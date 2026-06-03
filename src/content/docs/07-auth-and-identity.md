# memQL — Authentication & Identity

memQL ships its own authentication provider. There is no Auth0, no Keycloak, no external OIDC dependency in the critical path: a dedicated `identity` node-type binary owns magic-link login, OAuth-style token endpoints, the JWKS feed, and an admin web app, while every other binary in the cluster (`bff`, `voice`, `cognition`, `agent`, `planner`, `workbench`) verifies the resulting JWTs locally against the published public keys. The identity model is small and explicit: one `user` record per person, many `identity` credential rows per user, and a closed set of token families (interactive JWTs, PATs, worker tokens, guest invites, plus internal node / voice-agent / service-account JWTs). This document is the reference for that whole surface — the data model, the wire-level enforcement, every token type and its lifecycle, key management, the secrets envelope, and the places where the model deliberately chose a tradeoff or has a known gap.

---

## 1. The shape of the system

### 1.1 One identity binary, many verifiers

A cluster runs exactly **one** `identity` binary and **many** other binaries:

- The `identity` binary holds the Ed25519 signing key, mints tokens, publishes the JWKS feed at `/.well-known/jwks.json`, and serves the public auth web pages plus the `/admin/*` console. It is built and run via `make identity` (`go build -tags identity .`).
- Every other binary runs the per-node verifier middleware (`component/identity/verifier`), which fetches the public JWKS on a 5-minute background loop (and on demand for an unknown `kid`) and validates incoming JWTs locally. **They never see the private key.**

CLI clients (`memql-cockpit`, custom tooling) authenticate against the identity binary using Personal Access Tokens (`mql_pat_<...>`). Browser clients (the SPA, the identity web app itself) authenticate via magic link, then carry the resulting access JWT to `bff`/`voice`/etc.

Two distinct env vars configure the two sides:

- `IDENTITY_BASE_URL` — configures the identity service itself (its public origin; becomes the JWT `iss` claim and the base of email links).
- `IDENTITY_VERIFIER_BASE_URL` — configures a verifier node; the verifier fetches `${BASE}/.well-known/jwks.json` from it.

> **Dev no-auth mode.** Leaving `IDENTITY_VERIFIER_BASE_URL` unset on a non-identity node boots it into dev no-auth mode: a synthetic `local-dev` identity is stamped on every request. Convenient for solo development; never enable in production.

### 1.2 Three layers: authentication, identity, authorization

memQL separates three concerns:

- **Authentication** — *who are you.* Establishing the principal behind a request (magic-link login, PAT, guest token, etc.).
- **Identity** — *which credential you are using.* One human can have many credentials (a magic-link email, a PAT for CI, a worker token per machine). The credential is a separate record from the person.
- **Authorization** — *what you can do.* Enforced **per row**, inside DSL queries and mutations, gating on the authenticated actor.

The authorization layer underwent a significant change: the earlier per-partition ACL middleware has been removed (tracked under issue #56). Authorization is now enforced per row inside the DSL. Section 5 covers the model and the historical context honestly.

---

## 2. The identity concept family

All identity concepts are **global-scoped** (`@scope("global")`): their rows live in the reserved `_system` partition and are readable from every view. The wire-level partition selector does not hide them. The full schema lives in `dsl/identity/concepts.memql`.

### 2.1 `v1:identity:user` — the person

One record per human (or synthetic principal), deduplicated by `primaryEmail`. Key fields (from `concept user`):

```memql
concept user {
  displayName   string  @required
  firstName     string   // → JWT given_name claim
  lastName      string   // → JWT family_name claim
  primaryEmail  string  @required  // dedup key
  role          enum("owner", "admin", "writer", "reader")  @default("reader")
  internal      bool    @default("false")  // matched IDENTITY_INTERNAL_DOMAINS
  preferences { ... }    // theme, timezone, voice mode, computerUseEnabled kill switch, ...
  suspendedAt     datetime
  lastSeenAt      datetime
  legalAcceptance []object   // append-only ToS / Privacy history
  deletionScheduledAt datetime  // soft-delete request; honored by accountDeletionSweep cron
  revocationEpoch int       @default("0")  // bulk-revoke counter (see §6.4)
}
```

*Source: `dsl/identity/concepts.memql`*

The `role` enum is the cluster-wide role: `owner` / `admin` / `writer` / `reader`. The schema comment documents the historical meaning precisely: "owner bypasses the partition ACL; admin sees all partitions but still needs a per-partition grant to mutate data; writer and reader need an explicit grant for every partition they operate in." [VERIFY: that text reflects the pre-#56 partition model; with the partition ACL retired, see §5 for the current per-row enforcement.]

### 2.2 `v1:identity:identity` — a credential set

A credential owned by a user. One user can own many. The `identityType` enum is the discriminator for a `@variant` block on the `credentials` object:

```memql
concept identity {
  active        bool    @default("true")  // soft-delete / revocation flag
  userId        string  @required          // owning user
  identityType  enum("oauth", "api_key", "service_account", "magic_link",
                     "worker_token", "node_token", "voice_agent_token")  @required
  credentials   object  @required  @variant(discriminator="identityType") {
    oauth            { provider, externalUserId, scopes[] }
    api_key          { keyHash }                          // PAT: SHA-256, plaintext never stored
    service_account  { accountId }
    magic_link       { verifiedAt, lastLinkSentAt }
    worker_token     { name, keyHash, registeredBy, ... }
    node_token       { nodeId, nodeType, keyHash, mintedBy, ... }
    voice_agent_token{ instanceId, keyHash, mintedBy, ... }
  }
  usableByAgents bool @default("false")  // can v1:identity:delegation borrow this?
  lastUsedAt     datetime
}
```

*Source: `dsl/identity/concepts.memql`*

For every credential family that carries a secret (`api_key`, `worker_token`, `node_token`, `voice_agent_token`), only the SHA-256 hex hash of the token is persisted (`keyHash`). The plaintext is shown to the user exactly once at mint time and is never recoverable.

### 2.3 `v1:identity:authSession` — the session record

One row per access token issued by the magic-link / refresh flow, looked up on every authenticated request to enforce per-session revocation. Notable fields:

- `subject` (required) — the JWT subject; the canonical key for revoke-all. Populated unconditionally so all-sessions revoke works even before the user row is bootstrapped.
- `tokenHash` (required) — SHA-256 of the bearer token; the hot-path lookup key.
- `expiresAt`, `firstAuthenticatedAt`, `lastRefreshedAt` — drive expiry, max-age, and idle-timeout policy.
- `refreshTokenHash`, `previousRefreshTokenHash`, `previousRotatedAt` — refresh-rotation bookkeeping plus a 30-second grace window (see §4.4).
- `revokedAt`, `revokedReason` (`user_action` / `all_sessions` / `admin`).

*Source: `dsl/identity/concepts.memql` (`concept authSession`)*

### 2.4 The credential / flow concepts

| Concept | Purpose |
|---|---|
| `v1:identity:magicLinkRequest` | One row per `/auth/magic-link` issuance. Stores only the SHA-256 `tokenHash`; single-use via atomic `consumedAt`; rejected past `expiresAt`. |
| `v1:identity:authCode` | One-time OAuth authorization code (RFC 6749 §4.1 style), `clientId`- and `redirectURI`-bound, ~60s TTL, single-use via `consumedAt`. |
| `v1:identity:invitation` | Token-hashed invitation for guest invites (`kind=guest`) and admin-issued user invitations (`kind=user`). |
| `v1:identity:accessRequest` | Waitlist-mode self-service access request; admins triage in the console. Carries a composite `riskScore` + `riskSignals`. |
| `v1:identity:delegation` | Grants an agent the right to act through a user's identity for a bounded role ceiling, scope set, and lifetime (see §6.6 — interface-only today). |
| `v1:identity:auditEvent` | Append-only audit log; categories `auth` / `identity` / `authorization` / `configuration` / `admin` / `data`. |
| `v1:identity:clusterSettings` | Single-row (`id='cluster'`) runtime-editable config; the admin app edits it, and `Service.LiveConfig()` reads it first, falling back to env. |
| `v1:identity:workerPairingCode` | Short-lived `XXXX-XXXX` pairing code for the computer-use enrollment flow (see §4.6). |
| `v1:identity:group` | Organization group. Users belong to groups; agents are assigned to groups for scoped access. Created/managed in-app; `externalId` preserved for legacy synced rows. |

There is **no** `v1:identity:partitionAccess` concept in the current tree — it was removed with the partition layer. (The docs under `docs/auth/` still describe it; see §5 for the discrepancy and the current truth.)

---

## 3. Token families

memQL has one signing key and one verifier, but several token *classes*. The class is carried in the JWT `class` claim (or implied by a token prefix for non-JWT credentials), and surface-pinning interceptors keep each class on the wire it belongs to.

### 3.1 The JWT and its claims

Every interactive login produces an EdDSA-signed JWT. The claims struct is the stable contract every node validates against:

```go
type AccessTokenClaims struct {
    Email           string            `json:"email,omitempty"`
    Name            string            `json:"name,omitempty"`
    GivenName       string            `json:"given_name,omitempty"`
    FamilyName      string            `json:"family_name,omitempty"`
    Role            string            `json:"role,omitempty"`
    Internal        bool              `json:"internal,omitempty"`
    Partitions      map[string]string `json:"partitions,omitempty"`
    SessionId       string            `json:"sid,omitempty"`
    RevocationEpoch int64             `json:"revocation_epoch,omitempty"`
    Class           string            `json:"class,omitempty"`   // user/node/voice_agent/service_account
    NodeId          string            `json:"node_id,omitempty"`
    NodeType        string            `json:"node_type,omitempty"`
    jwt.RegisteredClaims                                          // iss, sub, aud, iat, nbf, exp, jti
}
```

*Source: `component/identity/jwt.go`*

- `sub` is the canonical `v1:identity:user.id` for a user token (for node / voice-agent / service-account tokens it is the issuing `v1:identity:identity` row id instead).
- `sid` is the `authSession.id`; every refresh keeps the same `sid` so a per-device revoke can target it.
- `revocation_epoch` is a per-user counter snapshot — the basis of bulk revocation (§6.4).
- The `Partitions` claim and `actor.partitions` envelope field are legacy; the partition layer was removed and the actor envelope no longer exposes them (§5.3).

The four token classes (`component/identity/jwt.go`):

| Class constant | `class` value | Wire surface | Subject |
|---|---|---|---|
| `ClassUser` | `""` / `"user"` | full `MemqlService.Stream` | `v1:identity:user.id` |
| `ClassNode` | `"node"` | `NodeService.Stream` only | node_token identity id |
| `ClassVoiceAgent` | `"voice_agent"` | `MemqlService.Stream`, pinned to `VoiceAgent*` payloads | voice_agent_token identity id |
| `ClassServiceAccount` | `"service_account"` | `MemqlService.Stream`, pinned to a read/query surface | a stable machine principal id |

An empty `class` claim is treated as `ClassUser` for backward compatibility — the issuer normalizes `"user"` to empty before signing.

### 3.2 Signing and verification

Tokens are signed with `jwt.SigningMethodEdDSA` and verified with an explicit method allow-list, which closes the classic `alg: none` downgrade attack:

```go
parsed, err := jwt.ParseWithClaims(raw, &AccessTokenClaims{}, func(t *jwt.Token) (any, error) {
    if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
        return nil, fmt.Errorf("unexpected signing method %v (expected EdDSA)", t.Method.Alg())
    }
    // ... resolve kid against current, then previous (overlap window) ...
},
    jwt.WithIssuer(j.issuer),
    jwt.WithAudience(j.audience),
    jwt.WithValidMethods([]string{"EdDSA"}),
    jwt.WithLeeway(30*time.Second),
    jwt.WithTimeFunc(func() time.Time { return now }),
)
```

*Source: `component/identity/jwt.go` (`VerifyAccessToken`)*

The verify path checks signature (against the `kid`-selected key, current then previous), `iss`, `aud`, and `exp`/`nbf` with 30s leeway. The same EdDSA key validates user, node, voice-agent, and service-account tokens — they differ only in claims, not in signing material.

### 3.3 Personal Access Tokens (`mql_pat_<...>`)

Long-lived bearer credentials for CLI clients, stored as `identityType="api_key"` rows. Wire format and minting:

```go
const TokenPrefix = "mql_pat_"
const tokenRandomBytes = 32  // 256 bits → 43 base64url-no-pad chars

func Mint() (plain, hash string, err error) {
    buf := make([]byte, tokenRandomBytes)
    if _, err := rand.Read(buf); err != nil { return "", "", err }
    body := base64.RawURLEncoding.EncodeToString(buf)
    plain = TokenPrefix + body          // shown ONCE; never recoverable
    hash = Hash(plain)                  // SHA-256 hex; this is what persists
    return plain, hash, nil
}
```

*Source: `component/identity/pat/token.go`*

The `mql_pat_` prefix lets the gRPC interceptor fan out between the PAT path and the JWT path without speculatively parsing either format. PATs are verified **only by the identity binary** — they are rejected on `bff`/`voice`/etc., where the verifier handles JWTs. CLI clients hit the identity binary directly. Revocation is row-state (`active=false` on the identity row); PATs are intentionally exempt from the revocation-epoch check (§6.4), which lives on the user row and only applies to JWTs.

### 3.4 Worker tokens (`mql_wkr_<...>`)

Credentials for the computer-use ("workers") feature, stored as `identityType="worker_token"` rows. Identical mint shape to PATs (32 random bytes → `mql_wkr_<43 chars>`, SHA-256 hash persisted), but with strict surface pinning:

> "The interceptor admits worker tokens ONLY on WorkerService paths and rejects them on every other RPC."
> *Source: `component/identity/workertoken/token.go`*

A worker token on any non-`WorkerService` path returns `PermissionDenied`; a Bearer JWT on `WorkerService.Stream` returns `Unauthenticated`. Worker tokens are scoped to a single owning user, revoked by flipping `active=false`, and (as of #97) have their `ExpiresAt` enforced at admit time. The credential variant carries advertised capability/label snapshots and a 90-day auto-rotation window driven by `expiresAt`.

### 3.5 Guest tokens

Guests authenticate with `Authorization: Guest <token>` (or `?guest_token=<token>` on the WebSocket bridge, since browsers cannot set custom headers on the WS upgrade). The `NewGuestAwareStreamInterceptor` validates the token against the invitation registry and builds a guest `AccessContext`: `actor.userId` is empty, `actor.role` is `guest`, and the surface is limited to the explicitly-scoped reads on the invitation. Token lookup is by SHA-256 hash; as of F9 (#98) the interceptor stows the `tokenHash` on the claims rather than the plain token.

### 3.6 Node and voice-agent service-account tokens

Two internal classes mint through dedicated issuer methods (`IssueNodeAccessToken`, `IssueVoiceAgentAccessToken` in `component/identity/jwt.go`):

- **Node tokens** (`class="node"`) authenticate cluster-internal binaries on `NodeService.Stream`. The claims bind `node_id` and `node_type`; the NodeService interceptor cross-checks `NodeHello.NodeId` / `NodeType` against the token, so a token minted for one node cannot announce as another (#105). Operators inject the plaintext as `MEMQL_NODE_TOKEN`. No refresh path — rotate by minting fresh and restarting the binary. The on-disk credential is `identityType="node_token"`, and the identity binary can also self-mint via `POST /node/bootstrap`.
- **Voice-agent tokens** (`class="voice_agent"`) authenticate the Go voice-agent process on `MemqlService.Stream`, pinned to `VoiceAgent*` payload types so a leaked credential can't drive other RPCs (#109). The instance id rides the `node_id` claim slot for audit attribution. Default TTL 90 days; rotate = mint fresh + restart.

> **Discrepancy with the project CLAUDE.md.** The top-level project CLAUDE.md describes voice-agent auth as a shared-secret bearer (`mql_va_<...>` / `VOICE_AGENT_SHARED_TOKEN`). The current public-repo code path is the EdDSA `class="voice_agent"` JWT (#109), and the `voice_agent_token` concept variant notes "the JWT replaces the legacy `VOICE_AGENT_SHARED_TOKEN` shared secret on a release-deprecation cycle." Treat the JWT path as current.

### 3.7 Operator master key

`MEMQL_MASTER_KEY` admits `Authorization: Operator <key>` via `NewOperatorAwareStreamInterceptor` for bootstrap before any users exist (and for break-glass). The threat model is explicit that this key lands in `/proc/self/environ`; the trust assumption is that it's used only for initial cluster bootstrap and rotated after the first admin user is created, and injected via a secrets manager rather than plain env (`docs/auth/threat-model.md` §5.5).

---

## 4. The login and session flow

### 4.1 Registration modes

Set via `IDENTITY_REGISTRATION_MODE` (and editable at runtime on `clusterSettings`):

| Mode | Who can register |
|---|---|
| `open` | Anyone with any email (default for new clusters). |
| `domain_restricted` | Email must match `IDENTITY_REGISTRATION_DOMAINS`. |
| `invite_only` | No self-registration; users enter only via admin invitations. |
| `waitlist` | Users submit access requests; admins approve into invitations. |

### 4.2 Magic-link flow (the primary path)

1. User enters their email at `/auth/login`; the form posts to `/auth/magic-link`.
2. The handler runs the anti-abuse middleware (per-IP rate limit, optional Cloudflare Turnstile, disposable-email blocklist, MX-record validation, composite risk score). A rejection records an audit event with `action=magic_link_blocked` + a `failureReason` and returns a generic message.
3. The issuer mints a single-use token, stores only its SHA-256 hash on a fresh `v1:identity:magicLinkRequest` row, and sends the email via the `email` integration plug-in.
4. The user clicks the link, landing at `/auth/complete?token=...`.
5. The verifier consumes the token atomically (sets `consumedAt`), resolves the email, and either logs in an existing user or provisions a new one — then issues an access + refresh token pair and creates a `v1:identity:authSession` row.

*Source: `docs/auth/user-provisioning.md`; verifier at `component/identity/magiclink/verifier.go`*

User-row creation happens in exactly one place — `Store.CreateUserOnFirstLogin` on the magic-link verification path. There is no `session.opened` auto-provision automation (an earlier `bootstrapIdentity` backstop was retired because it created phantom rows for synthetic dev-mode subjects).

### 4.3 First-user-is-owner and the bootstrap wizard

The first user to register (regardless of mode) is promoted to cluster `role=owner` so the cluster has a manageable admin from the start. This is the "bootstrap path" in the verifier — the `/setup` wizard captures the owner's profile, and the verifier promotes to `owner` and marks `internal` on the wizard-issued owner-mint:

```go
// Bootstrap path: this is the wizard-issued owner-mint. Always
// promote to owner, mark internal so the user gets the ...
role = "owner"
```

*Source: `component/identity/magiclink/verifier.go`*

Internal-domain users (email matched `IDENTITY_INTERNAL_DOMAINS`) get `IDENTITY_INTERNAL_DEFAULT_ROLE` (default `writer`); external users historically started with no cluster role and an owner grant on a fresh personal partition.

### 4.4 Token lifetimes and refresh rotation

Default lifetimes (all overridable via `IDENTITY_*` env or the live `clusterSettings` row):

| Setting | Default | Notes |
|---|---|---|
| `IDENTITY_ACCESS_TOKEN_TTL_SECONDS` | 900 (15 min) | Short by design — limits XSS blast radius. |
| `IDENTITY_REFRESH_TOKEN_TTL_SECONDS` | 2,592,000 (30 d) | Absolute lifetime; idle/max-age policies enforce earlier. |
| `IDENTITY_MAGIC_LINK_TTL_SECONDS` | 600 (10 min) | |
| `IDENTITY_SESSION_IDLE_DAYS` | 14 | Refresh fails if `lastRefreshedAt + idle < now`. |
| `IDENTITY_SESSION_MAX_DAYS` | 90 | Refresh fails if `firstAuthenticatedAt + max < now`. |

Refresh tokens are one-time-use and rotated on every `/auth/refresh`. The rotator persists the immediately-previous refresh hash (`previousRefreshTokenHash` + `previousRotatedAt`) and accepts it for a 30-second grace window — covering the "SPA hard-refreshed mid-rotation" race where the server already minted the new pair but the browser aborted before consuming the `Set-Cookie`. The window is hard-coded as `previousRefreshGraceWindow = 30 * time.Second` in `component/identity/refresh/rotate.go`. Presenting a stale refresh token outside the grace window is treated as theft and revokes the entire session.

### 4.5 Invitations and account deletion

Invitations (`v1:identity:invitation`) back two flows: guest invites (a space owner sends `SendGuestInviteMsg`; the guest authenticates with `Authorization: Guest <token>`) and admin/waitlist user invitations (the recipient lands in registration with the invitation token pre-bound). Tokens are SHA-256-hashed; plaintext is shown once.

Account deletion is a soft request: `/me/delete` stamps `deletionScheduledAt`, and the `accountDeletionSweep` cron performs the cascade after `IDENTITY_DELETION_COOLDOWN_DAYS` — hard-deleting the user and all their identity / session rows, but **tombstoning** (`<deleted:hash>`) audit / access-request / invitation references to preserve the trail. `mutationCancelScheduledDeletion` aborts during cooldown.

### 4.6 Worker pairing (computer-use enrollment)

A short-lived `XXXX-XXXX` pairing code (`v1:identity:workerPairingCode`, ~10 min TTL) bridges the SPA and the cockpit worker. CoPresent's "Connect this computer" card mints a code; the cockpit redeems it on the gRPC stream via `Authorization: Pair <code>`, and the redeem handler mints a `worker_token` identity owned by the same user and returns the plain `mql_wkr_<...>` token plus the cluster URL. Single-use via `redeemedAt`. The `/pair/codes` and `/pair/redeem` HTTP endpoints are HTTPS-required (see §7).

---

## 5. Authorization: per-row, and the partition story

This is the area where the docs and the code have drifted, so it is worth being precise.

### 5.1 What the code does now

Authorization is enforced **per row** inside DSL queries and mutations, gating on the authenticated actor. Every query and mutation falls into exactly one of four buckets, classified and tested at load time (`docs/auth/threat-model.md` §3 and `docs/auth/per-row-authz-audit.md`):

| Bucket | Filter shape | Example |
|---|---|---|
| **Owned** | `payload.ownerUserId == actor.userId` | `queryActiveSpaces`, `queryOwnedSpaceById` |
| **Granted** | a relationship predicate gates on `actor.userId` | `querySpaceParticipants` |
| **Admin** | composes `spec("requiresClusterOwner")` | admin-only mutations |
| **Public** | `@public` annotation (a validator marker, no runtime effect) | `/.well-known/jwks.json`, the concept schema feed |

The conformance test `dsl.TestPerRowAuthzClassification` hard-fails on any new unclassified construct, so the classification cannot silently drift.

### 5.2 The partition layer was removed

memQL previously used partitions as a hard isolation boundary: a request authenticated as user X could only read rows under partition X, enforced by a `PartitionACL` middleware. Issue #56 removed partitioning, and the per-row authz audit (shipped 2026-05-20) was the prerequisite — every read/write path needed an explicit caller-check before the partition safety net came out, so removal didn't demote defense-in-depth to a single point of failure. The actor envelope no longer exposes `actor.partitions` / `actor.partition`; the parser rejects both with a migration hint (`docs/auth/actor-envelope.md` §field-reference).

> **Honest note on the docs.** Several files under `docs/auth/` (notably `access-model.md`, and the top-level project CLAUDE.md's "strict isolation" section) still describe the per-partition ACL middleware, `CheckPartition`, `scopeGraphPatternToPartition`, and the `v1:identity:partitionAccess` concept as live. They are stale relative to the code: there is no `partitionAccess` concept in `dsl/identity/concepts.memql`, no `CheckPartition` / `PartitionACL` symbol in `component/`, and `access-model.md` itself opens with a status banner stating the ACL layer "has been retired (phase 4)." The current truth is per-row authorization on the actor envelope. Where this doc cites partition-era role semantics (e.g. §2.1), they are flagged as historical.

### 5.3 The actor envelope

`actor.*` is the single source of authorization input to the DSL. The auth interceptor validates the credential, builds an `auth.Identity`, and the engine binds it onto the request context; DSL code reads it back as read-only dotted paths:

| Field | Meaning |
|---|---|
| `actor.userId` | Canonical `v1:identity:user.id`. Empty for guest and system actors. |
| `actor.role` | Cluster role (`owner`/`admin`/`writer`/`reader`, plus `system` and `guest`). Re-fetched per request — a demotion takes effect on the next call, not the next refresh. |
| `actor.identityId` | The `v1:identity:identity.id` of the credential used (distinct from `userId`). |
| `actor.isClusterOwner` | True iff the actor is the registered cluster owner. |
| `actor.primaryEmail` | The user's primary email (empty for guest/system/worker). |
| `actor.now` | RFC3339 timestamp captured once at request start — the only clock DSL evaluators may use. |
| `actor.config.<key>` | Allow-listed config (whitelist in `component/config/policy_exposable.go`); an unlisted key is a parse-time error. |

*Source: `docs/auth/actor-envelope.md`*

The envelope says *who* the actor is, not *what* they can do — permissions are composed on top of it via specs and policies. It is captured once at request entry, never mutated mid-call, and never cached across requests. The `caller.` / `@caller` spelling was retired in #221 in favor of `actor.` / `@actor`.

### 5.4 Owner/admin deploy-control actions

The Deployment Console (the `deploycontrol` gRPC surface; see the cluster-and-deployment doc §5.9) adds a class of **owner/admin-gated write actions** — `deploy` / `promote` / `rollback` / `rollout`. They are gated on `actor.role ∈ {owner, admin}` like any other privileged surface, and every invocation is **audited** (actor, action, target version/env, outcome). These are operational deploy controls, not data-plane authz: they govern who may move the *cluster* between versions, recorded in the same audit trail as the rest of the platform (§8).

---

## 6. Key management and revocation

### 6.1 On-disk keys and at-rest encryption

Ed25519 signing keys live in `IDENTITY_KEY_DIR`:

- `jwt-current.ed25519` — the active signing key.
- `jwt-previous.ed25519` — present only during a rotation overlap window; the retiring `kid` stays in JWKS so in-flight tokens still verify.

Files are 0600, the directory 0700. With `IDENTITY_KEY_ENCRYPTION_KEY` set, the private bytes are wrapped in AES-256-GCM under an Argon2id-derived key; with it unset (dev only), private bytes are plaintext. The Argon2id parameters target OWASP 2024 minimums:

```go
const (
    argonTime    uint32 = 2
    argonMemory  uint32 = 64 * 1024 // 64 MiB
    argonThreads uint8  = 1
    argonKeyLen  uint32 = 32 // AES-256 key
    argonSaltLen        = 16
)
```

*Source: `component/identity/keys.go`*

`Config.Validate()` makes encryption-at-rest mandatory in production: if `IDENTITY_BASE_URL` is not a localhost origin and `IDENTITY_KEY_ENCRYPTION_KEY` is empty, startup fails. The `kid` is the base64url of the first 8 bytes of `sha256(publicKey)`.

### 6.2 envMode: stateless HA replicas

For high-availability deployments, identity can derive its signing key from an env-provided seed instead of a PVC. `NewKeyManagerFromSeed` (`component/identity/keys.go`) takes a base64 32-byte Ed25519 seed (`IDENTITY_SIGNING_KEY_B64`) and derives the same keypair + `kid` + JWKS on every replica deterministically — so identity needs no single-writer key volume and can run ≥2 replicas. In envMode, `Load()` is a no-op, there is never a previous key, and `Rotate()` is refused:

```go
if km.envMode {
    return nil, errors.New("identity: key rotation is disabled when the signing key is env-provided ...; re-seal the envelope with a new seed and roll the deployment to rotate")
}
```

*Source: `component/identity/keys.go` (`Rotate`)*

### 6.3 Rotation and JWKS

Two rotation paths (disk-key mode only): a cron goroutine triggers `KeyManager.Rotate` every `IDENTITY_KEY_ROTATION_DAYS` (default 90), and the admin UI's "Rotate now" button calls the same path. The retired key stays in JWKS for `IDENTITY_JWKS_OVERLAP_HOURS` (default 24), then a sweep hard-removes it. Other nodes pick up the new `kid` on their next 5-minute JWKS refresh, or on demand when they encounter a token signed under an unknown `kid`.

The JWKS feed serves RFC 7517 + RFC 8037 OKP/Ed25519 keys with a short cache TTL and permissive CORS:

```go
out.Keys = append(out.Keys, JWK{
    Kty: "OKP", Alg: "EdDSA", Use: "sig", Crv: "Ed25519",
    Kid: k.KID, X: k.PublicB64,
})
// ... Cache-Control: public, max-age=300 ; Access-Control-Allow-Origin: *
```

*Source: `component/identity/jwks.go`*

### 6.4 Revocation: sessions and the epoch

Two mechanisms revoke a credential:

- **Per-session revocation** — `NewSessionRevocationStreamInterceptor` hashes the bearer token at stream-open and rejects when it matches a revoked `v1:identity:authSession` row. This check runs at stream-open only and **fails open** on engine unavailability with a WARN log (JWT expiry remains the underlying guarantee).
- **Revocation epoch (bulk revoke, #106)** — every user row carries a monotonic `revocationEpoch`; the issuer stamps it into every JWT as `revocation_epoch`. The verifier rejects any JWT whose claim is below the user's current row value, both at stream-open and on a periodic per-stream re-check (default 5 minutes). When the epoch advances mid-stream, the derived context is cancelled and long-lived streaming RPCs shut down:

```go
if vc.RevocationEpoch < cur {
    // logged, then:
    return status.Error(codes.Unauthenticated, "token revoked")
}
// ... and a per-stream re-check goroutine cancels on advance:
go runEpochRecheck(derived, logger, info.FullMethod, vc, epoch.Resolver, interval, cancel)
```

*Source: `component/identity/verifier/interceptor.go`*

The epoch path fails closed (rejects on resolver error) because the resolver is the local engine. PATs bypass the epoch check entirely — PAT revocation is row-state on `v1:identity:identity`, not claim-state. The epoch only applies to JWTs (`Source == SourceJWT`).

### 6.5 The interceptor stack

The full `MemqlService.Stream` interceptor stack, innermost → outermost (`app/transport.go`, per `docs/auth/threat-model.md` §1.1):

1. `verifier.StreamInterceptor()` — JWT signature validation via the per-node JWKS verifier.
2. `NewSessionRevocationStreamInterceptor()` — rejects revoked-session tokens.
3. `NewGuestAwareStreamInterceptor()` — admits `Authorization: Guest <token>`.
4. `NewOperatorAwareStreamInterceptor()` — admits `Authorization: Operator <MEMQL_MASTER_KEY>`.
5. `NewVoiceAgentStreamInterceptor()` — pins voice-agent tokens to `VoiceAgent*` payloads.
6. `NewServiceAccountStreamInterceptor()` — pins `class="service_account"` tokens to the read/query surface.
7. `NewPanicRecoveryStreamInterceptor()` — wraps the entire chain; catches downstream panics and surfaces them as `codes.Internal`.

`NodeService.Stream` uses the same stack but is pinned to `class="node"` JWTs (#105) — user JWTs, PATs, and worker tokens are all rejected at that surface.

### 6.6 Delegation (not yet implemented)

`v1:identity:delegation` and `component/auth/delegation_resolver.go` exist for an "agent acts on a user's behalf" pattern with a bounded `roleCeiling`, `scopes`, and `expiresAt`. As of the threat model (§5.6) the resolver is **interface-only**: no in-tree implementation populates a delegation, so the surface is a no-op today. When implementations land, every delegation must carry a role no greater than the delegating user's, a scope that narrows theirs, and a lifetime shorter than their session.

---

## 7. The secrets envelope and transport security

### 7.1 Two configuration tiers

memQL splits configuration (`docs/guides/env-vars.md`):

1. **Bootstrap envelope** — the small set of OS env vars the process must see before it can read anything else: where Postgres is, what node this is, and the master encryption key. There is no encrypted-at-rest path for these — they live in plain env (compose files in dev, the Cloud Run service manifest in prod).
2. **Concept storage** — everything else (vendor API keys, OAuth client secrets, model defaults, feature flags), stored in memQL concepts and seeded via the `make secrets-*` / `make variable-*` workflow. Encrypted secrets sit on `v1:platform:partitionSecret` / `v1:platform:globalSecret`.

The envelope is kept deliberately tiny so rotating an API key or adding a tenant's BYOK credential never requires a redeploy.

### 7.2 Secret encryption (`MEMQL_MASTER_KEY`)

The `component/secret` package provides authenticated symmetric encryption using NaCl secretbox (XSalsa20-Poly1305) under a single 32-byte master key from `MEMQL_MASTER_KEY` (64 hex chars). Two surfaces:

- **Per-value** `Encrypt`/`Decrypt` — seals one secret string for storage in a concept row, output `base64(nonce(24B) || secretbox_seal(plaintext))`. Returns a `Fingerprint` (last 4 chars) so the UI can show rotated values without revealing the secret.
- **Whole-blob** `SealBlob`/`OpenBlob` — seals a full byte slice with a versioned `ZNAS`-magic header for on-disk artifacts like `~/.memql/genesis.znas`.

```go
func masterKey() (*[32]byte, error) {
    raw := strings.TrimSpace(os.Getenv(EnvMasterKey))
    if raw == "" {
        return nil, fmt.Errorf("%s is not set; encrypted secrets cannot be used without it", EnvMasterKey)
    }
    // ... must decode to exactly 32 bytes ...
}
```

*Source: `component/secret/encryption.go`*

Encryption fails loudly (rather than writing cleartext) when the master key is missing or malformed. NaCl secretbox was a deliberate Phase 1 choice: the simplest authenticated symmetric primitive that works everywhere the platform runs, with no KMS dependency.

> Note: the identity service's signing-key wrapping (§6.1) uses a *separate* secret (`IDENTITY_KEY_ENCRYPTION_KEY`, AES-256-GCM + Argon2id), distinct from the `MEMQL_MASTER_KEY` that drives `component/secret`. Two independent at-rest encryption mechanisms for two independent concerns.

### 7.3 The genesis secrets manifest

`component/genesis` is the dev-secrets provisioning layer baked into the cockpit binary. It defines a manifest (`manifest.yaml`) of every secret and variable an operator must supply, and validates an operator's `.env` against that floor. The manifest distinguishes required entries from `optional: true` ones (which are documented + sealed-when-present but not part of the strict-superset floor). For example, `IDENTITY_SIGNING_KEY_B64` is optional in the manifest because it's required for the HA envMode deploy but absent in local disk-key mode:

```yaml
- name: IDENTITY_SIGNING_KEY_B64
  scope: global
  kind: integration
  optional: true
  description: Base64 (std) 32-byte Ed25519 signing seed ... every replica derives
    the SAME key + kid + JWKS from this seed ... Optional here so local seals don't
    fail; staging/prod envelopes MUST carry it.
```

*Source: `component/genesis/manifest.yaml`*

The manifest resolves in priority order — a `--manifest` flag, then `MEMQL_MANIFEST_PATH`, then `$MEMQL_REPO/scripts/secrets/manifest.yaml`, then the embedded snapshot (`component/genesis/manifest.go`, `LoadManifest`).

The CLI `token` subcommands now **autoload the genesis envelope** (#751): when run with envelope autoload enabled, token minting/inspection resolves shared secrets (e.g. the signing seed) from the genesis envelope the same way the engine does at boot, so the CLI and the running cluster agree on the signing material without the operator wiring it by hand.

### 7.4 BYOK — honest status

The Portal exposes a Bring-Your-Own-Key surface so an operator can supply their own vendor API key per tenant. **The storage half is built; the runtime half is not.** From the Portal handoff doc:

> "The Portal can collect BYOK keys today and they're stored securely, but the runtime AI-call path still uses the platform's own vendor keys. A separate backend change will flip the runtime to use the Operator's BYOK key when present."
> *Source: `docs/planning/portal-ai-router-handoff.md` §"Open items"*

Server-side encryption is mandatory for the BYOK save path (plaintext over TLS, encrypted server-side before persistence, never returned), and the save fails with an actionable error when the platform encryption key isn't configured. But until the runtime activation change lands, a stored BYOK key does not yet override the platform vendor key at AI-call time. This is a known gap, not a bug.

### 7.5 Transport security

- **gRPC** defaults to insecure transport when no TLS env vars are set — the legacy posture for deployments behind a TLS-terminating proxy (Cloud Run, Cloudflare, an mTLS load balancer). Opt-in direct TLS / mTLS is available via `MEMQL_GRPC_TLS_CERT_FILE` + `MEMQL_GRPC_TLS_KEY_FILE` (+ `MEMQL_GRPC_TLS_CLIENT_CA_FILE` for optional mTLS, + `MEMQL_GRPC_REQUIRE_CLIENT_CERT=1` for required mTLS); the key file is rejected at load if its mode permits group/other access. Trust assumption: the cluster runs behind a TLS-terminating proxy and the gRPC port is not exposed to untrusted networks (`docs/auth/threat-model.md` §5.8).
- **Pair endpoints are HTTPS-required.** `/pair/codes` and `/pair/redeem` carry plaintext credentials, so `requireSecureRequest` rejects HTTP-only requests with `errorCode: insecure_transport`, honoring `X-Forwarded-Proto: https` from the proxy. A dev escape hatch (`MEMQL_IDENTITY_ALLOW_INSECURE_PAIR=1`) logs a WARN on every use. *Source: `component/identity/http/pair.go`.*
- **WebSocket origin policy.** The `/memql/ws` bridge consumes `MEMQL_WS_ORIGIN_PATTERNS` (a comma-separated glob list). When unset it falls back to the legacy wildcard and emits a WARN on every upgrade; production deployments must populate it.
- **Cookies.** The `memql_auth` cookie is `HttpOnly`, `Secure` (when `X-Forwarded-Proto: https`), and `SameSite=Lax` (configurable to `none` for true cross-site SPA/identity topologies via `refreshCookieSameSite`).

---

## 8. Audit and observability

Every auth lifecycle moment lands on `v1:identity:auditEvent` (in addition to slog). The concept is append-only with a coarse `category` (`auth` / `identity` / `authorization` / `configuration` / `admin` / `data`), a lower_snake_case `action`, full actor attribution (`actorUserId` / `actorEmail` / `actorRole` / `actorIdentityId`), target attribution, `outcome` (`success` / `failure` / `blocked`), and a `failureReason`. A `correlationId` groups the events of one logical interaction (e.g. a single login flow's attempt + magic-link issued + magic-link consumed + session created). The `prevEventHash` field is reserved for a future hash-chain tamper-resistance feature — written from day one but not yet validated. Retention is controlled by `IDENTITY_AUDIT_LOG_RETENTION_DAYS` (default 365) via a daily sweep. On user deletion, audit rows are tombstoned rather than removed, preserving the trail.

Operationally: `GET /healthz` returns 200 once the key manager has loaded, `GET /.well-known/jwks.json` always reflects the current public key set, and the admin UI's JWKS panel shows live key metadata (`kid`, `createdAt`, `retiresAt`) and the rotation cadence.

---

## 9. Quick reference

| Topic | Where it lives |
|---|---|
| JWT claims, issuer, all four token classes | `component/identity/jwt.go` |
| Key management, envMode HA seed, at-rest encryption | `component/identity/keys.go` |
| JWKS document + handler | `component/identity/jwks.go` |
| Per-node verifier + revocation epoch | `component/identity/verifier/interceptor.go` |
| PAT mint/hash | `component/identity/pat/token.go` |
| Worker-token mint/hash | `component/identity/workertoken/token.go` |
| Magic-link verify + first-user-owner | `component/identity/magiclink/verifier.go` |
| Refresh rotation + grace window | `component/identity/refresh/rotate.go` |
| Pair-endpoint HTTPS enforcement | `component/identity/http/pair.go` |
| Identity concept family (schema) | `dsl/identity/concepts.memql` |
| Per-value + whole-blob secret encryption | `component/secret/encryption.go` |
| Secrets manifest / genesis envelope | `component/genesis/manifest.go`, `component/genesis/manifest.yaml` |
| Operator narrative, env vars, key rotation | `docs/auth/identity-service.md` |
| Auth threat model (authoritative) | `docs/auth/threat-model.md` |
| Actor envelope contract | `docs/auth/actor-envelope.md` |
| Per-row authorization audit | `docs/auth/per-row-authz-audit.md` |

> **A note on the docs vs. code.** Several `docs/auth/*` files and the project CLAUDE.md still describe the retired partition ACL and the shared-secret voice-agent path. Where this document and those files conflict, the code (cited inline above) is authoritative, and `docs/auth/threat-model.md` is the most current narrative doc.
