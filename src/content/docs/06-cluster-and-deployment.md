# memQL — Cluster Architecture & Deployment

memQL runs either as a single process or as a distributed mesh of role-specialized nodes. Each role — `bff`, `voice`, `cognition`, `agent`, `planner`, plus the `identity` auth service and a `workbench` sandbox node — is a *separate binary compiled from the same source tree* via Go build tags, so each ships only the packages it needs. The nodes find each other over a DB-backed peer table, connect with a single bidirectional gRPC stream (`NodeService.Stream`), bridge graph events across the mesh with dedup + TTL, and serialize cluster-wide singleton work (cron, event-triggered automations) behind Postgres advisory locks and a claim table. In production the mesh runs on **Azure Kubernetes Service** (AKS), reconciled by **Argo CD** from a digest-pinned Git overlay, with **Argo Rollouts** driving blue/green (BFF) and canary (engine nodes) progressive delivery, **External Secrets Operator** syncing secrets from Azure Key Vault, and a managed **Tiger Cloud** (TimescaleDB) database. This document covers all of it, grounded in the current `main` branch.

> Hosting note: memQL was previously deployed on Google Cloud Run. That is retired. The current target is **Azure AKS** (`acrmemql.azurecr.io` for images, Tiger Cloud for the database). Some inline code comments still reference Cloud Run — those are stale; the manifests and deploy scripts are AKS.

---

## 1. Node types and the build-tag model

### 1.1 The roles

| Type | Build tag | Purpose | Approx. binary size |
|------|-----------|---------|---------------------|
| **bff** | (none, default) | Backend for frontend; mesh hub; `/memql/ws` | ~25 MB |
| **voice** | `voice` | Voice transport (audio WS, LiveKit); `/memql/audio` | ~30 MB |
| **cognition** | `cognition` | Routing + conductor + Polyphon pipeline | ~35 MB |
| **agent** | `agent` | Task execution, SI work, tool calling | ~43 MB |
| **planner** | `planner` | Task planning and orchestration | ~25 MB |
| **identity** | `identity` | Magic-link auth, JWT issuance, JWKS, admin UI | — |
| **workbench** | `workbench` | Sandboxed per-Plan Linux working environment | — |

Build tags are **mutually exclusive** — never combine them (e.g. `-tags "bff cognition"`).

```bash
go build -o bin/memql .                       # bff (default, no tag)
go build -tags voice     -o bin/memql-voice .
go build -tags cognition -o bin/memql-cognition .
go build -tags agent     -o bin/memql-agent .
go build -tags planner   -o bin/memql-planner .
```
Source: `docs/core/build-tags.md`

The Docker build threads the tag through a build-arg:

```dockerfile
ARG BUILD_TAGS=""
ARG CGO_ENABLED=0
# ...
RUN CGO_ENABLED=${CGO_ENABLED} GOOS=linux GOARCH=amd64 \
    go build -tags "${BUILD_TAGS}" -ldflags="-s -w" -o /app/bin/memql .
```
Source: `Dockerfile`

The CGO-free node types build static binaries and run on `gcr.io/distroless/base-debian12`. The **voice** node is the exception: it links `libopus`/`opusfile`/`soxr` via CGO (LiveKit media SDK), so it builds with `CGO_ENABLED=1` and runs on a `debian:12-slim` runtime stage (`--target voice-runtime`) that carries the shared libraries.

### 1.2 Why tags instead of a runtime flag

The `app/` package contains build-tagged `Build()` entry points and per-node integration/transport files. Excluding an *import* of an unused integration package is what actually shrinks the binary and the attack surface; the `.memql` DSL files (~212 KB total) are always `//go:embed`-baked regardless of tag. The key principle from the build-tags doc:

> The key principle: move **import statements** to tag-specific files. Excluding a Go package import is what actually reduces binary size.

Common constraint patterns:

```go
//go:build !voice && !cognition && !agent && !planner     // default (BFF) only
//go:build !voice && !agent && !planner                   // cognition + default (BFF)
//go:build voice || cognition                             // voice + cognition
```
Source: `docs/core/build-tags.md`

### 1.3 Compile-time node type

Each binary knows its own role at compile time through a tiny tag-gated variable:

```go
//go:build cognition

package node

// compiledNodeType is the node type this binary was compiled for.
var compiledNodeType = NodeTypeCognition
```
Source: `component/node/compiled_cognition.go`

`node.CompiledNodeType()` returns this. For tagged binaries the compiled type wins; for the default (untagged) binary, `MEMQL_NODE_TYPE` is honored as a fallback. The resolution logic in `NewIdentity` also intentionally honors a non-mesh `MEMQL_NODE_TYPE` (e.g. `identity`) verbatim rather than defaulting it to `bff`:

```go
if ValidNodeTypes[compiled] {
    nodeType = compiled            // Tagged binary: compiled type wins
}
if ValidNodeTypes[envType] {
    nodeType = envType             // env override (untagged builds)
} else if envType != "" {
    // operator set e.g. "identity" — honor it verbatim so it does NOT
    // pass the `Type == NodeTypeBFF` gate and start the WorkerDialer.
    nodeType = envType
}
if nodeType == "" {
    nodeType = NodeTypeBFF
}
```
Source: `component/node/identity.go`

Note `ValidNodeTypes` deliberately **excludes** `identity` — identity is the node-token *issuer*, not a mesh worker, so it never participates in peer discovery or runs the worker dialer (more on this in §3.4).

### 1.4 What each node includes

| Component | BFF | Voice | Cognition | Agent | Planner |
|-----------|:---:|:-----:|:---------:|:-----:|:-------:|
| Config + Auth | x | x | x | x | x |
| Database + Concepts | x | x | x | x | x |
| MemQL Engine | x | x | x | x | x |
| gRPC `MemqlService.Stream` | x | x | x | x | x |
| WebSocket bridge `/memql/ws` | x | x | x | x | x |
| Cluster node bootstrap | x | x | x | x | x |
| Polyphon cognition |  |  | x |  |  |
| Polyphon HTTP (`/polyphon/*`) |  | x |  |  |  |
| Audio WS (`/memql/audio`) |  | x |  | x |  |
| Attachment upload |  |  |  | x |  |
| STT provider |  | x | x | x |  |
| File / storage / email |  |  |  | x |  |
| Agent tool-loop + replier + suggest |  |  |  | x |  |

Source: `docs/core/build-tags.md`

---

## 2. The node mesh: `NodeService.Stream`

Inter-node communication is one gRPC **bidirectional stream** per peer connection, defined by `NodeService` in `component/node/node.proto`. `NodeClientMessage` envelopes flow client→server; `NodeServerMessage` envelopes flow server→client.

| Message | Direction | Purpose |
|---------|-----------|---------|
| `NodeHello` | C→S | Handshake with identity |
| `NodeWelcome` | S→C | Server's node_id + peer table |
| `NodeHeartbeat` | bidi | Liveness with health status |
| `PeerIntroduction` | bidi | Peer table updates |
| `SpawnRequest` / `Result` | bidi | Node spawning |
| `EventForward` / `Ack` | bidi | Distributed graph events |
| `CapabilityQuery` / `Response` | bidi | Capability discovery |
| `QueryForward` / `QueryResponse` | C→S / S→C | Cross-node MemQL query routing |
| `SIForwardRequest` / `Response` / `Cancel` | C→S / S→C / C→S | BFF→worker AI/voice forwarding |
| `NodeShutdown` | S→C | Graceful shutdown |

Source: `component/node/CLAUDE.md`, `component/node/node.proto`

### 2.1 Topology — the BFF is the hub

In a cluster, the **BFF is the client** of each worker for forwarding purposes. `WorkerDialer` (BFF-only) opens one outbound `NodeService.Stream` per worker type. Workers themselves are servers; they do not dial the BFF or each other by default.

```
              BFF (WorkerDialer)
               │
    ┌──────────┼──────────┬──────────┐
    ▼          ▼          ▼          ▼
  Voice     Agent    Cognition    Planner
  :50059    :50055    :50054      :50056
```
Source: `component/node/CLAUDE.md`

EventBridge runs on **every** node and rides whatever streams already exist (the dialer's on the BFF, the inbound handlers on workers), so distributed events flow both directions once the mesh is up.

The live AKS port map (from the manifests): BFF NodeService `:50058`, cognition `:50054`, voice `:50059`, agent `:50055`, planner `:50056`, workbench `:50060`, identity `:50061`. Every node also exposes HTTP `:8085` (health, WS bridge) and the public gRPC `:50051`.

### 2.2 Connection lifecycle and backoff

A `peerConnection` (`component/node/connection.go`) manages one outbound stream with automatic reconnect:

```go
const (
    initialBackoff = 1 * time.Second
    maxBackoff     = 30 * time.Second
    backoffFactor  = 2.0
    // sendChCapacity bounds the in-memory outbox for a single peer
    // connection. ... At 1024 a 5-second reconnect window at ~200 events/s
    // still fits without tail-drops ...
    sendChCapacity = 1024
)
```
Source: `component/node/connection.go`

On connect it sends `NodeHello` with its identity, starts a send-loop goroutine draining the outbox channel, starts a heartbeat ticker, and blocks in a receive loop. On stream loss it reconnects with exponential backoff (1s → 30s cap). If the local identity carries a `BearerToken`, the outbound context is decorated with `authorization: Bearer <token>` so the remote's class-pin interceptor can verify it (see §3.4). Inter-node calls raise the gRPC message-size limit to **32 MiB** (screenshot-bearing agent turn deltas exceed the default 4 MiB cap).

The outbox `Send` is non-blocking with a drop-on-full fallback:

```go
select {
case pc.sendCh <- msg:
default:
    pc.logger.Warn("peer send channel full, dropping message", "peer_id", pc.nodeId)
}
```
Source: `component/node/connection.go`

### 2.3 Peer discovery: DB-first, env-fallback

Discovery is primarily **DB-based**, against the global `v1:cluster:node` concept. During the cluster bootstrap phase, `DiscoverPeerAddress` queries for an existing healthy peer; if found it sets `identity.ParentAddress` so `ParentConnector` dials it. The first node in a fresh cluster finds nothing, becomes the mesh root, and waits to be discovered.

```go
result, err := ctx.Engine.Execute(context.Background(), "concept==v1:cluster:node")
// ...
for _, n := range result.Bundle.Nodes {
    // skip self; read payload address + health
    if health == "healthy" || health == "connecting" || health == "" {
        ctx.Identity.ParentAddress = addr
        return
    }
}
```
Source: `component/node/bootstrap.go`

`MEMQL_PARENT_ADDRESS` and `MEMQL_WORKER_PEERS` are env-var seeds for *deterministic first-boot* before the DB has any rows. On AKS the BFF carries the full seed list:

```yaml
- { name: MEMQL_WORKER_PEERS,
    value: "voice=voice:50059,agent=agent:50055,cognition=cognition:50054,planner=planner:50056,workbench=workbench:50060" }
```
Source: `deploy/k8s/base/bff.yaml`

The `WorkerDialer` reconciles its target set from two sources: the static `MEMQL_WORKER_PEERS` seeds and DB discovery against `v1:cluster:node`, the latter event-driven via subscriptions on `graph.node.created._system.v1:cluster:node` / `...updated...` plus a 30s ticker fallback (`component/node/worker_dialer.go`).

### 2.4 Bootstrap strategy

`BootstrapFor(nodeType)` returns a per-type `NodeBootstrap` that wires only the components that node needs:

```go
func BootstrapFor(nodeType NodeType) NodeBootstrap {
    switch nodeType {
    case NodeTypeCognition: return &CognitionBootstrap{}
    case NodeTypeAgent:     return &AgentBootstrap{}
    case NodeTypePlanner:   return &PlannerBootstrap{}
    case NodeTypeBFF:       return &BFFBootstrap{}
    case NodeTypeVoice:     return &VoiceBootstrap{}
    case NodeTypeWorkbench: return &WorkbenchBootstrap{}
    default:                return &BFFBootstrap{}
    }
}
```
Source: `component/node/bootstrap.go`

### 2.5 Cross-node AI/voice forwarding

Because cognition (chat-driven turns) and planner (Plan execution) need agent nodes to actually run the SI work, and the BFF needs to proxy SI requests to workers, the mesh carries an AI-forward path layered on `NodeService.Stream` via `SIForwardRequest` / `SIForwardResponse` / `SIForwardCancel`. The router (`component/grpc/si_forward.go`, type `SIForwardRouter`) keeps an in-flight table keyed by `request_id`:

- It requires a `request_id` and rejects duplicates.
- It installs a context watchdog that emits `SIForwardCancel` on cancellation.
- Inbound `SIForwardResponse` chunks are dispatched back to the matching in-flight receiver by `request_id`; an orphaned response (no receiver) is logged and dropped.

`app/cluster.go` wires this asymmetrically. On the **BFF**: create the router, plug it into the gRPC AI handlers (`grpcServer.SetAiForwarder`), set it as the response sink on every inbound channel (NodeServer, ParentConnector, the dialer's streams), and install the WorkerDialer. On **cognition/planner**: also create a router + a WorkerDialer narrowed to agent peers (`dialer.SetDialTypes(node.NodeTypeAgent)`) and attach it to the node's integration so its handlers can `Forward()`. On plain **workers**: install a shim so inbound `SIForwardRequest` dispatches into the local AI handlers as if the client connected directly.

Source: `app/cluster.go`, `component/grpc/si_forward.go`

---

## 3. Event bridging across the mesh

memQL's local event bus (`events.Bus`) is per-process. `EventBridge` (`component/node/eventbridge.go`) connects it to the mesh: it subscribes to all local events with the `#` pattern, evaluates routing rules, and forwards matching ones to peers; inbound peer events are published locally after dedup and TTL checks.

### 3.1 Loop prevention and the publish path

Forwarding never re-forwards an event that originated on another node:

```go
func (eb *EventBridge) onLocalEvent(event events.Event) {
    if event.IsRemote() { return } // prevent loops
    decision := evaluateRouting(eb.rules, event.Topic)
    if !decision.Forward { return }
    // build EventForward with OriginNodeId + Ttl=defaultTTL, then forwardToPeers
}
```
Source: `component/node/eventbridge.go`

Inbound events can be re-published to the local bus directly, or — when `SetWiring()` is configured — via the `bus.EventPublishCh` channel (with a fallback to direct publish if the channel is full). Each bootstrap passes the optional `*bus.Wiring` through `BootstrapContext`.

### 3.2 Routing rules (default-deny, block-first)

Routing is a glob match over event topics with explicit block and forward rules. **Block rules evaluate first; events matching no rule are not forwarded (default-deny).**

```go
core := []RoutingRule{
    // Block rules -- these events stay local.
    {Pattern: "automation.#", Block: true},
    {Pattern: "telemetry.#",  Block: true},
    {Pattern: "session.#",    Block: true},
    {Pattern: "query.#",      Block: true},

    // Forward rules -- core/infrastructure events. "*" matches any partition segment.
    {Pattern: "graph.node.created.v1:cluster:*",   TargetType: ""},        // broadcast
    {Pattern: "graph.node.created.v1:cognition:*", TargetType: ""},
    {Pattern: "graph.node.created.v1:planner:*",   TargetType: ""},
    // ... updated/deleted variants ...
    {Pattern: "cognition.response.audio",          TargetType: NodeTypeVoice},
}
```
Source: `component/node/routing.go`

`TargetType: ""` means broadcast to all peers; a non-empty type narrows the forward to peers of that type (e.g. `cognition.response.audio` → voice nodes only). Product code can register additional rules from `init()` via `node.RegisterRoutingRule(...)` without editing the core package; block rules across the combined set still evaluate first.

### 3.3 Dedup ring and TTL

Because the same event can reach a node by more than one path, `EventBridge` carries a fixed-size ring-buffer dedup (`component/node/dedup.go`, default 8192 entries) keyed by event id, and every forward carries a TTL (`defaultTTL = 3`). Inbound events with `Ttl <= 0` are dropped; re-forwarding decrements the TTL (`ForwardInboundToPeers` stops at `Ttl <= 1`). A peer whose outbound stream is mid-reconnect (`Connection == nil`) is counted as a *skipped* delivery and WARN-logged — fire-and-forget; concepts needing stronger delivery (e.g. client-tool requests) must layer their own retry.

### 3.4 Mesh auth: class-pinned node JWTs

When an identity verifier is wired, `NodeService.Stream` enforces a `class="node"` JWT and a revocation gate:

```go
if nodeServer != nil && a.identityVerifier != nil {
    // ... build NodeRevocationCheck against the identity Store ...
    nodeServer.SetAuthInterceptor(
        node.NodeClassStreamInterceptorWithRevocation(a.identityVerifier, revCheck, a.Logger))
}
```
Source: `app/cluster.go`

The interceptor rejects any non-node-class bearer and any stream from a node whose `v1:identity:identity[node_token]` row is `Active == false` (operator-revoked via `/admin/tokens`); the revocation lookup is cached ~5s so a peer pinging every ~30s costs at most one DB read per window. When no verifier is configured (single-node dev), the interceptor is a pass-through. Tokens are provisioned out-of-band via `MEMQL_NODE_TOKEN`, or self-bootstrapped: a node with an empty token but `MEMQL_NODE_BOOTSTRAP_TOKEN` + `IDENTITY_VERIFIER_BASE_URL` set calls identity's `/node/bootstrap` to mint a fresh class-node JWT (`EnsureBearerToken`). The identity node itself never self-bootstraps (it is the issuer) and never dials a parent.

---

## 4. Multi-replica concerns

Each node type runs **2 replicas** on AKS. Two cluster-wide-singleton problems arise from that, both solved in `component/automations/`.

### 4.1 Cron leader election

Every node runs the automation scheduler, so a `@trigger(cron=...)` automation would fire once per replica *and* once per node type. `CronLeader` (`component/automations/cron_leader.go`) elects one cluster-wide owner of scheduled automations via a **Postgres session-level advisory lock**:

```go
const cronLeaderLockKey int64 = 7756010113207010561
// ...
var acquired bool
conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", cronLeaderLockKey).Scan(&acquired)
if acquired {
    cl.leader.Store(true)
    cl.logger.Info("cron leader acquired -- this node runs scheduled automations")
}
```
Source: `component/automations/cron_leader.go`

Exactly one node holds the lock and becomes leader; the scheduler only executes cron firings on the leader (wired as `Scheduler.LeaderGate`). The lock is session-scoped on a dedicated connection, so if the leader pod dies its connection drops and Postgres releases the lock automatically — another node's 10s poll then takes over (failover). When no DB is reachable the node is simply *not* leader (fail-closed: skipping a maintenance cron beats double-running a non-idempotent one). On clean shutdown the leader explicitly `pg_advisory_unlock`s so a co-located node takes over faster.

### 4.2 Event-execution guard (exactly-once)

Event-triggered automations are different: the mesh routes a triggering event to multiple replicas, and the per-process EventBridge dedup doesn't span replicas. `ClusterExecutionGuard` (`component/automations/cluster_guard.go`) makes them exactly-once via a claim row whose primary key lets one replica win:

```go
res, err := db.DB.ExecContext(ctx,
    `INSERT INTO automation_execution_claims (automation_name, dedup_key, claimed_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (automation_name, dedup_key) DO NOTHING`,
    automationName, dedupKey, g.nodeId)
// ...
n, _ := res.RowsAffected()
if n == 0 {
    g.prevented.Add(1)   // another replica already owns this (automation, event)
    return false
}
return true
```
Source: `component/automations/cluster_guard.go`

The `dedupKey` is the automation's deterministic event fingerprint (its `InitialChainHead`), so the same event yields the same key on every replica. Design choices worth noting:

- **Fail-open:** if the DB is unreachable, the claim returns `true` and the automation runs **unguarded** (never drop legitimate work), but the double-fire window is WARN-logged and counted (`ClaimErrors`).
- **Observability:** every *prevented* duplicate is WARN-logged and counted (`DuplicatesPrevented`); a rising count proves multi-replica delivery is live *and* being collapsed correctly. A periodic summary line emits the running counts.
- **Pruning:** a background loop deletes claim rows older than a 1h retention window (the dedup window only needs to span concurrent deliveries).

The cognition manifest documents the safety this buys: replicas were raised to 2 *because* the cron leader + execution guard collapse any cross-replica double-fire.

```yaml
spec:
  # HA (#561): safe to run >=2 replicas now that automations are cluster-
  # singleton -- cron leader + the event-execution guard collapse any
  # cross-replica double-fire (watch the guard's duplicatesPrevented metric).
  replicas: 2
```
Source: `deploy/k8s/base/cognition.yaml`

### 4.3 Graceful drain for zero-dropped-streams

The `/healthz` health surface tracks the number of open `MemqlService.Stream` sessions so a load balancer / blue-green cutover can keep an old-color pod alive until its connections drain:

```go
func StreamOpened()  int64 { return activeStreams.Add(1) }
func StreamClosed()  int64 { return activeStreams.Add(-1) }
func ActiveStreams() int64 { return activeStreams.Load() }
```
Source: `component/server/health.go`

On a shutdown signal the process flips a `draining` flag; while draining, `/healthz` returns **503** so Kubernetes stops routing new connections, the gRPC server `GracefulStop()`s, and existing streams finish. The manifests pair this with a `preStop` sleep (so EndpointSlice deregistration happens before SIGTERM) and a generous `terminationGracePeriodSeconds`:

```yaml
lifecycle:
  preStop:
    exec: { command: ["/bin/sh", "-c", "sleep 5"] }
# Graceful shutdown (#552 + zero-downtime #615): grace period must exceed
# preStop (5s) + MEMQL_SHUTDOWN_DRAIN_DELAY (5s) + the app Stop budget (30s).
terminationGracePeriodSeconds: 60
```
Source: `deploy/k8s/base/bff.yaml` (BFF 60s; cognition/identity 45s)

---

## 5. Deployment model (Azure AKS)

### 5.1 Live topology

The `memql` namespace runs **8 Deployments** — the engine mesh, the carrier, and the SPA:

| Deployment | Image | Replicas | Role |
|---|---|---|---|
| `identity` | `memql-identity` | 2 (HA, envMode) | auth, JWT, JWKS, admin; owns the one-time DB migration |
| `bff` | `memql-bff-copresent` (carrier) | 2 | backend-for-frontend; mesh hub; `/memql/ws` |
| `cognition` | `memql-cognition` | 2 | routing + conductor + Polyphon |
| `voice` | `memql-voice` | 2 | voice transport; `/memql/audio` |
| `agent` | `memql-agent` | 2 | task execution, SI work |
| `planner` | `memql-planner` | 2 | plan orchestration |
| `workbench` | `memql-workbench` | 2 | sandboxed headless work surface |
| `copresent` | `copresent` (SPA) | 2 | the web app (static SPA via nginx) |

Source: `DEPLOYMENT_STRATEGY.md` §1

Networking: a single `bff-external` LoadBalancer plus 3 ingress-nginx objects (cert-manager TLS) fronting `app.staging.copresent.ai` (SPA + `/memql/ws` + `/memql/audio` + a same-origin JWKS proxy) and `identity.staging.copresent.ai`. The internal mesh dials over the cluster CA; each node verifies identity-issued JWTs via its per-node verifier against `https://identity:8085`.

```
                          Internet
                             |
              ingress-nginx (cert-manager TLS)
            /            |                     \
 app.staging.*      app.staging.*         identity.staging.*
   copresent SPA   bff (/memql/ws,        identity (2, HA)
      |             /memql/audio,            |  JWKS @ :8085
      \-------- bff-external LB -------------/
                       |
   bff <-> cognition / voice / agent / planner / workbench   (NodeService mesh, mTLS)
                       |
              managed Tiger Cloud (Postgres + TimescaleDB)
```
Source: `DEPLOYMENT_STRATEGY.md` §1

Infrastructure facts: cluster `aks-memql-staging` (rg `rg-memql-staging`), registry `acrmemql.azurecr.io`, database managed **Tiger Cloud**, secrets in the **genesis A2** sealed envelope, per-env config in **Key Vault** (`kv-memql-<env>`). The former Google Cloud Run / Cloud Build / Artifact Registry / Secret Manager stack is retired (`INFRASTRUCTURE.md`).

### 5.2 The digest-pinned overlay — single image authority

The base manifests under `deploy/k8s/base/` carry human-readable `:tags`, but the **overlay** (`deploy/k8s/overlays/<env>/kustomization.yaml`) is what gets applied/reconciled. Kustomize's `images:` transformer replaces every tag with a pinned `@sha256:` digest, so the overlay is the single image authority:

```yaml
images:
  - name: acrmemql.azurecr.io/memql-bff-copresent
    digest: sha256:c3e3dd89fe052842e13d563731ec9b5a4d0d46f8f5416aae6c47122ffa86fa0a
  - name: acrmemql.azurecr.io/memql-cognition
    digest: sha256:3d3eae79e9f97b2bc334410b07f340b6e279bb13b750401e5f11da8469313003
  # ... 8 components total ...
```
Source: `deploy/k8s/overlays/staging/kustomization.yaml`

There is **no runtime `kubectl set image`** and **no `rollout undo`**: an apply cannot leave a node on a stale manifest tag. Rollback = `git revert` of a change to the overlay (see §5.7).

### 5.3 The deploy command

`make deploy VERSION=X` (→ `scripts/deploy/aks-deploy.sh`) takes the cluster from source to a gated, rolled-out deploy:

1. **Build + push** the 6 engine images via `az acr build` (root `Dockerfile`, one per build tag; voice is the CGO exception). Engine tags are **immutable** — overwriting an existing `memql-<nt>:<tag>` is refused (`--allow-overwrite` only re-cuts an *unvalidated* tag). `--skip-build` deploys already-pushed tags.
2. **Ensure secrets** — internal TLS CA + identity cert; warns if `memql-secrets` is absent.
3. **Migration gate** (pre-rollout) — a Job pinned to `VERSION` runs the DB migrations once and **aborts the deploy on failure**, so the mesh never rolls onto a half-migrated schema (§5.4).
4. **Apply the digest-pinned overlay** — `kubectl apply -k deploy/k8s/overlays/<env>`. `identity` is waited Ready first (JWKS), then the rest.
5. **Health gate** — a drift assertion (`drift-check.sh --live`: every live pod runs the exact digest the overlay pins) followed by the deep smoke gate (§5.5). On failure with the gate armed, the deploy stops and prints the git-revert rollback procedure; it does **not** imperatively revert.
6. **Record validated version** on a green deep gate (§5.6).

Flags: `--version`, `--env`, `--skip-build`, `--skip-tls`, `--skip-migrate`, `--no-smoke`, `--no-gate`, `--allow-overwrite`, `--dry-run`. The carrier (`memql-bff-copresent`) and SPA (`copresent`) are built/pinned from their own repos, not by this script.

Source: `DEPLOYMENT_STRATEGY.md` §2

### 5.4 Migrations run once

Only the **identity** node migrates against the shared Tiger DB; every other node sets `MEMORY_NODES_DATABASE_MIGRATE_ON_START=false` and `..._AUTO_MIGRATE=false` to avoid a multi-way migration race. The pre-deploy migration is a one-shot Job pinned to the deploy version:

```yaml
kind: Job
metadata: { name: memql-migrate, namespace: memql }
spec:
  backoffLimit: 2
  ttlSecondsAfterFinished: 600        # reap 10 min after finish
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: acrmemql.azurecr.io/memql-identity:0.9.14  # identity carries full schema
          command: ["./memql", "migrate"]
          env:
            - { name: MEMORY_NODES_DATABASE_MIGRATE_ON_START, value: "true" }
            - { name: MEMORY_NODES_DATABASE_AUTO_MIGRATE,     value: "true" }
```
Source: `deploy/k8s/base/migrate-job.yaml`

The migration is idempotent — the bun migrator takes a Postgres advisory lock and marks-applied-on-success, so re-running (or identity's retained boot-migration fallback) is a no-op when current. The runtime counterpart is the `/readyz` schema assertion (§5.5).

### 5.5 The deep smoke gate

`scripts/deploy/staging-smoke-test.sh` has two profiles:

- **baseline** (default): front-door reachability — TLS+DNS, identity health + JWKS, the `/readyz` schema assertion, login page, `/memql/ws` + `/memql/audio` wiring, SPA boot assets. A SKIP never fails the run.
- **deep** (the promotion gate): all baseline checks **plus a real authenticated WS query that fans BFF → cognition/agent**. Every deep check must run and PASS — a missing input (no token / ws client) is a **FAIL, not a SKIP**. This is what makes the gate conclusive: a prior incident went 8-PASS/0-FAIL/2-SKIP green while the authenticated app was broken.

Server-side readiness is an unauthenticated `GET /readyz` on every binary that asserts critical schema presence via `to_regclass` (the core `"MemoryNodes"` table + `automation_execution_claims`) and returns 503 when an invariant is missing — proving a migration actually applied *without* DB credentials (the DB is firewalled to AKS egress).

```bash
SMOKE_PROFILE=deep MEMQL_SMOKE_TOKEN=<pat-or-jwt> bash scripts/deploy/staging-smoke-test.sh
```
Source: `DEPLOYMENT_STRATEGY.md` §7

### 5.6 Promotion staging → prod (digest copy, no rebuild)

A version is promotable to prod **only after a green deep staging gate**, and a validated artifact is **immutable**. The unit of promotion is a **release lockfile** (`releases/<version>.yaml`) pinning all **8 components** (6 engine node types + the `memql-bff-copresent` carrier + the `copresent` SPA) by digest:

```yaml
version: "0.9.14"
engineVersion: "0.9.14"
components:
  memql-cognition:
    repo: znasllc-io/memql
    digest: sha256:3d3eae79e9f97b2bc334410b07f340b6e279bb13b750401e5f11da8469313003
  memql-bff-copresent:
    repo: visionarys-io/memql-bff-copresent
    digest: sha256:c3e3dd89fe052842e13d563731ec9b5a4d0d46f8f5416aae6c47122ffa86fa0a
    builtAgainstEngine: "0.9.14"  # coherence: MUST equal engineVersion
```
Source: `releases/0.9.14.yaml`

A CI `release-lockfile` gate (`scripts/release/coherence-check.sh`) enforces: 8 components present, all digest-pinned, and the carrier + SPA `builtAgainstEngine` equals `engineVersion`. Prod promotes by **digest copy, no rebuild** — `scripts/release/promote.sh --version=X --env=prod` copies the validated lockfile's digests into `deploy/k8s/overlays/prod`; PR it and Argo CD reconciles prod. Prod runs the exact bytes staging validated; environments differ only by config. This supersedes the older `deploy/validated-versions.json` ledger (now an empty historical record).

### 5.7 Argo CD (GitOps reconciler)

Git is the single source of truth; **Argo CD** continuously reconciles the `memql` namespace to the committed overlay. Deploys become merges — `selfHeal` reverts any out-of-band change.

```
   PR merges digest change to deploy/k8s/overlays/staging  (on main)
                         │
              ┌──────────▼───────────┐
              │  Argo CD (argocd ns)  │  app `memql` (project `memql`)
              └──────────┬───────────┘
                  sync (auto, prune + selfHeal)
                         ▼
                   memql namespace
```
Source: `deploy/argocd/README.md`

Layout: `bootstrap/` installs Argo CD itself (pinned v2.13.3, *not* GitOps-managed — chicken/egg); `apps/project.yaml` is an `AppProject` restricting the reconciler to this repo + the `memql`/`argocd` namespaces; `apps/root.yaml` is an app-of-apps; `apps/memql.yaml` is the mesh + CoPresent Application with `source = deploy/k8s/overlays/staging`. Rollback under Argo is just a `git revert` push that reconciles automatically; `make deploy-rollback ARGS=--to=<commit>` prints the exact revert + re-converge steps. A documented **break-glass** procedure lets an operator suspend auto-sync (`argocd app set memql --sync-policy none`), make an emergency change, reconcile Git to match within the same incident, then re-enable auto-sync — so break-glass can never cause silent drift.

### 5.8 Argo Rollouts (progressive delivery)

`deploy/rollouts/` replaces the bespoke public-host shell smoke with **controller-driven** progressive delivery, each step gated by an **in-cluster** `AnalysisTemplate`. A failed analysis auto-aborts → auto-rollback to the stable ReplicaSet (no `rollout undo`).

**BFF rolls blue/green.** The Rollout *adopts* the committed `bff` Deployment's pod template via `workloadRef` (so the digest still comes from the overlay), brings up the new color as `bff-preview`, runs the gate against it, then flips — and keeps the old color serving open streams for an hour before scaling it down:

```yaml
strategy:
  blueGreen:
    activeService: bff-active
    previewService: bff-preview
    autoPromotionEnabled: false       # operator-in-the-loop for first cutovers
    prePromotionAnalysis:
      templates: [{ templateName: deploy-gate }]
      args: [{ name: service, value: bff-preview }]
    scaleDownDelaySeconds: 3600        # drain open MemqlService.Stream sessions
```
Source: `deploy/rollouts/bff-rollout.yaml`

**Engine nodes roll canary** (cognition exemplar; same shape for voice/agent/planner/workbench) with background analysis against a canary service:

```yaml
strategy:
  canary:
    maxUnavailable: 0
    maxSurge: 1
    analysis:
      templates: [{ templateName: deploy-gate }]
      args: [{ name: service, value: cognition-canary }]
      startingStep: 1
    canaryService: cognition-canary
    steps:
      - setWeight: 25
      - pause: { duration: 60s }
      - setWeight: 50
      - pause: { duration: 60s }
      - setWeight: 100
```
Source: `deploy/rollouts/cognition-canary.yaml`

**The in-cluster gate** (`deploy/rollouts/analysis/deploy-gate.yaml`) runs as a Job against the *preview/canary* service DNS — never a public host (this structurally kills the wrong-host and mixed-version convergence-race failure modes). It does three checks: (1) `/readyz` schema assertion; (2) an **authenticated** `MemqlService.Stream` query using a short-lived `class="service_account"` JWT, fanning BFF → cognition/agent; (3) an optional Prometheus SLO gate (error-rate ≤ 2%, p95 ≤ 1.5s, and an active-stream-drop guard built on the `memql_active_streams` counter). The gate entrypoint is `deploy-gate-check` (`cmd/deploy-gate-check`), a distroless static binary that does both legs in-process:

```yaml
deploy-gate-check \
  --addr "$svc:50051" \
  --jwt "$MEMQL_SVC_JWT" \
  --query 'count v1:cognition:space' \
  --fan-agent
```
Source: `deploy/rollouts/analysis/deploy-gate.yaml`

The zero-dropped-streams definition of done: a held `MemqlService.Stream` (browser WS) survives a full BFF cutover with 0 dropped streams — new logins land on the new color while the pre-existing session stays served by the old color until it closes and `activeStreams` winds to 0.

### 5.9 The Deployment Console (`deploycontrol`)

The GitOps machinery above (Argo CD reconciling overlays, Argo Rollouts gating cutovers) is driven from Git. The **Deployment Console** puts that control plane behind an authenticated, audited API so an operator can drive it without shelling into the cluster. It is an **owner/admin-gated `deploycontrol` gRPC surface** with four write actions:

| Action | Effect |
|---|---|
| `deploy` | Cut a deploy of a version to an environment (the gated build → migrate → rollout path of §5.3). |
| `promote` | Promote a green, validated version from staging → prod by digest copy (§5.6). |
| `rollback` | Revert to a prior validated digest (the `git revert` → reconcile path of §7). |
| `rollout` | Drive / advance a progressive rollout (the Argo Rollouts steps of §5.8). |

Every action is **authorization-gated to `owner`/`admin`** (enforced on the actor envelope, §7 of the auth doc) and **audited** — each invocation lands an audit record with the actor, action, target version/env, and outcome, so the deploy history is queryable rather than living only in shell scrollback and Git log. The surface ships with an **operator guide**, and a first-party Go client (`sdk/go/client/deploycontrol.go`, §8 of the SDK doc) wraps the four actions.

This is an internal-ops capability (it does not change the application data plane) — it formalizes "who deployed what, when, and was it allowed" into the same audited, role-gated model the rest of the platform uses.

### 5.10 Operational maturity

The GitOps stack has hardened alongside the mesh: **Argo CD** (§5.7) reconciles overlays, **External Secrets Operator** (§6.3) reconciles secrets from Key Vault, and **cert-manager** issues/renews the cluster's TLS certificates so cert rotation is declarative rather than manual. **Disaster-recovery drills are now rehearsed on staging** — the secret-recovery and DB point-in-time-recovery paths of §7 are exercised against the staging cluster rather than only documented. The Go toolchain is pinned to **1.26.4** (a `govulncheck` fix) across the build images.

---

## 6. Configuration & secrets

### 6.1 Two-layer precedence

1. **Genesis envelope (base layer, set-if-absent)** — shared secrets + config sealed in the A2 envelope (`MEMQL_GENESIS_B64` in `memql-secrets`), autoloaded at boot when `MEMQL_GENESIS_AUTOLOAD=true`. Applied only for keys not already in the environment.
2. **Per-pod env / envFrom (override)** — values set explicitly in the manifests (node type, mesh addresses, `IDENTITY_*` hosts, feature flags) win over the envelope.

Rule of thumb: shared secrets/config → genesis envelope (via the re-seal flow); per-node, non-secret config → k8s manifest env. Never set shared secrets with ad-hoc `kubectl set env`. Source: `DEPLOYMENT_STRATEGY.md` §3.

### 6.2 The genesis A2 envelope

Shared secrets live in a single encrypted envelope sealed under `MEMQL_MASTER_KEY` (NaCl secretbox; `component/secret/`). The cluster Secret `memql-secrets` carries three keys: `MEMQL_MASTER_KEY`, `MEMQL_GENESIS_B64` (the sealed envelope), and `MEMORY_NODES_DATABASE_DSN`. To rotate a shared secret you edit the gitignored per-env source, re-seal it with `cmd/genesis-seal`, push the new blob to Key Vault and the cluster Secret, and roll the consuming pods (`DEPLOYMENT_STRATEGY.md` §4).

### 6.3 External Secrets Operator

ESO reconciles `memql-secrets` from `kv-memql-staging`, so the cluster's secret *wiring* is declarative + reconciled (no operator drift) — the secrets analogue of what the digest overlay did for images:

```
   kv-memql-staging (Azure Key Vault)
      memql-master-key / memql-genesis-b64 / memory-nodes-database-dsn
              │   (WorkloadIdentity: federated managed identity -> ESO SA)
              ▼
   ExternalSecret (external-secrets controller, refresh 1h)
              ▼
   Secret/memql-secrets (memql ns)  ── envFrom ──►  every pod
```
Source: `deploy/external-secrets/README.md`

ESO authenticates to Key Vault via AKS **Workload Identity** (secret-less; a federated managed identity bound to the ESO ServiceAccount). It owns the k8s Secret but does **not** change the genesis envelope itself — to rotate a shared secret you still re-seal and push to Key Vault; ESO then propagates the new blob to the cluster Secret on its next refresh, replacing the manual `kubectl patch` step. The secret *values* never enter Git — only the Key-Vault references do.

### 6.4 Identity HA + signing key

Identity runs **2 replicas in envMode**: the Ed25519 signing seed (`IDENTITY_SIGNING_KEY_B64`) rides the genesis envelope, so every replica derives the **same** key + `kid` + JWKS. There is no RWO key PVC (which would force a single writer), the strategy is RollingUpdate, and a PodDisruptionBudget keeps ≥1 pod serving auth through disruptions (`deploy/k8s/base/identity.yaml`). Rotating the signing key = re-seal a new seed + roll identity; in envMode there is no previous-key overlap, so a rotation invalidates JWTs signed by the old key (clients re-authenticate, mesh nodes re-bootstrap on restart). The signing key is JWT-only — it does not encrypt stored secrets (those use `MEMQL_MASTER_KEY`).

---

## 7. Recovery and capacity

- **Rollout:** stateless nodes roll with RollingUpdate (`maxUnavailable: 0`, `maxSurge: 1`) + graceful gRPC drain; identity is HA so auth stays up across a roll. PodDisruptionBudgets (`minAvailable: 1`) protect each 2-replica node through voluntary disruptions.
- **Rollback:** `git revert` the overlay commit; Argo reconciles. `make deploy-rollback ARGS=--to=<commit>` prints the steps. The old `kubectl rollout undo` path is retired (it reverted to the manifest tag, not the prior digest).
- **Secret recovery:** the sealed envelope is in Key Vault (`kv-memql-<env>/memql-genesis-b64`); re-store it into `memql-secrets` and roll.
- **DB:** managed Tiger Cloud (point-in-time recovery via Tiger); the DSN lives in `memql-secrets` / Key Vault.
- **Capacity:** staging runs nodepool `nodepool1` = 4× `Standard_B2s` for the 16-pod mesh, with thin rolling-update surge headroom. The cluster autoscaler floor is codified as IaC (`scripts/deploy/aks-autoscaler.sh`, `make deploy-autoscaler`): **min 2, max 5 on B2s**, owner-gated (plan-and-stop by default). A pre-deploy `check_nodepool_headroom` guard in `aks-deploy.sh` sums the rolling-update surge CPU and warns (or fails with `--gate-headroom`) before the mesh rolls.

Source: `DEPLOYMENT_STRATEGY.md` §8–§9

---

## 8. Quick reference: key files

| Area | Path |
|---|---|
| Build tags / node-type binaries | `docs/core/build-tags.md`, `app/build_*.go`, `component/node/compiled_*.go` |
| Node identity + env resolution | `component/node/identity.go` |
| Mesh proto + server | `component/node/node.proto`, `component/node/server.go`, `component/node/stream_handler.go` |
| Peer connection + backoff | `component/node/connection.go` |
| Peer discovery + bootstrap | `component/node/bootstrap.go`, `component/node/bootstrap_*.go` |
| Worker dialer / parent connector | `component/node/worker_dialer.go`, `component/node/parent_connector.go` |
| Event bridge + routing + dedup | `component/node/eventbridge.go`, `routing.go`, `dedup.go` |
| Cluster wiring (AI forward, auth) | `app/cluster.go`, `component/grpc/si_forward.go` |
| Cron leader / execution guard | `component/automations/cron_leader.go`, `cluster_guard.go` |
| Graceful drain | `component/server/health.go`, `component/grpc/server.go` |
| Deploy strategy (authoritative) | `DEPLOYMENT_STRATEGY.md`, `INFRASTRUCTURE.md` |
| K8s manifests + overlays | `deploy/k8s/base/`, `deploy/k8s/overlays/<env>/` |
| Migration job | `deploy/k8s/base/migrate-job.yaml` |
| Argo CD (GitOps) | `deploy/argocd/` |
| Argo Rollouts (progressive) | `deploy/rollouts/` |
| External Secrets | `deploy/external-secrets/` |
| Release lockfiles | `releases/`, `scripts/release/` |
| Dockerfile (tag → binary) | `Dockerfile` |
