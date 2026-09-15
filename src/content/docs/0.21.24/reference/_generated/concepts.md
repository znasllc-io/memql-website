---
title: Concept Catalog
audience: public
status: stable
area: language
sinceVersion: 0.9.0
owner: znas
---

# Concept Catalog

Generated from the live DSL by `cmd/docs-gen` -- do not hand-edit.
A MemQL node is an instance of one of these concepts; each concept's
fields below are its schema.

Total: **226** concepts.

## `v1:accounts:account`

A client -- a company this instance's owner does work for.
THE COMPOSITE TIER, for the reason v1:platform:site carries one. A plain `owner="ownerUserId"` tier has no cluster-owner escape on the READ path -- enforceRowAuthzOnPlan ANDs the owned predicate unconditionally -- so "list every account in this cluster" would not merely be unimplemented, it would not be EXPRESSIBLE, and the app's primary screen would silently render a subset. Going the other way (a bare clusterOwner tier) would make every account a non-operator created invisible to the person who created it. The composite keeps both statements true: a user reads exactly their own accounts, an operator reads every row.
`ownerUserId` EMPTY means cluster-owned, and the `self` singleton is the case: it is the DEPLOYMENT's row, not whichever principal happened to boot the cluster. sameRowAuthzOwner refuses an empty owner outright, so a cluster-owned row is reachable through the admin branch alone.
THAT LAST SENTENCE WAS ALSO A CLAIM NOTHING IMPLEMENTED (memql#4817). The seeded row landed owned by `system:maintenance:seedSelfAccount` -- not empty, just meaningless -- and the tier happened to behave as designed because a bogus owner matches no real user either. It is genuinely empty now: a non-principal actor cannot own a row (component/memql/rowauthz_nonprincipal_owner.go).
THE RANK MODIFIERS (epic memql#4832). `rankVisible` adds "rows owned by anyone at or below my rank" (D2), and `unowned="admin"` is what finally makes the self row readable by somebody other than a cluster owner.
Before it, an admin or a developer opening the registry got ZERO ROWS and could not distinguish an unconfigured cluster from an empty one -- which is why the "not set up yet" state had no signal to read.
THE FLOOR READS `admin` AND THE ISSUE SAYS "developer-and-above", AND BOTH NAME THE SAME SET. memql#4837 spells the set out -- "admits developer, admin and owner, and excludes writer and reader" -- and under the ladder this epic makes authoritative that set is rank >= 200, whose slug is `admin`. "Developer-and-above" was the OS ladder's way of saying it, where developer sat BELOW admin. Writing `unowned="developer"` here would read like the issue and lock out every admin, which is the exact class of mistake memql#4833 warns about: every requirement written under the old ordering changes meaning the moment it flips, and has to be re-read against what it was TRYING to say rather than transcribed.
NOT rankStrict. Rank-visible reads are wanted here; rank-strict writes are not, because an account is a RECORD -- who work is for -- and letting a developer edit an admin's client list is authority this concept never claimed. The owned tier keeps the write rule it always had: your own rows, plus the cluster-owner escape.

| Field | Type | Required | Description |
|---|---|---|---|
| `configuredAt` |  |  | When a human last stated this row's facts -- stamped by updateClientAccount, and by NOTHING else (D7). Its absence on the seeded `self` row is what renders the OS first-run card, and the card's Save is an updateAccount, so answering the question is what retires it; createClientAccount deliberately does not stamp, or the card would be retired before it was ever shown. On an ordinary account -- one somebody typed into the create form -- absence means created and never since edited, which is a smaller claim than the one the card acts on. Read the field as 'a person last confirmed these facts at', and read the card's gate as what it is: a question about ONE row, asked because a boot filled that row in and a boot cannot know what a company is called. |
| `domain` | string |  | The client's OWN domain (acme.com), not a hostname this cluster serves. Free text, unvalidated, and deliberately so: it is a fact about the client, recorded because somebody knows it, and refusing a typo would cost more than it saves. Epic C (custom domains) consumes exactly this field plus v1:platform:site.accountId as its SUGGESTION source when an operator adds a custom domain to a site (D9) -- a suggestion, never a claim: nothing here verifies ownership of anything, and Epic C's DNS check is what does. |
| `domainFailureDetail` | string |  | What the lookup actually saw, verbatim. The half of a DNS failure a person can act on: `dns_token_missing` says the record was not there, and this says whether the zone answered with nothing, with somebody else's token, or not at all. |
| `domainFailureReason` | string |  | Why the last check failed, typed: `dns_token_missing` today. NOT an enum, for v1:platform:customDomain.failureReason's reason -- a resolver reports things a closed set written today does not anticipate, and a value the enum refuses is a row that will not write at all. |
| `domainLastCheckedAt` |  |  | When the walk last looked. Written on EVERY pass, which is why it must stay out of every arrival fingerprint -- a field that changes every two minutes makes any digest built over the row change every two minutes too. |
| `domainStatus` | string | yes | How far the ownership walk has got. `unverified`: no check has run. `verifying`: a check ran and is failing -- read domainFailureReason. `verified`: the TXT record carried the token at least once, and this is the ONLY value at which joinOnDomain is legal (D9) and a MemQL name may be reserved (D10). Never cleared except by a change of domain. (enum: unverified, verifying, verified) |
| `domainToken` | string |  | The ownership token published as TXT at _memql-verify.<domain> (epic memql#5165, section F). Minted by the reconciler the first time it sees a domain with no token, and PLAINTEXT for the reason v1:platform:customDomain.token is: the whole point is that a person copies it into a registrar, and a value nobody can read proves nothing to anybody. Cleared when `domain` changes -- proof of one name is not proof of another. |
| `domainVerifiedAt` |  |  | When ownership was first proven. Never cleared while the domain stands: the walk stops at a verified account, so a later DNS outage does not un-prove what was proven. |
| `joinOnDomain` | boolean |  | Whether a person arriving with a VERIFIED email address on this domain joins this account's group (D9). Legal only at domainStatus == "verified" -- a Go pre-insert validation refuses `domain_not_verified` rather than accepting a flag that would place strangers into a client's group on an unproven name. Never retroactive: it applies at arrival and to nobody already here. |
| `memqlDomain` | string |  | The name this account is RESERVED under on this cluster (D10) -- `memql.<domain>` by default, filled by updateClientAccount when empty and the domain is set, and editable. Recorded now and SERVED by nothing yet: the per-account front door is a later sub-project. Refused under this cluster's own domain or equal to a front-door host, the custom-domain guardrails, because either would be a certificate request for a host the platform already answers on. |
| `memqlReservationReason` | string |  | WHY the name is not held, when it is not -- or empty when it is held, or when nothing has looked yet (epic memql#5168). Written by the front-door sweep, never by a caller. It exists because an absent memqlReservedAt meant two different things and the Accounts rail inferred which by reading the ownership stop beside it: `ownership_unproven` is a domain that has not passed the TXT walk, while `domain_under_cluster_domain`, `domain_is_front_door_host`, `name_collides_with_site` and `name_collides_with_custom_domain` are names this cluster refuses to serve. The first two of those four are record A's own codes, reused verbatim rather than re-spelled. NOT AN ENUM, for customDomain.failureReason's reason: a refusal the engine has never seen must still reach the row rather than being refused by its own schema. NOTE that `domain_is_front_door_host` is written by nothing on a cluster whose labels are today's -- every front-door host is a single label under the cluster's own domain, so the under-domain test fires first and that branch is unreachable for any name a person would type. The value exists because the code that would set it exists; record A asserts the overlap honestly rather than reordering the branches to make it reachable. |
| `memqlReservedAt` |  |  | When the reservation was recorded -- stamped by the reconciler at the moment domainStatus becomes verified AND memqlDomain passes the guardrails. Absent means the name is not held: either ownership is unproven or the name was refused. |
| `name` | string | yes | The client's name, as a person would say it. REQUIRED, and it is the one thing the first-run card insists on (D7) -- an account whose name is a placeholder is a row nobody can pick out of a list. The seeded `self` row gets a starter value rather than a real one precisely so the card has something to ask for; see dsl/accounts/seeds.memql for why that starter is not a lie the app has to detect. |
| `notes` | string |  | Free text about the client, in the operator's own words. The place the things this schema deliberately does not model go -- the billing contact, the renewal date, the name of the person who actually answers. |
| `ownerUserId` | string |  | v1:identity:user.id that created this account, or EMPTY for a cluster-owned one. Stamped from the actor by createAccount, which is what makes the tier above true rather than aspirational; a write made by a SYNTHETIC actor -- the seed materializer, a maintenance actor, an automation's system actor -- has that stamp undone and produces a cluster-owned row instead, which is how the seeded `self` row gets its empty owner (memql#4817). NARROWER THAN THE SENTENCE THIS REPLACED, which said `a cluster owner, a system actor, or trusted server-side Go` and was wrong on two of the three: a real cluster owner keeps their stamp, and so does an internal-origin write. Only an actor carrying AccessContext.Synthetic is undone -- and borrowed authority (ContextWithUserActor) is deliberately NOT one, because it acts as a real person and the rows it creates are theirs. NOT `string!`: an empty value is the meaningful cluster-owned state, and `string!` would refuse the seed. |
| `primaryContactEmail` | string |  | How to reach primaryContactName. Recorded, never sent to -- no path in this tree mails an account contact. When guest access for a client is eventually wanted it rides an invitation carrying this account's id, and the invitation carries its own inviteeEmail; the two are deliberately not the same field. |
| `primaryContactName` | string |  | Who to talk to at the client. A FIELD ON THE ROW rather than a contact concept (D4): a contact concept is future work that nothing in this epic needs, and a v1 that ships two fields is one a later concept can migrate from, while a v1 that ships a half-designed concept is one it has to live with. |
| `status` | string | yes | Two rungs, and the missing third is the decision (D8). The deployables ladder is draft / live / disabled because a site is a SERVABLE thing and `disabled` is the state that answers 503 rather than 404. An account serves nothing, so there is no request for a middle rung to change the answer to -- it is a record that is either current or filed away. `archived` removes the row from the default list and marks it under the Archived filter; nothing else in the cluster consults it, and in particular a tie pointing at an archived account keeps resolving, because unfiling a client must never break the provenance of what was done for them. NOTE: @default is never applied on insert (memql#2960) -- createAccount fills this with ??. (enum: active, archived) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:actions:action`

A reusable, replayable library entry minted from a candidate trace (Phase 1, #1736). A primitive stores one or more captured capability calls with literal args, keyed by inputFingerprint, and replays them token-free on identical input against the default surface. Reliability rises on verified replay; mismatches fall back to the LLM.

| Field | Type | Required | Description |
|---|---|---|---|
| `argTemplate` | object |  | AUTHORED action (#2218, ADR section 2.3) capability-argument template: a flat map of {capabilityArgKey: templateString} rendered from params before the capability runs (a $params.<name> reference is substituted with the bound value). THE definition of what an authored primitive invokes. Empty for a replay-capture action (which carries literal calls instead). |
| `calls` | array | yes | Ordered capability calls to replay, in execution order. Each entry: {index, capability, args}. args are the literal recorded argument map (parameterization lands in Phase 3 #1738). Error/cache-hit calls are excluded at mint time. |
| `capability` | string |  | The abstract external capability verb the action performs (e.g. shell.exec, fs.writeFile, integration.github.tagRelease). For an AUTHORED primitive (#2218) this is THE single capability the action invokes -- bound from params via argTemplate; for a replay-capture action it is the dominant verb the capability->surface resolver consumes (Phase 2 #1737). |
| `inputFingerprint` | string | yes | Stable hash of the dispatched step input that minted this action. THE literal-replay key: a later step whose input hashes to the same value replays this action instead of calling the LLM. |
| `intent` | string | yes | Natural-language description of what the action does -- the future embedding source for retrieval (Phase 3). Phase 1 derives it from the step goal/input. |
| `kind` | string | yes | primitive = one or more captured capability calls replayed directly. composite = an ordered list of child action references (Phase 3 #1738). Phase 1 mints only primitives. (enum: primitive, composite) |
| `lastReinforced` |  |  | When the action was last reinforced -- the decay clock for Phase 4 consolidation. |
| `ownerUserId` | string | yes | v1:identity:user.id of the owner. The per-row authz key (owned tier), stamped from actor.userId by mintAction. |
| `paramBindings` | array |  | Phase 3 (#1738) automatic parameterization. Per-call arg bindings derived from the data-flow tracer's provenance: {index, capability, bindings:[{name, kind, ref, fragment, template, fragmentValue, literal}]}. kind is stepInput (re-bind from the current step input at ref) or literal. Lets the action replay on VARYING input by re-binding witnessed params; an unbound arg stays its recorded literal. |
| `params` | array |  | AUTHORED action (#2218, ADR section 2.3) input schema: the named, typed parameters the step args bind to. Each entry mirrors an args field: {name, type, required, description}. The argTemplate renders the concrete capability arguments from these. Empty for a replay-capture action (which re-binds via paramBindings instead). |
| `provenanceMutation` | string |  | Name of the mutation that produced this action version (audit trail). |
| `provenancePlanId` | string |  | The run that minted this action. A plain string FK: the harness plan and step concepts it pointed at are retired (work spine A1), and epic A3 re-points it at v1:work:run when the trust ladder moves onto the construct. |
| `provenanceStepId` | string |  | The step of that run. A plain string FK, for provenancePlanId's reason. |
| `recordedResult` | object |  | The step result the minting run produced (returned verbatim on a verified replay, since the LLM synthesis is not reproducible without the model). |
| `recordedSurface` | string |  | Provenance only: the surface the action was captured on (Phase 1 is always the default surface). Replay re-resolves in Phase 2 (#1737); this never constrains where it runs. |
| `reinforceCount` | integer | yes | Number of verified successful replays observed. Bumped by reinforceAction (value computed engine-side, MemQL has no arithmetic). |
| `reliability` | number | yes | Confidence in [0,1]. Rises on a verified successful replay (fingerprint match), decays on mismatch/disuse (Phase 4). Below a floor an action is deprecated and no longer offered (Phase 4 #1739). |
| `resourceEdges` | array |  | Resource-coupling edges carried from the candidate trace: {fromCallIndex, toCallIndex, resource}. Phase 2 (#1737) uses these to form world groups so coupled calls pin to a single surface (decision A). |
| `resultFingerprint` | string |  | Stable hash of the recorded tool results. A replay must reproduce this fingerprint to be trusted; a mismatch decays trust and falls back to the LLM. |
| `sideEffectClass` | string | yes | Coarse risk class, used by the surface-aware trust gate in Phase 4 (#1739). Carried on the action for authoring/labelling; the AUTHORITATIVE sideEffectClass lives on the capability (ADR section 7, reconciled by the I7 capability vocabulary) so an authored or generated action cannot spoof it. Phase 1 records it (defaulting conservatively to write) but does not yet gate on it. (enum: read, write, exec) |
| `slug` | string | yes | Human-readable name (e.g. the dominant capability slug). Not unique on its own; (ownerUserId, inputFingerprint) is the replay key. |
| `status` | string | yes | Trust-ladder state. Phase 1 mints directly as active (replay is fingerprint-verified, so it is safe to offer); the candidate->active->deprecated ladder with surface-aware gating lands in Phase 4 (#1739). (enum: candidate, active, deprecated) |
| `steps` | array |  | Phase 3 (#1738) composite body (kind=composite): an ordered list of child action references {actionId, version, argTemplate}. A composite replays by recursing into each child action. Empty for primitives. |
| `templateFingerprint` | string |  | Phase 3 (#1738) structural lookup key: a stable hash of the dispatched step input's KEY SET (not values). An input with the same shape matches this action and re-binds params by value -- the pre-planner parameterized-replay key, superseded by the planner's semantic (pgvector) search once wired. |
| `version` | integer | yes | Monotonic version, bumped on every edit. Pin-by-default references and the verified upgrade migration land in Phase 5 (#1740). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:actions:surface`

A registered execution surface for action replay (Phase 2, #1737): workbench / computer-use:<machineId> / mcp:<server>, with its served capability verbs + current availability. The resolver binds capability->surface per world group with explicit > policy > availability precedence (decision A pins coupled actions to one surface).

| Field | Type | Required | Description |
|---|---|---|---|
| `available` | boolean | yes | Whether the surface is currently reachable. The availability failover chain skips unavailable surfaces; an operator/agent flips this via setSurfaceAvailability. |
| `capabilities` | array | yes | The abstract capability verbs this surface serves (e.g. fs.writeFile, fs.readFile, shell.exec). The resolver only binds a capability to a surface that lists it. |
| `kind` | string | yes | Surface family. Drives the surface-aware trust gate in Phase 4 (#1739): a real-machine computer-use surface always confirms destructive replays. cockpit-runner is the control-plane runner (operator/CI) that executes deploy/control capabilities OUTSIDE the target cluster (memql#2220). (enum: workbench, computer-use, mcp, cockpit-runner) |
| `lastSeen` |  |  | Last availability heartbeat -- staleness signal for the resolver (full liveness model is an open question, #1742). |
| `machineId` | string |  | For kind=computer-use: the stable machine identity (see open question in #1742 on stable identity across reconnects). |
| `ownerUserId` | string | yes | v1:identity:user.id of the owner. Per-row authz key (owned tier); computer-use machines + workbenches are per-user. Stamped from actor.userId by registerSurface. |
| `priority` | integer | yes | Failover order within the available set (lower runs first). The default surface (workbench) is registered with a low priority so it wins by default. |
| `provenanceMutation` | string |  | Name of the mutation that produced this surface version (audit trail). |
| `slug` | string | yes | Stable surface identifier used in bindings/policies: 'workbench', 'computer-use:<machineId>', 'mcp:<server>'. (ownerUserId, slug) is the registry key. |
| `status` | string | yes | Registry lifecycle. retired surfaces are kept (append-only) but excluded from resolution. (enum: active, retired) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:agent`

System-level AI assistant templates with configurable capabilities, personalities, and provider settings. Global-scoped: lives in _system alongside v1:identity:user, since per-user platform agents (assistant, plannerAgent, trainerAgent) are infrastructure that every tenant sees the same way -- keyed by ownerUserId payload field, addressed canonically as _system:v1:agents:agent:<seedName>-<userShortId>.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the agent template is available for use. |
| `capabilities` | object |  |  |
| `colorIndex` | integer |  | Persistent color palette index (0-12). Assigned at creation, never changes. Used for consistent agent colors across all surfaces. |
| `deleted` | boolean |  | When true, the agent has been permanently removed and should not appear in any agent list. Distinct from active:false (deactivated) which keeps the agent visible but disabled. |
| `description` | string |  | Brief description of the agent's purpose. |
| `groupIds` | array |  | IDs of groups this agent is assigned to. Empty means global/unscoped. |
| `identity` | object |  |  |
| `kind` | string | yes | First-class agent identity: what KIND of agent this is across the platform. `assistant` -- user-facing conversational agent (the per-user General Assistant). The user's active assistant joins their spaces. `specialist` -- agent that does tool work for a Task (planner-provisioned or user-created). Specialists answer through tools and never write user-facing utterances. `system` -- platform-internal agent (MemQL Planner, MemQL Trainer, future system-owned ones); hidden from every user-facing surface, not editable / deletable by users. Distinct from but aligned with the `role` field, which is the guardrail-routing classifier read at dispatch time (specialist vs assistant); the invariant `kind == "system" OR kind == role` keeps the two in sync. Stamping paths: user-actor `createAgent` -> `assistant` via default; planner-driven `createAgent` calls pass `kind: "specialist"` (memql#399); seed materializer (plannerAgent / trainerAgent) passes `kind: "system"`. The SPA (`frontend#121`) reads this field to filter / route / hide; epic #122 / #123 / #124 land the SPA-side consumers. Backfilled from the prior `enum("system", "user")` schema: `system` rows stay `system`; `user` rows split into `assistant` (role=assistant) or `specialist` (role=specialist). Pre-prod (no migration tooling needed; seed regen on a fresh DB). (enum: assistant, specialist, system) |
| `lineage` | object |  |  |
| `name` | string | yes | Display name of the agent. |
| `ownerUserId` | string |  | Canonical owning-user pointer. Distinct from the engine-auto-stamped `createdBy` column: createdBy carries the request actor at insert time, which is the user when the agent is created via the Create Agent modal but is the system actor (`system:automation:provisionAssistantOnUserCreate`) when the assistant is auto-seeded by the provisioning automation. Owner-keyed lookups (Computer Use status, worker dispatch routing, agent-context auto-injection for worker tools) read this field first and fall back to createdBy. |
| `personality` | string |  | System prompt describing the agent's persona and behavior. |
| `providerConfig` | object |  |  |
| `role` | string |  | Role in the guardrail routing hierarchy. Specialists answer through tools and never write user-facing utterances. The assistant is the sole agent that converses with humans in the space. Related to `kind` but distinct: `kind` is the platform-identity classifier (assistant / specialist / system) that the SPA filters on, while `role` is the dispatch-time guardrail. Invariant: `kind == "system" OR kind == role` -- a non-system agent's kind always matches its role. System agents may carry either `role=assistant` (rare; reserved for future) or `role=specialist` (the current MemQL Planner / MemQL Trainer pattern). (enum: specialist, assistant) |
| `roleEmbedding` | array |  | Embedding of (role + roleSlug + description + the resolved domain union across capabilities.skillIds[]) used by the layered dedupe (Q10) similarity check. Recomputed on insert/update of any of those fields by the agentRoleEmbed automation. Empty for legacy agents until the backfill runs. Stored on the row rather than a sidecar concept for v1 simplicity; can be moved to v1:agents:agentEmbedding later if row width becomes a concern. |
| `roleSlug` | string |  | Specialty slug -- the canonical identifier for the agent's specialty (it-support, accounting-finance, customer-service, human-resources, legal-compliance, sales-marketing, operations, project-management, research-development, training-education, quality-assurance, assistant, ...). UNIQUE per partition: at most one non-deleted agent may carry any given roleSlug per partition. Empty for legacy / unscoped agents. The frontend's role dropdown filters out roleSlugs already taken in the partition so duplicates can't be created from the UI; the constraint is enforced caller-side. |
| `systemPrompt` | string |  | System prompt/instructions that define how this agent interacts with users. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:identity:identity`, `createdBy` -> `v1:work:run`, `references` -> `v1:agents:agent`

## `v1:agents:agentAuthorization`

Standing authorization granting an agent permission to trigger Plans of certain kinds without per-Plan user approval. Per Q4 Option B (tiered trust + opt-in autonomy): agent-proactive Plans default to 'requires user approval' (canvas suggestion card -> click Approve to start); the user can graduate a specific agent to standing authorization for specific plan kinds via the 'Approve & always allow this' button on the suggestion card. The grant is per (agentId, planKind, spaceScope) and carries a per-grant token budget cap + an expiry so autonomy is bounded by default.
ROW AUTHZ (memql#3177, carrying memql#3129 + memql#3138). The tier below is what makes this concept's long-standing "only the granting user can revoke" claim a fact rather than a comment. Three things had to be true at once and now are:   1. the tier is DECLARED here, so #3174's write guard resolves the target row and      refuses revokeAgentAuthorization / updateAgentAuthorization / updateAgentAuthScope      when the row's userId is not the caller's;   2. userId is SERVER-STAMPED on every write that touches it (createAgentAuthorization      stamps it; updateAgentAuthorization re-stamps it over its payload splat), so a      caller cannot rewrite the field the tier is keyed on -- the two-call escalation      memql#3138 documented;   3. the READ is caller-scoped (agentAuthorizationsForSelf), so the grants cannot be      enumerated for a stranger either. Dropping any one of the three reopens the other two: an unstamped userId defeats the guard from inside a row the attacker legitimately owns, and an unscoped read hands out the ids the guard is asked about.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string |  | What the grant authorizes the agent to do. NOT stamped, deliberately: createAgentAuthorization does not write this field, and an absent value is read as 'not this action' by every gate (mintSkill_handler compares getString(row, "action") == "mintSkill"), so absence fails CLOSED. Stamping a "triggerPlan" convention here would BROADEN every grant the mutation creates, which is the wrong direction for an authorization record. triggerPlan = auto-trigger Plans matching planKind without per-Plan approval (legacy behavior; default for backward compatibility). createSpecialist = the Planner Agent may auto-mint specialists matching planKind (Q4 standing envelope). extendSpecialist = may auto-clone-and-extend an existing specialist (Q10 layered dedupe). trainSpecialist = may auto-trigger trainSpecialist Plans for the specialist. mintSkill = the Planner Agent may mint a NEW v1:skills:skill row when the catalog lacks a suitable bundle (Phase 3 / memql#159). For mintSkill the skillTierAllowlist field gates which skill tiers (A / B / C) the planner may mint at without per-mint approval; out-of-allowlist mints surface a canvas approval card and park the Plan. (enum: triggerPlan, createSpecialist, extendSpecialist, trainSpecialist, mintSkill) |
| `active` | boolean |  | Soft-revoke flag. User-revocable from the agent's settings at any time. |
| `agentId` | string | yes | v1:agents:agent.id this grant authorizes. |
| `computerUseScope` | string |  | Standing computer_use authorization tier the user has granted this agent (Q9 layer 2). observe = read-only worker calls (screenshot, fs_read, fs_list, fs_stat, http_fetch GET, cursor/display/window-list). full = adds shell exec, fs_write, full HTTP, mouse + keyboard + window_focus. Empty string means computer_use is not authorized for this agent in this scope; dispatch rejects with denied_by_scope. Plans can declare a NARROWER scope at creation time but never wider. NOTE: the `interact` value is a retired tier kept in the enum for backward compatibility with rows written before the simplification; the read path treats it as `full`. (enum: , observe, interact, full) |
| `expiresAt` |  |  | When this grant expires. Null = no expiry (lifetime grant). Default UI proposes 30-day expiry with a renewal prompt before expiration. |
| `maxPerPlan` | integer |  | Cap on how many times this action can fire under a single parent Plan. Used primarily for action='createSpecialist' (e.g. 'up to 3 new specialists per Plan'). Null = no cap. |
| `planKind` | string | yes | Plan kind this grant covers, OR '*' to cover any kind. Matches v1:planner:plan.kind values. For action='triggerPlan' this is the kind being triggered; for createSpecialist/extendSpecialist/trainSpecialist this is the originating-Plan kind that the action fires under. |
| `roleSlugAllowlist` | array |  | Optional list of agent.roleSlug values this grant covers; empty = any roleSlug. Lets the user say 'auto-create technical specialists but ask before HR / Legal / Finance roles'. Only meaningful for action='createSpecialist'/'extendSpecialist'. |
| `skillTierAllowlist` | array |  | For action='mintSkill' grants (Phase 3 / memql#159): the v1:skills:skill tiers (A / B / C) the planner may mint at without per-mint approval. Default is implicitly ['A'] when the grant is created -- the planner integration injects that default at read time when the field is empty AND action='mintSkill'. B and C are riskier (safety-relevant + high-stakes regulated respectively) so they require explicit user opt-in via the 'Approve & always allow this tier' button on the mintSkillApprovalRequested canvas card. Empty / unused for non-mintSkill grants. |
| `spaceScope` | string | yes | Space id this grant is restricted to, OR '*' to cover any space owned by the user. Lets users grant 'Cleo can auto-run analyzeFile in the HR space' without granting workspace-wide. |
| `tokenBudgetCap` | integer |  | Per-Plan token budget ceiling enforced when this authorization is consumed. Even auto-approved plans can't blow through tokens beyond this cap. Null = use User.preferences.defaultPlanTokenBudget. |
| `userId` | string | yes | v1:identity:user.id of the user who granted the authorization. THE ROW-AUTHZ OWNER FIELD: this concept declares @rowAuthz(owner='userId'), so this field decides who may read, revoke or update the grant, and it is server-stamped from actor.userId by every mutation that writes it -- never accepted from caller args. 'Only the granting user can revoke' is ENFORCED as of memql#3177: the engine resolves the target row on update/revoke and refuses a caller who is not this user (component/memql/rowauthz_write_guard.go). Before that it was documented and unenforced, and any authenticated caller who knew an authId could revoke a stranger's grant or write computerUseScope / skillTierAllowlist into it. |

**Relationships:** `parent` -> `v1:agents:agent`, `parent` -> `v1:identity:user`

## `v1:agents:agentRole`

First-class catalog of agent roles. A role is the spine of an agent's identity: it picks the locked minimum skills (knowledge + tool + live-source bundles), declares the recommended LLM policy, and caps how many skills an agent in the role may carry at once. The role is the contract the assistant fulfills when it auto-creates a specialist mid-conversation -- pick the role, copy its locked + default skills onto the new agent, materialize the row. Lock semantics (#158): lockedSkillIds is the minimum required set for any agent carrying this role. The cockpit's Studio renders locked rows with a lock icon; updateAgent rejects writes that strip a locked id (server-side enforcement, not just UI). defaultSkillIds is pre-selected when the agent is created but the user / planner may remove them later. forbiddenSkillIds hard-denies skills the agent factory MUST NOT grant. availableSkillIds (when non-empty) is the inclusive 'visible in the picker' set; empty = anything not forbidden is permitted. maxSkills caps the count -- 5 for specialists, 2 for the assistant by default. Predefined rows are re-seeded on every startup; user-created roles default to predefined=false and stay fully editable. Predefined rows are locked on the write path by validateAgentRolePredefinedLock, which mirrors the v1:rbac:role guard: a non-system actor cannot modify one at all, and cannot mint a new predefined row (memql#2985). The SeedMaterializer re-materializes them on every startup, so an edit would not survive a boot in any case. Per-user roles are global-scoped because routing decisions need to see the same role surface across every partition; that makes one user's custom role visible to every caller -- a known trade rather than an oversight, with the scoped alternative written down. See the note above activeAgentRoles in dsl/agents/queries.memql.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive roles disappear from the picker but existing agents that carry the role keep functioning. |
| `availableSkillIds` | array |  | Skill ids visible in the picker for this role. Superset of locked + default. Empty = 'every non-forbidden skill is permitted' (the open-picker default for general-purpose roles); a non-empty list narrows the picker to that explicit set. |
| `category` | string | yes | Coarse grouping for the picker. professional = white-collar business roles. personal = household/lifestyle. creative = arts/writing. scientific = research/discovery. medical / legal / financial = regulated. trades = skilled labor. education = K-12 + higher ed. civic = government / public service. hospitality = food/lodging/events. agriculture = farming/ranching. transportation = pilots/captains/drivers. energy = utilities/power. specialized = doesn't fit elsewhere. hobby = recreational pursuits. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby) |
| `defaultSkillIds` | array |  | Skill ids pre-selected when the agent is minted but freely removable later. Distinct from lockedSkillIds: locked = always there, default = nice-to-have starting point. Disjoint by convention (a skill id is either locked or default, not both). |
| `description` | string |  | One- or two-line description of what an agent in this role does. Surfaced in tooltips + the role picker's expanded view. |
| `forbiddenSkillIds` | array |  | Skill ids the agent factory MUST NOT grant to agents in this role -- hard denylist that overrides availableSkillIds. Mirrors the old forbiddenToolSlugs semantic. Use for Tier-C medical roles that must never carry operator-computer-use, regulated finance roles whose audit story can't tolerate workbench shell access, etc. |
| `lockedSkillIds` | array |  | v1:skills:skill ids the role MUST carry -- updateAgent rejects writes that strip any of these from agent.capabilities.skillIds. Phase 2 (#158) cut: replaces the three parallel locked* lists (lockedDomainIds, lockedToolSlugs, lockedLiveKnowledgeIds) with a single skill-id surface. The skill bundle's domain / tool / liveSource composition is resolved at attach time by the agent factory. |
| `maxSkills` | integer | yes | Count cap on agent.capabilities.skillIds. updateAgent rejects writes where len(skillIds) > effective cap, computed as min(agent.capabilities.skillBudgetMax, role.maxSkills). Defaults: 5 for specialist roles, 2 for the assistant role (which is meant to orchestrate, not specialize). |
| `name` | string | yes | Display name, e.g. 'IT Support' or 'Family Medicine Physician'. Surfaced in role pickers and on the agent card. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/roles/*.memql on every startup. Predefined rows are LOCKED in the role manager UI: name / description / category / locked + forbidden fields + maxSkills are read-only; only tier edits are accepted. User-created roles default to predefined=false and remain fully editable. The role catalog itself is the only place where 'admin-only edit predefined rows' would happen, and even there the locks come back on the next startup if not aligned with the source slice. |
| `slug` | string | yes | Canonical slug -- the value v1:agents:agent.roleSlug points to. Kebab-case, stable, never renamed (rename = new row + migration). Examples: 'it-support', 'family-doctor', 'commercial-pilot', 'union-carpenter'. ENFORCED UNIQUE ACROSS ACTIVE ROWS on the write path by validateAgentRoleSlugUnique (component/memql/agent_role_slug_unique_validation.go, memql#3207): a write that would put a second ACTIVE row under a slug an active row at a different id already holds is refused -- including a RENAME onto a taken slug, and including the raw insert() path that skips the mutation template. Be exact about the bounds, because this description is the thing a reader trusts. (1) The rule is over ACTIVE rows only: deactivating a role releases its slug, so 'never renamed' is a convention about how to treat the field, not a claim that the store forbids reuse afterwards. (2) The SYSTEM actor is carved out, mirroring validateAgentRolePredefinedLock, so the SeedMaterializer's idempotent re-write of every predefined role on each boot cannot be refused -- which means two AUTHORED seeds claiming one slug is not caught here. (3) It is not an ownership control: this concept has no owner field, so a caller supplying NO agentRoleId gets id = slug, which for an existing user role is that row's own id, and the write read-merges over it rather than being refused as a duplicate. Uniqueness is a key constraint; that hole needs an owner column. memql#3066's preference in findRoleBySlug is retained as defence in depth and is now BACKED by this invariant rather than standing in for it. |
| `systemPromptHints` | string |  | Free-text guidance the agent factory layers into the role's system prompt. NOT the full system prompt -- the agent's own systemPrompt field still wins -- but a short paragraph of role-shape direction (tone, scope of expertise, escalation behavior) that the factory can inject. Example for 'family_doctor': 'You provide general health information, not personal medical advice. Always recommend consulting a licensed practitioner for diagnosis or treatment decisions.' |
| `tier` | string |  | Safety tier, mirroring v1:knowledge:knowledgeDomain.tier by convention so a role and the domains its locked skills carry are classified consistently. A = general. B = safety-relevant. C = high-stakes regulated (clinical medicine, surgery, anesthesia, securities advice, legal practice, structural engineering); agents in Tier-C roles are still creatable. ADVISORY ONLY on this concept (memql#3068): the sole consumer of agentRole.tier is roleCatalogForPrompt (integrations/agents/factory.go), which passes it to the agentFactoryAnalyze prompt so the model choosing a role can weigh how sensitive each one is. (An earlier draft of this text also named responsibilityIntake; that is wrong -- roleCatalogForPrompt has one call site, in analyzeGoal, and responsibilityIntake receives no role catalog at all. Its prompt schema declares the catalog shape without tier and its template never renders one.) The field is ALSO projected by the agentRoleFull shape, so it reaches the role-picker UI over the wire -- 'sole consumer' means sole ENGINE consumer, and if you are auditing who can SEE this field rather than who acts on it, that projection is the answer. NOTHING BRANCHES ON IT -- there is no tier-keyed disclaimer injection and no tier-keyed create-flow warning, and this description previously claimed both. The disclaimer machinery is keyed on knowledgeDomain.tier, NOT on this field (integrations/knowledge/seed_domain_content.go): a Tier-B DOMAIN gets disclaimerChunkText prepended as chunk 0; a Tier-C DOMAIN gets curated Wikipedia content where a mapping exists (17 of the 30 Tier-C domains today) and placeholder content telling the user to upload authoritative sources only as the fallback -- the placeholder is the minority case, not the rule. An agent in a Tier-B/C role does therefore tend to inherit those effects -- but through the domains its locked skills carry, not through this field. Read it as a classification hint, never as an enforced safety control. TestAgentRoleTierIsPromptAdvisoryOnly (integrations/agents) sweeps for a second reader across the engine paths where a tier-keyed control would actually land -- integrations/agents, integrations/agent, and component/memql, which is where the server-side write validator already loads the role row. Be exact about what that buys: it catches a new READER in those paths, which is the drift that produced memql#3068. It is a sweep, not a proof, and an earlier draft of this sentence claimed the text 'cannot silently go stale again' while the sweep covered ONE package -- measured, a tier-keyed create-flow rejection added to component/memql passed it. (enum: A, B, C) |

## `v1:agents:operatorMemory`

Session-scoped memory for UI-driving agents. One record per user; accumulates short notes across takeovers so the operator agent can learn the user's app usage patterns and shortcut repeat work.

| Field | Type | Required | Description |
|---|---|---|---|
| `entries` | array |  | Append-only list of memory notes. Each entry is { ts: datetime, kind: string, goal: string, route?: string, summary: string }. The operator agent writes to this list after each successful takeover and reads from it at the start of the next one. Bounded in practice by the agent's own trim rules (most recent N entries). |
| `lastUpdatedAt` |  |  | Timestamp of the most recent entry. Convenience field; the authoritative order is entries[].ts. |
| `userId` | string | yes | ID of the user this memory belongs to. One-to-one with v1:identity:user. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:skillChangeEvent`

Append-only audit log for every skill attach / reconfigure event on an agent. Mirrors v1:knowledge:validationEvent: denormalized state lives on the agent row for fast queries; this event log carries the per-mutation history the planner trace viewer (cockpit#125) and audits replay against. Two writes per attach (the agent row update + the event row); cheap. Phase 1 lands the concept; Phase 2 starts writing rows from the agent factory. detached is reserved for a future phase -- v1 is append-only because no consumer currently reads the negative path.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorAgentId` | string |  | v1:agents:agent.id of the agent that drove the change -- the Planner Agent for planner-driven attaches, empty for human-driven changes. Mutually distinguishable from actorUserId; exactly one of the two is set per event. |
| `actorUserId` | string |  | v1:identity:user.id of the human that drove the change (cockpit Skills admin view, agent edit modal). Empty for planner-driven attaches. |
| `after` | object |  | Snapshot of the agent's capability shape AFTER the change. Same key set as before. Used by the planner trace viewer to diff what the planner's mintSkill / extendSpecialist run actually added. |
| `before` | object |  | Snapshot of the agent's capability shape (domainIds, toolSlugs, liveSourceIds) BEFORE the change. Empty {} for the very first attach to a freshly created agent. Stored verbatim so a future replay tool can rewind state without re-querying the row history. |
| `changeKind` | string | yes | attached = a new skill was added to the agent. skillReconfigured = an already-attached skill's composition shifted under the agent (downstream domain edits propagated through; rare but possible). detached is reserved for a future phase; v1 is append-only. (enum: attached, skillReconfigured) |
| `runId` | string |  | v1:work:run.id of the run the change happened under, if any. Lets the trace viewer surface 'attached during run X' attribution + group co-occurring attaches under the same run. |
| `skillId` | string | yes | v1:skills:skill.id that was attached or reconfigured. The event log entries are denormalized by skillId so the audit / trace viewer can answer 'when was X attached to Y'. |
| `targetAgentId` | string | yes | v1:agents:agent.id whose skill set changed. Pair with createdAt to reconstruct an agent's skill timeline. |

**Relationships:** `references` -> `v1:agents:agent`, `references` -> `v1:skills:skill`, `references` -> `v1:agents:agent`, `parent` -> `v1:identity:user`, `references` -> `v1:work:run`

## `v1:authoring:bundle`

An atomic, versioned unit of planner-authored DSL: one automation plus the dependency closure it needs (logic / shapes / specs / traits / policies / mutations / queries / prompts), compiled from a user Responsibility. The bundle is the unit of validation and activation -- the whole closure passes Gate 1 (isolated compile+bind), Gate 2 (tiered behavioral dry-run), and Gate 3 (user approval) together, then activates together into the sandboxed authored-construct runtime (#959). Never part of the core engine Init() path, so a malformed bundle can never brick the cluster. Member constructs are v1:authoring:construct rows pointing back via bundleId.

| Field | Type | Required | Description |
|---|---|---|---|
| `activatedAt` |  |  | When the bundle was approved + registered into the authored runtime (status -> active). Null until activated. |
| `dryRunReport` | object |  | Gate 2 result (tiered behavioral dry-run, #958): {ok: bool, trace: [...], sideEffectManifest: {mutations: [...], aiCalls: [...], webCalls: [...], blockedWebhooks: [...]}, costEstimate: {tokens, usd}}. The approval artifact shown to the user at Gate 3. Populated by recordBundleDryRun. Empty until Gate 2 runs. |
| `failureReason` | string |  | Populated when status transitions to failed -- which gate failed and why (e.g. 'gate1: spec specX references unknown field payload.foo'). Cleared on a successful re-author. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this bundle (the Responsibility author). Per-row authz owner; server-stamped from actor.userId at create, never caller-supplied. Authored automations run under THIS user's authz envelope -- no privilege escalation. |
| `responsibilityId` | string |  | v1:planner:responsibility.id this bundle was compiled from, when authored via the Responsibility intake path. Empty for bundles authored directly. Links the human-facing standing directive to its compiled artifact. |
| `retiredAt` |  |  | When the bundle was retired. Null unless status=retired. |
| `reusedConstructRefs` | array |  | Existing constructs this bundle COMPOSES rather than authors (the compose-first dependency strategy). Each entry: {name, kind, namespace, source: 'core'\|'catalog'}. Net-new dependencies are authored as their own v1:authoring:construct rows; this list records the reuse edges for the dependency graph + impact analysis (#957). |
| `sourceRunId` | string |  | v1:work:run.id this bundle was post-hoc captured from, when authored via the capture path (epic memql#1160) rather than a standing Responsibility. Empty for Responsibility-authored or directly-authored bundles. Links the run that actually happened to its reproducible, inspectable compiled artifact, and is the idempotency + lookup key for the capture orchestrator (skip re-authoring a re-delivered terminal event). Was sourcePlanId until memql#5050: capture reads the tool calls a run recorded, so the thing it was captured FROM is a run. |
| `status` | string | yes | Lifecycle. draft = constructs authored, not yet validated. validated = passed Gate 1 (isolated compile+bind) -- see validationReport. dryRunPassed = passed Gate 2 (tiered behavioral dry-run) -- see dryRunReport. active = approved (Gate 3) and registered into the authored-construct runtime; its automation is live. paused = temporarily disabled by the user or a circuit breaker without retiring. retired = permanently deactivated (superseded by a new version or removed). failed = a gate failed (validation or dry-run); failureReason carries why. Transitioned via the authoring mutations; the engine does not enforce a hard state machine here (the planner loop drives transitions). (enum: draft, validated, dryRunPassed, active, paused, retired, failed) |
| `summary` | string |  | Longer human description of what the bundle does, generated by the planner design pass. Shown on the approval card alongside the dry-run trace + side-effect manifest. |
| `supersedesBundleId` | string |  | When this bundle is a new version of an existing capability, the v1:authoring:bundle.id it replaces. On activation the superseded bundle is retired. Empty for a first-version bundle. |
| `title` | string | yes | Human-readable name of the capability this bundle implements (e.g. 'Draft a reply when a refund escalation arrives'). Surfaced on management cards + the approval (Gate 3) artifact. |
| `validationReport` | object |  | Gate 1 result (isolated compile+bind, #956): {ok: bool, diagnostics: [{constructName, severity, message, line?}], boundConcepts: [...], unresolvedRefs: [...]}. Populated by recordBundleValidation. Empty until Gate 1 runs. |
| `version` | integer |  | Monotonic version of this capability. A user edit to the Responsibility (or a dependency change) produces a NEW bundle that supersedes the prior one via supersedesBundleId, rather than mutating an active bundle in place. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:planner:responsibility`, `references` -> `v1:work:run`, `references` -> `v1:authoring:bundle`

## `v1:authoring:construct`

One authored DSL construct that is a member of a v1:authoring:bundle: the `.memql` source for an automation / logic / shape / spec / trait / policy / mutation / query / prompt, plus its cached compiled form. These are the NET-NEW constructs the planner authored because nothing existing fit (compose-first, author-the-gap); reused constructs are recorded on the bundle's reusedConstructRefs instead. After a bundle activates, a construct can be promoted into the per-owner reusable catalog (catalogued=true) so later bundles compose it -- the catalog match key lives in catalogKey (#957).

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleId` | string | yes | v1:authoring:bundle.id this construct belongs to. Every authored construct is a member of exactly one bundle. |
| `catalogKey` | string |  | Dedup / match key for the catalog (#957): a stable signature of what this construct does (e.g. kind + bound concept + normalized predicate), used by the similarTo-backed matcher to find an existing construct before authoring a new one. Empty until catalogued. |
| `catalogMatchText` | string |  | The name-independent semantic text (kind + @description intent + canonicalized body) that was embedded for the near-match retrieval tier (#957). Computed by CatalogMatchText at promotion time and stored alongside the embedding (the vector itself lives in node_vectors keyed by this construct's id, vector_field='content') so similarTo can rank close-but-not-identical constructs for a stated need, and a re-embed can backfill from it. Empty until catalogued. |
| `catalogedAt` |  |  | Provenance (#957): when this construct was promoted into the owner's reusable catalog (the post-activation catalog-write path). Null until catalogued. Together with ownerUserId (who) and catalogedFromBundleId (which activated bundle) this is the full reuse provenance later bundles inherit when they compose it. |
| `catalogedFromBundleId` | string |  | Provenance (#957): the v1:authoring:bundle.id whose activation promoted this construct into the catalog. Normally the construct's own bundleId, but recorded explicitly so the provenance survives even after that bundle retires (a cataloged construct outlives a single bundle). Empty until catalogued. |
| `catalogued` | boolean |  | True once this construct has been promoted into the owner's reusable catalog (post-activation), so later bundles can compose it instead of re-authoring. Drives the compose-first reuse path (#957). |
| `compiledForm` | object |  | Cached compiled representation produced by the sandbox compile+bind harness (#956), so activation doesn't re-parse. Empty until Gate 1 compiles the bundle. |
| `conceptDataStaged` | boolean |  | Concept-only (epic memql#3974): the rows written under this promoted concept are STAGED -- they exist, they are addressable, and they are withheld from the ordinary read path until the concept is TRAINED, at which point they become live in place. The name says DATA deliberately, because `status: staged` on this very row is a different fact owned by a different epic (memql#3928): there, staged is a property of the CONSTRUCT's RESOLUTION SCOPE -- it resolves for its author alone and is not broadcast -- and `concept` is refused from that tier by name, since a concept has no owner-scoped resolution path and staging one would register an entry nothing could ever read. Here the concept IS registered shared, IS resolvable, and DOES accept writes; the only thing withheld is the VISIBILITY OF ITS ROWS. So this cannot be a `status` value even setting the collision aside: a status the boot re-hydration skips leaves the concept unresolvable, and rows under an unresolvable concept are UNREADABLE rather than staged -- the same argument conceptRetired records above, arriving at the same sibling-boolean answer. Visibility is a pure function of the CONCEPT and is marked nowhere else, least of all per row: measured against a fully-compressed TimescaleDB hypertable, this concept-grain flip is one insert at 11ms and decompresses nothing, while every row-marked variant either forces decompression (116-142ms per 10k rows, and hard-errors outright under timescaledb.enable_dml_decompression=false) or doubles version history and makes every later read of that concept 3-5x slower forever. Re-hydration replays it, and resolution across rows is `a live row wins` -- the same asymmetry conceptRetired takes and for the same shape of reason: a stale stamp resolving to LIVE costs visibility an owner can withdraw again, while a stale stamp resolving to STAGED hides the rows of a concept its owner has already trained, which is indistinguishable from data loss. |
| `conceptRetired` | boolean |  | Concept-only (memql#3756): this promoted concept was DEMOTED while rows already existed under it, so it stays REGISTERED -- name still claimed, existing rows still readable -- and new writes to it are refused. Deliberately NOT `status: retired`, which means the opposite thing on this row: a status-retired construct is skipped by the boot re-hydration and therefore never re-registers, which for a concept would make every row already written under it unreadable. A concept demote with ZERO rows uses status instead, because there is no data to strand and the name must go back to being claimable. Re-hydration replays this: the row registers the concept and is then marked retired, so a restart comes back retired rather than active. Resolution across rows is `a live row wins` -- a re-promote writes a NEW construct row with this false, and the un-stamped row is what un-retires the concept, so a stale stamp can never silently refuse writes to a concept its owner has re-promoted. |
| `goalSignature` | string |  | The work spine's catalog key (epic memql#4966): sha256 over the NORMALIZED goal statement plus the SORTED input argument names, computed by component/work.GoalSignature. This is what compile's exact-match tier looks a goal up by, and it is a separate field from catalogKey because catalogKey hashes construct SOURCE per kind and refuses `automation` outright -- which is the kind a compiled goal is, so a goal could not be looked up by it at all. Empty on a construct that was never compiled from a goal. |
| `grammarVersion` | string |  | The engine grammar epoch this source was authored under (parser.GrammarVersion, S6 #2361), stamped at create. Re-hydration compares it against the running engine's grammar: a MISMATCHED stamp quarantines the row with an error naming the memqlmigrate rewrite mode instead of a silent degradation. Empty on legacy rows (treated as unknown; recompile decides). |
| `kind` | string | yes | Which DSL construct kind this source defines. Drives which loader/validator the sandbox compile+bind harness (#956) routes it through. `concept` is the memql#3746 addition -- the anchor of the training epic, since a customer's domain arrives as nouns first and every other kind binds to one; a promoted concept row re-derives its canonical id from the source's @namespace at re-hydration, so `name` here stays the DECLARATION name like every other kind. (enum: concept, automation, logic, shape, spec, trait, policy, rule, mutation, query, prompt) |
| `lastReinforced` |  |  | When the ladder last climbed. Together with reinforceCount this is what decides whether a template has succeeded often enough to be offered back to its owner as a responsibility with its arguments as the form. |
| `name` | string | yes | The construct's DSL name as it appears in source (e.g. the automation/logic/spec name). Owner-scoped uniqueness; the authored runtime registers it under targetNamespace so two users' authored constructs never collide. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this construct (same as the parent bundle's owner). Per-row authz owner; server-stamped from actor.userId at create. |
| `reinforceCount` | integer |  | How many successful runs have reinforced this template. Absent reads as 0. |
| `reliability` | number |  | The trust ladder (epic memql#4966, spec section E `Promote`): how far this template has earned being replayed without a model. Climbs when a run whose fingerprints matched succeeds, decays on mismatch and on disuse. Absent reads as 0, which is the correct starting point -- a template that has never succeeded has earned nothing -- so there is deliberately no @default to stamp. NOTE the ladder ALSO exists on v1:actions:action and moves onto v1:skills:skill in epic A3; this is the TEMPLATE's reliability, which is a different subject from a skill's, and the two are not merged. |
| `source` | string | yes | The raw `.memql` source text for this construct. The single source of truth; the compiled form is derived + cached. |
| `status` | string | yes | Follows the parent bundle's lifecycle at a construct grain: draft while the bundle is pre-activation, active once the bundle activates, retired when the bundle retires. Lets a cataloged construct outlive a single bundle. `retired` means WITHDRAWN -- the boot re-hydration skips the row, so the construct never re-registers. For a promoted CONCEPT that is only one of the two withdrawal outcomes (see conceptRetired). `staged` is the middle tier (memql#3928): the row persists and is reviewable exactly as an active one is, and the boot re-hydration registers it OWNER-SCOPED rather than into the shared registry -- session-define, minus dying with the connection. Training is the transition staged -> active, which registers it shared and fires the cross-node broadcast; staging simply does not fire it, and that omission IS the tier. (enum: draft, staged, active, retired) |
| `targetNamespace` | string | yes | The namespace this construct registers under in the authored runtime (e.g. an owner-scoped namespace). Resolution precedence at runtime is core (sealed) -> owner-catalog -> bundle-local. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:authoring:bundle`, `references` -> `v1:authoring:bundle`

## `v1:authoring:dependencyEdge`

One dependency edge in a bundle's construct graph (epic memql#954, issue #957). Construct `fromConstruct` (kind `fromKind`) in bundle `bundleId` depends on construct `toName` (kind `toKind`), which resolves from `toSource` (core = sealed engine, catalog = the owner's reusable catalog, bundle = bundle-local). Edges are recorded at compile time so the catalog can run IMPACT ANALYSIS -- 'which bundles depend on this construct' -- before a shared / cataloged construct changes. This is the reuse-coupling mitigation from the design doc: editing a cataloged construct re-validates its dependents.

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleId` | string | yes | v1:authoring:bundle.id whose construct declares this dependency. |
| `fromConstruct` | string | yes | Name of the depending construct (the one that references the dependency). |
| `fromKind` | string | yes | Kind of the depending construct. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this edge (the bundle owner). Per-row authz owner; server-stamped from actor.userId. |
| `toKind` | string | yes | Kind of the depended-on construct. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `toName` | string | yes | Name of the depended-on construct. |
| `toSource` | string | yes | Where the dependency resolves under the precedence core -> owner-catalog -> bundle-local. Edges to `catalog` are the ones impact analysis cares about when a shared construct changes. (enum: core, catalog, bundle) |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:authoring:bundle`

## `v1:bench:run`

One invocation of the proving suite. Written by `memql-bench --do=run`, once per run, before any sample.
CLUSTER-OWNER TIER WITH A READ FLOOR AT ADMIN (memql#5216), and it has no owner field at all. A benchmark is a fact about the DEPLOYMENT rather than about a person: there is nobody whose row this is, so the composite `owner=..., clusterOwner` form other operator surfaces use would have an owner key that nothing could ever fill.
THE FLOOR RELAXES THE READ AND LEAVES THE WRITE WHERE IT WAS, and that asymmetry is why it exists. `clusterOwner` alone said two things at once -- only the deployment writes these, AND only the cluster owner reads them -- and the second was never intended. MemQL OS surfaces these rows at Settings -> Benchmarks with `roles: { min: "admin" }`, so a non-owner admin was admitted to the screen and served nothing. On a surface built so that an absence takes the same room as a number, that refusal rendered as UNMEASURED: a permission answer wearing the costume of a measurement, on the one screen whose design principle is that an absence must be legible.
EVERY MUTATION BOUND TO THIS CONCEPT IS @serverOnly, and that is the load-bearing part. These rows are what the README's published claims rest on (the claims gate in scorecard/claims.go checks a marked claim against the committed scorecard), so a client-reachable write here would be a primitive for forging the numbers the product is sold on. The writer stamps internal origin and takes an entry in call_origin_conformance_test.go's allowlist saying exactly that.

| Field | Type | Required | Description |
|---|---|---|---|
| `blockingFailures` | array |  | The blocking failures, in the suite's own words. Empty on a pass. A negative control that read zero appears here and is the most serious entry it can carry: it means the counter behind a metric never goes up on any path, so every green figure that metric produced means nothing. |
| `commit` | string | yes | Short SHA the suite ran at. Required on every figure: a number nobody can reproduce is a number nobody should act on. |
| `corpusFingerprint` | string | yes | Digest over the scenario corpus's CONTENT, from component/proving/scenario. Two runs with different fingerprints measured different things, and joining them into a trend is the mistake this field exists to make visible. It moves when an asserted value changes and stays put when the JSON is merely reformatted. |
| `costUsd` | number |  | What this run cost. Absent rather than zero on a CI run, which reaches no provider: an absent figure and a zero are different answers, about money as much as anything else. |
| `finishedAt` |  |  | When it ended. Empty on a run that did not finish. |
| `modelIds` | array |  | The models involved, sorted. On a live run these are the providers called. On a CI run they are what the cassettes were RECORDED against -- `synthetic` where the tape holds placeholder responses, which is honest about structure and silent about anything model-dependent. |
| `runner` | string |  | The machine class the run happened on, so a wall-clock figure from a shared CI runner is not silently compared against one from a workstation. |
| `scenarioCount` | integer | yes | How many scenarios ran. A run whose count fell without a corpus change is a run that skipped something. |
| `startedAt` | string | yes | When the run began. |
| `tier` | string | yes | Which lane produced this run. `ci` replays from recorded responses and reaches no provider; `live` runs against real providers. The two measure different things about the same metric names, which is why a figure from one is never compared against a figure from the other -- component/proving/figure.Compare returns `undecidable` across a tier boundary rather than pretending. (enum: ci, live) |
| `verdict` | string | yes | `pass` means no blocking failure; `blocked` means a structural property regressed, a verifier failed, or a negative control read zero; `error` means the suite could not run. Cost and speed movements never produce `blocked` -- design P2, because a threshold that reds the lane for runner noise gets widened until it means nothing, taking the structural half with it. (enum: pass, blocked, error) |

## `v1:bench:sample`

One published figure: a metric, on one arm, for one scenario.
A SAMPLE CARRIES EITHER A STATISTIC OR AN ABSENT REASON, NEVER BOTH AND NEVER NEITHER. That invariant is enforced in Go by component/proving/figure before a row is composed, and it is why `absentReason` is a first-class field rather than an empty median: a run whose provider-call count could not be measured and a run that genuinely made zero provider calls are different answers, and a schema that could only say "0" would collapse them.
There is deliberately NO `mean` field, and no single-number form. The epic's honesty rule is medians and spread, never a best case, and a schema that offered a bare number is a schema somebody would eventually publish from.

| Field | Type | Required | Description |
|---|---|---|---|
| `absentReason` | string |  | Why there is no number. A CLOSED set: a free-text reason drifts into 'n/a' within two releases and stops meaning anything, and the whole value of an absent figure is that it says something specific. `seamNotBuilt` is the one that matters most today -- it names code that does not exist yet, and it is what stops the suite reporting 'zero provider calls' because nothing in the path calls a provider, which is a lie that reads exactly like the headline result. (enum: , notMeasurableOnReplay, seamNotBuilt, tierNotRun, noProvider, belowFloor, ceilingReached) |
| `arm` | string | yes | What was under test. `platform` is the work spine with its machinery on; `baseline` is the same model, the same tools and the same scenario in a plain bounded tool loop, with catalog, journal, replay, classifier and healing switched off. There are exactly two and there will not be a third: the epic's comparison is a model by itself against the model with MemQL, and a third arm turns a comparison into a survey. (enum: platform, baseline) |
| `benchRunId` | string | yes | v1:bench:run.id this sample belongs to. |
| `commit` | string | yes | Copied from the run. |
| `detail` | string |  | Qualifies absentReason. Required for `seamNotBuilt`, where it NAMES the missing code -- 'the code is not built' without naming the code is the sort of absence that never becomes a work item. |
| `family` | string | yes | Which of the six families this belongs to, or `governance` -- which is carried by the same rows and is deliberately NOT a family in the epic's sense: it is pass-or-fail and has no statistics, so there is no governance score to be tempted by. (enum: amortizedCost, reliability, recovery, durability, learningCurve, speed, governance) |
| `mad` | number |  | Median absolute deviation -- the spread figure quoted for a small N. |
| `maximum` | number |  | Largest observation. |
| `measuredOn` | string | yes | The date, YYYY-MM-DD. A date rather than a timestamp: the scorecard is a daily artifact and a timestamp invites reading a precision into it that the refresh cadence does not support. |
| `median` | number |  | The median. Absent when the figure is unmeasured -- and note that ABSENT is not 0.0: a reader must consult absentReason before treating this as a number. |
| `metric` | string | yes | The metric id, registered in component/proving/figure. Registration is what supplies its unit and its DIRECTION -- whether lower or higher is better -- so an unregistered metric cannot be compared at all rather than being compared by a guess. |
| `minimum` | number |  | Smallest observation. Named `minimum` rather than `min` because `min` reads as an intrinsic. |
| `n` | integer |  | Sample size. Absent when the figure is unmeasured. |
| `p10` | number |  | Tenth percentile. Quoted for N of five or more; below that the scorecard quotes the range and the median absolute deviation instead, because a p10 over three samples is an order statistic wearing a percentile's name. |
| `p90` | number |  | Ninetieth percentile. |
| `scenarioId` | string | yes | The corpus scenario that produced it, which is also the filename under test/proving/scenarios/. |
| `tier` | string | yes | Copied from the run, so a sample is self-describing when read on its own. (enum: ci, live) |
| `unit` | string | yes | What the number counts. Two figures in different units are never compared. (enum: calls, steps, tokens, usd, ms, ratio, percent, count) |

**Relationships:** `parent` -> `v1:bench:run`

## `v1:calendar:booking`

A booking taken against published hours (memql#4142). Owned by the host so the portal's host calendar is the operations surface. Booker identity is payload (name + email), not a second owner. Cancel and reschedule append a new version of this id -- there is no silent overwrite of history.

| Field | Type | Required | Description |
|---|---|---|---|
| `bookerEmail` | string |  | Booker contact. Marked @pii: queries projecting it must constrain the caller. |
| `bookerName` | string | yes | Who the slot is for. Displayed on the host's booking list. |
| `endsAt` | string | yes | Booking end instant (RFC3339). |
| `hoursId` | string |  | Optional v1:calendar:bookingHours.id this slot was taken from. |
| `notes` | string |  | Optional host or booker note. |
| `ownerUserId` | string | yes | v1:identity:user.id of the host. Stamped from actor.userId. The per-row authz key. |
| `rescheduledToId` | string |  | When status=rescheduled, the v1:calendar:booking.id of the replacement. |
| `startsAt` | string | yes | Booking start instant (RFC3339). |
| `status` | string | yes | Lifecycle. booked is the active hold; cancelled and rescheduled are terminal for this version. A reschedule writes a new booked row and stamps this one rescheduled. (enum: booked, cancelled, rescheduled) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:calendar:bookingHours`, `references` -> `v1:calendar:booking`

## `v1:calendar:bookingHours`

Weekly booking hours a client owner publishes (memql#4142). Calendly-style availability without a Calendly bill or a new SPA. Config is data -- flipping `published` does not require a rebuild. Per-row authz: owned by the host.

| Field | Type | Required | Description |
|---|---|---|---|
| `endLocal` | string | yes | Local end time as HH:MM (24h) in timezone, e.g. "17:00". Must be after startLocal. |
| `label` | string |  | Optional host-facing label, e.g. "Office hours". |
| `ownerUserId` | string | yes | v1:identity:user.id of the host who publishes these hours. Stamped from actor.userId. |
| `published` | boolean | yes | When true, these hours are offered for booking. Flipped at runtime. |
| `slotMinutes` | integer |  | Booking slot length in minutes. Data, not source. |
| `startLocal` | string | yes | Local start time as HH:MM (24h) in timezone, e.g. "09:00". |
| `timezone` | string | yes | IANA timezone the local times are expressed in, e.g. America/Phoenix. |
| `weekday` | string | yes | Day of week these hours apply, in the host's timezone. (enum: sun, mon, tue, wed, thu, fri, sat) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:calendar:calendarEvent`

A single calendar event owned by one user. The app-native source of truth for that user's schedule (#642): the reactive harness's reminder triggers read upcomingEvents over these rows ('remind me the day before X'), and the calendar tool/skill lets agents create + list + edit them. source discriminates native (first-party, the only writer in v1) from externalSync (a future Google/CalDAV sync via knowledge:liveConnector, which stamps externalRef back to the upstream event id). recurrence is an optional RFC-5545 RRULE string carried verbatim for v1 -- expansion into concrete occurrences is a downstream concern, not stored here.

| Field | Type | Required | Description |
|---|---|---|---|
| `allDay` | boolean |  | True = a date-scoped event with no meaningful clock time (birthdays, holidays, 'out of office'). The frontend renders these in the all-day band; reminder logic uses the date rather than the instant. |
| `deleted` | boolean |  | Soft-delete flag. The calendar delete action stamps this true rather than hard-deleting so the time-series history survives and a future external-sync reconciler can propagate the deletion upstream. Queries filter it out via isNotDeleted. |
| `endsAt` |  |  | Event end instant (RFC3339). Optional: a point-in-time reminder ('Call mom') may omit it. For allDay events this is the end-of-day (or the day after's midnight) boundary. |
| `externalRef` | string |  | When source=externalSync: the upstream event id (e.g. the Google Calendar event id) this row mirrors. Used by the future sync reconciler for idempotent upsert + deletion-propagation. Empty for native events. |
| `location` | string |  | Free-form location text ('Dojo on 5th', 'Zoom', a street address). Not geocoded in v1. |
| `notes` | string |  | Free-form notes / agenda / description body for the event. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this event. Stamped from actor.userId at create time. Every read self-scopes on this field; it is the load-bearing per-row authz guard. |
| `recurrence` | string |  | Optional RFC-5545 RRULE recurrence rule carried verbatim (e.g. 'FREQ=WEEKLY;BYDAY=TU,TH'). Empty = a one-off event. v1 stores the rule but does not expand occurrences server-side; the reminder + listing surfaces treat the row as its next/seed instance. |
| `source` | string | yes | Provenance discriminator. native = created in-app (the only writer in v1; the calendar tool + frontend stamp this). externalSync = mirrored from an external calendar (Google / CalDAV) via the knowledge:liveConnector sync path shipping later; those rows carry externalRef and are owned by the sync, not hand-edited. (enum: native, externalSync) |
| `startsAt` | string | yes | Event start instant (RFC3339). For allDay events this is midnight at the start of the day in the user's timezone. upcomingEvents + eventsByDay range over this field. |
| `title` | string | yes | Human-readable event title, e.g. 'Karate class' or 'Dentist'. Shown as the primary line on the event card and in agent-facing listings. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:campaigns:audience`

A named set of email recipients -- the WHO of a campaign. Audiences are authored in the portal and referenced by campaigns; membership lives on v1:campaigns:recipient rows pointing back here rather than as a list on this row, so a hundred-thousand-address audience is a hundred thousand rows rather than one enormous payload. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Optional v1:accounts:account.id this audience is FOR -- the client whose work it is. A RECORD, NEVER A VISIBILITY SCOPE (accounts D1): no query in this tree narrows a read because of it, and two people opening the same account see different rollups because the account is shared and the rows are not. Empty is the ordinary case and means the operator's own work; the OS app requires picking one at create, which is app behaviour rather than schema. |
| `description` | string |  | What this audience is and how someone lands in it. Free text, shown under the name in the portal's audience list. |
| `name` | string | yes | Short operator-facing name for the audience, e.g. 'Beta waitlist'. The primary display field; not required to be unique. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this audience. Stamped from actor.userId at create time and re-stamped on every update, so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `status` | string |  | Lifecycle. 'active' audiences are offered when authoring a campaign; 'archived' ones are kept for the history their past campaigns reference but are hidden from the picker. Audiences are never deleted -- a deleted audience would orphan every delivery record that names it. (enum: active, archived) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:accounts:account`

## `v1:campaigns:campaign`

A campaign: one template addressed to one audience, optionally at a scheduled time, plus the state of its send. This is the row an operator thinks of as 'the campaign'. Per-row authz: owned.
The send-state fields (startedAt / completedAt / the three counters / lastError) are written by the sending engine's drain worker through `updateCampaignProgress`, which runs under the CAMPAIGN OWNER'S actor -- so `ownerUserId` is re-stamped from `actor.userId` there exactly as it is on the operator-facing writes, and the counters land on a row the worker was authorized to touch rather than on one it reached past the owner tier.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Optional v1:accounts:account.id this campaign is FOR -- the client whose work it is. A RECORD, NEVER A VISIBILITY SCOPE (accounts D1): no query in this tree narrows a read because of it. Empty is the ordinary case and means the operator's own work; the OS app requires picking one at create, which is app behaviour rather than schema. |
| `audienceId` | string | yes | v1:campaigns:audience.id this campaign is addressed to. Resolved to recipient rows at send time, not at authoring time, so an audience that grows between scheduling and sending is mailed as it stands when the send runs. |
| `completedAt` |  |  | When the last recipient reached a terminal delivery state. |
| `failedCount` | integer |  | Deliveries that reached a terminal failure. |
| `fromName` | string |  | Per-campaign display name on the From header, e.g. 'The MemQL team'. A non-secret presentation setting: it overrides the integration-wide default (MEMQL_EMAIL_FROM_NAME) for this campaign only. The From ADDRESS is deliberately not settable here -- it is bound to the configured mailbox credential and changing it is a deliverability decision, not a campaign one. |
| `lastError` | string |  | The most recent send-level error -- a refused configuration, an exhausted allowlist -- as opposed to a per-recipient failure, which lives on the delivery row. Empty on a clean send. |
| `name` | string | yes | Operator-facing campaign name. The primary display field. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this campaign. Stamped from actor.userId. The per-row authz key. |
| `recipientCount` | integer |  | How many recipients the audience resolved to when the send started. Frozen at send time so the counters below add up even if the audience changes afterwards. |
| `replyTo` | string |  | Optional Reply-To address for this campaign. Non-secret; empty means replies go to the configured sender address. |
| `scheduledAt` |  |  | When the send should begin. Empty means the campaign is not scheduled -- it is a draft an operator will start by hand. THE AUTHORITY on when a scheduled send fires (memql#3459): the drain worker re-reads this field rather than trusting the copy on the send job, so moving the date here moves the send. |
| `senderIdentityId` | string |  | Optional v1:campaigns:senderIdentity.id this campaign sends AS. Empty resolves to the env-configured default sender, which is exactly what every campaign did before identities existed -- so absence is the ordinary case and plurality is additive. THE ENGINE NEVER INFERS THIS FROM accountId: the app prefills the picker from the account's identities, and prefill is UX while resolution is explicit (memql#4821 D4). Preflight refuses a campaign naming a missing or disabled identity rather than silently falling back, because a silent fallback mails a client's list from the wrong mailbox. |
| `sentCount` | integer |  | Deliveries the transport accepted. Denormalized from v1:campaigns:delivery so a campaign list does not have to aggregate per row. |
| `skippedCount` | integer |  | Recipients suppressed rather than mailed (memql#4823). The worker has computed this per job since memql#3348 and had nowhere on the CAMPAIGN to put it, so the number an operator most needs -- the gap between the audience and what actually left -- was visible only on a clusterOwner-tier row a browser cannot read. recipientCount minus sentCount minus this minus failedCount is what is still outstanding. |
| `startedAt` |  |  | When the send actually began. Empty until it does. Distinct from scheduledAt: the gap between the two is the queue latency a deliverability review looks at. |
| `status` | string |  | Campaign lifecycle. 'draft' is being authored; 'scheduled' is committed to a time and WILL fire on its own (memql#3459 -- the worker promotes the campaign's scheduled send job once scheduledAt has passed); 'sending' / 'paused' / 'sent' / 'failed' are send-engine states; 'cancelled' is an operator stopping it before or during a send. (enum: draft, scheduled, sending, paused, sent, cancelled, failed) |
| `templateId` | string | yes | v1:campaigns:template.id supplying the subject and bodies. |
| `trackClicks` | boolean |  | Whether http(s) links in the HTML part are rewritten to signed redirect URLs (memql#4823). The signature is what makes the redirect open-redirect-proof: an unsigned or tampered target never redirects. Text-part link tracking is deliberately not built -- rewriting a URL a reader can see would be visible mangling for a number nobody asked for. |
| `trackOpens` | boolean |  | Whether the HTML part carries a tracking pixel (memql#4823). HTML only -- there is no honest way to count an open in a plain-text part, and a text-part beacon would be a claim the format cannot support. Default true; an operator sending to a privacy-sensitive list turns it off per campaign. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:campaigns:audience`, `references` -> `v1:campaigns:template`, `references` -> `v1:campaigns:senderIdentity`, `references` -> `v1:accounts:account`

## `v1:campaigns:consentEvent`

Append-only consent / suppression event for one subscriber (memql#4141). Current status is derived from the latest event -- there is no mutable status column on this concept. Send-time suppression (v1:campaigns:suppression + recipient.subscriptionStatus) is unchanged; this stream is the export/compliance answer for "status, date, source".
grant / withdraw / bounce / complaint / suppress are events. reason is required on suppress (enforced by recordConsentSuppress). Config and templates stay data, not this schema.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this consent event is for, COPIED from its recipient at write (epic memql#5165, section J). Denormalized rather than joined for the reason ownerUserId above is: the account grant is a filter conjunct the engine ANDs into every read, and a conjunct that needs a join is one that cannot be pushed down. NO BACKFILL -- rows written before this field existed carry no value and stay owner-only, which is the honest state rather than a history pretending to have moved. A member who can read the campaign can read the consent events written after this change, and cannot read the ones written before it. |
| `campaignId` | string |  | Optional v1:campaigns:campaign.id of the send that produced a bounce, complaint, or one-click withdraw. |
| `emailDigest` | string | yes | SHA-256 hex digest of the normalized (lowercased, trimmed) address. The subscriber key. The mailbox is never stored here -- a caller can ask about an address only when it already holds it. |
| `kind` | string | yes | The event. grant = opted in; withdraw = opted out; bounce / complaint = provider verdict; suppress = operator or policy suppression. There is no mutable status field -- current status is the latest kind. (enum: grant, withdraw, bounce, complaint, suppress) |
| `occurredAt` | string | yes | When the event happened. Stamped from the engine clock unless the writer records an earlier verified event (e.g. a provider timestamp). |
| `ownerUserId` | string | yes | v1:identity:user.id of the operator whose send this consent belongs to. Stamped from actor.userId. The per-row authz key for export. |
| `reason` | string |  | Why, when kind is suppress. Required on the suppress write path. Empty for grant/withdraw/bounce/complaint. |
| `recipientId` | string |  | Optional v1:campaigns:recipient.id when the event is about a specific audience membership. The digest is the subscriber identity; this is the membership the operator was looking at. |
| `source` | string | yes | Where the event came from. Data, not DSL source. (enum: signup, one_click, import, provider, operator, rfc8058) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:campaigns:recipient`, `references` -> `v1:campaigns:campaign`, `references` -> `v1:accounts:account`

## `v1:campaigns:delivery`

One recipient's outcome for one campaign -- the per-recipient audit trail a deliverability review is actually made of, and the LEDGER THAT MAKES A RESUMED SEND SAFE. Per-row authz: owned.
IDEMPOTENCY IS STRUCTURAL, not a retry flag. The row id is derived deterministically from (campaignId, recipientId) -- per-part hashed, so no separator can alias two pairs onto one id -- which means a recipient has exactly one delivery row per campaign no matter how many times the send is resumed, restarted or raced between replicas. The worker's batch is "recipients of this audience with no delivery row, plus rows still `pending` whose nextAttemptAt has passed", so a recipient that already reached `sent` or `skipped` is simply not in the next batch. There is no "already sent?" flag to forget to check: the absence of the row IS the work queue.
Written by component/campaigns' drain worker through `recordCampaignDelivery`, which runs under the CAMPAIGN OWNER'S actor -- so `ownerUserId` is stamped from `actor.userId` like every other write in this domain, never from a caller argument. That is what memql#3348 supplies and what took v1:campaigns:delivery off the owner-stamping gate's exemption list.
outboundRequestId is EMPTY on every row this engine writes, and that is a decision rather than an omission (memql#3348). memql#3323 designed the send to stage v1:platform:outboundRequest rows and let the engine's outbound worker deliver them. Three things make that the wrong seam for bulk campaign mail: (1) the campaign worker has to SEE the provider's 429 + Retry-After to pace itself, and a queue drained by another worker turns that signal into an opaque retry -- which is exactly the "retries that look like duplicates to the recipient" failure; (2) a per-recipient TERMINAL outcome is the whole point of this row, and an async seam leaves every row `pending` until somebody writes a reconciler; (3) MEMQL_OUTBOUND_EMAIL_ALLOWLIST is a domain allowlist for TRANSACTIONAL mail, and a marketing audience is by definition arbitrary external domains -- so routing campaigns through it would either refuse every send or force that allowlist wide open and weaken the transactional egress control it exists to provide. The field stays on the schema because a future queued transport would populate it.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this delivery is for, COPIED from its campaign at write (epic memql#5165, section J). Denormalized rather than joined for the reason ownerUserId above is: the account grant is a filter conjunct the engine ANDs into every read, and a conjunct that needs a join is one that cannot be pushed down. NO BACKFILL -- rows written before this field existed carry no value and stay owner-only, which is the honest state rather than a history pretending to have moved. A member who can read the campaign can read the deliverys written after this change, and cannot read the ones written before it. |
| `attempts` | integer |  | Delivery attempts made for this recipient. Incremented on each transport failure and bounded by MEMQL_CAMPAIGNS_MAX_ATTEMPTS, past which the row goes terminal 'failed'. Zero on a 'skipped' row, which never reaches the transport. |
| `campaignId` | string | yes | v1:campaigns:campaign.id this delivery belongs to. |
| `email` | string | yes | The address the send targeted, captured at send time rather than read back from the recipient row -- an address that changes afterwards must not rewrite what was actually mailed. Marked @pii. |
| `emailRuleId` | string |  | v1:campaigns:emailRule.id of the event rule that produced this send, when one did (memql#4829). Empty on every ordinary campaign delivery, which is the overwhelming majority. It exists because an event rule mails one person at a time in response to something that happened, and 'which rule mailed this person, and why' is the FIRST question anybody asks about automated mail -- a question the campaign id alone cannot answer, because a rule's sends carry no campaign at all. |
| `lastError` | string |  | The transport's error for a 'failed' or retrying 'pending' delivery, truncated to 4KB. Empty otherwise. |
| `nextAttemptAt` |  |  | When a retryable 'pending' row becomes eligible again -- bounded exponential backoff with jitter, or the provider's own Retry-After when it supplied one. Compared Go-side by the drain worker, which is why it is a stored instant rather than a computed one. |
| `outboundRequestId` | string |  | v1:platform:outboundRequest.id carrying this message, when a queued transport staged one. EMPTY on every row the current engine writes -- it delivers directly so it can observe the provider's throttle response. See the concept doc for the three reasons. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this delivery record -- the owner of the campaign, mirrored so the row is gated without a join. The per-row authz key. |
| `recipientId` | string | yes | v1:campaigns:recipient.id that was targeted. |
| `sentAt` |  |  | When the transport accepted the message. Empty unless status is 'sent'. |
| `skipReason` | string |  | Why a 'skipped' delivery was suppressed: 'unsubscribed' / 'hard_bounce' / 'complaint' / 'manual' when the cluster suppression list matched, or the recipient row's own subscriptionStatus when that was the gate. Empty otherwise. |
| `status` | string | yes | Outcome for this recipient. 'sent' and 'skipped' and 'failed' are terminal; 'pending' means a retryable transport failure whose next attempt is due at nextAttemptAt (a row is never written as 'pending' before an attempt -- the ABSENCE of the row is the not-yet-attempted state, see the concept doc). 'skipped' is the suppression case -- unsubscribed, hard-bounced or complained -- and is distinct from 'failed' because it is a correct outcome rather than an error. (enum: pending, sent, failed, skipped) |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:campaigns:campaign`, `references` -> `v1:campaigns:recipient`, `references` -> `v1:platform:outboundRequest`, `references` -> `v1:campaigns:emailRule`, `references` -> `v1:accounts:account`

## `v1:campaigns:emailRule`

An event-triggered email: "when X happens on concept Y, send template Z" (memql#4829, program P4 and P5). THIS ROW IS THE FORM, NOT THE MECHANISM. What actually runs is a real authored automation construct, generated deterministically from these fields and activated through the runtime authoring pipeline; this row is what the app lists, edits, pauses and explains.
WHY A GENERATED CONSTRUCT RATHER THAN ONE SHIPPED AUTOMATION WITH A LOOKUP TABLE. An automation's @trigger names ONE concept at load time. A user picking an arbitrary trigger concept therefore cannot be served by anything pre-shipped -- there is no wildcard trigger, and there should not be one. Generating a construct also inherits the whole governance apparatus for free: per-rule pause, the circuit breaker, the cluster kill switch, boot re-arm, and an author-scoped actor. The generator is a deterministic template. The LLM authoring path stays off: a rule that mails strangers is not a place for a model to improvise, and a deterministic generator is one a person can read the output of.
TWO DELIVERY LANES, CHOSEN BY WHO RECEIVES (P5), never by a toggle the operator has to understand.
  recipientMode=cluster_roles  OPERATIONAL. The recipients are this cluster's own people, so the                                mail rides the transactional outbox: the egress allowlist applies,                                there is no unsubscribe footer, and the marketing suppression list                                is neither consulted nor written. Telling an owner a new admin was                                added is not marketing, and running it through the campaign                                machinery would let an unsubscribe from a newsletter silence an                                operational alert.
  recipientMode=audience       MARKETING. A campaign audience is being mailed one row at a time,   recipientMode=row_address    so it rides the campaign machinery: suppression checked at the                                point of send, unsubscribe attached, sender identity applied,                                outcome ledgered. row_address is the same lane with the address                                read off the triggering row instead of a roster.
Per-row authz: composite -- the operator owns their rules, the cluster owner reads them all. The GENERATED construct runs under the author's own envelope, which is why the rule records who authored it: an automation's actor is not the row owner's, and a caller-scoped read from inside one returns nothing while looking entirely correct.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Optional v1:accounts:account.id this rule is FOR. A record, never a visibility scope (accounts D1). |
| `audienceId` | string |  | The audience this rule mails, REQUIRED in both marketing modes and ignored on the operational lane. For recipientMode=audience it is the roster. For recipientMode=row_address it is the list the row-derived address is ENROLLED INTO, and that is not bookkeeping: an unsubscribe token is minted from (owner, recipient, campaign), so an address with no recipient row has no way to opt out -- and mailing marketing to somebody who cannot unsubscribe breaches the exact RFC 8058 stance the rest of this engine is built on. The address gets a real membership with a real subscription state, and the second send to it consults the state the first one gave it. |
| `bundleId` | string |  | v1:authoring:bundle.id of the generated bundle. Empty until the rule is first activated. Editing a rule generates a NEW bundle and retires the old one, so this always names the bundle currently armed. |
| `condition` | string |  | Optional boolean expression over the triggering event, evaluated by the automation's own condition step -- e.g. role=="admin". Empty fires on every event of the kind. It is the runtime STRING evaluator's grammar, which is the one surface where ! is legal; the generator validates it before the bundle is written rather than letting a typo become a construct that fails to load. |
| `constructName` | string |  | The generated automation construct's name, derived deterministically from the rule id so a regeneration replaces rather than accumulates. What to grep for when somebody asks which automation sent an email. |
| `description` | string |  | What this rule is for, in the operator's own words. Rendered under the name; also carried onto the generated construct so somebody reading the DSL knows why it exists. |
| `eventKind` | string | yes | Which row event fires the rule. 'created' maps to node.created, 'updated' to node.updated. Deliberately only two: a delete has no row to read recipients or merge data from, so a rule triggered by one could describe nothing about what was deleted. (enum: created, updated) |
| `firedCount` | integer |  | How many times the rule has fired since it was first activated. Liveness like lastFiredAt -- shown, never fingerprinted. |
| `lastError` | string |  | Why generation, validation or activation last refused -- the engine's own sentence, so the app can render it verbatim instead of paraphrasing a failure it does not understand. Empty on a healthy rule. |
| `lastFiredAt` |  |  | When the generated construct last ran. A LIVENESS field: it moves on its own, so a surface that fingerprints it for arrival cues turns the rules list into a strobe. Display it; do not ring on it. |
| `name` | string | yes | Operator-facing rule name, e.g. 'Tell the owner about new admins'. The primary display field, and the basis of the generated construct's name, so it is what an operator sees in both places. |
| `ownerUserId` | string | yes | v1:identity:user.id that authored this rule. Stamped from actor.userId. The per-row authz key, AND the envelope the generated construct runs under -- see the concept doc's note on the actor trap. |
| `recipientField` | string |  | For recipientMode=row_address, the dotted path into the triggering row's payload that holds the address, e.g. 'primaryContactEmail'. Validated to resolve on the trigger concept at generate time, because a path that resolves to nothing is a rule that fires forever and mails nobody. |
| `recipientMode` | string | yes | WHO receives, which is also what picks the delivery lane (P5). 'cluster_roles' = this cluster's own people, operational lane. 'audience' = a campaign audience, marketing lane. 'row_address' = an address read off the triggering row, marketing lane. The app presents this as a question about recipients and never as a lane toggle: the lane is a consequence. (enum: cluster_roles, audience, row_address) |
| `recipientRoles` | array |  | For recipientMode=cluster_roles, which roles receive -- owner / admin / developer / writer / reader. Empty means the cluster owner alone, which is the common 'tell me when this happens' case. |
| `senderIdentityId` | string |  | Optional v1:campaigns:senderIdentity.id the marketing lane sends as. Empty resolves to the env-configured default, exactly as a campaign's does. Ignored on the operational lane, which leaves through the transactional outbox and its own configured sender. |
| `status` | string |  | Rule lifecycle. 'draft' has never been generated. 'active' has a live construct. 'paused' keeps the construct but disarms it -- the operator's own stop button. 'failed' means generation or validation refused, and lastError says what the engine said; the app renders that sentence rather than inventing one. (enum: draft, active, paused, failed) |
| `templateId` | string | yes | v1:campaigns:template.id supplying the subject and bodies. The same templates campaigns use, so copy is authored once -- and merge tags resolve against whichever lane runs, with {{fields.*}} empty on the operational lane, which has no recipient row. |
| `triggerConcept` | string | yes | The canonical concept id whose rows fire this rule, e.g. 'v1:identity:user'. Offered from the LIVE concepts registry rather than a hardcoded list, so a rule can name a concept a product bundle added after this release. It becomes the generated @trigger's concept argument verbatim. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:campaigns:template`, `references` -> `v1:campaigns:audience`, `references` -> `v1:campaigns:senderIdentity`, `references` -> `v1:accounts:account`, `references` -> `v1:authoring:bundle`

## `v1:campaigns:engagementEvent`

One tracked interaction with one delivered message -- an open or a click (memql#4823). Append-only: a person who opens a message four times produces four rows, and `campaignStats` computes the unique figure by (delivery, kind). Raw events are stored rather than counters incremented because a counter cannot answer "when", and "the whole audience opened it within ninety seconds of a tweet" is the shape of question an operator actually has.
HOW A ROW GETS HERE, AND WHY THAT IS SAFE. The tracking endpoints are unauthenticated by necessity -- the caller is a mail client fetching an image, or a browser following a link -- so the only thing standing between them and a forged row is the token. The token is HMAC-signed by the same rotating key ring the unsubscribe links use, under its OWN context label, and it carries the delivery, the campaign, the kind and (for a click) the destination URL. An unsigned or edited token records NOTHING and, for a click, redirects nowhere: the signature over the URL is exactly what makes the redirect open-redirect-proof. The write itself is a @serverOnly mutation under internal origin, so no client can reach it directly whatever it holds.
WHAT AN OPEN IS NOT. It is a pixel fetch, and mail clients cache, prefetch and block images. An open is therefore evidence of interest and never proof of reading, and the surfaces that render it say so rather than implying a precision the mechanism does not have. Text-only readers count as zero opens, which is the same statement.
Per-row authz: composite -- the operator owns their own engagement history, the cluster owner reads every operator's.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this engagement event is for, COPIED from its campaign at write (epic memql#5165, section J). Denormalized rather than joined for the reason ownerUserId above is: the account grant is a filter conjunct the engine ANDs into every read, and a conjunct that needs a join is one that cannot be pushed down. NO BACKFILL -- rows written before this field existed carry no value and stay owner-only, which is the honest state rather than a history pretending to have moved. A member who can read the campaign can read the engagement events written after this change, and cannot read the ones written before it. |
| `campaignId` | string | yes | v1:campaigns:campaign.id the tracked message belonged to. Denormalized from the delivery so per-campaign stats need no join. |
| `deliveryId` | string | yes | v1:campaigns:delivery.id -- the one recipient's message that was opened or clicked. It is the uniqueness key: unique opens are distinct deliveryIds, not distinct addresses, because one address in two audiences is two people as far as a campaign is concerned. |
| `kind` | string | yes | Which interaction. 'open' is a tracking-pixel fetch on the HTML part; 'click' is a signed redirect being followed. There is deliberately no third value -- 'delivered' is not observable here (the transport says accepted and a bounce arrives later) and inventing it would be a number nothing can honestly produce. (enum: open, click) |
| `occurredAt` | string | yes | When the hit arrived, stamped from the engine clock. Not caller-supplied: the caller here is an unauthenticated mail client, and a timestamp it chose would be the one field of this row an attacker could set. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns the campaign this event is about, mirrored so the row is gated without a join. The per-row authz key. Taken from the signed token's own campaign, never from the request. |
| `url` | string |  | For a click, the destination the reader was sent to, verbatim from the signed token. Empty on an open. Stored so 'which link worked' is answerable without re-parsing the body a template may since have been edited out from under. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:campaigns:campaign`, `references` -> `v1:campaigns:delivery`, `references` -> `v1:accounts:account`

## `v1:campaigns:recipient`

One email address in an audience, with the subscription state that decides whether it may be mailed. Subscription state is modelled here rather than derived at send time because it is a standing fact about a person, not a property of one campaign: an unsubscribe must suppress every future send, including sends of campaigns authored before the unsubscribe. Per-row authz: owned via ownerUserId, mirrored from the parent audience at create time.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this recipient is for, COPIED from its audience at write (epic memql#5165, section J). Denormalized rather than joined for the reason ownerUserId above is: the account grant is a filter conjunct the engine ANDs into every read, and a conjunct that needs a join is one that cannot be pushed down. NO BACKFILL -- rows written before this field existed carry no value and stay owner-only, which is the honest state rather than a history pretending to have moved. A member who can read the campaign can read the recipients written after this change, and cannot read the ones written before it. |
| `audienceId` | string | yes | v1:campaigns:audience.id this address belongs to. A person in two audiences is two rows, so a per-audience unsubscribe is expressible and a global one is a sweep. |
| `displayName` | string |  | Optional human name used to personalize the greeting. Marked @pii for the same reason as email. |
| `email` | string | yes | The recipient's email address -- the delivery target and the identity of the row. Marked @pii: it is scrubbed by the deletion path and every query projecting it must constrain its caller. |
| `fields` | object |  | Per-recipient merge data -- every column a CSV import carried that was not `email` or `displayName`, verbatim, as a flat string map (memql#4822). Reachable from a template as {{fields.<key>}} against the CLOSED merge-tag set; the renderer builds a strings.NewReplacer over the enumerable keys rather than evaluating a template language, so a value here is substituted and never executed. Marked @pii: an import's spare columns routinely carry names, companies and account numbers, and the deletion path must reach them. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this recipient row -- the owner of the parent audience, stamped from actor.userId. The per-row authz key. |
| `source` | string |  | How the address got here. 'manual' = typed into the portal, 'import' = bulk upload, 'signup' = a product flow added it. Provenance a deliverability review asks for first when complaint rates rise. (enum: manual, import, signup) |
| `subscriptionStatus` | string |  | Whether this address may be mailed. 'subscribed' is the only sendable state. 'unsubscribed' is the recipient's own choice and is permanent until they opt back in; 'bounced' and 'complained' are the provider's verdict and exist as distinct states because they mean different things to a deliverability review -- a bounce is a bad address, a complaint is a reputational event. (enum: subscribed, unsubscribed, bounced, complained) |
| `unsubscribedAt` |  |  | When the address left the subscribed state. Empty while subscribed. Recorded rather than inferred from row history so a suppression check is one field read. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:campaigns:audience`, `references` -> `v1:accounts:account`

## `v1:campaigns:reputationWindow`

Per-(sending identity, recipient domain, day) counters -- the reputation telemetry a warming ramp has to be driven by, and the thing memql#3462 says has to exist before a ramp is anything but a hardcoded table pretending to be a control loop.
WHY PER DOMAIN. Mailbox providers judge a sender independently. "Our bounce rate is 1%" is not a number any of them acts on; "our complaint rate at gmail.com is 0.4% this week" is. It is also the question an operator asks long before they want anything automated, which is why this half is worth having on its own.
WHY A ROW PER REPLICA (nodeId). Counters are accumulated in each worker's memory and written as ABSOLUTE values to that replica's own row. Two replicas incrementing one shared row would need a read-modify-write on the send path and would lose counts to the interleaving; one row each, summed at read time, has neither problem. The cost is that a reader must aggregate, which it was going to do anyway across domains and days.
WHAT `accepted` IS NOT. It counts messages the TRANSPORT accepted, which is not delivery -- Graph answers 202 and the bounce arrives later. Delivery is therefore inferred (accepted minus bounces) and the field is named for what it actually observes. A `delivered` column would be a number nothing on this side can honestly produce.
UNSUBSCRIBES ARE NOT COUNTED HERE, deliberately: the one-click endpoint is a separate HTTP handler with its own store and no collector, so a field for them would be a field nothing writes -- the exact shape this issue exists to remove. The ramp's thresholds are the bounce and complaint rates, which are what the providers themselves act on.
clusterOwner tier, for the same reason the suppression list is: one deployment, one sending mailbox, one reputation. It is not an operator's number and no operator's authority should decide what it says. It carries no address -- a domain and four integers.

| Field | Type | Required | Description |
|---|---|---|---|
| `accepted` | integer |  | Messages the transport accepted for this domain in this window. NOT deliveries -- Graph answers 202 and a bounce arrives later. Delivery is inferred as accepted minus bounces. |
| `complaint` | integer |  | Spam complaints reported for this domain. The most damaging signal a mailbox provider tracks, and the one whose threshold is an order of magnitude tighter than the bounce rate's. |
| `domain` | string | yes | The recipient's domain, lowercased -- gmail.com, outlook.com. The only human-readable field, and it identifies nobody, which is the same property that makes the suppression list safe to keep cluster-wide. |
| `hardBounce` | integer |  | Permanent bounces reported for this domain, from the provider's own classification (memql#3461). The numerator of the rate a ramp holds on. |
| `nodeId` | string | yes | The replica that accumulated these counts. Part of the row id; see the concept doc for why one row per replica beats one shared row. |
| `sendingIdentity` | string | yes | Which sending mailbox these counters belong to. One deployment normally has exactly one, and the default is derived from the configured sender address; the dimension exists so a future multi-mailbox deployment is a value change rather than a re-model. |
| `softBounce` | integer |  | Transient bounces. Watched but not thresholded: a full mailbox is not a reputational event. |
| `windowStart` | string | yes | The UTC day these counters cover, as YYYY-MM-DD. A string rather than a datetime because it is a BUCKET KEY that has to be compared for equality and ordered lexically, and because it participates in the derived row id. |

## `v1:campaigns:sendJob`

The engine's own record of one send RUN -- the queue the drain worker scans, and the only row in this domain the worker can find without already knowing whose it is.
WHY THIS IS clusterOwner AND NOT owned. A worker cannot scan an owned concept: the owned tier injects `ownerUserId==actor.userId` into every read and there is no cluster-owner bypass on it (component/memql/rowauthz_enforce.go), so "which campaigns want sending" is not a question an owned row can answer. Nor should it be answerable from a row a caller can write: whichever row says "send campaign X as user Y" is an instruction the engine carries out under Y's authority, so a caller-writable one is an escalation with extra steps. Both writers of this concept (campaignStartSend and the worker) are Go that derived campaignOwnerUserId from a campaign row it had ALREADY READ under the caller's own actor -- the caller proves ownership by being able to read their own campaign, and nothing they typed is trusted.
One row per campaign, id = the campaign's bare short id, so pause / resume / restart all land on the same timeline rather than accumulating runs. Per-recipient idempotency does not live here -- it lives on the delivery ledger (see v1:campaigns:delivery), which is what makes a resumed send safe even if this row is lost entirely.
A SCHEDULED CAMPAIGN IS A JOB IN THE `scheduled` STATUS (memql#3459), and that is why scheduling needed no new concept and no cross-owner scan. "Which campaigns are due?" is not a question an OWNED row can answer -- the owned tier injects ownerUserId==actor.userId into every read with no cluster-owner bypass -- so a clock-driven scan over v1:campaigns:campaign is not expressible at all. The scheduling builtin therefore does what campaignStartSend already does: it reads the campaign under the CALLER'S own actor, and writes a job here carrying the owner it derived. The worker then scans this concept, which it can, and asks the campaign row whether its time has come.
`scheduled` is deliberately NOT drainable (see isDrainableSendJob): a job in this status is inert until something promotes it to `queued`, so the row existing can never by itself mail anybody.

| Field | Type | Required | Description |
|---|---|---|---|
| `audienceId` | string | yes | v1:campaigns:audience.id resolved to recipients each batch, so an audience that grows mid-send is mailed as it stands when the batch runs. |
| `campaignAccountId` | string |  | The v1:accounts:account the campaign is FOR, copied off the same campaign row campaignOwnerUserId came from (epic memql#5165, section J). Carried HERE rather than read per hit: the open/click tracking path resolves a campaign's owner from this row and cannot read the campaign row at all -- that row is owner-tier, and establishing the owner is the very thing being asked -- so without this field every tracked pixel fetch would cost a second query to learn the client tie. Written once per send, read on a path that already reads this row. Empty for a campaign with no client tie, which is the ordinary case. |
| `campaignId` | string | yes | v1:campaigns:campaign.id this job drains. Stored canonical like every other @relationship field; the worker bare-ifies it (memql.BareShortId) before feeding it back to campaignById, because a named-query argument is the BARE-ids client contract. |
| `campaignOwnerUserId` | string | yes | v1:identity:user.id the worker impersonates for every owned-tier read and write this job performs -- the campaign, its template, its audience's recipients, and the delivery ledger. SERVER-DERIVED ONLY: both writers read it off a campaign row they had already read under the caller's own actor, so it can never name a user the caller could not already act as. This is the single most security-load-bearing field in the domain. |
| `completedAt` |  |  | When the job reached a terminal status. |
| `failedCount` | integer |  | Recipients that reached a terminal failure. |
| `lastError` | string |  | The most recent job-level error, truncated. Empty on a clean run. |
| `recipientCount` | integer |  | Recipients the audience resolved to on the most recent batch. Not frozen -- the campaign row carries the frozen count. |
| `rosterCursor` | string |  | Where the roster walk resumes (memql#3460). An OPAQUE engine keyset cursor -- the (createdAt, id) position of the last recipient examined, encoded by the engine's own pagination codec -- so a send through a large audience does not re-scan from the start on every 15-second tick. Empty means 'start a fresh pass'. It is an OPTIMIZATION, never a correctness mechanism: the delivery ledger decides who gets mailed, so a cursor lost, stale or refused by a codec change costs one re-scan and nothing else. |
| `rosterOutstanding` | boolean |  | Whether the pass currently in progress has seen ANY recipient still to deal with -- unmailed, or pending a retry that is not yet due (memql#3460). It is what makes completion decidable without holding the whole roster in memory: a pass that reaches the end of the audience with this false has proved there is nothing left, and the job completes. Reset at the start of each pass. |
| `scheduledAt` |  |  | The time this job was enqueued for, copied off the campaign at schedule time. A HINT for the operator and for the scan, never the authority: the worker re-reads the CAMPAIGN's scheduledAt at fire time, so an operator who moves the date with updateCampaign is obeyed rather than raced by a stale copy. Empty on a job started by hand. |
| `sentCount` | integer |  | Deliveries the transport accepted so far. |
| `skippedCount` | integer |  | Recipients suppressed rather than mailed. The gap between this and sentCount IS the suppression rate a deliverability review asks for. |
| `startedAt` |  |  | When the first batch ran. |
| `status` | string | yes | Job lifecycle. 'scheduled' is committed to a time and NOT drainable -- the worker promotes it to 'queued' once the campaign row's scheduledAt has passed, so a scheduled job can never mail anybody by merely existing; 'queued' is enqueued and unclaimed; 'running' has had at least one batch; 'paused' is an operator stopping the drain without discarding the ledger; 'completed' means every recipient reached a terminal delivery state; 'failed' is a job-level refusal (no configured sender, no unsubscribe secret, audience over the ceiling); 'cancelled' follows the campaign being cancelled. (enum: scheduled, queued, running, paused, completed, failed, cancelled) |
| `templateId` | string | yes | v1:campaigns:template.id supplying the subject and bodies. |
| `throttledUntil` |  |  | When the provider's own throttle response says we may resume. Set from a 429/503 Retry-After; the worker leaves the job alone until it passes. Distinct from our own pacing, which is a per-process token bucket and needs no row. |

**Relationships:** `parent` -> `v1:campaigns:campaign`, `references` -> `v1:identity:user`, `references` -> `v1:campaigns:audience`, `references` -> `v1:campaigns:template`, `references` -> `v1:accounts:account`

## `v1:campaigns:senderIdentity`

A mailbox this deployment may send campaign mail AS -- the "from whom" of a send (memql#4821, program P1).
IT CARRIES NO SECRET MATERIAL, and that is the whole shape of the design. Authentication stays the cluster's ONE Graph credential; an identity row is the operator's DECLARATION that a mailbox exists inside their tenant and that campaigns may leave from it. Nothing here grants access to anything. Whether the send actually succeeds is decided by the tenant's Exchange ApplicationAccessPolicy -- the mail-enabled security group that scopes Mail.Send -- which no engine preflight can read. So a mailbox declared here but not added to that group surfaces as Graph's own 403 on the campaign's lastError, and that refusal is the honest check. The runbook section "adding a sending identity" is the other half of creating one of these.
WHY A ROW RATHER THAN MORE ENV VARS. The deployment runs campaigns for several accounts, and which mailbox a client's mail leaves from is a per-account fact an operator changes without a restart. The env-configured sender remains the DEFAULT -- a campaign naming no identity behaves exactly as every campaign did before this concept existed -- so plurality is purely additive and the single-mailbox deployment never has to know this concept is here.
SUPPRESSION DOES NOT FOLLOW THE IDENTITY (program P8). Several mailboxes inside one operator tenant are still one legal sender org and one domain reputation, so the do-not-mail list stays cluster-wide: an unsubscribe is a statement to the operator of this deployment, not to one of their mailboxes. Reputation and warmup DO key per identity -- they always did, on v1:campaigns:reputationWindow.sendingIdentity and v1:campaigns:warmupState.sendingIdentity, which were built for a plurality that did not yet exist. This concept is what finally supplies it.
Per-row authz: composite. The operator owns their identities; the cluster owner reads them all.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Optional v1:accounts:account.id this identity belongs to -- the client whose mailbox it is. A RECORD, NEVER A VISIBILITY SCOPE (accounts D1); it is what lets the app PREFILL a campaign's identity picker from the selected account. The ENGINE never infers an identity from a campaign's accountId: prefill is UX, resolution is explicit (D4). |
| `address` | string | yes | The mailbox UPN the Graph application may send as, e.g. news@acme-client.com. Becomes the From ADDRESS and the /users/{address}/sendMail path segment, so it is validated for RFC 5322 shape AND header safety on the write path -- a CR or LF here would be header injection into every message this identity sends. Normalized lowercase; it is also the reputation and warmup key, so two spellings of one mailbox would split its ramp in half. |
| `fromName` | string | yes | The display name on the From header for campaigns sent as this identity, e.g. 'Acme News'. Overridden per campaign by campaign.fromName when that is set. Required, because a From with no phrase shows the raw mailbox to every recipient, which is the deliverability equivalent of not having thought about it. |
| `notes` | string |  | Free-text operator provenance -- which tenant group the mailbox is in, who asked for it, when it was warmed. Never a credential. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this identity. Stamped from actor.userId on every write. The per-row authz key. |
| `replyTo` | string |  | Default Reply-To for campaigns using this identity that set none of their own. Empty means replies go to the sending address itself. A campaign's own replyTo always wins. |
| `status` | string |  | Whether this identity may be used. 'disabled' is how an operator retires a mailbox WITHOUT deleting the row -- past campaigns name it, and the reputation history is keyed on its address. Preflight refuses a campaign naming a disabled identity rather than falling back to the default, because a silent fallback mails a client's list from the wrong mailbox and nothing says so. (enum: active, disabled) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:accounts:account`

## `v1:campaigns:suppression`

The cluster-wide do-not-mail list. ONE address per row, keyed by the SHA-256 hex digest of the normalized address (lowercased, trimmed) -- the digest IS the row id, so a lookup is a by-id read and a re-suppression is a new version of the same row rather than a duplicate.
SUPPRESSION IS CLUSTER-WIDE, NOT PER-ACCOUNT, and that is the decision this concept exists to record (memql#3348). An unsubscribe is a statement by a person to the operator of THIS DEPLOYMENT: every campaign leaves through the same authenticated mailbox, under the same From address, signed by the same SPF and DKIM records. A per-operator list would let operator B mail an address that unsubscribed from operator A, in a message the recipient cannot tell apart from the one they already opted out of -- and the complaint lands on the one shared domain reputation. Legally the obligation attaches to the sender, and there is one sender.
BEING CLUSTER-WIDE COSTS NOBODY AN ADDRESS. The row stores no mailbox: the id is a non-reversible digest and the only human-readable field is the address's DOMAIN, which is what a deliverability review actually asks for ("which domains are bouncing?") and which identifies no one. A caller can therefore ask "is this address suppressed" only about an address it already holds.
Reads and writes are clusterOwner because the list must not be caller-writable: a caller who could insert digests could silently suppress a competitor's audience, and one who could delete them could un-suppress a complaint. Every write goes through the engine -- the unsubscribe endpoint, the feedback builtin, or an operator's explicit suppress call -- and each of those derives the address from something it verified rather than from an argument. An operator's own view of who left is their recipient rows' subscriptionStatus, which the worker converges onto this list on the next send.

| Field | Type | Required | Description |
|---|---|---|---|
| `domain` | string |  | The domain part of the suppressed address, lowercased. Recorded rather than derived because the address itself is never stored: it is what makes 'which domains are bouncing' answerable without making 'who unsubscribed' answerable. |
| `note` | string |  | Free-text provenance for a 'manual' row, or the provider's bounce classification for a reported one. Never the address. |
| `reason` | string | yes | Why this address may never be mailed again. 'unsubscribed' is the recipient's own choice, via the RFC 8058 one-click header or the link in the body. 'hard_bounce' and 'complaint' are the provider's verdict and are kept apart because they mean different things to a review -- a bounce is a dead address, a complaint is a reputational event. 'manual' is an operator adding one by hand. (enum: unsubscribed, hard_bounce, complaint, manual) |
| `sourceCampaignId` | string |  | v1:campaigns:campaign.id of the send that produced this suppression, when one did. Empty for an operator-entered row or a feedback report that named no campaign. |
| `suppressedAt` | string | yes | When the address entered the list. Stamped from the engine clock at write time, not threaded by a caller -- unlike a recipient row's unsubscribedAt, which can legitimately record a state change that happened earlier. |

**Relationships:** `references` -> `v1:campaigns:campaign`

## `v1:campaigns:template`

The authored content of a campaign -- subject line plus plain-text and optional HTML bodies. Kept separate from the campaign so one piece of content can be sent to several audiences without being retyped, and so editing copy is a different action (and a different authorization decision, later) from scheduling a send. Per-row authz: owned.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Optional v1:accounts:account.id this template is FOR -- the client whose work it is. A RECORD, NEVER A VISIBILITY SCOPE (accounts D1): no query in this tree narrows a read because of it, and two people opening the same account see different rollups because the account is shared and the rows are not. Empty is the ordinary case and means the operator's own work; the OS app requires picking one at create, which is app behaviour rather than schema. |
| `htmlBody` | string |  | Optional HTML alternative. When present the message goes out as multipart/alternative with text first. |
| `name` | string | yes | Operator-facing name for the template, e.g. 'August product update'. Distinct from the subject line, which is what the recipient sees. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this template. Stamped from actor.userId. The per-row authz key. |
| `status` | string |  | Authoring lifecycle. 'draft' is being written; 'ready' means an operator has decided it may be attached to a campaign; 'archived' keeps it readable for the campaigns that referenced it without offering it in the picker. (enum: draft, ready, archived) |
| `subject` | string | yes | The email subject line. Rendered verbatim; the engine's email sender rejects control characters in it (header-injection barrier in integrations/email). |
| `textBody` | string | yes | The plain-text body. Required, not optional: a text alternative is what keeps a message out of the spam bucket and readable in a client that refuses HTML. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:accounts:account`

## `v1:campaigns:warmupState`

The warming ramp's own state -- one row per sending identity, id = the sending identity (memql#3462).
A RAMP THAT ADVANCES ON A CLOCK IS A GUESS WITH A SCHEDULE ATTACHED, and the issue is explicit that the reason no ramp shipped with memql#3348 was the absence of the evidence one would need. So this row records a decision rather than a countdown: a step advances only when the previous step produced enough volume, held long enough, and stayed inside the bounce and complaint thresholds. `decision` and `reason` are what the row is FOR -- an operator who cannot see why the ramp last held has a control loop they have to trust rather than read.
clusterOwner, like the counters it reads: the ramp paces the deployment's one sending mailbox.

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptedInStep` | integer |  | Messages accepted since the current step began -- the volume half of the advance condition. A step that has sent nothing has produced no evidence, and advancing on no evidence is what this design exists to avoid. |
| `decision` | string |  | What the last evaluation did. 'held' is the common and healthy state -- a step waits for volume and time before it may advance. (enum: advanced, held, reduced, started) |
| `evaluatedAt` |  |  | When the ramp last looked at the evidence. |
| `ratePerMinute` | integer |  | The send rate the current step allows. The worker takes the LOWER of this and MEMQL_CAMPAIGNS_SEND_RATE_PER_MINUTE, so the ramp can only ever slow the configured rate down, never raise it past what the operator allowed. |
| `reason` | string |  | Why, in words, stated for a person: which threshold was exceeded, or how much volume the step still needs. An automated pacer whose decisions cannot be read is one an operator has to trust rather than check. |
| `sendingIdentity` | string | yes | The sending mailbox this ramp paces. Also the row id, so there is exactly one ramp per identity and no way to accumulate competing ones. |
| `step` | integer |  | Index into MEMQL_CAMPAIGNS_WARMUP_STEPS. Zero is the starting trickle a new sending domain begins on. |
| `stepEnteredAt` |  |  | When the current step began. The minimum-hold clock runs from here. |

## `v1:cluster:cluster`

A MemQL cluster -- the top-level deployment unit consisting of a shared database and seed nodes (bff, agent, planner). Partitions exist within a cluster for data isolation.

| Field | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string |  | Node ID of the v1:cluster:database record for this cluster's database. |
| `identityProviderId` | string |  | Node ID of the v1:cluster:identityProvider record. |
| `name` | string | yes | Cluster name (e.g., 'development', 'staging-us-central1'). |
| `provider` | string |  | Cloud provider / deploy target backing this cluster: 'docker-local' (local Docker) or 'azure' (AKS). Empty until stamped by the deploy driver (#1872). |
| `region` | string |  | Cloud region (e.g., 'us-central1') or 'local' for development. |
| `seedNodeTypes` | array |  | Required node types for this cluster (e.g., ['bff', 'agent', 'planner']). |
| `version` | string |  | MemQL version running on this cluster. |

**Relationships:** `owns` -> `v1:cluster:database`, `owns` -> `v1:cluster:identityProvider`

## `v1:cluster:database`

A PostgreSQL database instance backing a MemQL cluster. Tracks connection info, engine version, and installed extensions. # `status` IS GONE, AND IT CANNOT COME BACK (memql#4766)
It was `enum("healthy","degraded","unreachable")` stamped as the literal `"healthy"` by `createDatabase` and refreshed by nothing, so every reader got a hardcoded verdict. The fix is not "write a refresher" -- the field is STRUCTURALLY incapable of carrying the answer.
This row lives IN the database it describes. Reading it requires that database to be reachable, so a successful read can only ever return `healthy`, and an unreachable database returns no row at all rather than `unreachable`. The one value the field exists to communicate is the one value it can never be observed holding.
A surface that wants database health observes the CONNECTION, which already knows. Do not re-add this field.

| Field | Type | Required | Description |
|---|---|---|---|
| `clusterId` | string |  | Node ID of the parent v1:cluster:cluster record. |
| `dbName` | string | yes | Database name (e.g., 'memql'). |
| `engine` | string | yes | Database engine identifier (e.g., 'postgresql'). |
| `engineVersion` | string |  | Engine version (e.g., '16.4'). |
| `extensionVersions` | object |  | Extension version map (e.g., {'timescaledb': '2.25.2', 'vector': '0.8.2'}). |
| `extensions` | array |  | Installed extensions (e.g., ['timescaledb', 'vector', 'uuid-ossp', 'pgcrypto']). |
| `host` | string | yes | Database hostname (e.g., 'postgres', 'tiger-cloud-abc.timescaledb.io'). |
| `port` | integer |  | Database port. |
| `sslMode` | string |  | SSL mode: 'disable', 'require', 'verify-full'. |

**Relationships:** `parent` -> `v1:cluster:cluster`

## `v1:cluster:deployment`

A persisted deployment record (foundation of epic #1871, issue #1872). Append-only + time-series like the other cluster concepts: the row is written at deploy start (pending/in_progress) and every status transition appends a new payload version under the SAME concept id (the deploymentId, which is also the rollout hash) -- so the full lifecycle is reconstructable asOf any time, and `asOf latest` collapses to the deployment's current status. The CDC path emits graph.node.created/updated.<partition>.v1:cluster:deployment on every write, which the cockpit Deployments view subscribes to (same mechanism v1:cluster:node uses for live topology). The image digest -- previously only in releases/*.yaml on disk -- now lands in the data layer so history, node<->deploy linkage, next-version suggestion, and rollback can all be served from a query.

| Field | Type | Required | Description |
|---|---|---|---|
| `changelog` | string |  | Optional changelog / release-notes summary for this version. |
| `clusterId` | string |  | Node id of the v1:cluster:cluster this deployment targets. Plain string FK (not a @relationship -- cross-concept references use FK fields). |
| `deploymentId` | string | yes | Stable deployment id; also the Argo rollout hash. Used as the concept row id so status transitions append to one timeline. |
| `imageDigest` | string |  | Resolved container image digest for this deploy (sha256:...). Empty until the build/lockfile resolves it. |
| `notes` | string |  | Optional free-form operator notes. |
| `previousDeploymentId` | string |  | Optional deploymentId of the deploy this one supersedes. Plain string FK (not a @relationship). |
| `provider` | string |  | Deploy target / cloud provider: 'docker-local' (local Docker) or 'azure' (AKS). |
| `region` | string |  | Cloud region (e.g. 'us-central1') or 'local'. |
| `status` | string |  | Deployment lifecycle status. pending -> in_progress -> succeeded \| failed; succeeded -> superseded when a newer deploy promotes; any -> rolled_back on an explicit rollback. (enum: pending, in_progress, succeeded, failed, superseded, rolled_back) |
| `triggeredBy` | string |  | v1:identity:user.id of the operator who initiated the deploy. |
| `updatedAt` |  |  | Timestamp of the most recent status transition. The row intrinsic createdAt carries the deploy-start time. |
| `version` | string |  | MemQL semver being deployed (e.g. '2026.6.21'). |

## `v1:cluster:deploymentNodeSpec`

Per-node-type spec for a deployment (Epic 2 / #2094). One row per (deploymentId, nodeType): the version + replica count + resolved image digest a given node type runs under a deployment. Engine-as-spine: an empty `version` means this node type resolves against the parent deployment's engine version (the release lockfile's engineVersion); a non-empty `version` pins this node type to a specific version that overrides the spine. Append-only + time-series like the parent deployment: the row is written when the spec is first set and every re-pin (version/replicas/imageDigest change) appends a new payload version under the SAME concept id -- `hash(concat(shortId(deploymentId), ':', nodeType))` -- so the per-node-type spec history is reconstructable asOf any time, and `asOf latest` collapses to the node type's current spec. The CDC path emits graph.node.created/updated.<partition>.v1:cluster:deploymentNodeSpec on every write. deploymentId is a plain string FK to v1:cluster:deployment.deploymentId (cross-concept references use FK fields, not @relationship). A deployment's full per-node spec set = every deploymentNodeSpec with the same deploymentId.

| Field | Type | Required | Description |
|---|---|---|---|
| `deploymentId` | string | yes | FK to v1:cluster:deployment.deploymentId this spec belongs to. Plain string FK (not a @relationship -- cross-concept references use FK fields). Normalised with shortId() and then hashed into the composite concept id, so a bare and a canonical form derive the same row (#2925). Stored normalised too, since nodeSpecsForDeployment filters on this field. @minLength(1) because hashing makes an empty key indistinguishable from a real one (#2885). |
| `imageDigest` | string |  | Resolved container image digest for this node type (sha256:...). Empty until the build/lockfile resolves it. Mirrors the per-component digest in releases/<version>.yaml. |
| `nodeType` | string | yes | Node role this spec targets: bff, agent, planner, identity, mcp, workbench, edge. Hashed into the composite concept id alongside deploymentId so each (deployment, nodeType) pin appends to one timeline. @minLength(1) for the same reason as deploymentId (#2885). |
| `replicas` | integer |  | Desired replica count for this node type under this deployment. The cloud overlay defaults to 2 per Deployment to match the local 2-replica parity cluster (`make up SERVERS=2` + `make scale N=2`); the concept default is 1 for a single-node baseline. |
| `updatedAt` |  |  | Timestamp of the most recent spec transition. The row intrinsic createdAt carries the first-set time. |
| `version` | string |  | MemQL version this node type is pinned to (e.g. '2026.6.21'). Empty means engine-as-spine: resolve against the parent deployment's engine version (the release lockfile's engineVersion) rather than a per-node pin. A non-empty value overrides the spine for this node type only. |

## `v1:cluster:identityProvider`

An identity provider used for authentication and user management in a MemQL cluster. Typically the in-house identity service (component/identity), surfaced for cluster-topology dashboards. # `status` AND `lastVerifiedAt` ARE GONE (memql#4766)
Both were written once at bootstrap -- `status` as the literal `"connected"` -- and refreshed by nothing, so a cluster whose IdP had been unreachable for a week still reported `connected`.
Unlike `database.status` this one is not structurally impossible: the IdP is a different system, so a node CAN observe it. It is dropped because no writer is honest at this granularity. Every node runs a verifier that refreshes JWKS on a five-minute timer, so writing from all of them is a write per node per five minutes forever for a single-row fact -- the volume reasoning that keeps `lastSeenAt` off the broadcast rules. Electing one writer makes the row report THAT node's view rather than the cluster's. And a stored freshness stamp decays: "connected as of five minutes ago", read an hour later, is not a health signal.
A surface that wants IdP health probes it, and says when it looked. Re-add these only with a named writer and a stated staleness contract.

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptedAudiences` | array |  | List of accepted token audiences. |
| `clientIdPrefix` | string |  | First 8 characters of the OAuth client ID (non-secret, for identification). Empty for the in-house identity service. |
| `clusterId` | string |  | Node ID of the parent v1:cluster:cluster record. |
| `issuerUrl` | string | yes | Token issuer URL (e.g., 'https://auth.example.com/'). |
| `jwksUrl` | string |  | URL of the public-key JWKS document used for token verification. |
| `name` | string | yes | Provider name (e.g., 'MemQL Identity'). |
| `providerType` | string | yes | Authentication protocol. (enum: oidc, saml, ldap) |
| `redirectUrl` | string |  | OAuth callback URL configured for this provider. |

**Relationships:** `parent` -> `v1:cluster:cluster`

## `v1:cluster:node`

A registered node in the MemQL cluster. The record is written on registration and updated on every liveness transition (connecting, healthy, degraded, draining, offline, stopped). States mirror the NodeHealthStatus enum defined in component/node/node.proto -- that proto is the source of truth.

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | Advertised NodeService gRPC address for peer connections. |
| `capabilities` | array |  | Fully qualified capability names this node offers (e.g. integration.workbench.dispatchHost). |
| `deploymentId` | string |  | Stable id of the deployment that created this node (#1873). Injected at registration from the rollout (MEMQL_DEPLOYMENT_ID; downward-API pod/rollout template hash in k8s, 'local' in dev). Plain string FK to v1:cluster:deployment.deploymentId -- a deployment's topology is every node with the same deploymentId, and a node whose deploymentId != the cluster's current deployment is an orphan from a previous deploy (feeds the reaper #1874 + cockpit orphan highlight). |
| `flavor` | string |  | Domain flavor within the node type. Empty for single-flavor types. |
| `health` | string |  | Last known health status. Mirrors NodeHealthStatus enum in node.proto. (enum: connecting, healthy, degraded, draining, offline, stopped) |
| `labels` | object |  | Arbitrary metadata key-value pairs. |
| `lastSeen` |  |  | ISO 8601 timestamp of the most recent heartbeat (or registration if none received yet). |
| `nodeType` | string | yes | Node role: bff, agent, planner, workbench. |
| `parentId` | string |  | Node ID of the peer this node discovered via DB-based topology. Empty for the first node in a cluster. |
| `provider` | string |  | Cloud provider / deploy target backing this node: 'docker-local' (local Docker) or 'azure' (AKS). Stamped at registration from the system.startup payload (#1873). |
| `region` | string |  | Cloud region (e.g. 'us-central1') or 'local'. Stamped at registration from MEMQL_REGION (#1873). |

## `v1:cluster:nodeType`

Definition of a node type and its expected capabilities.

| Field | Type | Required | Description |
|---|---|---|---|
| `capabilities` | array |  | Expected capability FQNs that nodes of this type should expose. |
| `codeReference` | string |  | Optional architecture-model node id (model.Node.ID, e.g. 'service:memql') linking this node type to its code-side identity. Cockpit's Topology view uses this to bridge the live cluster grid and the architecture-model drill-down: selecting a live node finds the matching code-side service and jumps the navigator to that drill point. |
| `defaultLabels` | object |  | Default labels applied to spawned instances of this type. |
| `description` | string |  | Human-readable description of this node type's purpose. |
| `image` | string |  | Container image reference for this node type (e.g. gcr.io/project/memql-agent:latest). |
| `name` | string | yes | Node type identifier: bff, agent, planner, workbench. |

## `v1:cluster:releaseCut`

One release cut of MemQL itself: the tag and published GitHub Release that make the CI cascade (dispatch-engine-images-on-release.yml, #2519) build every node image at that version. Written only by integrations/release, and append-only -- the row id is the VERSION, so every status transition appends to that version's own timeline and a cut is never edited into a different one.
WHY THE ROW IS HISTORY AND NOT THE ANSWER TO "WHAT IS NEWEST". GitHub's tags are. A human who cuts a release by hand -- which release.sh's break-glass path still allows -- creates a tag this concept never hears about, so a reader that trusted the newest row would name a version that is no longer the latest and be confidently wrong. The portal card reads TAGS for "newest existing" and these rows only for "what did this cluster do", which is a division the card states in words.
STATUS IS WHAT WE VERIFIED, NOT WHAT WE EXPECT. `dispatched` means the Release published and the cascade was handed the version; it does NOT claim the images exist. Only an actual GHCR manifest check moves a row to `images_available` (releaseCutStatus, D5), and a check that ERRORED leaves the row where it was rather than guessing -- the workflow can fail after the Release publishes, and the registry is the only thing that knows.

| Field | Type | Required | Description |
|---|---|---|---|
| `baseSha` | string | yes | The main-branch commit sha the tag was created at, read from GitHub at cut time. This is what makes a cut reproducible: the version alone does not say what shipped, and the tag can be deleted. |
| `bump` | string | yes | Which part of the previous version was incremented to reach this one. Recorded because it is the operator's INTENT, and intent is not recoverable from the two versions alone once a hand-cut tag lands between them. (enum: major, minor, patch) |
| `checkedAt` |  |  | When a GHCR manifest check last ran for this version. Empty until someone asks -- the check is on demand, with no poller. |
| `dispatchedAt` |  |  | When the Release published. |
| `error` | string |  | The typed refusal code plus its message, when the cut failed or a status check errored. Never a credential: refusals name the VARIABLE to seed, never its value. |
| `pinBumpNote` | string |  | Why the pin-bump PR did not open, when it was asked for and could not. A PR that cannot be opened degrades to this note and NEVER fails the cut -- the release is already published by then, and failing the call would report a cut that happened as a cut that did not. |
| `pinBumpPrUrl` | string |  | html_url of the follow-on PR bumping the VS Code extension's DEFAULT_STACK_TAG, when bumpExtensionPin was asked for and the PR opened. Empty when it was not asked for. |
| `releaseUrl` | string |  | html_url of the published GitHub Release. Empty when the cut did not get that far. |
| `requestedBy` | string | yes | v1:identity:user.id of the owner who cut this release. Server-derived from the authenticated actor -- never an argument, because a caller-supplied value here would let one owner write another's name into the release history. |
| `requestedByEmail` | string |  | Email of the requester at cut time, denormalized so the history stays readable after the user row changes or is deleted. The same reasoning as v1:identity:auditEvent.actorEmail. |
| `status` | string | yes | dispatched = tag created and Release published, cascade handed the version, images NOT yet verified. tag_created_release_failed = the HALF-DONE state: the tag exists and the Release does not, so nothing fired and a human must finish or delete the tag. images_available = a GHCR manifest check found every image at this version. failed = nothing was created. (enum: dispatched, tag_created_release_failed, images_available, failed) |
| `tagName` | string |  | The git tag that exists even when the Release did not publish -- the one fact a human needs to finish or delete a half-done cut. Duplicates `version` on the happy path and is deliberately NOT derived from it: on tag_created_release_failed it is the only evidence that something was created. |
| `version` | string | yes | The version cut, in git-tag form (vX.Y.Z). ALSO the row id: one timeline per cut, so the append-only status transitions of one version stay one row's history. The image tags carry the BARE form without the leading v (memql#4061's two-conventions rule) -- this field is the tag, never the image tag. |

## `v1:cluster:spawnEvent`

Lifecycle event recording node state transitions (started, stopped, failed). Used for audit trail and cluster state recovery. Legacy name retained for data compatibility.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | What happened to the node. (enum: spawned, stopped, failed) |
| `initiatorId` | string |  | ID of the node that triggered this event. |
| `metadata` | object |  | Additional context about the event. |
| `nodeId` | string | yes | ID of the node this event pertains to. |
| `nodeType` | string | yes | Type of the node: bff, agent, planner, workbench. |
| `reason` | string |  | Human-readable reason for the event (e.g. shutdown signal, health check failure). |

## `v1:commerce:approvalChain`

An approval chain: who has to say yes, in what order, above what value.
Evaluated in MemQL BEFORE a draft order is sent, which is the whole point -- Shopify's own order-review Functions run at checkout, by which time the buyer has already been quoted a price nobody internally approved.

| Field | Type | Required | Description |
|---|---|---|---|
| `companyGid` | string |  |  |
| `currencyCode` | string |  |  |
| `decidedAt` |  |  |  |
| `name` | string | yes |  |
| `status` | string |  | (enum: pending, approved, rejected, inactive) |
| `steps` | array |  |  |
| `storeId` | string | yes |  |
| `subjectId` | string |  |  |
| `thresholdAmount` | string |  |  |

## `v1:commerce:companyLocationNote`

An internal note about a company location, projected the same way.

| Field | Type | Required | Description |
|---|---|---|---|
| `authoredBy` | string |  |  |
| `companyLocationGid` | string | yes |  |
| `note` | string |  |  |
| `status` | string |  | (enum: draft, live, failed) |
| `storeId` | string | yes |  |

## `v1:commerce:creditLimit`

A credit limit for a company location.
Shopify has no credit-limit field, so the limit is projected to a company-location metafield (memql.creditLimit) where a checkout validation Function can read it. THE FUNCTION IS NOT HERE: Functions are authored in the product repository and deployed to the store, and this row is what one reads. What MemQL owns is the number and its history.

| Field | Type | Required | Description |
|---|---|---|---|
| `companyGid` | string | yes |  |
| `companyLocationGid` | string | yes |  |
| `currencyCode` | string | yes |  |
| `limitAmount` | string | yes |  |
| `outstandingAmount` | string |  |  |
| `reviewedAt` |  |  |  |
| `reviewedBy` | string |  |  |
| `status` | string |  | (enum: active, hold, waived, failed) |
| `storeId` | string | yes |  |

## `v1:commerce:customerNote`

An internal note about a customer, projected to a memql-namespace metafield on the Shopify customer. Not storefront-readable.

| Field | Type | Required | Description |
|---|---|---|---|
| `authoredBy` | string |  |  |
| `customerGid` | string | yes |  |
| `note` | string |  |  |
| `status` | string |  | (enum: draft, live, failed) |
| `storeId` | string | yes |  |

## `v1:commerce:productContent`

Agent- and operator-authored product copy, projected into Shopify as metafields in the `memql` namespace. The FIRST origin domain (design D7): additive, cannot break a store, and the vehicle for agent-written content.

| Field | Type | Required | Description |
|---|---|---|---|
| `authoredBy` | string |  |  |
| `blocks` | object |  |  |
| `description` | string |  |  |
| `keywords` | array |  |  |
| `productGid` | string | yes |  |
| `status` | string |  | (enum: draft, live, failed) |
| `storeId` | string | yes |  |
| `summary` | string |  |  |

## `v1:commerce:quote`

A quote: priced, time-boxed, and turned into a Shopify draft order when the buyer accepts.
MemQL-origin and NOT mirrored. Shopify has no quote object, so pushing one would mean inventing a representation in metafields and then owning it forever. What crosses over is the ACCEPTED quote, as a draft order with locked prices -- which is a Shopify object that already exists.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvalChainId` | string |  |  |
| `companyContactGid` | string |  |  |
| `companyGid` | string | yes |  |
| `companyLocationGid` | string |  |  |
| `currencyCode` | string | yes |  |
| `draftOrderGid` | string |  |  |
| `lines` | array |  |  |
| `quoteNumber` | string | yes |  |
| `respondedAt` |  |  |  |
| `salesRepId` | string |  |  |
| `sentAt` |  |  |  |
| `status` | string |  | (enum: draft, sent, accepted, declined, expired) |
| `storeId` | string | yes |  |
| `terms` | string |  |  |
| `totalAmount` | string |  |  |
| `validUntil` |  |  |  |

## `v1:commerce:reorderList`

A saved reorder list: what a buyer buys again.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  |  |
| `companyContactGid` | string |  |  |
| `companyGid` | string | yes |  |
| `companyLocationGid` | string |  |  |
| `lastOrderedAt` |  |  |  |
| `lines` | array |  |  |
| `name` | string | yes |  |
| `storeId` | string | yes |  |

## `v1:commerce:salesRep`

A sales rep. A MemQL identity, deliberately: a rep is a person in the wholesale business, not a Shopify staff member, and on a non-Plus plan Shopify will not tell us about staff at all.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  |  |
| `displayName` | string | yes |  |
| `email` | string |  |  |
| `storeId` | string | yes |  |
| `territoryId` | string |  |  |
| `userId` | string |  |  |

## `v1:commerce:territory`

A territory: a named set of companies and locations one rep covers.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  |  |
| `companyGids` | array |  |  |
| `companyLocationGids` | array |  |  |
| `name` | string | yes |  |
| `storeId` | string | yes |  |

## `v1:common:attachment`

A file attachment with extracted transcription.

| Field | Type | Required | Description |
|---|---|---|---|
| `blobUrl` | string | yes | Azure Blob Storage URL where the file is stored (https://account.blob.core.windows.net/container/object). |
| `fileName` | string | yes | Original filename of the uploaded file. |
| `fileSize` | integer |  | File size in bytes. |
| `mimeType` | string | yes | MIME type of the uploaded file. |
| `status` | string | yes | Processing status of the attachment. (enum: processing, ready, error) |
| `summary` | string |  | AI-generated 2-3 sentence summary of the file content. |
| `transcription` | string |  | Extracted plain text from the file, or image description for images. |
| `uploadedBy` | string | yes | Actor identifier of the user who uploaded the file. |

## `v1:compose:composeTemplate`

A file that makes an output repeatable for a customer: a .docx with a branded header, an HTML shell, a Markdown skeleton, or a zip of files for a deployable. The row binds one Library file to the format it produces and the placeholders it expects.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountIds` | array |  | Optional v1:accounts:account tags -- 'this is the template we use for that client'. A record, never a visibility scope: no query here narrows on it, and a template tagged for one account is still selectable for another. |
| `archived` | boolean |  | Soft delete. Archiving the binding does not archive the file it points at -- the file is an ordinary Library row with its own disposition, and somebody who retires a binding has not asked to throw away the document. |
| `description` | string |  | What it is for, in the owner's words. Rendered under the name in the picker, which is where somebody choosing between two similar templates decides. |
| `fileId` | string | yes | v1:library:file holding the template's bytes -- a document, an HTML file, a Markdown file, or a zip of files. THE BYTES LIVE IN THE LIBRARY (design D7): this is a binding, not a second storage form. |
| `format` | string | yes | The format this template produces. A composition inherits it, and a Target column that offered a different one would be offering a combination the render step cannot honour. (enum: markdown, html, txt, csv, json, docx, pdf) |
| `name` | string | yes | What the person calls it in the Templates section and the Target column's picker. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this template. Stamped from actor.userId, never a caller arg. |
| `placeholders` | array |  | What the template will ask for: {name, description, required}, read out of the template when it is bound. It lets the app show what a template needs BEFORE somebody picks it, which is the difference between choosing a template and discovering halfway through a composition that it wanted a field nobody has. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:file`, `references` -> `v1:accounts:account`

## `v1:compose:composition`

One materialization: what was made, from what, through which template, by which models, and whether the file it produced carries its own provenance. The record is the provenance of last resort -- for a format with no metadata channel (design D4) it is the ONLY provenance the output has, which is why it is a first-class row rather than a field on the file.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountIds` | array |  | Optional v1:accounts:account tags -- a record of who the work is for, never a visibility scope (the accounts D1 rule). No query in this namespace narrows a read because of it. |
| `archived` | boolean |  | Soft delete, the same append-only re-version every Library row gets. Archiving the RECORD does not archive the output file and never deletes bytes -- the two are separate rows with separate dispositions, which is the Bin's own rule about what an archive is. |
| `deployableKind` | string |  | Set when this composition produced a PACKAGE SOURCE ZIP for the Deployables pipeline (design D8, epic issue #4980) rather than a document. The value is the site kind the zip is for, and the set matches OFFERED_KINDS in the Deployables app -- which site_kind_os_parity_test.go holds equal to v1:platform:site.kind, so this app reads that list rather than keeping a second one. EMPTY means an ordinary document composition, which is almost all of them. NO @default: the empty string is a MEMBER of this enum rather than a fallback, so an absent key and an explicit "" are the same answer and there is nothing for a default to add. @default is documentation and is never applied on insert, so one here would be a no-op reading as a promise. (enum: , spa, static, shopify_storefront) |
| `failureReason` | string |  | Why status is failed, in terms the person who asked can act on. Empty unless status==failed. On the row rather than only in a log because the person who asked is the one who needs to read it. |
| `folderId` | string |  | v1:library:folder the output was filed into, chosen in the Target column. Empty means the Library root. |
| `format` | string | yes | What kind of file this produces. The set is exactly what component/compose can WRITE (design D3). Audio and video are named in the brief and deliberately have NO value here: audio wants a compose-then-speak pipeline with a cost ceiling of its own and video wants a generation provider this cluster has none of, and a value that nothing can produce is a form somebody can fill in and nothing can store -- the same reasoning v1:platform:site.kind gives for having no ios/android value. The Target column names both absences and says why, because an absent option with no account of itself reads as something nobody got round to building. (enum: markdown, html, txt, csv, json, docx, pdf) |
| `goalId` | string |  | The v1:work:goal this materialization is. EVERY materialization is a goal (design D6): it opens through the existing createGoal builtin with requestedVia='materializer', so Nexus shows it, the spine journals it, and forkRun/replayRun already know how to run it again. This field is how the app hands off to Nexus and how a recipe finds its run template. |
| `modelsUsed` | array |  | Every model that contributed, as {provider, model, calls, tokens} -- A LIST, because the brief says 'every model that contributed' and a composition drafted by one model and tightened by another has two entries. A single field would make the second contribution invisible, which is precisely the fact a provenance record exists to carry. EMPTY IS A REAL ANSWER and the honest one on a catalog hit: a re-run that matched the catalog reached no model at all, and that is the product's headline claim rather than a missing value. |
| `name` | string | yes | What the person called it, and the filename stem of the output. Sanitised the way an upload's name is: path separators and control characters removed, length bounded. |
| `outputFileId` | string |  | v1:library:file holding the produced bytes. Empty until status reaches ready. The file is an ORDINARY Library file -- it browses, downloads, versions, moves between folders and archives to the Bin like any other, and the Files app's Materializer place is a shortcut to the subset that came from here. |
| `ownerUserId` | string | yes | v1:identity:user.id of the person this composition belongs to. Stamped from actor.userId and never accepted as a caller arg -- the load-bearing per-row authz key. |
| `provenanceEmbedded` | boolean |  | Whether the output file carries provenance in its own bytes. True for markdown (front matter), html (a meta block), docx (docProps/core.xml + custom.xml) and pdf (an XMP packet and the Info dictionary); false for txt, csv and json, which have no metadata channel (design D4). A false with no account of itself reads as a failure, which is what provenanceNote is for. NO @default, deliberately: this field has THREE states and the third is the reason the app reads it through an optional-bool rather than the SDK's rowBool. ABSENT means the stamp step has not run yet, and a default of false would put 'the record is the only copy' on a composition still composing -- a file that will carry its own provenance the moment it is written. The engine writes this once, in updateCompositionState, and never before it knows. |
| `provenanceNote` | string |  | One sentence saying what the flag above means for THIS file, rendered verbatim by the app: 'CSV carries no metadata channel -- the record here is the only provenance this file has.' Written by the stamp step, which is the only place that knows which branch it took. |
| `recipeId` | string |  | v1:compose:recipe this composition was run from, when it was run from one rather than composed by hand. Empty for a first-time composition -- which is also what tells the app whether to offer 'Save as recipe'. |
| `runId` | string |  | The v1:work:run currently carrying this composition, or the last one that did. Re-stamped on each attempt, so it names the run whose steps the app draws rather than the first one ever opened. |
| `sha256` | string |  | Lowercase hex SHA-256 of the produced bytes, copied from the file row. A verification handle, never an access key: the bytes only ever reach a viewer through GET /artifacts/{id}/content under their own actor. |
| `sources` | array |  | What went in: a list of {kind, ref, label, capturedAt} where kind is concept_row \| library_file \| query. THREE KINDS RATHER THAN A LIST OF IDS, and the distinction is load-bearing (design C): 'made from the 4 invoices matching status=open' and 'made from these 4 invoice ids' are different claims about repeatability, and flattening them to ids keeps only the second. `ref` is a BARE id for the row and file kinds and a rendered call string for the query kind; `capturedAt` is when it was resolved, which is what makes a re-run's difference explainable. |
| `statement` | string |  | What the person asked for, in their own words -- copied from the goal's statement. Kept on the row rather than read through goalId because the Materialized list renders it and a per-row goal read would be one read per row. |
| `status` | string | yes | Where the materialization is. draft = sources and target chosen, nothing run; composing = the one reasoning step is in flight; rendering = the deterministic tail (render, stamp, file); ready = the output file exists; failed = terminal, with failureReason set; cancelled = somebody stopped it. NOT a mirror of the run's status: a run can be `waiting` on an approval while this row is still `composing`, and collapsing the two would make the app claim the file is being written when nothing is. (enum: draft, composing, rendering, ready, failed, cancelled) |
| `templateId` | string |  | v1:compose:template this was rendered through. Empty for a composition with no template -- the format's own default rendering is used, which is the common case for markdown and the impossible case for docx branding. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:file`, `references` -> `v1:library:folder`, `references` -> `v1:compose:composeTemplate`, `references` -> `v1:work:goal`, `references` -> `v1:work:run`, `references` -> `v1:compose:recipe`, `references` -> `v1:accounts:account`

## `v1:compose:compositionInput`

The saved execution request and captured source payloads for one materialization. Kept apart from the account-shared composition so sharing its provenance does not share private inputs.

| Field | Type | Required | Description |
|---|---|---|---|
| `compositionId` | string | yes |  |
| `ownerUserId` | string | yes |  |
| `request` | object | yes |  |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:compose:composition`

## `v1:compose:recipe`

A composition that worked, promoted to something you can run again: the source SELECTORS, the template and the format. Running one opens a goal exactly as a fresh materialization does, and a re-run with the same shape is a catalog exact match -- so it reaches no model at all.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountIds` | array |  | Optional v1:accounts:account tags. A record, never a visibility scope. |
| `archived` | boolean |  | Soft delete. The compositions a recipe produced are untouched -- they are the evidence it worked. |
| `description` | string |  | What running it does, in the owner's words. |
| `folderId` | string |  | v1:library:folder to file each run's output into. Empty means the Library root. |
| `format` | string | yes | What it produces. (enum: markdown, html, txt, csv, json, docx, pdf) |
| `lastRunAt` |  |  | When this recipe last produced something. Rendered continuously beside the row and deliberately ABSENT from the arrival-cue fingerprint: a recipe on a schedule would touch it forever, and naming it as news would strobe the list on that schedule's own cycle (the heartbeat rule, clients/os/README.md). |
| `name` | string | yes | What the person calls it -- 'Quarterly report for Acme'. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this recipe. Stamped from actor.userId, never a caller arg. |
| `runCount` | integer |  | How many compositions this recipe has produced. ABSENT MEANS ZERO here and that is safe, unlike every `absent is not zero` case in this tree: nothing wrote this field before the concept existed, because the concept is new. |
| `sourceSelectors` | array |  | How to find the sources NEXT time: {kind, selector, label} where kind is concept_query \| library_file. A SELECTOR RATHER THAN THE ROWS IT RETURNED -- 'the invoices matching status=open' rather than the four ids that matched last quarter. Storing the answers would make a recipe a copy of one composition instead of a way to make the next one. THERE IS DELIBERATELY NO library_folder KIND: 'everything in that folder' is exactly the standing selection a recipe wants, and the Library has no read that answers it -- v1:library:file.folderId is the INITIAL FILING ONLY, so a query built on it would silently omit every file somebody had since moved. A recipe that quietly composes from a subset is worse than one that cannot express the selection, so the kind is refused by name and a concept_query over the artifact index is how to say it today. |
| `templateId` | string |  | v1:compose:template to render through. Empty for a recipe with no template. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:compose:composeTemplate`, `references` -> `v1:library:folder`, `references` -> `v1:accounts:account`

## `v1:data:log`

Audit log entry for validation state transitions. Tracks who performed each check, confirm, or revert action, when, and why.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Action performed (enum: check, confirm, revert) |
| `active` | boolean |  | Soft-delete flag (append-only semantics). Convention: true -- NOT applied on insert, and no mutation is bound to this concept, so a writer must supply it; an absent value reads as false, i.e. soft-deleted. |
| `fromState` | string | yes | Validation state before the action (enum: draft, checked, confirmed) |
| `identityId` | string | yes | Identity who performed the action |
| `identityType` | string | yes | Type of identity (denormalized for fast filtering) (enum: human, synthetic) |
| `note` | string |  | Optional reason, especially useful for reverts |
| `partitionId` | string | yes | Space ID for scoped log queries |
| `recordId` | string | yes | The v1:data:record node ID this log entry refers to |
| `toState` | string | yes | Validation state after the action (enum: draft, checked, confirmed) |

**Relationships:** `parent` -> `v1:data:record`

## `v1:data:policy`

Validation policy defining check/confirm requirements for a record type. Controls how many synthetic checks and human confirmations are needed, and whether checked data is usable before full confirmation.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `checkedDataUsable` | boolean |  | Whether checked (not yet confirmed) records are usable live |
| `partitionId` | string |  | Optional space scope. Null means global for this record type. |
| `requiredChecks` | integer |  | Number of synthetic checks needed for draft -> checked |
| `requiredConfirmations` | integer |  | Number of human confirmations needed for checked -> confirmed |
| `revertMinRole` | string |  | Minimum role required to revert records (enum: owner, admin, writer, reader) |
| `targetRecordType` | string | yes | Record type this policy applies to (e.g., 'vehicle', 'bird') |

## `v1:data:record`

Data record with validation lifecycle: draft -> checked -> confirmed. Replaces the staging/production split with a unified concept where data visibility is governed by validation state and policy.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `checkCount` | integer |  | Number of synthetic checks received |
| `confidence` | number |  | AI confidence score (0-1) |
| `confirmCount` | integer |  | Number of human confirmations received |
| `data` | object | yes | The actual data payload |
| `importSource` | string | yes | How this data was imported (enum: chat-ai-research, chat-file-upload, manual) |
| `importedBy` | string | yes | Identity ID of the importer |
| `label` | string | yes | Human-readable display label |
| `lastCheckedAt` |  |  | When last checked by a synthetic identity |
| `lastCheckedBy` | string |  | Identity ID of last synthetic checker |
| `lastConfirmedAt` |  |  | When last confirmed by a human identity |
| `lastConfirmedBy` | string |  | Identity ID of last human confirmer |
| `naturalKeyField` | string |  | Name of the natural key field for conflict detection (e.g., 'vin', 'name') |
| `naturalKeyValue` | string |  | Value of the natural key for conflict matching |
| `partitionId` | string | yes | Space this record belongs to |
| `recordType` | string | yes | Domain-specific record type (e.g., 'vehicle', 'bird', 'employee') |
| `sourceAttachmentId` | string |  | Reference to source attachment if file-based import |
| `validationState` | string |  | Current lifecycle state (enum: draft, checked, confirmed) |

## `v1:forge:project`

A project/codebase forge develops against (e.g. memql, or a given client's app). Requests are scoped to a project so one agnostic bundle serves many apps. Partition-scoped: team-shared within the tenant.

| Field | Type | Required | Description |
|---|---|---|---|
| `createdByUserId` | string |  | v1:identity:user.id of whoever registered the project. |
| `description` | string |  | What this project is. |
| `name` | string | yes | Human-readable project name. |
| `provenanceMutation` | string |  | Name of the mutation that produced this version (audit trail). |
| `repo` | string |  | Git repository URL or path. |
| `slug` | string | yes | Stable short id, e.g. 'memql', 'acme-app'. Unique within the partition. |
| `status` | string | yes | active = accepting requests; archived = read-only history. (enum: active, archived) |
| `targetApp` | string |  | Which app this project develops (memql / memql-cockpit / a client app / ...). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:forge:request`

A request a team member submits through Claude -> the forge MCP surface: a bug, feature, or (later) HR action. Routed by submitterRole through the approval pipeline (submitted -> needs_validation -> validated -> needs_approval -> approved -> queued). Partition-scoped so validators/approvers can read it. Every transition is recorded as a v1:forge:requestEvent for a full time-series audit trail.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvedByUserId` | string |  | v1:identity:user.id of the approver (owner). Set on the approved transition. |
| `attachmentIds` | array |  | v1:common:attachment ids -- screenshots/files the submitter (via Claude) attached. Reuses the common attachment concept. |
| `body` | string | yes | The full prompt/description -- what the submitter wants, what they saw, repro steps. |
| `priority` | string | yes | Submitter/triager priority. (enum: low, normal, high, urgent) |
| `projectId` | string | yes | v1:forge:project.id this request targets. |
| `provenanceMutation` | string |  | Name of the mutation that produced this version (audit trail). |
| `requestType` | string | yes | Request kind (named requestType because `type` is a reserved row intrinsic). Drives which pipeline applies. First slice centers bug/feature; HR types are modelled so they ride the same spine. (enum: bug, feature, chore, question, timeOff, checkIn) |
| `resolution` | string |  | Free-form outcome note when the request reaches a terminal state. |
| `status` | string | yes | Approval-pipeline state. createRequest lands 'submitted'; routeRequest sets the next state by role; validate/approve transitions advance it; 'queued' = approved and waiting for implementation (auto-execute lands when the actions substrate is wired). (enum: submitted, needs_validation, validated, needs_approval, approved, changes_requested, rejected, queued) |
| `submitterRole` | string | yes | The submitter's cluster role at submit time. Stamped from actor.role. THE routing key: owner short-circuits the chain; reader requires validation + approval and triggers the mentoring layer. (enum: owner, admin, writer, reader) |
| `submitterUserId` | string | yes | v1:identity:user.id of the submitter. Stamped from actor.userId by createRequest -- the caller cannot submit as someone else. |
| `targetEnv` | string | yes | Where an approved request deploys. Defaults to staging. (enum: staging, production) |
| `title` | string | yes | Short summary of the request. |
| `validatedByUserId` | string |  | v1:identity:user.id of the developer who validated. Set on the validated transition. |

**Relationships:** `parent` -> `v1:forge:project`, `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`

## `v1:forge:requestEvent`

An append-only event in a request's lifecycle: a routing decision, validation, approval, rejection, comment, or mentoring touch. The time-series audit trail for a request -- every transition is one row, never mutated.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorRole` | string |  | The actor's cluster role at event time. |
| `actorUserId` | string | yes | v1:identity:user.id who produced the event. Stamped from actor.userId. |
| `fromStatus` | string |  | Request status before this event (for transitions). |
| `kind` | string | yes | What happened. (enum: submitted, routed, validated, changes_requested, approved, rejected, commented, mentored) |
| `note` | string |  | Free-form note: validation comment, rejection reason, mentoring summary, etc. |
| `provenanceMutation` | string |  | Name of the mutation that produced this event (audit trail). |
| `requestId` | string | yes | v1:forge:request.id this event belongs to. |
| `toStatus` | string |  | Request status after this event (for transitions). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:healing:healedOverride`

A two-tier definition of a self-healable construct: the immutable BASE (authored/embedded, never LLM-healed -- the deploy spine's source of truth) and a healed OVERLAY override (data, produced by the repair loop, human-validated) that shadows its base when valid. Resolution prefers the most-recent VALID overlay override for a baseConstructId and falls back to the base. Mirrors the Epic 1 RBAC base/custom hybrid (immutable predefined base + dynamic custom data, newest-wins). The `tier` field is the immutability axis: a tier=base row is immutable at runtime (the validateHealingBaseImmutable Go guard rejects any non-system-actor write to it, so an override can never be forged as base to escape the override-is-data contract); a tier=overlay row is the healed data an actor may add. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId. Multi-node consistent via the shared Postgres + the cache.invalidate broadcast.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. An inactive override is ignored at resolution time but kept for audit -- lets a healed override be retired (reverting resolution to base or an older valid override) without churning row history. Base rows are never deactivated (the immutability guard blocks it). |
| `baseConstructId` | string | yes | Stable id of the BASE construct this row defines or overrides -- the automation name, precondition id, guard id, or literal key the healing loop targets (e.g. 'deployStaging' or 'deployStaging.envIsStaging'). The resolution key: resolveConstruct(baseConstructId) prefers the newest VALID overlay override with this baseConstructId and falls back to the base. Mirrors how v1:rbac:capability.roleSlug + role.slug join a grant to its role by a stable string, not a node id. |
| `blastRadius` | string |  | How widely this heal propagates -- the validation effort axis (E4.5 / memql#2143). Bigger blast radius => a HIGHER minimum role rank is required to validate it (the validateHealingValidationRankBound Go guard gates the valid false->true transition on actor.rank >= the radius-required rank). personal = the heal only affects the owner's own construct (min rank: user); shared = the heal affects a construct other principals depend on (min rank: admin); spine_adjacent = the heal sits next to the deploy spine / cross-cutting infrastructure (min rank: developer). Owner can validate any radius. Mirrors Epic 1's rank model (owner > developer > admin > user). (enum: personal, shared, spine_adjacent) |
| `overrideData` | object |  | The healed construct body -- the typed-patch RESULT (E4.3): the construct definition (e.g. the rewritten automation / precondition / guard / literal) that this override resolves to. Empty for a placeholder/pending row. Named overrideData (not the reserved `payload` intrinsic). The two-tier resolver returns this verbatim when this override wins resolution. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this override -- the user whose construct was healed. Stamped from actor.userId at create time and re-stamped on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. For an embedded tier=base row materialized by the SeedMaterializer this is the system owner. |
| `reason` | string |  | Human-readable note explaining WHY this override exists -- the precondition-miss that triggered the heal, the patch kind applied, the validator's comment. Surfaced in the cockpit healed-pack view (E4.6) for auditability. Optional. |
| `rejectionReason` | string |  | Human-readable reason a validator REJECTED this override. Empty unless validationStatus=rejected. Kept for audit so a rejected proposal is recorded, not silently dropped. |
| `sourcePreconditionId` | string |  | Optional back-pointer to the precondition (E4.1) whose miss triggered this heal -- the healing.precondition.missed signal's preconditionId. Empty for a manually-authored override. Lets the cockpit group healed overrides under the precondition-miss that produced them and lets the repair loop reconcile what it has already proposed for a given miss. |
| `tier` | string | yes | The immutability axis. base = the immutable, authored/embedded definition -- the deploy spine's source of truth, never LLM-healed; a tier=base row is materialized only by a system actor (the SeedMaterializer) and the validateHealingBaseImmutable Go guard rejects any non-system-actor write to it. overlay = a healed override produced by the repair loop (E4.4) + human-validated (E4.5); it is editable data an actor may add and is the default for any runtime write. Resolution prefers a VALID overlay over base. (enum: base, overlay) |
| `valid` | boolean |  | Whether this override is a VALID, resolution-eligible definition. Only a valid override shadows its base -- the core of the two-tier contract: resolution prefers a VALID overlay override and otherwise falls back to base. A proposed-but-not-yet-validated override (E4.5 human validation pending) carries valid=false and is invisible to resolution, so an unvalidated heal can never silently take effect. Set true on human acceptance (E4.5). |
| `validatedAt` |  |  | RFC3339 timestamp of the validation/rejection decision. Empty while proposed. |
| `validatedBy` | string |  | v1:identity:user.id of the human who validated (or rejected) this override. Stamped from actor.userId by the validate/reject mutation. Empty while proposed. The audit trail for who accepted a heal at what blast radius. |
| `validationStatus` | string |  | Human-validation state (E4.5). proposed = the repair loop proposed it (valid=false, invisible to resolution); validated = a role-appropriate human accepted it (flips valid=true, captured as a new version); rejected = a human declined it (valid stays false, kept for audit). The validation flow transitions proposed -> validated\|rejected; resolution only ever returns validated+valid+active overlays. (enum: proposed, validated, rejected) |
| `version` | integer |  | Monotonic version of this override for a given baseConstructId. Always written: proposeOverride takes `version int!` as a required arg and accepts it, so there is no omitted case. each accepted heal captures a NEW version (E4.5 capture-as-version) rather than mutating the prior one, so the override history is an audit trail and a pin can resolve an exact version. Resolution prefers the highest-version VALID overlay; ties break on newest createdAt. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:accessRequest`

Self-service access request placed on the waitlist queue. Created when an unknown email submits the registration form while MEMQL_IDENTITY_REGISTRATION_MODE=approval. Admins triage rows in the admin console: approval mints a v1:identity:invitation and emails a magic link; rejection stamps the reason and closes the row. Also auto-aged by the accessRequestExpirySweep cron once IDENTITY_ACCESS_REQUEST_EXPIRY_DAYS has elapsed without a decision. Global scope so admins in any partition (typically owners of the cluster) can review the queue.

| Field | Type | Required | Description |
|---|---|---|---|
| `additionalContext` | string |  | Free-text 'what would you use this for' answer the requester can optionally supply. Helps admins triage but never gates access by itself. |
| `email` | string | yes | Email address the requester wants to register with. Same value flows into the eventual v1:identity:user.primaryEmail on approval. |
| `invitationId` | string |  | Set on approval to the v1:identity:invitation row that was minted to deliver the magic link. Empty for pending / rejected / expired rows. |
| `name` | string |  | Display name supplied at submission time. Optional (some flows ask, some don't). |
| `reviewedAt` |  |  | Timestamp of the admin decision. Empty until reviewed. |
| `reviewedBy` | string |  | v1:identity:user.id of the admin who acted on the row. Empty until reviewed. |
| `reviewerNote` | string |  | Free-text rationale recorded by the admin. Required by UX convention for rejections; optional but encouraged for approvals. Stored verbatim for audit -- never edited. |
| `riskScore` | integer |  | Composite risk score (0-100) computed at submission time from riskSignals. Higher = more suspicious. Surfaced to admins in the queue so they can triage cleanly. Never auto-rejects; admins always make the call. |
| `riskSignals` | string |  | Comma-separated signal tags that fed riskScore. Examples: disposable_domain,velocity_per_ip,typo_squatted_domain,known_breach_email. Admin UI renders each tag as a chip with a tooltip. |
| `sourceIP` | string |  | IP the submission came from. Captured for audit and to feed velocity-per-IP risk signals. |
| `status` | string | yes | Lifecycle. pending = on the queue. approved = admin clicked approve and the invitation was minted. rejected = admin closed the row with reviewerNote. expired = aged out by accessRequestExpirySweep cron. (enum: pending, approved, rejected, expired) |
| `userAgent` | string |  | User-Agent header at submission. Captured for audit; bot-fingerprint heuristics may reference it. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:invitation`

## `v1:identity:account`

A CUSTOMER THE OPERATOR MANAGES -- the record MemQL keeps ABOUT a downstream business, as opposed to v1:identity:user (a principal that logs in) or v1:identity:accountEntitlement (a billing cap keyed on a paying account id). An account is operator-side bookkeeping: it holds no credential, mints no session and is never a subject -- nothing authenticates AS an account, and no v1:identity:identity row points at one. Accounts are also FLAT: there is deliberately no parentAccountId, because a nesting edge makes the isolation predicate transitive and a transitive predicate cannot be pushed down as a single filter conjunct. An agency with sub-clients is N sibling accounts sharing an operator, not a tree. Per-row authz: OWNED, and engine-enforced rather than author-enforced -- ownerUserId is @serverSet and stamped from actor.userId on every write, and the @rowAuthz declaration makes the engine AND ownerUserId==actor.userId into every read (component/memql/rowauthz_enforce.go, memql#3172) and refuse any update whose target row the actor does not own (component/memql/rowauthz_write_guard.go, memql#3174). The model, and the three places it is NOT sufficient, are recorded in docs/internal/design/account-isolation-model.md.

| Field | Type | Required | Description |
|---|---|---|---|
| `archivedAt` |  |  | RFC3339 timestamp stamped by archiveAccount. Empty while status is active or suspended. Kept alongside status so a retention sweep can age archived customers without re-deriving the transition time from the row's version history. |
| `description` | string |  | Free-text operator note about who this customer is and what MemQL does for them. Rendered as the display card's secondary line. |
| `externalRef` | string |  | The operator's own identifier for this customer in whatever system is upstream of MemQL -- a CRM record id, a billing customer id, an internal account number. Opaque to the engine: never parsed, never resolved, and deliberately NOT an @relationship, because it names a row in a system MemQL does not host. |
| `name` | string | yes | Display name of the customer, as the operator refers to them. The primary display field. Not unique -- the engine enforces no uniqueness constraint on any payload field, so two accounts may share a name and the row id is the only identity. |
| `ownerUserId` | string | yes | v1:identity:user.id of the operator principal that manages this customer. THE ROW-AUTHZ OWNER FIELD: stamped from actor.userId on create and re-stamped on every update so ownership can never be reassigned by a caller, and @serverSet turns 'never accepted from caller args' into a LOAD-TIME rejection rather than a convention. Because the concept declares @rowAuthz(owner="ownerUserId"), this field is also what the engine compares against on the read path and in the write guard -- it is not merely documentation of an intent each query has to restate. |
| `primaryContactEmail` | string |  | Email of the primary contact. @pii for the same reason as primaryContactName. NOT a credential and NOT a login: an account has no authentication path, so this address is never matched against a magic-link or session lookup. |
| `primaryContactName` | string |  | Name of the human the operator deals with at this customer. Personal data about a third party rather than about a MemQL principal, hence @pii: any query projecting it must constrain its caller (test/dslconformance/pii_projection_test.go). |
| `status` | string | yes | Lifecycle. active = a live customer. suspended = temporarily stopped (non-payment, pause) but still visible in the operator's list. archived = closed; retained for history and excluded from working lists by the caller's filter. Stamped 'active' by createAccount and flipped to 'archived' by archiveAccount; there is no hard delete -- a write is an append onto the same id. (enum: active, suspended, archived) |
| `updatedAt` |  |  | RFC3339 watermark of the most recent edit, stamped to now on every write so an operator list can sort by recency. The authoritative version order is still the row's createdAt history; this is a denormalized convenience for the latest version. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:accountEntitlement`

Per-account entitlement that caps the number of CONCURRENTLY-RUNNING tasks (Plans) a paying account may have across all of its spaces, sourced from the billing tier (epic memql#902 / foundation child #903). The cap is per paying account -- v1 keys on v1:identity:user.id (accountKind='user'); accountKind='org' is reserved for a future per-organization rollup where many users share one paying account's slots. DEFAULT = UNLIMITED (enterprise behavior): an account with no row here, an enterprise tier, or a non-positive maxConcurrentTasks is uncapped -- the admission controller (#904) is a no-op until a finite cap is written, so existing / unconfigured accounts behave exactly as today (no regression). The NUMBER (maxConcurrentTasks) is the source of truth so billing can change a tier's cap without a code change; tier is carried alongside purely for the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. Global scope (lives in _system) so the planner node's admission controller and the billing / admin writer can both reach it from any partition. One logical row per account: setAccountEntitlement mints a deterministic id (accountEntitlement-<hash(accountId)>) so each set appends a new time-series version and the latest wins.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string | yes | The paying account this entitlement applies to. v1: a v1:identity:user.id (accountKind='user'). The admission controller (#904) resolves a Plan's account via Plan.requestedBy and reads the effective cap from the matching row here. |
| `accountKind` | string | yes | Whether accountId names a user or an org. v1 is always 'user' (per-user account); 'org' is reserved for the future per-organization concurrency rollup where many users share one paying account's pool of slots. (enum: user, org) |
| `maxConcurrentTasks` | integer |  | The cap: the maximum number of Plans this account may have running concurrently across all of its spaces. SOURCE OF TRUTH for the number (billing writes it), so a tier's cap changes without a code change. A value <= 0 means UNLIMITED (the default). Ignored when tier='enterprise' (always unlimited). E.g. set to 5 to cap a pro account at five concurrent running tasks; the 6th and beyond wait for a freed slot (#905). |
| `note` | string |  | Free-text operator / billing note about why this entitlement was set (e.g. 'pro plan', 'temporary bump during migration'). Audit aid only; the resolver ignores it. |
| `tier` | string | yes | Billing tier label. Drives the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. NOT the source of truth for the cap number -- maxConcurrentTasks is. Defaults to 'enterprise' so a default / unconfigured row stays uncapped. (enum: free, pro, team, enterprise) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:auditEvent`

Append-only audit log entry. Captures security-relevant events (auth, identity, authorization, configuration, admin) with actor + target + source attribution. Global scope so any cluster operator can read the full trail. Retention controlled by MEMQL_IDENTITY_AUDIT_LOG_RETENTION_DAYS via the daily auditEventRetentionSweep automation. The prevEventHash field is reserved for future hash-chain tamper-resistance; written but not validated in MVP.
TIER: `clusterOwner`, and that is a RULING rather than a default (memql#4366, which carved this decision out of memql#4313). Three things ruled out the alternatives:
  - `owner="actorUserId"` cannot be declared. createAuditEvent writes actorUserId from CALLER     ARGS, which TestDeclaredOwnerFieldsAreServerStamped refuses for a declared owner field --     and re-stamping it from the actor would be WRONG rather than inconvenient: the identity     service writes these on a user's behalf, and actorUserId is deliberately EMPTY for an     anonymous event. A tier whose owner field is empty on the rows that matter most is a tier     that admits nobody to them.   - The composite `owner=..., clusterOwner` cannot deliver "an admin reads all" either.     `clusterOwner` is `Role == owner` ALONE (AccessContext.IsClusterOwner), so an admin would     be passed by a requiresOwnerOrAdmin query gate and then narrowed by the tier to nothing.     memql#4313 assumed the two were the same; they are not.   - `via="<spec>"` over a role predicate would parse, and is refused on meaning. The granted     tier's whole design premise is "a row in isolation cannot answer this, the filter's join     can" -- which is FALSE for a role check, needing no row at all. Every fail-closed edge it     has (graph traversal, top-level builtin results, the write guard) would then fail for a     reason that does not apply.
So the ruling is the one memql#4366 offers as the alternative: THE CLUSTER-WIDE SECURITY LOG IS OWNER-ONLY. It is the same split memql#4328 already made for its sibling -- recentAuthActivity is the operator roll-up, authActivityForSelf is where a person reads their own story. Routine MECHANICS are self-readable; security DECISIONS about the whole cluster are the operator's. A non-owner admin keeps authActivityForSelf and loses the cluster-wide trail.
createAuditEvent is unaffected: the write guard resolves a TARGET ROW and so covers updates and deletes, never creates (rowauthz_write_guard.go), and this concept is append-only with no update path at all.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Machine-readable action enum, lower_snake_case. Examples: login_attempted, login_succeeded, magic_link_issued, magic_link_approved, magic_link_approval_denied, magic_link_completed, magic_link_finish_blocked, magic_link_consumed, magic_link_refused_policy, auth_code_redemption_blocked, session_created, sign_in_notification_sent, sign_in_policy_changed, sign_in_policy_reset_by_admin, shared_mailbox_changed, session_revoked, refresh_token_reuse_detected, role_changed, partition_grant_created, registration_mode_changed, jwks_rotated. THIS LOG RECORDS DECISIONS AND SECURITY SIGNALS; routine mechanics live on v1:identity:authActivity (memql#4328). Four actions MOVED there and no longer appear here: session_refreshed, session_refresh_blocked, grace_window_accept, pat_auth_accepted. refresh_succeeded and refresh_token_theft_detected were listed here and are not, because nothing emitted either -- an example nothing writes reads as a control that exists. Their successors are real: the rotation event is session_refreshed on the activity stream, and refresh_token_theft_detected is superseded by refresh_token_reuse_detected, which memql#4329 actually emits. Unlike authActivity.action this stays an unconstrained string: this concept has many writers across the identity service and a closed enum here would refuse a new decision at insert time. |
| `actorEmail` | string |  | Email of the actor at the time of the event. Captured here for audit even after the user record is deleted — auditEvent rows are tombstoned, not removed, on user deletion. |
| `actorIdentityId` | string |  | v1:identity:identity.id of the credential the actor used (magic_link, api_key, etc.). Distinguishes 'logged in via web' from 'PAT in CI'. |
| `actorRole` | string |  | Cluster role of the actor at the time of the event (owner / admin / developer / writer / reader). Captured for point-in-time accuracy. |
| `actorUserId` | string |  | v1:identity:user.id of the actor when authenticated. Empty for anonymous events (login attempts where no session yet exists). |
| `category` | string | yes | Coarse grouping for filtering and retention policy hooks. (enum: auth, identity, authorization, configuration, admin, data) |
| `correlationId` | string |  | Groups related events from one logical interaction. Example: a single login flow's attempt + magic-link issued + magic-link consumed + session created share one correlationId. |
| `detail` | object |  | Action-specific structured payload. Schema varies by action; consumer code reads the keys it knows. Examples: {"reason":"idle_timeout"} for refresh failures, {"oldRole":"writer","newRole":"admin"} for role changes, {"riskScore":62,"signals":["disposable_domain","velocity"]} for blocked registrations. |
| `failureReason` | string |  | Free-text or enum reason when outcome=failure or outcome=blocked. Examples: token_expired, insufficient_role, rate_limited, risk_threshold_exceeded. |
| `occurredAt` | string | yes | When the event happened. May lag createdAt by milliseconds because the row is written after the event completes. |
| `outcome` | string |  | Outcome marker for events where success/failure is meaningful. blocked = denied at policy layer (rate limit, risk threshold, etc.). (enum: success, failure, blocked, ) |
| `prevEventHash` | string |  | Reserved for future hash-chain tamper-resistance. SHA-256 hex digest of the previous event's full payload. Written from day one; chain validation enabled by a follow-up iteration. |
| `sourceIP` | string |  | IP address the event originated from. Best-effort — proxy chains and X-Forwarded-For honored only when the deployment trusts the proxy. |
| `targetEmail` | string |  | Email associated with the target, if applicable. Useful for filtering audit history by user without needing a join. |
| `targetId` | string |  | Identifier of the target row when targetType is set. |
| `targetType` | string |  | Concept type of the target row, if any. oauthClient names the RELYING PARTY rather than a row this cluster necessarily holds -- a built-in first-party client is compiled in, not stored (memql#4515) -- and is what a role-floor refusal on the SSO fast path targets, where no credential row was created to name instead. releaseCut names a v1:cluster:releaseCut row -- the DECISION to ship a version of MemQL itself, which belongs in this log rather than only in the cluster history (epic memql#4434). passkeyIdentity and badgeIdentity name the v1:identity:identity VARIANT rather than the concept, so a credential whose lifecycle is audited on its own (passkey register / login / rename / revoke, badge grant) stays distinguishable in the trail without parsing `action`. rowOwnership names a TRANSFER of who owns a set of rows (memql#4838) -- not a row, and not a user, but the relationship between them. It is the one targetType whose subject is a pair of principals, which is why targetId carries the RECIPIENT and the departing principal rides in detail alongside the rows moved -- the question an auditor asks of this event is who holds these rows now. githubGrant names a v1:platform:sourceCredential row of kind="github_app" -- an AUTHORIZATION this cluster holds on somebody's behalf at GitHub (epic memql#4912). Not `identity`, which names a credential that proves who a person IS here: a grant proves nothing about identity and authenticates nobody at this cluster, it is authority to act at another one. Not `config` either, because it belongs to one person rather than to the deployment, and the audit question asked of it -- who connected, reconnected, or had a callback refused -- is about that person. targetId carries the credential row id and the GitHub login rides in detail. role names a v1:rbac:role row (epic memql#5166) -- a DEFINITION of authority rather than a person who holds it, which is why it is neither `identity` (a credential proving who somebody IS) nor `config` (the deployment's own settings). A role belongs to the cluster and the question asked of these events is what a role was allowed to do and who decided that, so targetId carries the slug and the changed fields ride in detail. group and groupMembership name the two rows of the grant model (epic memql#5165). A group is not a `user` and not `config`: it belongs to the deployment rather than to a person, and the audit question asked of it -- who could reach this client's work, and since when -- is answered by walking the group rather than any one person. The membership is its own type rather than a flavour of `user` for the same reason component/identity/adminops could not reuse its hardcoded `user`: a membership is a decision ABOUT a person but TO a group, so targetId carries the membership row and the person rides in detail. grant names a v1:rbac:grant row (epic memql#5297) -- a DECISION about a person or a group over one (verb, resource), beside the role catalog. Not `role`, whose subject is a definition of authority, and not `user`, because the same row can name a group: targetId carries the grant's derived row id and the subject, verb, resource and effect ride in detail, which is what an auditor asks of it -- who was let in or barred, from what, and by whom. upstreamIdentity names an EXTERNAL identity provider's statement about a person (memql#4611) -- an Entra ID or generic OIDC sign-in. Not `identity`, which names a credential row this cluster holds: the whole point of federation is that the credential lives somewhere else, and there is often no row here at all yet (the linking decision is what determines whether one is created). Every value here must also be accepted by createAuditEvent, and every value a Go writer emits must be here -- test/dslconformance/identity_audit_enum_contract_test.go walks the writers (memql#4213). (enum: user, session, identity, invitation, accessRequest, config, magicLinkRequest, authCode, clusterSettings, deviceCode, delegation, workerPairingCode, enrolmentToken, passkeyIdentity, badgeIdentity, appSession, shopifyStore, releaseCut, oauthClient, upstreamIdentity, rowOwnership, githubGrant, role, group, groupMembership, grant, ) |
| `userAgent` | string |  | User-Agent header at the time of the event. Empty for non-HTTP-originated events. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:identity:authActivity`

Routine authentication MECHANICS: refresh-token rotations, the blocked ones, grace-window acceptances, and PAT-authenticated requests (memql#4328). The high-volume sibling of v1:identity:auditEvent, split from it so the audit trail stays a log of DECISIONS AND SIGNALS and is clean by construction rather than by a filter every reader has to remember.
WHY A SECOND CONCEPT. One rotation is one row, and the designed cadence is one rotation per ~10.5 minutes per open tab. Two defects (memql#4326's skew-blind timer, memql#4327's per-route probe) turned that into a row every few seconds, and the operator's Audit Trail -- a generic concept walk over auditEvent with no filter of any kind -- became unreadable. Considered and rejected: a `severity` field plus a server-side filter on the generic browse walk (new engine, SDK and view-kit machinery, epic #4274), and simply not persisting rotations (which throws away the one signal showing WHICH DEVICE refreshed WHEN -- exactly what you need when a refresh token is stolen, and what memql#4329's reuse detection is built on). Two concepts also let retention differ, and keep a session's whole story one join on sessionId.
`action` IS A CLOSED ENUM, unlike auditEvent.action. This concept has exactly four writers and will not grow by convention; a fifth mechanic is a deliberate change to this line and to the Go constants beside it, checked against each other by test/dslconformance/identity_audit_enum_contract_test.go.
RETENTION IS REAL HERE. Rows older than MEMQL_IDENTITY_AUTH_ACTIVITY_RETENTION_DAYS (default 30) are HARD-DELETED daily by a Go-side job on the identity node (component/identity/authactivity, memql#4330) -- not counted, as auditEvent's observe-only sweep does. Reuse detection therefore reaches back exactly that far; the default exceeds both the 14-day idle timeout and the 30-day refresh TTL, so a token older than the window is dead on its own account.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | What happened. CLOSED, and each value has exactly one writer: session_refreshed and session_refresh_blocked are refresh.Rotator's two outcomes; grace_window_accept is the Rotator accepting the immediately-previous hash inside its 30s window (a legitimate mid-rotation retry, NEVER reuse -- see memql#4329); pat_auth_accepted is the PAT verifier, once per PAT-authenticated request. Every value here must also be accepted by createAuthActivity, and every value a Go writer emits must be here. (enum: session_refreshed, session_refresh_blocked, grace_window_accept, pat_auth_accepted) |
| `actorEmail` | string |  | Email of that user at the time, denormalized so the Trail-equivalent view has an actor column that is not blank. Point-in-time, like auditEvent's. |
| `actorIdentityId` | string |  | v1:identity:identity the credential belongs to. For pat_auth_accepted this is the PAT row itself, which is what distinguishes one CI credential's traffic from another's. |
| `actorRole` | string |  | Cluster role at the time (owner / admin / developer / writer / reader). |
| `actorUserId` | string | yes | v1:identity:user this activity belongs to. THE ROW-AUTHZ OWNER FIELD: stamped from actor.userId by createAuthActivity and never accepted from caller args, which @serverSet turns from a convention into a load-time rejection. The Go writers reach it by running the write under auth.ContextWithUserActor for the user the SESSION resolved to -- the identity service knows whose session it is before the actor envelope does, because /auth/refresh is unauthenticated by construction. Empty when nothing resolved, which leaves the row readable by a cluster owner alone; an unattributable blocked attempt is an operator's row. |
| `clientLabel` | string |  | Best-effort human device label (mirrors authSession.clientLabel) so a person reading their own activity sees 'Safari on macOS' rather than a UA string. |
| `detail` | object |  | Action-specific structured payload. Consumers read the keys they know, exactly as with auditEvent.detail. |
| `failureReason` | string |  | Why, when outcome=blocked. The rotator's existing reasons, unchanged: session_not_found, previous_refresh_grace_expired, session_revoked, session_expired_absolute, session_idle_timeout, session_max_age_exceeded. |
| `occurredAt` | string | yes | When the mechanic happened. Written by the identity service at the moment it completes, so it is within milliseconds of the row's createdAt -- the retention job leans on that (it prunes on the hypertable's partition key and confirms against this field). |
| `outcome` | string | yes | Only two outcomes are reachable here: the mechanic completed, or it was refused. There is no `failure` value -- an internal error on this path returns before any row is written -- and no empty value, because a mechanic with no outcome is not a mechanic. (enum: success, blocked) |
| `retiredTokenHash` | string |  | SHA-256 hex of the refresh token THIS rotation retired. The lookup key memql#4329's reuse detection runs on: a presented token matching no live session but matching a retired hash is a replay, not a stale cookie. Storing it is the same posture as authSession.previousRefreshTokenHash -- a retired token can no longer be used, and a digest cannot be reversed. Indexed by a partial index on this concept (20260823000000_auth_activity_retired_token_hash_idx). |
| `sessionId` | string |  | v1:identity:authSession row this concerns. Empty when the presented credential resolved to no session at all -- which is the session_not_found case, and the one a reuse lookup then investigates. |
| `sourceIP` | string |  | IP the request came from. Best-effort, same proxy caveat as auditEvent.sourceIP. |
| `userAgent` | string |  | User-Agent at the time. With sourceIP this is the whole of what a user can be shown about a device that refreshed their session. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `references` -> `v1:identity:authSession`

## `v1:identity:authCode`

One-time OAuth authorization code, RFC 6749 §4.1 style. Minted at /auth/magic-link/consume when the originating magic link carried an oauthCtxJSON (third-party OAuth client flow) and exchanged at /oauth/token for an access + refresh token pair. Single-use, redirect-URI bound, client-ID bound, ~60s TTL. Bound to the specific magic-link row it was minted from so a leaked code cannot be replayed across sessions. Global scope: token redemption is unauthenticated and must work without partition context.
NO PLAINTEXT IS STORED (issue #3187). This concept once carried a `code` field holding the cleartext one-time code -- the only stored-plaintext credential in the tree. Its description claimed the plaintext was "the equality check on redemption". That was false: /oauth/token hashes the presented code and looks the row up BY codeHash (component/identity/http/token.go), AuthCodeRow has no Code member, and authCodeFull never projected it. The field was written and read by nothing. Finding a row by sha256(presented) IS the verification -- it proves the presenter holds the preimage -- so removing the field cost no property.

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | string | yes | OAuth client identifier the code was minted for. Token-exchange MUST verify the redeeming client matches; mismatched client = reject and audit as code_misuse. |
| `codeChallenge` | string |  | PKCE code_challenge (RFC 7636) captured when the OAuth context was established. Empty for legacy non-PKCE first-party flows. /oauth/token requires a matching code_verifier when this is set. |
| `codeChallengeMethod` | string |  | PKCE method: S256 (required for new flows) or plain. Empty when codeChallenge is empty. |
| `codeHash` | string | yes | SHA-256 hex digest of the plaintext code. Primary lookup key in the token-exchange path -- avoids equality lookups on the plaintext. |
| `consumedAt` |  |  | Set atomically on the first successful /oauth/token redemption. Non-nil = the code is spent and any further redemption attempt is rejected and audited as code_replay. Single-use enforcement is the load-bearing security property of OAuth auth codes. |
| `consumedFromIP` | string |  | IP the redemption request came from. Captured for audit and anomaly detection. |
| `expiresAt` | string | yes | Absolute expiration. ~60s after creation per RFC 6749 §4.1.2 guidance. Past this point the token-exchange rejects regardless of consumedAt. |
| `identityId` | string | yes | v1:identity:identity.id of the magic_link credential the code was minted from. Stamped onto the session for per-credential lastUsedAt bookkeeping. |
| `magicLinkRequestId` | string | yes | v1:identity:magicLinkRequest.id of the consumed magic link this code was minted from. Provides a 1:1 audit trail (one magic-link click yields exactly one auth code) and lets revoking a magic link cascade-invalidate any outstanding code. |
| `redirectURI` | string | yes | redirect_uri value supplied at /authorize, exact-matched against the registered URI for clientId. Token-exchange MUST verify the redeeming request's redirect_uri matches; mismatched = reject. |
| `state` | string |  | PKCE-style state value supplied at /authorize and echoed back on the redirect to redirectURI. Informational only at this layer (the OAuth client validates state on its end); persisted for audit correlation. |
| `userId` | string | yes | v1:identity:user.id the code authenticates. Stamped onto the resulting session at redemption. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `parent` -> `v1:identity:magicLinkRequest`

## `v1:identity:authSession`

Bearer-token session record. One row per access token issued by the identity service's magic-link / refresh flow. Looked up on every authenticated request to enforce per-session revocation; rows past expiresAt are tombstoned by GC, not by user action. Global scope: lives in _system so any partition's middleware can resolve a session.

| Field | Type | Required | Description |
|---|---|---|---|
| `clientLabel` | string |  | Best-effort human label parsed from User-Agent at issuance. Drives the device list in future per-session UIs. |
| `expiresAt` | string | yes | Mirror of the JWT expiry. Sessions past this are dead even if not revoked. |
| `firstAuthenticatedAt` |  |  | Set once on first issuance and never changed. Powers max-age enforcement (refresh fails if firstAuthenticatedAt + MEMQL_IDENTITY_SESSION_MAX_DAYS < now). |
| `identityId` | string |  | v1:identity:identity the session was minted from (typically the magic_link variant). Same caveat as userId. |
| `lastActivityAt` |  |  | Bumped opportunistically by the auth middleware. Useful for surfacing 'last seen' on each device. |
| `lastRefreshedAt` |  |  | Bumped on every successful refresh-token rotation. Powers idle-timeout enforcement (refresh fails if lastRefreshedAt + MEMQL_IDENTITY_SESSION_IDLE_DAYS < now). |
| `previousRefreshTokenHash` | string |  | SHA-256 hex digest of the IMMEDIATELY-PREVIOUS refresh token, kept valid for a short grace window after rotation. Handles the 'client hard-refreshed mid-rotation' case: the server completed the rotation and stored the new hash, but the browser aborted before receiving the Set-Cookie response, so the browser still holds the old token. Within the grace window (see previousRotatedAt) the rotator accepts presentation of this hash and re-issues a fresh pair. Outside the window the field is treated as expired bookkeeping. |
| `previousRotatedAt` |  |  | Wall-clock timestamp at which previousRefreshTokenHash was the current hash. Combined with the rotator's grace-window constant (~30s) to decide whether the previous hash is still acceptable. Past the window, presenting the previous hash returns 401 like any other stale token. |
| `refreshTokenHash` | string |  | SHA-256 hex digest of the current refresh token bound to this session. Rotated on every refresh. Used by the refresh handler to detect token theft (presenting a stale refresh = revoke entire session). |
| `revokedAt` |  |  | Set when the user revokes the session. Non-nil = middleware rejects the bearer token. |
| `revokedReason` | string |  | Why the session was revoked. user_action = the per-device sign-out. all_sessions = the cross-device revoke. admin = staff-initiated. reuse_detected = a refresh token this session had already RETIRED was presented again (memql#4329); the rotator revokes the whole session, writes refresh_token_reuse_detected to v1:identity:auditEvent and notifies the user. It is the one value no human chose -- and the one that means the credential is believed to be in someone else's hands. (enum: user_action, all_sessions, admin, reuse_detected, ) |
| `source` | string | yes | Which auth flow created the row. bff_exchange = SPA token path (Authorization: Bearer). oidc_cookie = browser memql_auth-cookie path. device_code = RFC 8628 device grant redeemed at /oauth/token (memql#3410; editor and CLI sign-ins). What makes a device-originated session distinguishable in /me/devices and in an incident review. (enum: bff_exchange, oidc_cookie, device_code) |
| `subject` | string | yes | JWT subject claim. The canonical key for revoke-all; populated unconditionally so all-sessions revoke works even when the user record hasn't been bootstrapped yet. |
| `tokenHash` | string | yes | SHA-256 hex digest of the bearer token. Primary lookup key in the auth hot path; the plain token is never stored. |
| `userId` | string |  | Owning v1:identity:user. Optional because rows are written at token-issuance time, which can race ahead of the magic-link verifier's user-row insert on first-time logins. Subject is the canonical lookup key. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:identity:clusterSettings`

Runtime-editable cluster settings. Single-row concept (id='cluster') that holds the operator-tunable knobs originally bootstrapped from IDENTITY_* env vars. The first-run wizard (Phase 3) writes this row; the admin app (Phase 6) edits it. Service.LiveConfig() reads from here first and falls back to env so a fresh deployment is functional without any post-bootstrap edits. Global scope so the configuration is reachable from every binary that needs it (identity itself plus future per-node verifier middleware).

| Field | Type | Required | Description |
|---|---|---|---|
| `accessRequestNotifyEmails` | string |  | Comma-separated list of operator addresses that get notified when a waitlist access-request is filed. Mirror of MEMQL_IDENTITY_ACCESS_REQUEST_NOTIFY_EMAILS. |
| `accessRequestNotifyThrottleMins` | integer |  | Throttle window in minutes for the access-request notify emails. High-risk requests bypass via immediate-notify. Mirror of MEMQL_IDENTITY_ACCESS_REQUEST_NOTIFY_THROTTLE_MINUTES. |
| `accessTokenTTLSeconds` | integer |  | Lifetime of issued access tokens in seconds. 0 means 'fall back to MEMQL_IDENTITY_ACCESS_TOKEN_TTL_SECONDS env, or the 900s built-in default'. Bounded at the admin form layer to [60, 86400] (1 minute to 24 hours). Read on every /oauth/token + /auth/refresh issuance so changes apply on the next access-token mint without an identity restart. |
| `authoredAutomationsEnabled` | boolean |  | Cluster-wide GLOBAL KILL SWITCH for planner-authored automations (epic memql#954, issue #961). true = activated authored bundles fire normally; false = the authored runtime is halted across the WHOLE cluster -- no authored automation fires on any node until re-enabled, regardless of any individual bundle's status or any per-user kill switch. The governance hard stop for the authored-automation surface. Single-row (id='cluster') so every node reads the same value; flipped via setAuthoredAutomationsEnabled and read by the authored scheduler's global gate. |
| `bootstrapBirthdate` | string |  | Owner's ISO-8601 date of birth captured by the wizard. Same lifecycle. |
| `bootstrapEmail` | string |  | Email captured by the first-run wizard for the cluster owner. Stamped here for audit even though the actual cluster-owner role is granted by the magic-link verifier when the operator clicks the bootstrap link, not from this row. |
| `bootstrapFirstName` | string |  | Owner's given name captured by the first-run wizard. Read once by the magic-link verifier when the bootstrap user row is created (UserProfileSeed) and never used again. Stored on this row because the wizard runs before any user row exists -- there is nowhere else for it to live across the magic-link round-trip. |
| `bootstrapGender` | string |  | Owner's self-identified gender captured by the wizard. Same lifecycle. |
| `bootstrapLastName` | string |  | Owner's family name. Companion to bootstrapFirstName; same lifecycle. |
| `bootstrapPhone` | string |  | Owner's phone number captured by the wizard. Same lifecycle as bootstrapFirstName / bootstrapLastName. |
| `bootstrapPrimaryRole` | string |  | Owner's free-form job title captured by the wizard. Same lifecycle. |
| `bootstrappedAt` | string |  | RFC3339 timestamp stamped by the magic-link verifier when an operator clicks the wizard-issued bootstrap link. Empty means 'wizard hasn't run' OR 'wizard ran but ownership not yet claimed' -- /setup remains accessible in either case. Stored as string (not datetime) so empty-string is a legal value the JSON-schema validator accepts; readers parse it as RFC3339 when non-empty. |
| `brandIconDataURI` | string |  | Optional square brand icon (icon-only mark) encoded as a data URI. Used for compact contexts (favicon, collapsed sidebar, tile previews). Operators frequently want a wordmark in the header AND a tight icon for tabs / share previews -- keeping these as separate fields lets each render at its native aspect ratio. |
| `brandLogoDataURI` | string |  | Optional horizontal brand logo (name+icon mark) encoded as a data URI. Used for the wide-display contexts (header brand, login page top). CSP allows img-src data: precisely so this can render without an external host. |
| `brandName` | string |  | Display name shown in the web UI and in outbound emails. Empty falls back to 'MemQL'. |
| `brandPrimaryColor` | string |  | Hex color used as --brand-primary in the web UI. Empty falls back to a neutral blue. |
| `clusterDomain` | string |  | The deployment-wide hostname suffix the operator entered at /setup (or supplied via MEMQL_IDENTITY_BOOTSTRAP_DOMAIN). Examples: memql.localhost, staging.acme.com, acme.com. Every public service URL the cluster builds derives from it: app.<clusterDomain> for the SPA, identity.<clusterDomain> for sign-in, bff.<clusterDomain> for the API, agent.<clusterDomain> for worker registration. Empty before the wizard runs. |
| `internalDefaultRole` | string |  | Cluster-wide role granted to internal users on first login. A v1:rbac:role SLUG or one of its aliases, validated in Go at the seam that writes a user row -- a DSL enum cannot name a row, and a five-value enum here would mean a cluster could never default new people onto a role it authored itself (epic memql#5166). Always written: createClusterSettings takes this as a required arg and stamps it; the 'writer' fallback lives in MEMQL_IDENTITY_INTERNAL_DEFAULT_ROLE, which is where the operator sets it. |
| `internalDomains` | string |  | Comma-separated email-domain allowlist that flips the per-user 'internal' flag at first login. Internal users get the cluster-wide internalDefaultRole; external users get owner of an auto-created personal partition. |
| `invitationTTLDays` | integer |  | How long an admin-issued user invitation token stays valid, in days. 0 means 'fall back to MEMQL_IDENTITY_INVITATION_TTL_DAYS env, or the 7-day built-in default'. Bounded at the admin form layer to [1, 90]. |
| `magicLinkTTLSeconds` | integer |  | How long an issued magic-link is valid. 0 means 'fall back to MEMQL_IDENTITY_MAGIC_LINK_TTL_SECONDS env, or the 600s built-in default'. Bounded at the admin form layer to [60, 3600] (1 minute to 1 hour). Short by design -- magic-links are click-through credentials, not session tokens. |
| `refreshCookieSameSite` | string |  | SameSite policy for the refresh-token cookie. Empty = inherit from MEMQL_IDENTITY_REFRESH_COOKIE_SAMESITE env (which defaults to 'lax'). 'lax' is correct for the common same-site self-hosted topology (app.acme.com + identity.acme.com share an eTLD+1) and avoids Safari ITP scrutiny. 'none' is required for true cross-site deployments where the SPA and identity service live under different eTLD+1s (app.example.com + auth.example.net); browsers treat the cookie as third-party and apply ITP rules. The cookie is always Secure when BaseURL is HTTPS regardless of this setting. (enum: , lax, none) |
| `refreshTokenTTLSeconds` | integer |  | Absolute lifetime of refresh tokens in seconds. 0 means 'fall back to MEMQL_IDENTITY_REFRESH_TOKEN_TTL_SECONDS env, or the 30-day built-in default'. Bounded at the admin form layer to [86400, 31536000] (1 day to 1 year). Refresh rotation uses this for both the initial mint and the rotation-time max-age check; lowering it does NOT immediately invalidate live sessions but the next rotation that crosses the new ceiling will refuse. |
| `registeredClientsJSON` | string |  | JSON array of {clientId, redirectURIs} entries — the relying parties allowed to initiate the OAuth-style code flow. Stored as a string because the engine doesn't yet support nested arrays of objects in concept fields. Mirrors MEMQL_IDENTITY_REGISTERED_CLIENTS. |
| `registrationDomains` | string |  | Comma-separated allowlist used when registrationMode=domain_restricted. Mirror of MEMQL_IDENTITY_REGISTRATION_DOMAINS. |
| `registrationMode` | string | yes | Who can self-register. Mirror of MEMQL_IDENTITY_REGISTRATION_MODE. (enum: open, domain_restricted, invite_only, waitlist) |

## `v1:identity:delegation`

Grants an AI agent the right to act through a user's v1:identity:identity for a bounded role ceiling, scope set, and lifetime. Global scope: lives in _system and is readable from any partition so cross-partition agent work does not require per-partition delegation rows.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this delegation is currently in effect. |
| `agentId` | string | yes | Node ID of the v1:agents:agent receiving delegated authority. |
| `approvedBySubject` | string |  | authenticated subject id of the guardian who approved (for synthetic identity delegations). |
| `createdBySubject` | string | yes | authenticated subject id of whoever authorized this delegation. |
| `expiresAt` |  |  | When this delegation expires. Null means persistent (no expiry). |
| `identityId` | string | yes | Node ID of the v1:identity:identity granting authority. Through its userId the delegation resolves back to a v1:identity:user. |
| `identitySubject` | string | yes | authenticated subject id of the delegating identity (denormalized for fast lookup on the auth hot path). |
| `identityType` | string | yes | Type of the delegating identity. Separate from v1:identity:identity.identityType (which classifies the credential family); this classifies the principal behind it. (enum: human, synthetic) |
| `note` | string |  | Human-readable note about why this delegation was created. |
| `revokedAt` |  |  | When this delegation was revoked. |
| `revokedBySubject` | string |  | authenticated subject id of whoever revoked this delegation. |
| `roleCeiling` | string | yes | Maximum role the agent may assume under this delegation. A v1:rbac:role SLUG or one of its aliases, validated in Go where the delegation is created and again where it is resolved (epic memql#5166) -- a DSL enum cannot name a row. Compared by RANK, not by the legacy four-value level scale, which collapsed every custom role into its bottom rung and so admitted a ceiling that outranked its own delegator. The engine caps the effective role at RoleAtMost(identity.role, roleCeiling). |
| `scopes` | array |  | Allowed operation scopes. Empty means all operations within the role ceiling. Examples: query:*, mutation:library.*. |

**Relationships:** `parent` -> `v1:identity:identity`, `references` -> `v1:agents:agent`

## `v1:identity:deviceCode`

RFC 8628 device authorization grant state (memql#3410). One row per `POST /device/code` call. The device (a headless box, a hardened network, an editor extension that cannot bind a loopback listener) holds the plaintext `device_code` and polls `/oauth/token`; the human carries the short `user_code` to `/device` on a second device, signs in normally, and approves or denies. BOTH credentials are hashed at rest -- the plaintext device_code is returned exactly once in the `POST /device/code` response and the plaintext user_code is shown to the operator there and typed into the verification page; neither is ever persisted. Single-use: `status` is the state machine (pending -> approved -> redeemed, or pending -> denied), and only a row in `approved` can be redeemed, exactly once. 10-minute TTL (expiresAt), independent of status.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvedAt` |  |  | Stamped when the human approved. Empty otherwise. |
| `approvedByUserId` | string |  | v1:identity:user.id of the human who approved (or denied) at /device. Stamped from actor.userId, never accepted from caller args. Empty while pending. |
| `clientId` | string | yes | OAuth client_id the device authorization was requested for. The token-grant redemption MUST verify the polling client matches; a mismatch is rejected and audited. |
| `codeChallenge` | string |  | PKCE code_challenge (RFC 7636) supplied at POST /device/code. Empty when the device did not use PKCE. When set, the device_code grant REQUIRES a matching code_verifier, exactly as the authorization_code grant does. |
| `codeChallengeMethod` | string |  | PKCE method: S256 (required for new flows) or plain. Empty when codeChallenge is empty. |
| `deniedAt` |  |  | Stamped when the human denied. Empty otherwise. |
| `deviceCodeHash` | string | yes | SHA-256 hex digest of the plaintext `mql_dvc_<...>` device_code. Primary lookup key on the polling path. The plaintext is returned once in the POST /device/code response and never persisted. |
| `expiresAt` | string | yes | Absolute expiration, ~10 minutes after creation per RFC 8628 §3.2. Past this the poll returns expired_token and the verification page refuses the code, regardless of status. |
| `intervalSeconds` | integer | yes | The minimum seconds the device must wait between polls, returned as `interval` in the device-authorization response and RE-READ on every poll. A poll that arrives sooner than this after lastPolledAt gets slow_down AND this value is increased by 5 (RFC 8628 §3.5), so an impatient client is progressively throttled rather than merely warned. |
| `lastPolledAt` |  |  | Timestamp of the most recent /oauth/token poll against this row, stamped on EVERY poll including rejected ones. Paired with intervalSeconds to enforce the poll floor across replicas -- an in-memory clock would give each replica its own budget. |
| `redeemedAt` |  |  | Stamped on the first successful token redemption. Single-use enforcement: the redeem transition also flips status to `redeemed`, so a replayed device_code is rejected. |
| `scope` | string |  | Space-delimited OAuth scope requested by the device, echoed onto the issued session. Empty when the device requested none. |
| `sourceIP` | string |  | IP the POST /device/code request came from. Shown on the approval page so the human can tell their own request apart from someone else's, and kept as an abuse signal. |
| `status` | string | yes | The state machine. `pending` = awaiting the human. `approved` = the human said yes and the device may redeem exactly once. `denied` = the human said no; polling returns access_denied forever. `redeemed` = tokens were issued; any further poll is rejected. Expiry is orthogonal and read off expiresAt. (enum: pending, approved, denied, redeemed) |
| `userAgent` | string |  | User-Agent the POST /device/code request carried. Shown on the approval page for the same reason as sourceIP: it is the only evidence the approver has about what they are authorizing. |
| `userCodeHash` | string | yes | SHA-256 hex digest of the CANONICALIZED user_code (uppercased, separator stripped). Lookup key for the verification page. The plaintext is displayed by the requesting device and typed by the human; never persisted. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:enrolmentToken`

Single-use enrolment credential: authorizes exactly one action -- register a passkey as the named user -- which is what makes a FIRST credential obtainable with no mailbox (memql#3408). The plain token is mql_enr_<43 base64url chars> (32 CSPRNG bytes); only its SHA-256 hex digest lands here, so a database snapshot cannot be replayed into an enrolment. Single-use via consumedAt, stamped when the passkey registration succeeds; revokedAt is the issuer's kill switch before that. Default TTL 15 minutes.

| Field | Type | Required | Description |
|---|---|---|---|
| `consumedAt` |  |  | Stamped when the authorized passkey registration completes. Single-use semantics: a row with non-empty consumedAt is dead and any replay is refused with the already-used rejection state. |
| `consumedFromIP` | string |  | Source IP the redeem came from. Audit signal -- helps detect 'someone else used my enrolment link'. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Redeem rejects rows past this even when consumedAt is empty. Default 15 minutes from issue, overridable per-issue up to a capped maximum (component/identity/enrolment.MaxTTL). |
| `invitationId` | string |  | v1:identity:invitation.id of the invitation this token was minted in exchange for, when there was one (memql#4880). Empty on the portal and install-wizard paths. This is how an operator reading the row sees that a credential came from an invitation rather than from a person's click in the console; issuedBy cannot carry that, because it has to name a user. |
| `issuedBy` | string | yes | v1:identity:user.id of the principal whose authority minted the token -- the owner/admin on the portal path, the cluster owner on the install-wizard path, the INVITER on the invitation-accept path (memql#4880). Equal to userId when someone mints their own link; carried separately so an admin-assisted enrolment has attribution without re-deriving it from the audit trail. ALWAYS a user id: this field is a parent edge onto v1:identity:user, and the engine refuses any other concept's id here at write time, which is what an accept that named the invitation instead ran into. |
| `revokedAt` |  |  | Stamped when the issuer kills the token before it was used. Distinct from consumedAt so the /enroll page can say 'this link was revoked' rather than the misleading 'already used'. |
| `sourceIP` | string |  | IP the issue request came from. Audit + abuse signal. |
| `tokenHash` | string | yes | SHA-256 hex digest of the plain mql_enr_<...> token. The plaintext is returned to the issuer ONCE, embedded in the enrolment link, and is never persisted or logged. |
| `userId` | string | yes | v1:identity:user.id this token enrols. The redeem path resolves the passkey owner from THIS field and never from a caller-supplied argument, so a leaked token can only ever add a credential to the account it was minted for. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`, `references` -> `v1:identity:invitation`

## `v1:identity:githubConnectState`

| Field | Type | Required | Description |
|---|---|---|---|
| `consumedAt` |  |  | Stamped when the callback completes the flow. Single-use: a row with a non-empty consumedAt is dead, and the SECOND click on a callback URL is connect_state_invalid rather than a second grant. Written under a Postgres advisory lock (component/identity/store_githubconnect.go), because a browser redirect can be replayed and two identity replicas would otherwise both read 'not consumed'. |
| `consumedFromIP` | string |  | Source IP the callback arrived from. Audit signal, and the one that distinguishes a person finishing their own connect from somebody replaying a URL they found. |
| `expiresAt` | string | yes | Absolute expiry. Ten minutes from issue: longer than any human takes to authorize and install an app, and short enough that a state value left in a browser history is worthless. The consume refuses a row past this even when consumedAt is empty. |
| `returnPath` | string |  | Where in MemQL OS the browser should land when the callback finishes, as a SAME-ORIGIN path. Client-supplied, so it is passed through identity.SafeRelativeRedirect on the way in AND again on the way out: a value that was safe when it was stored is not evidence it is safe when it is used, which is why TakePostLoginRedirect re-validates for the identical reason. Empty means the OS root. |
| `sourceIP` | string |  | IP the begin call came from. Audit signal; deliberately NOT compared against consumedFromIP, because a person who starts on wifi and finishes on a mobile network is the ordinary case and refusing it would break the flow for a threat this row's TTL and single-use already bound. |
| `stateHash` | string | yes | SHA-256 hex digest of the plaintext `state` value that travels in the authorize URL. The plaintext is returned to the caller of githubConnectBegin ONCE, inside the URL it answers, and is never persisted or logged -- the same convention every other credential row here follows (pat, workerToken, workerPairingCode, invitation, magicLinkRequest, enrolmentToken). |
| `userId` | string | yes | v1:identity:user.id the connect was begun by, and the ONLY account the callback may land a grant on. The callback resolves the grant owner from THIS field and never from anything GitHub sent, which is what makes a replayed or forged callback unable to attach somebody else's GitHub account to an account it chooses. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:group`

A GROUP -- the thing that lets a client's people reach the client's work (epic memql#5165, D1).
Membership in a group tied to an account is what admits a person to that account's rows: reads for any active member, writes for a member whose role holds the verb. That is not a second authorization mechanism -- it is the `account="<field>"` argument of the owned tier every tied concept already declares, resolved per request from these rows (design section C).
THE ROW IS THE DEPLOYMENT'S, NOT A PRINCIPAL'S (D2), which is why ownerUserId is always empty and the tier carries `unowned="admin"`. A membership keyed as owner-tier on `userId` would let a Member insert their OWN row into Acme's group, because an owned row admits its owner's inserts -- so both concepts here are unowned and written only by the Go builtins in integrations/groups under internal origin.
A GROUP WITH NO ACCOUNT GRANTS NO ROWS (D8) and exists to organize. `kind` says which of the two a row is: `account` for the one the automation makes per account, `custom` for any other. It can still be a GRANT SUBJECT (design 2026-09-11-app-access-grants, D13): a group with no account grants apps -- it is a subject an app capability can name, and its members open that app's door -- and still grants no rows, because the rows a person then sees are decided by the tier of each concept, and a group with no account ties them to nothing.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this group GRANTS. Empty on a custom group tied to no account, which grants nothing and exists to organize (D8). This is the field the account scope resolves through: a member of this group reaches every row whose own account argument names this id. |
| `archivedAt` |  |  | When status became archived. Written by groupArchive and by the archiveAccountGroup cascade. |
| `description` | string |  | Short description of the group's purpose. Optional, unlike the field it replaces: the account-kind group is created by an automation that has nothing meaningful to say here, and a required field would have forced it to invent one. |
| `kind` | string | yes | Which of the two kinds of group this is. `account` is the one ensureAccountGroup writes per account, at the derived id acct-<accountShortId>, and it is refused archive while its account is active. `custom` is any group a person made -- tied to an account or not. (enum: account, custom) |
| `name` | string | yes | Display name of the group, as a person would say it. For the group the automation makes per account this is the account's own name; for a custom group it is whatever the operator called it. |
| `ownerUserId` | string |  | ALWAYS EMPTY: this is the deployment's row, not a principal's (D2). Present so the owned tier reads at all -- an ABSENT owner key is denied at every rank, and only a PRESENT-and-empty one is the deliberate statement of cluster ownership that `unowned="admin"` then makes readable. Nothing writes a value here, and a row that carried one would be readable by that principal alone. |
| `status` | string | yes | Lifecycle. Only an ACTIVE group grants anything -- the resolution reads the group's status rather than trusting the membership, because a group is archived without its memberships being rewritten. Archive is the only exit; there is no delete. (enum: active, archived) |

## `v1:identity:groupMembership`

ONE PERSON'S MEMBERSHIP OF ONE GROUP (epic memql#5165, D11).
The id is derived -- <groupShortId>-<userShortId> -- so re-adding somebody who was removed writes a NEW VERSION of the same logical row rather than a second row. History is the versions, which is what makes "when did they join, and who put them there" answerable without a second audit concept.
UNOWNED for the reason the group is (D2): the row records a decision the deployment made about a person, not a row that person owns. Written only by integrations/groups, never by a mutation a caller can reach.

| Field | Type | Required | Description |
|---|---|---|---|
| `addedBy` | string |  | The acting user's id, or EMPTY for the engine -- domain join and the boot backfill have no acting person, and stamping a synthetic id there would put a principal that does not exist into the audit answer. |
| `groupId` | string | yes | The v1:identity:group this membership is in. |
| `origin` | string | yes | How the person got here. `added` is a person calling groupMemberAdd; `invitation` is an invitation that carried this group being accepted; `domain` is the account's verified domain matching a verified email at arrival (D9). Kept because the three answer different questions when somebody asks why a person can see a client's work. (enum: added, invitation, domain) |
| `ownerUserId` | string |  | ALWAYS EMPTY (D2). See v1:identity:group.ownerUserId for why the field is present and never written. |
| `removedAt` |  |  | When status became removed. |
| `removedBy` | string |  | Who removed them. Empty when the engine did it -- the archive cascade, for instance. |
| `status` | string | yes | Only an ACTIVE membership grants. Removing writes a new version at the same id with `removed`; the previous version stays as history, which is why every read of these rows collapses to the newest version per id first. (enum: active, removed) |
| `userId` | string | yes | The v1:identity:user who is a member. NOT the row's owner: a member who owned their own membership row could insert one, which is the whole reason this concept is unowned. |

**Relationships:** `references` -> `v1:identity:group`, `references` -> `v1:identity:user`

## `v1:identity:identity`

An account or credential set owned by a v1:identity:user. One user can have many identities: a magic-link verified email, OAuth accounts on external apps, API keys (Personal Access Tokens), or service accounts. Agents borrow identities to act on the user's behalf via v1:identity:delegation. Cluster-wide: one row set, the same from every caller's view.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag. Revoked credentials stay around for audit but are inactive. |
| `credentials` | object | yes | Type-specific credential material. Shape is a oneOf picked by identityType: see the @variant block below. Raw OAuth tokens and API-key plaintext never live here. |
| `identityType` | string | yes | Which credential family this identity belongs to. Determines the shape of the credentials object: see the credentials field below. The 'worker_token' variant authenticates a Cockpit worker process -- a machine running `memql worker run` (one credential per registered machine); it is server-side-scoped to WorkerService.Stream + audit-emit paths and is rejected by the auth interceptor on every other RPC. The 'node_token' variant authenticates a cluster-internal node binary (bff / agent / planner / workbench) on NodeService.Stream; the interceptor pins this surface to node-class JWTs and rejects every other class (#105). The 'account_token' variant is a credential ISSUED TO THIS USER ON BEHALF OF a v1:identity:account -- the subject is still userId, never the account, because nothing authenticates AS an account; it is admitted by NO verifier and NO interceptor today (memql#3322), so it grants nothing until the actor envelope carries a tenancy dimension. The 'passkey' variant is the only family here whose stored material is PUBLIC (a COSE public key) rather than a digest of a secret -- possession is proved by a signature the authenticator produces and the server verifies, so a leaked passkey row authenticates nobody (memql#3406). The 'oidc' variant is the LINK to an upstream identity provider (memql#4611): it stores no secret at all, only the (issuer, subject) pair the provider asserted, because the credential lives at the provider and this cluster never sees it. That pair is what makes federation land an existing person on their EXISTING row -- it is the stable identity, and the only one the provider guarantees, so it survives a rename or an address being reassigned where an email match would not. The 'recovery_key' variant is the OWNER BREAK-GLASS credential (memql#3964): one active row per cluster, bound to one owner, redeemed exactly once to register a passkey when that owner has lost every sign-in route. It is NOT a sign-in route itself and must never be counted as one -- signInIdentitiesForUser deliberately does not match it, because a key that counted itself would refuse itself forever. (enum: oauth, api_key, service_account, magic_link, worker_token, node_token, badge, account_token, passkey, recovery_key, oidc) |
| `label` | string |  | Human label shown in UIs, e.g. 'Work email', 'Personal Slack', 'Legacy integration key'. Optional, defaults to a generated summary of the credentials. |
| `lastUsedAt` |  |  | Per-credential last-use stamp. Useful for pruning stale OAuth tokens or unused API keys. User-level 'last seen' lives on v1:identity:user.lastSeenAt. |
| `usableByAgents` | boolean |  | Whether v1:identity:delegation can borrow this identity for agent work. Magic-link identities default false (agents shouldn't impersonate humans wholesale); OAuth identities for specific external apps default true (they exist precisely so agents can act against that app on the user's behalf). |
| `userId` | string | yes | Owning v1:identity:user. Every identity must belong to exactly one user; a user can own many identities. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:identity:user`

## `v1:identity:invitation`

Token-hashed invitation credential. Maps an invitee (existing user by ID, or an external address by email + token) to the cluster role they land with. The identity layer owns the lifecycle (pending/accepted/expired/cancelled) and the auth primitive.
The space scope this used to carry (partitionId / spaceName) went with the space concept (epic memql#4988), and with it the guest half of the flow: the guest-auth interceptor, the five guest gRPC messages, and the mutations that minted a guest participant. What remains is the user invitation, which is what the MemQL OS Users app issues. `kind` keeps its "guest" value for rows already written; nothing produces one.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this invitation is on behalf of -- which client's person is being invited (epic memql#4800, D5). Optional, and a plain reference with NO read effect: the invitation lifecycle, the token hash and every existing query are untouched, and an invitation with no tie behaves exactly as every invitation did before this field existed. It is a LABEL on an invitation, never a grant: tying an invite to an account gives the invitee nothing they would not otherwise have had, because an account admits nobody (D1). Optional on the invitation-send path; an invitation that omits it behaves exactly as before. Rendered on the Users app's invite list and set by the optional account picker in its send flow. |
| `active` | boolean |  | Whether the invitation is active. Set false to soft-cancel. |
| `bindingHash` | string |  | SHA-256 hex digest of the 32-byte CSPRNG nonce handed to the browser that FIRST opened this invitation link, delivered to it as a cookie. The plaintext nonce is never stored. An invitation only ACCEPTS in a browser that presents a cookie hashing to this value, which is what stops a forwarded email from being redeemed by whoever it was forwarded to: the credential arrives by mail, so on its own its holder is anybody who can read the mailbox, and first-touch binding narrows that to the one browser that opened the link (memql#4601 -- the same design D2 magicLinkRequest.bindingHash below carries for memql#4302). Written FIRST-TOUCH ONLY, by bindUserInvitation, and never overwritten: a row a second browser could re-bind is an unbound row, so the no-overwrite rule IS the control rather than a detail of it. Empty means no browser has touched the row yet, or that it predates first-touch binding; both read as a no-cookie touch, and what that is worth is the accept path's decision rather than this row's. |
| `deliveryAttemptedAt` |  |  | When the delivery verdict on this row was last recorded. Equal to the issue time for a first attempt, and updated by a resend -- which is why it is not simply row.createdAt. Empty on rows predating memql#4587. |
| `deliveryError` | string |  | The mail provider's own text when deliveryState is failed, so an operator can tell a refused credential from a refused sender from an unreachable host -- a fixed token collapses all three. Empty otherwise. Not a secret: it never contains the invitation link, which is a bearer credential and belongs in no durable record (see tokenHash). |
| `deliveryState` | string |  | Whether the invitation EMAIL left the process, recorded on the row rather than only in a log line (memql#4587). The verdict already reached the audit trail and the issuing operator's own response; neither is visible to the operator who comes back a week later and asks why somebody never joined. `status: pending` reads identically whether the invitee got the link or the panel was closed and forgotten, which is how memql#4583 went unnoticed until the owner asked the colleague in person. not_attempted = no mail seam on this node, so nobody asked for a send; sent = the provider accepted it; failed = it was tried and refused. Never a guess: the three are what the issuing path actually observed. (enum: not_attempted, sent, failed) |
| `expiresAt` |  |  | Absolute expiration timestamp. Set for both kinds since memql#4270: a user invitation that never expires is a standing credential nobody remembers issuing. |
| `groupIds` | array |  | The v1:identity:group rows this person JOINS when they accept (epic memql#5165, section G). Every id is validated at issue -- it must name an active group, and the invitee's role must sit strictly below the inviter's, the same rank rule groupMemberAdd applies -- so an invitation cannot place somebody where the inviter could not have placed them by hand. On acceptance one groupMembership row is written per entry with origin "invitation" and addedBy set to the inviter. Empty is the ordinary case and joins nobody. |
| `inviteeEmail` | string |  | Email address of the invitee. Set for BOTH kinds. For kind=user it is the address the invitation authorizes to register, which is the whole point: the recipient has no account yet, so there is no id to name them by. |
| `inviteeId` | string |  | User ID of the invitee, when one already exists. Empty for the common kind=user case -- an invitation to a person who has not registered cannot name a row that does not exist. Stamped on acceptance. |
| `inviteeName` | string |  | Display name suggested by the inviter. Optional. |
| `inviteeRole` | string |  | The cluster role the recipient lands with on redemption (memql#4270). A v1:rbac:role SLUG or one of its aliases (epic memql#5166); a DSL enum cannot name a row, so the check is auth.MayAssignRole in component/identity/adminops, which is the same function SetUserRole calls. Empty means the cluster default for a new user. An inviter cannot grant above their own role -- enforced in component/identity/adminops, not here, because the comparison needs the caller. |
| `inviterId` | string | yes | User ID of the person who issued the invitation. |
| `inviterName` | string |  | Display name of the inviter. Denormalized for notification/email rendering. |
| `kind` | string | yes | user = invite an external email to register against this cluster, which is the only kind anything writes. guest = the retired space-guest invitation; the value stays so rows already written keep reading back, and the default moved off it because a row landing on `guest` today is one no redeem path will ever find. (enum: user, guest) |
| `previousTokenHash` | string |  | SHA-256 hex digest of the token this row carried before the most-recent resend rotation, when there was one. Used by the resolve handler to return a UX-friendly `superseded` status for an older link instead of a generic `invalid`. Carries only ONE generation of history -- the rotation before last drops off. Always empty before any resend has rotated the row. |
| `respondedAt` |  |  | When the invitation was responded to. |
| `status` | string | yes | Lifecycle status. Product layers extend with participation-style values (left/kicked/dismissed) when they bind the invitation to a product record. (enum: pending, accepted, ignored, left, kicked, dismissed) |
| `tokenHash` | string |  | SHA-256 hex digest of the current invite token. Set for BOTH kinds since memql#4270 -- the identity login page resolves a user invitation by the same hash the guest path uses (stage needs_invite, form=invite). Primary lookup key in the guest-auth interceptor and on the /join/<token> resolve path. The plaintext token is delivered in the email and never persisted server-side (see memql#108). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`, `references` -> `v1:identity:account`

## `v1:identity:magicLinkRequest`

Pending magic-link authentication request. One row per /auth/magic-link issuance. The plain token is hashed (SHA-256) before persistence -- only the hash lives here so a database snapshot can never be replayed into a login. Single-use semantics: consumedAt is set atomically on the first successful click and any subsequent click against the same row is rejected. Past expiresAt the row is also rejected. Global scope so the public unauthenticated /auth/magic-link/consume endpoint can resolve the row regardless of which partition the eventual user belongs to.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvedAt` |  |  | Set by POST /auth/landing when the link was opened in a browser that does NOT hold the binding cookie. It means "a human holding the emailed token said yes"; it does not itself sign anybody in. The requesting tab polls GET /auth/magic-link/status, sees `approved`, and completes the sign-in itself. Written only when both approvedAt and consumedAt are empty, so a second click is idempotent. |
| `approvedFromIP` | string |  | IP of the device that approved the request. This is the field that names B when B clicked A's link -- kept precisely so the cross-device case leaves a trace an operator can read. Written with approvedAt, never alone. |
| `approvedUserAgent` | string |  | User-Agent of the approving device. Companion to approvedFromIP; audit and incident-review only, never compared against anything. |
| `bindingHash` | string |  | SHA-256 hex digest of the 32-byte CSPRNG nonce handed to the REQUESTING browser as the `memql_ml` cookie at issue time. The plaintext nonce is never stored. A magic link only COMPLETES in a browser that presents a cookie hashing to this value, which is what makes a session land on the device that asked for it rather than on whichever mailbox reader clicked first (design D2). Written once by the issuer; read by the landing, status and finish handlers. Empty on rows predating the device-bound flow -- those behave as a no-cookie click, i.e. approve-only. |
| `consumedAt` |  |  | Set atomically on the first successful consume. Non-nil = the row is spent and any further click against the same token is rejected. Single-use enforcement is the load-bearing security property of magic links. |
| `consumedFromIP` | string |  | Best-effort IP recorded at consume time. Used by the audit log and by anomaly detection (consume from a different country than issuance, etc). |
| `email` | string | yes | Email address the magic link was sent to. Drives the user-lookup / first-time-registration path on consume. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Past this point the row is dead even if not consumed; the consume handler treats expired and consumed identically (both reject). |
| `invitationId` | string |  | Set when the magic link was issued in response to an admin-approved access-request invitation. Empty for self-service login attempts. Lets the consume handler stamp the inviting context on the new user record. |
| `oauthCtxJSON` | string |  | Serialized JSON of the OAuth context the magic link was issued under: {clientId, redirectURI, state}. When present the consume handler mints an auth code instead of a session and redirects to clientId's redirectURI with the code. When absent the consume creates a session directly (first-party SPA flow). |
| `sourceIP` | string |  | IP the issuance request came from. Captured for audit and for risk scoring (issuance velocity per IP). |
| `tokenHash` | string | yes | SHA-256 hex digest of the plain magic-link token. Primary lookup key on consume; the plaintext token is delivered in the email link and never stored server-side. |
| `userAgent` | string |  | User-Agent header at issuance time. Captured for audit only. It is NOT a binding check and never was -- the description used to claim a "consume-time UA-mismatch check" that no code performs (memql#4301). What binds a link to the device that asked for it is bindingHash below. |

**Relationships:** `parent` -> `v1:identity:invitation`

## `v1:identity:oauthClient`

Public OAuth client minted at dynamic client registration (RFC 7591). claude.ai / Claude Desktop's 'add custom connector' flow POSTs to /register and cannot pre-configure a client_id, so the identity service issues one here and looks it up at /authorize + /oauth/token exactly like a static MEMQL_IDENTITY_REGISTERED_CLIENTS entry. Public clients only -- no secret is issued (token_endpoint_auth_method = none). Global scope: registration + token redemption are unauthenticated and must work without a partition context. Because registration is unauthenticated, NOTHING on a freshly-registered row may confer a privilege: corsOriginsJSON is the one field here an owner/admin has to write deliberately, and it is written by nothing on the /register path (memql#3716).

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | string | yes | Public OAuth client_id issued at dynamic registration (RFC 7591). Lookup key in /authorize + /oauth/token. |
| `clientName` | string |  | Human-readable client_name from the registration request. |
| `corsOriginsJSON` | string |  | JSON array of origins an owner/admin has granted credentialed CORS access for this client -- what makes a customer's own website able to call this cluster without an env change and a restart (memql#3716). EMPTY for every dynamically-registered client: /register is unauthenticated, so the allowance is a separate admin act on this row and a self-registered client cannot confer one on itself. Set only through IdentityAdminMsg / component/identity/adminops, and NEVER derived from redirectURIsJSON -- RFC 8252 loopback redirects are normal here (config.go implements it), so deriving would silently admit http://127.0.0.1 and hand every local process on somebody's machine cookie-bearing read access to identity. Entries are scheme + host + optional port and nothing else; '*' is refused on both the write and the read, because the CORS response always carries Access-Control-Allow-Credentials. |
| `grantTypes` | string |  | Space- or comma-joined grant_types (default authorization_code,refresh_token). |
| `redirectURIsJSON` | string | yes | JSON array of registered redirect_uris. Exact-matched (plus RFC 8252 loopback-any-port) at /authorize + /oauth/token. |
| `registeredAt` | string |  | RFC3339 registration time. Mirrors the row's createdAt intrinsic (createdAt is reserved and cannot be a payload field), kept explicit so the RFC 7591 client_id_issued_at can be re-derived without the row envelope. |
| `responseTypes` | string |  | Joined response_types (default code). |
| `tokenEndpointAuthMethod` | string |  | Client auth method; public clients use none (no secret issued). |

## `v1:identity:user`

A person (or synthetic principal). Owns identities. Same record cluster-wide.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the user account is active. |
| `birthdate` | string |  | ISO-8601 date (YYYY-MM-DD), optional. Stored as a string rather than datetime because we never compute against it -- it's reference data the admin sets and the profile UI surfaces. |
| `dataExportLastAt` |  |  | Timestamp of the most recent /me/export download. Drives rate-limiting per MEMQL_IDENTITY_DATA_EXPORT_RATE_LIMIT_HOURS. |
| `deletionScheduledAt` |  |  | Set when the user requested account deletion. The accountDeletionSweep cron hard-deletes the row MEMQL_IDENTITY_DELETION_COOLDOWN_DAYS later. Cleared by cancelScheduledDeletion if the user reverses the request during the cooldown. |
| `displayName` | string | yes | Display name shown in the UI. By convention this is firstName + ' ' + lastName when both are populated; the admin / setup wizard maintain that invariant. Standalone field (rather than a derived computed view) because legacy rows pre-date the firstName/lastName split and we want a stable display value to fall back on. |
| `firstName` | string |  | Given name. Set by the admin via /admin/users/detail (or by the cluster owner via /setup); flows through to the JWT as the OIDC-style `given_name` claim and into the product's profile UI. |
| `gender` | string |  | Optional self-identified gender. Free-form string -- the frontend offers a curated list but the backend doesn't enforce one. |
| `internal` | boolean |  | True when the registering email matched MEMQL_IDENTITY_INTERNAL_DOMAINS at first login. Always written on the registration path: createUserOnFirstLogin takes `internal bool!` as a required arg. createUser (admin-created) omits it, and an absent value reads as false. Internal users get the cluster-wide MEMQL_IDENTITY_INTERNAL_DEFAULT_ROLE; external users instead get owner of an auto-created personal partition. Captured at registration so policy decisions remain stable even if the configuration drifts. |
| `lastName` | string |  | Family name. Mirror of firstName -- admin-curated, stamped onto the JWT as `family_name`. |
| `lastSeenAt` |  |  | Updated by the identity service on each successful refresh. Answers 'when was this person last around'. Per-credential last-use lives on v1:identity:identity.lastUsedAt. |
| `legalAcceptance` | array |  | Append-only history of legal-document acceptances. Each entry: {documentType: 'tos'\|'privacy', version: string, acceptedAt: datetime, sourceIP: string}. Audit trail for compliance -- never edited, only appended. |
| `phone` | string |  | E.164 phone number, optional. Set by an admin via /admin/users/detail; required for full app access via the ProfileCompletenessGuard. |
| `preferences` | object |  |  |
| `primaryEmail` | string | yes | Canonical email. Verified by the magic-link flow at registration; the dedup key for 'is this Alice already known?'. |
| `primaryRole` | string |  | Free-form job title / role at the org (e.g. 'CEO', 'Engineer'). Distinct from the cluster-wide auth `role` field above; admin-curated, not auth-related. |
| `revocationEpoch` | integer |  | Monotonically-increasing per-user counter, starting at 0. Not stamped on create and it does not need to be: the identity store reads it through int64Field, which yields 0 for an absent key (component/identity/store.go). Stamped into every JWT this user is issued; the verifier rejects any JWT whose revocation_epoch claim is below the user's current value. Bumping this field invalidates every token issued before the bump, on the next stream-open or periodic in-stream re-check (default ~5 minutes). Bulk-revoke / role-change / security-event tooling is the intended writer. See memql#106. |
| `role` | string |  | Cluster-wide role: a v1:rbac:role SLUG or one of its aliases (epic memql#5166). It was a five-value enum, and that enum is why a custom role could be created, could rank, and could not be assigned -- the value would not fit the field. A DSL enum cannot name a row, so validation is auth.IsValidRole against the runtime catalog, applied at every seam that writes this field. owner is the sole cluster-owner tier (actor.isClusterOwner==true is what an admin-tier row's @rowAuthz gates on -- e.g. the audit log); admin/developer/writer/reader are RBAC roles for the identity admin console + engineering surfaces (component/auth/rbac.go) but carry no automatic per-row data access of their own -- reaching an owned/granted row still requires being its owner or holding a relationship grant, not just this role. developer additionally gets authoring + inline DSL + deploy/cut-version; admin/writer/reader do not. |
| `sharedMailbox` | boolean |  | True when this account's address looks like a mailbox several people read -- a role alias (support@, billing@) or a team name (team@, hello@). A HINT, set at registration and at invitation by a local-part heuristic in component/identity/registration and editable afterwards by the user and by an admin. It blocks nothing and gates nothing. What it does is make a fact visible that is otherwise invisible: anyone who can read the mailbox can request a sign-in link and enter the account, so the sign-in surface of the account is the mailbox's reader list. The remedy it points at is signInPolicy below. |
| `signInPolicy` | string |  | Which factors may enter this account. `any` is the default and means the ordinary set (magic link, passkey). `passkey_only` disables sign-in LINKS: a request for one writes no row, sends no link, and mails a notice instead -- informative to the account holder, useless to anyone else reading the same mailbox. Settable by the user only while they hold at least one active passkey, and the server enforces that regardless of the UI, because a policy that can lock its owner out is not a security control. Owners and admins can reset it to `any` over IdentityAdminMsg, audited; that is the rescue path, and it is no more power than the enrolment-token issuance admins already hold. Enrolment tokens and the owner recovery key are the lost-passkey routes and are deliberately unaffected. (enum: any, passkey_only) |
| `suspendedAt` |  |  | Set when the user is suspended by an admin. Nil means active. |
| `suspendedReason` | string |  | Human-readable reason for suspension. |

**Relationships:** `references` -> `v1:agents:agent`

## `v1:identity:workerPairingCode`

Short-lived pairing credential for the computer-use enrollment flow. The frontend's Settings -> Computer Use 'Connect this computer' card mints a row + plain code (XXXX-XXXX, 8 alphanumeric chars from Crockford's Base32 alphabet). The cockpit wizard on the user's machine redeems the code on the cluster's gRPC stream via Authorization: Pair <code>, the redeem handler stamps redeemedAt + redeemedBy, mints a v1:identity:identity worker_token row owned by the same user, and returns the plain mql_wkr_<...> token + cluster URL to the cockpit. Single-use: a row with non-empty redeemedAt is dead. TTL ~10 minutes (IDENTITY_PAIRING_CODE_TTL_MIN, default 10).

| Field | Type | Required | Description |
|---|---|---|---|
| `clusterURL` | string | yes | Canonical cluster URL the cockpit should dial for the WorkerService.Stream. Stamped at create time so the redeem handler can echo it back -- letting the frontend and the BFF be reachable at different DNS names without leaking that detail to the cockpit operator. |
| `codeHash` | string | yes | SHA-256 hex digest of the plain XXXX-XXXX code. Plaintext is shown to the user ONCE on the frontend's Settings card and never persisted. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Redeem rejects rows past this even when redeemedAt is empty. |
| `ownerUserId` | string | yes | v1:identity:user.id who minted the code (and who will own the resulting worker_token + v1:worker:registration). The redeem handler reads this and uses it as the registeredBy for the new worker_token credential. |
| `redeemedAt` |  |  | Stamped on first successful redeem. Single-use semantics: any subsequent redeem against the same row fails with already_redeemed. |
| `redeemedBy` | string |  | v1:identity:identity.id of the worker_token row the redeem minted, for audit trail. Empty until redeemed. |
| `redeemedFromIP` | string |  | Source IP the redeem call came from. Audit signal -- helps detect 'someone else redeemed my code' fraud. |
| `sourceIP` | string |  | IP the create-pairing-code request came from. Audit + abuse signal. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:install:installRun`

One execution of the install or uninstall step graph on one machine. The row is written when the run starts and re-written on every step transition under the SAME id (the runId), so the run's history is reconstructable asOf any instant. Its reason for existing is the receipts field: the per-step record of what the run placed on this machine and whether the machine already had it, which is the only evidence uninstall has that an artifact is ours to remove.

| Field | Type | Required | Description |
|---|---|---|---|
| `completedSteps` | array |  | Step ids that have run AND passed their verify predicate, in completion order. A step that ran but failed verification is not here -- passing verification is what 'completed' means. |
| `currentStep` | string |  | Step id currently executing, or the step the run stopped on. Empty once the run reaches a terminal status. |
| `engineTag` | string |  | Release tag the stack was checked out at (install.cloneStack --tag). Empty on an uninstall run. |
| `failureReason` | string |  | Why the run stopped, when status is failed: the failing step id and the capability script's error message. |
| `graph` | string |  | Which step-graph document this run executes (scripts/install/graph/install.json, uninstall.json or rebuild.json). (enum: install, uninstall, rebuild) |
| `hostArch` | string |  | CPU architecture reported by install.detect (arm64 \| amd64). |
| `hostOs` | string |  | Operating system reported by install.detect (darwin \| linux). Recorded because an uninstall may run on a machine whose state has drifted since. |
| `receipts` | object |  | Per-step artifact record, keyed by step id: the receipt kind, the resolved target, and whether the artifact PRE-EXISTED this run. The pre-existence flag is the value uninstall passes back as remove-artifact.sh's --pre-existing, whose refusal is the last wall between an uninstall and someone else's tooling. |
| `runId` | string | yes | Stable id for this run; also the concept row id, so every step transition appends to one timeline. |
| `startedAt` |  |  | When the run began. The row intrinsic createdAt carries the same instant for the first write. |
| `status` | string |  | Run lifecycle. running -> succeeded \| failed; cancelled when the operator stops it. (enum: running, succeeded, failed, cancelled) |
| `triggeredBy` | string |  | v1:identity:user.id of the operator who started the run. Plain string FK (not a @relationship -- cross-concept references use FK fields). |
| `updatedAt` |  |  | Timestamp of the most recent step transition. |

## `v1:knowledge:documentChunk`

A single retrievable text chunk attached to a knowledge domain. Chunks are produced by the knowledge ingestion integration (which splits source text and embeds each chunk). The embedding itself lives in the node_vectors table keyed by this chunk's id, via integration.embedding.store with vectorField='content'. Per Q8: text-style breakdowns of user-uploaded Documents (PDF sections, markdown chunks, plain text chunks) reuse this concept rather than duplicating the chunk infrastructure into a new typed concept.

| Field | Type | Required | Description |
|---|---|---|---|
| `documentId` | string |  | Per Q8: optional back-reference to a v1:knowledge:document row when this chunk came from a user-uploaded file rather than a seeded corpus. Null for seeded UI-corpus chunks; populated for chunks produced by the analyzer. NOTE: no `document` concept is declared anywhere in this engine tree today -- see the dead-stub headers below this concept. |
| `domainId` | string | yes | ID of the parent v1:knowledge:knowledgeDomain. Queries filter by this to scope retrieval to the agent's selected domains. |
| `seq` | integer |  | Order within the source (0-based). A document of N chunks has seq 0..N-1. |
| `source` | string | yes | Provenance discriminator for audit, UI grouping, and the dev-refresh cache filter. Aligned with the citation-registry source taxonomy on the agent-reply side -- one word, one meaning across the whole stack. 'llmSeeded' = baseline LLM-generated content from seedDomainContent (catalog Tier-A/B bodies, Tier-B disclaimers, Tier-C Wikipedia chunks). 'augment' = topic-focused chunks added via the chat 'Analyze for training' action; carries sourceUtteranceId + sourceAgentId + sourceTopic back-pointers. 'crossDomainBridge' = bridge content generated when an agent has 2+ domains. 'appStructure' = the product UI corpus that drives operator UI moves (cited silently). 'fileUpload' = user-uploaded document content (when wired). 'trainerAgent' = chunks distilled by the Trainer Agent's web-search + reasoning pipeline (Q3, Q9); cited with provenance back to the original web sources via sourceRef. Required: every writer must declare which class of provenance it represents. (enum: llmSeeded, augment, crossDomainBridge, appStructure, fileUpload, trainerAgent) |
| `sourceAgentId` | string |  | When source='augment': bare id of the v1:agents:agent whose retrieval gap surfaced this chunk. Same provenance audit purpose as sourceUtteranceId. |
| `sourceRef` | string |  | Where the chunk came from, e.g. 'opid:agents.new', 'doc:README.md#L42', 'url:https://docs.example.com/agents'. Used for citation in the UI and for idempotent re-ingestion. |
| `sourceTopic` | string |  | When source='augment': the narrow topic a chunk was generated to cover (e.g. 'Bronze Age Collapse and the Sea Peoples'). NOTHING WRITES THIS ANY MORE -- the chat augment flow that did went with the chat surface (epic memql#4988) and its builtins were retired in memql#5049. The field and the enum value stay because rows already carry them, and grouping them in the Knowledge panel still works. |
| `superseded` | boolean |  | Per Q9 trainSpecialist mode='refresh': set true when the Trainer Agent marks this chunk outdated (via markChunkSuperseded). Superseded chunks are excluded from retrieval -- they stay in the table for audit / provenance but no longer surface in the system_knowledge block. The replacement chunk (if any) carries fresher content written in the same refresh run. |
| `supersededAt` |  |  | When this chunk transitioned to superseded. Set alongside superseded=true by markChunkSuperseded. |
| `supersededReason` | string |  | The Trainer Agent's stated reason for marking the chunk outdated (e.g. 'superseded by 2026 figures', 'source page removed'). Surfaced in the Knowledge panel's chunk-history view. |
| `text` | string | yes | The chunk text. Kept as plain text so findSimilar can re-embed on demand and the model can render it in the system_knowledge prompt block. |
| `tokenCount` | integer |  | Approximate token count, rough character-length / 4 heuristic. Used for budgeting context windows when assembling the system_knowledge block. |
| `validationStatus` | string |  | Per Q15: validation gating mirror of v1:knowledge:document. validated = ingestible into knowledge domains; rejected = soft-deleted from retrieval. Seeded chunks default to 'validated' since they ship as canonical. (enum: unvalidated, validated, rejected) |

## `v1:knowledge:knowledgeDomain`

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this domain is tagged with -- which client it was trained for (epic memql#4800, D5). A TAG, and the word is exact: it is rendered on the Training domain card and filterable there, and NOTHING ELSE READS IT. Agent routing, domain attachment, retrieval, scoring and the system_knowledge block are all deliberately unaffected -- an agent carrying a tagged domain behaves identically to one carrying an untagged one, and `domainsForAccount` (dsl/accounts/queries.memql) is the only query in the tree that mentions the field. That restraint is the decision, not an omission: routing off account-tagged domains is named in the design as follow-up work, and building half of it here would make the tag mean something nobody agreed to. |
| `active` | boolean |  | Whether the domain participates. Absent reads as participating, and the convention is stated rather than declared as @default for the reason `tier` records. The seeder's existence probe (domainExists) treats a missing key and true as the same answer, so a row written before this field existed reads as active. |
| `category` | string |  | Catalog grouping the domain belongs to, e.g. 'personal' / 'business'. Free text rather than an enum: the catalog is product-extensible through RegisterSeedDomain, and a closed set here would refuse a pack's own category at load. |
| `description` | string |  | What the domain covers, in a sentence. Written by the catalog seeder from the standard-domain registration. |
| `name` | string | yes | The domain's human name, e.g. 'Residential real estate'. What the Training app renders on a card instead of the raw id, once rows carry it. |
| `predefined` | boolean |  | True for a domain that ships in the standard catalog, false for one created at runtime. Lets a surface tell a catalog domain from a domain somebody made. |
| `relevantForRoles` | array |  | Agent-role slugs this domain is offered for. Read by the role -> domain mapping at seed time; nothing at request time consults it. |
| `requiredByToolSlugs` | array |  | Tool slugs that need this domain present. A catalog-integrity input, not a runtime gate. |
| `source` | string |  | Which registration wrote the row -- the standard catalog, or a pack's RegisterSeedDomain. Provenance for an operator asking where a domain came from. |
| `tier` | string |  | Safety tier. Absent reads as A by convention -- @default is deliberately NOT declared, because this domain declares no create mutation (see the header) and @default is never applied on insert (memql#3038); an annotation nothing stamps is a silent no-op the conformance gate refuses. The convention lives here instead -- A = general, B = safety-relevant, C = high-stakes regulated. THE tier the disclaimer machinery actually keys on (integrations/knowledge/seed_domain_content.go): a Tier-B domain carries disclaimerChunkText as chunk 0, a Tier-C domain gets curated content or an upload-authoritative-sources placeholder. v1:agents:agentRole.tier and v1:skills:skill.tier mirror this value by convention and neither is what fires the effect -- see their own descriptions, which record that correction. (enum: A, B, C) |

**Relationships:** `references` -> `v1:accounts:account`

## `v1:library:artifact`

A single Library index row pointing at one underlying source concept (document / generated output / note / to-do / calendar event / memory / live source). Carries the shared provenance + type spine the Library panel needs to list / search / filter / sort across heterogeneous sources, while the actual content stays on the backing concept referenced by sourceConceptRef. The LOCKED backend shape for the Library epic (memql#693): a real index concept, not a UI projection. Per-row authz: the COMPOSITE tier (memql#4312) -- the owner, or a cluster owner. Every read already carried ownerUserId==actor.userId by hand; the declaration is what extends that to the paths a filter cannot reach (subscriptions, graph expansion, a raw query string) and what gives an operator console the cross-user view a plain owner= tier has no bypass for.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountIds` | array |  | The v1:accounts:account rows this item is labelled with -- who it is about, or who it was produced for (epic memql#4800, D5). A LIST, because "one or two accounts" is the owner's own framing: a contract naming two clients is one file, and forcing it to pick would be the schema disagreeing with the filing cabinet. Optional plain references with NO read effect: row authorization on the index is exactly what it was, `libraryItemsForAccount` reads through the ordinary owner-scoped path and narrows nothing, and a row with no key at all behaves as untied under every filter -- which is every row promoted before this field existed, so the Files browse filter reads absence and the empty list as the same answer, the way the folderId fold already has to. Edited from the Files inspector's account labels; browse filters on it CLIENT-SIDE over the seeded snapshot, for the reason every other Files facet does. |
| `agentId` | string |  | v1:agents:agent.id associated with this item, when one applies (e.g. the agent that produced a generated output or owns a memory). Backs the per-agent facet filter. |
| `archived` | boolean |  | Soft delete: true once the owner archives the item, which removes it from the default Library list without destroying the row or its provenance (memql#4340). The engine is append-only by (id, createdAt), so an archive is a re-version carrying archived=true rather than a DELETE -- the history, the labels and the sourceConceptRef all survive. archiveArtifact sets it, and archives the backing v1:library:file when the artifact is one. createArtifact writes `archived: args.archived ?? false` so every promoted row carries an explicit value -- not because the list filter requires it (measured: `archived != true` DOES return a row whose payload has no archived key at all, so rows written before this field existed keep listing), but because a row that states its own answer is what makes the filter readable and what stops the next author reaching for `archived == false`, which is the spelling a missing key would silently exclude. |
| `folderId` | string |  | v1:library:folder.id this item is filed under -- the ORGANIZATIONAL TRUTH of the Files app's Drive-model tree (memql#4781, design D3). An id, never a path string; empty or absent means the root. Any kind can be filed, not only files. moveArtifactToFolder is the re-filing write (a read-merge update, so labels and archived survive a move); at promotion time createArtifact carries the backing row's initial filing forward, after which THIS copy is authoritative and the backing row's is not tracked further. Every folder filter runs CLIENT-SIDE over the owner's snapshot, because rows promoted before this field existed have no key at all and `folderId == ""` cannot match them -- the `archived != true` lesson, applied to a field where the honest reader is the fold, not the filter. |
| `format` | string |  | High-level content classification for artifacts -- picks the viewer in the Library (markdown / Word document / PDF / Excel spreadsheet) and falls back to a metadata-only card for 'other'. Mirrors v1:knowledge:document.format with 'document' added for Word-style docs. Null for record-lens rows. (enum: markdown, document, pdf, spreadsheet, image, text, conversation, other) |
| `kind` | string | yes | The flavor of the backing concept. document = uploaded file (v1:knowledge:document); generated_output = an output produced on the workbench / via computer-use / by an agent; note = v1:notes:note; todo = v1:todos:todo; calendar_event = v1:calendar:calendarEvent; memory = user-facing assistant memory; live_source = v1:knowledge:liveSource; file = v1:library:file, the Library's own first-class byte-bearing row (the sixth backing concept, memql#4340). Extensible -- new sources append a value. (enum: document, generated_output, note, todo, calendar_event, memory, live_source, file) |
| `labels` | array |  | Free-text labels the owner or their agents put on this artifact to say what it was for. Rendered as chips in the portal Artifacts page and filterable one label at a time. Distinct from v1:worker:registration.labels (routing among a user's own workers) and v1:cluster:node.labels (arbitrary node metadata), which are key=value OBJECT maps -- these are display labels on a []string, matching note.tags and skill.tags. |
| `lens` | string | yes | Which Library lens this row belongs to. 'artifact' = file-like, content-bearing item opened in a type-aware viewer (documents, generated outputs). 'record' = structured memql row read/edited as data (notes, to-dos, calendar events, memories, live sources). Drives the Artifacts \| Records toggle in the Library panel. (enum: artifact, record) |
| `live` | boolean |  | True when this row is a live-data source (kind=live_source, source=live). The Library renders a LIVE badge + freshness indicator computed from the backing liveSource's latest liveSnapshot (materializedAt / expiresAt). False for everything else. |
| `mimeType` | string |  | MIME type of the backing bytes when this is a content-bearing artifact, copied from the attachment. Used alongside format to pick the viewer. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this index row. Stamped from actor.userId at create time and re-stamped on every update so ownership can never be reassigned. The load-bearing per-row authz key. |
| `partitionId` | string |  | Optional product scope tag. The engine derives nothing from it; it is carried so a product can facet its own index rows. Empty for everything the engine writes. |
| `producedByRunId` | string |  | v1:work:run.id that produced this item, when a run produced it. Provenance back-pointer surfaced in the detail view. Was producedByPlanId until memql#5053 -- and clients/os/README recorded the cost of that: with the field naming a Plan, nothing could point a produced thing at the RUN that made it, so Nexus could draw nothing below the road except approvals. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE this item is associated with, WHEN A MACHINE IS KNOWN (memql#4781 generalized this from its original computer-use-only meaning): the machine a computer-use output was produced on, or the machine a file was uploaded from (indexFileOnCreate forwards the file row's verified uploadedFromWorkerId here). Lets the Files app say WHICH of the user's registered computers an item came from, and detect when it is the machine the user is currently on. Empty when no machine is honestly known -- a browser upload names none. |
| `producedByWorkerName` | string |  | Human-readable name of the machine producedByWorkerId names (e.g. 'MacBook-Pro'), copied from the worker registration at write time so the Files app can label the row without a join. Empty unless producedByWorkerId is set. Generalized alongside producedByWorkerId: 'produced on' for computer-use outputs, 'uploaded from' for files -- the kind and source decide the verb, the field carries the machine. |
| `scope` | string |  | Shared-vs-private visibility tier, mirrored from the backing source's own scope (currently only v1:knowledge:liveSource carries one). 'workspace' MEANT a partition-shared row with NO single owner (ownerUserId empty), surfaced through a non-owned libraryWorkspaceLiveSources read (#723). memql#4340's tier ends that: an owner tier is ANDed into every read of this concept and every row is admitted against it on the way out, so an empty ownerUserId is now unreachable on every path and that read is owner-scoped like its siblings. The value survives as a mirrored FACET of the backing source's own scope; a genuinely ownerless partition-shared Library row needs a concept that can express one, which the index no longer is. 'private' = owner-scoped like everything else. Null for the ordinary owned rows (documents / notes / to-dos / memories) that have no shared tier. (enum: workspace, private) |
| `source` | string | yes | Provenance -- WHERE this item came from. uploaded = user-provided file; exported = written out of another artifact by the export route (v1:library:file only); workbench_generated = produced in a v1:workbench:workspace container; computer_use = produced at the computer-use level; agent_generated = emitted by an agent as a standalone deliverable; derived = computed from another artifact; user_created = the person wrote it themselves in the portal, rather than a tool producing it for them; live = a current-state read against a live source (paired with live==true). Rendered as the per-row source label in the Library list. THIS ENUM IS THE UNION OF EVERY BACKING ROW'S OWN source, and it has to be: indexFileOnCreate and its five siblings pass the backing value straight through to createArtifact, so a value a backing concept can hold and this one cannot is a promotion that REFUSES -- the row never gets an index row and never appears in the Library, with nothing on the failing path to say why. `exported` is here for exactly that reason (memql#4342 found it missing). TestEveryBackingSourceValueIsPromotable pins the containment. (enum: uploaded, exported, workbench_generated, computer_use, agent_generated, derived, user_created, live) |
| `sourceConceptRef` | string | yes | Fully-qualified reference to the backing row, e.g. 'v1:knowledge:document:<id>', 'v1:notes:note:<id>', 'v1:knowledge:liveSource:<id>'. The Library drill-in resolves content + children (document->documentChunk, liveSource->liveSnapshot) through this ref. Also the idempotency key for the write-path (one index row per source ref). |
| `summary` | string |  | Optional short summary / description for the list row. From document.summary, liveSource.description, etc. when available. |
| `title` | string | yes | Display title for the list row. Copied from the backing concept at index time (document.fileName, note.title, liveSource.name, etc.). |
| `updatedAt` |  |  | RFC3339 watermark of the most recent change to the backing item, stamped on every index write. The default Library sort key (most-recent first). |
| `validationStatus` | string |  | Validation rollup for document-backed artifacts, mirrored from v1:knowledge:document.validationStatus so the Library can facet on it without a join. 'none' for items that have no validation lifecycle (records, generated outputs). (enum: none, unvalidated, validated, rejected, partiallyValidated, superseded) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:agents:agent`, `references` -> `v1:work:run`, `references` -> `v1:worker:registration`, `references` -> `v1:library:folder`

## `v1:library:documentVersion`

An immutable content snapshot of one logical Library document at one point in its edit history. Appended -- never overwritten -- whenever a document is produced, edited (by user or assistant), or restored, with a monotonically increasing versionNumber. The artifact index + backing document always point at the LATEST version while the full append-only history is retained behind it. Backed by the MemoryNodes TimescaleDB hypertable (partitioned on createdAt); long-lived, compression-after-90-days, no retention drop (memql#1228). Per-row authz: owned -- ownerUserId is stamped from actor.userId on append; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachmentId` | string |  | Back-reference to v1:common:attachment when this version is file-backed (a .docx / .pdf / .xlsx snapshot). The bytes live on the attachment row in blob storage; this version carries the metadata pointer. Empty for inline-text versions. |
| `authorId` | string |  | Identity of the author. For authorKind=user, the v1:identity:user.id; for authorKind=assistant, the v1:agents:agent.id; empty for system-authored versions. Read alongside authorKind for the 'edited by X' provenance line. |
| `authorKind` | string | yes | Who authored this version. user = a person edited it directly (memql#1229); assistant = an agent revised it on the user's behalf (memql#1231); system = produced automatically (the initial version on document creation, or a restore append from memql#1230). Drives the history view's author badge and the provenance line. (enum: user, assistant, system) |
| `content` | string |  | Inline text content for this version (markdown / plain text). The immutable body snapshot. File-backed documents leave this empty and carry bytes on attachmentId instead. body and/or attachmentId -- at least one is set. |
| `documentId` | string | yes | Logical document id this version belongs to -- the stable identity of the document ACROSS all its versions (e.g. the v1:library:generatedOutput id, or the artifact's sourceConceptRef). A PLAIN STRING foreign key, NOT an @relationship: it points across concepts to the backing document, and the only valid @relationship types (parent/contains/alias/equals) don't model a cross-concept content-history link. Every version of the same document shares this value; it is the grouping key for the history queries. |
| `note` | string |  | Optional short human-readable note describing the change in this version (e.g. 'fixed the totals', 'restored from v2'). Surfaced in the history list so a user can scan what each version changed without diffing. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns the logical document this version belongs to. Stamped from actor.userId on every append and never accepted from caller args: the edit/restore handlers resolve the backing document's owner and run the append under that owner's actor, so the stamped value is the document owner and ownership cannot be forged. @serverSet makes that a LOAD-TIME rejection rather than a convention, and the engine server-stamps the field from the @rowAuthz declaration above on the raw insert() surface that bypasses accept/stamp (memql#3059 / #3175). The load-bearing per-row authz key for every history read. |
| `parentVersionId` | string |  | Id of the documentVersion row this one was derived from (the previous latest at append time, or the chosen source version for a restore). The append-only history's back-pointer chain -- empty only for the very first version of a document. |
| `partitionId` | string |  | Optional product scope tag, carried for facet parity with the artifact index. The engine derives nothing from it. |
| `producedByRunId` | string |  | v1:work:run.id that produced this version, when an assistant/agent edit came through a run. Provenance back-pointer mirroring the artifact/generatedOutput spine. |
| `versionNumber` | integer | yes | Monotonically increasing version number within the logical document, starting at 1 for the first snapshot. Computed server-side as (latest existing versionNumber for this documentId) + 1 on every append -- MemQL has no arithmetic, so the increment is done in the Go edit/restore handlers that read the current latest before inserting. The user-visible 'v3' label and the optimistic-concurrency token (an edit naming an expectedVersion that no longer matches the latest is a conflict). |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:common:attachment`, `parent` -> `v1:identity:user`, `references` -> `v1:work:run`

## `v1:library:file`

A file the owner put in their Library -- uploaded, exported from another artifact, produced by an agent, or derived from another file. The Library's own byte-bearing row: the bytes live in blob storage at blobUrl, and every fact about them (name, mimeType, size, sha256) lives here rather than on the artifact index, which owns no content (memql#693). Any MIME type is accepted; an unknown one is stored opaquely with status=ready and no chunks. Promoted into the Library by indexFileOnCreate. Per-row authz: the composite tier (memql#4312) -- the owner, or a cluster owner; ownerUserId is stamped from actor.userId and never accepted from caller args.

| Field | Type | Required | Description |
|---|---|---|---|
| `archived` | boolean |  | Soft delete, set by archiveLibraryFile -- and set for you by archiveArtifact when the artifact being archived is backed by this file, so the two never disagree. The bytes are NOT deleted: the row keeps its blobUrl and its provenance, and the append-only history keeps every earlier version. |
| `blobUrl` | string | yes | Where the bytes live: 'library/{userId}/{fileId}/{name}' through integration.storage.upload. A STORAGE PATH, not a URL a browser can fetch -- the bytes only ever reach a viewer through GET /artifacts/{id}/content, which re-checks row admission and streams them; it never redirects. |
| `embeddingStatus` | string |  | How much of the file is searchable by meaning. none = no chunks embedded (an opaque type, or the pass has not run); partial = some chunks embedded and the pass stopped; complete = every chunk of the file has an embedding. Read by librarySimilarArtifacts to say whether a miss means 'not similar' or 'not indexed yet'. (enum: none, partial, complete) |
| `failureReason` | string |  | Why status is failed, in terms an owner can act on ('could not extract text from a password-protected PDF'). Empty unless status==failed. Carried on the row rather than only in a log because the person who uploaded the file is the one who needs to see it. |
| `folderId` | string |  | v1:library:folder.id the upload was filed under -- the INITIAL FILING ONLY (memql#4781, design B2). The upload route knows the target folder, and the promotion automation can only forward what the backing row carries: the same 'the writer knew it' reasoning format already uses. After promotion the artifact index's own folderId is authoritative -- a later move updates the index and deliberately never comes back here, so this copy is a record of where the file LANDED, not where it is. |
| `format` | string |  | High-level content classification DERIVED FROM mimeType by the writer that knows the MIME (the upload route, or the analysis pass when the type had to be sniffed). Carried onto the artifact index at promotion, where it picks the Library viewer. Held on the row rather than computed in indexFileOnCreate because an automation step argument has no conditional form -- the mapping is a Go table, and the row is where its answer is recorded once. Defaults to 'other', which renders the metadata-only card. (enum: markdown, document, pdf, spreadsheet, image, text, conversation, other) |
| `linkCheckedAt` |  |  | RFC3339 moment linkState was last established. Displayed CONTINUOUSLY beside the state rather than fingerprinted into the arrival cue: a verify lane touches this on a schedule for every watched file forever, so naming it as news would strobe the Files list on the sweep's own cycle (the heartbeat rule, clients/os/README.md). It is what makes a stale `synced` honest -- 'synced, checked 3 weeks ago' is a different claim from 'synced', and only one of them is one this row can make. |
| `linkState` | string |  | How this copy stands against the machine it was pushed from -- the watched-folder backup's per-file state (epic memql#4783). synced = the copy matched the origin when it was last checked; stale = the origin changed and the new bytes have not arrived; origin_gone = the file is no longer at that path, or the machine is no longer reachable. THE INVARIANT IS THAT THIS FIELD ONLY EVER FLAGS: a deletion or a disconnection at the origin sets origin_gone and NEVER archives, moves or deletes the MemQL copy, because the whole point of a backup is that it outlives the thing it copied (design E, D12). ABSENT means this file has no origin link at all -- a browser upload has none to have, and every file stored before this field existed has no member. Absent is deliberately not a fourth state: 'we do not track this file' and 'we track it and it is fine' are different answers and must not share a spelling. The upload route stamps synced on any push that names a (machine, path), because at the instant those exact bytes arrived the copy DID equal the origin; every later transition is reported by the cockpit's verify lane through setLibraryFileLinkState. (enum: synced, stale, origin_gone) |
| `mimeType` | string | yes | Content type as uploaded, or sniffed from the leading bytes when the client sent none. ANY type is accepted -- there is no allowlist here, which is one of the reasons the Library does not ride the attachment routes (design D1). An unrecognised type is stored opaquely: status goes straight to ready, no text is extracted and no chunks are written. |
| `name` | string | yes | Original filename as the owner sees it, sanitised at upload (path separators and control characters removed, length bounded). Also the filename the export route puts in Content-Disposition, and the last segment of blobUrl. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this file. Stamped from actor.userId on every write and never accepted as a mutation arg -- the upload route runs as the authenticated caller, and the detached analysis pass re-enters under that same user's actor (auth.ContextWithUserActor). @serverSet turns 'never a caller arg' into a LOAD-TIME rejection (memql#3175); the engine also server-stamps it from the @rowAuthz declaration above on the raw insert() surface that bypasses accept/stamp (memql#3059). The load-bearing per-row authz key. |
| `producedByRunId` | string |  |  |
| `producedByStepKey` | string |  |  |
| `sha256` | string |  | Lowercase hex SHA-256 of the stored bytes. A DEDUP HINT and an integrity check -- NEVER an access key: knowing it grants nothing, because the download route resolves the artifact under the caller's own actor and there are no signed URLs anywhere in this design. OPTIONAL since memql#4782: a one-shot upload computes it inline, but a chunked upload's handler never holds the whole file, so the row lands in 'stored' with this ABSENT and the analysis pass stamps it by streaming the committed blob once. Absent means 'not measured yet', never 'no hash exists' -- readers render a dash, not an error. |
| `size` | integer | yes | Size of the stored bytes. Bounded at upload by MEMQL_LIBRARY_MAX_UPLOAD_BYTES (default 256 MB, sized so a site bundle fits). Recorded from what was actually written to blob storage, not from the client's Content-Length. |
| `source` | string | yes | Provenance -- how the file came to be. uploaded = a person put it there; exported = written out of another artifact by the export route; agent_generated = an agent produced it as a standalone deliverable; derived = computed from another file. Copied onto the artifact index row's own source field at promotion. (enum: uploaded, exported, agent_generated, derived) |
| `status` | string | yes | Lifecycle of the analysis pass. stored = bytes are durable and nothing has looked at them yet; analyzing = extraction / chunking / embedding in flight; ready = terminal success (including the unknown-type case, which is ready with no chunks); failed = terminal failure, with failureReason set. Never a silent partial: a pass that gives up sets failed and says why. (enum: stored, analyzing, ready, failed) |
| `summary` | string |  | Short description of the contents, written by the analysis pass for the types it can read. Empty for opaque types. Copied onto the artifact index row's summary so the Library list can render it without a join. |
| `trainedIntoDomainIds` | array |  | Ids of the knowledge domains this file has been trained into, appended one at a time by libraryTrainFile (design D7). Upload and train are two acts: nothing here is trained by default, and this list is the record of every deliberate one. A []string of domain ids rather than a relationship because the target concept is product-owned and the engine tree does not declare it. |
| `uploadedFromPath` | string |  | Absolute path the file occupied on the uploading machine, as the cockpit reported it (e.g. '/Users/a/Reports/q3.pdf'). Stamped only where honestly known -- a browser upload carries none. Stays on THIS row and is deliberately not promoted to the index: the Files app's inspector reads the file row, and the future watched-folder sync epic keys re-pushes on (uploadedFromWorkerId, uploadedFromPath) read from here (design E). |
| `uploadedFromWorkerId` | string |  | v1:worker:registration.id of the fleet machine this file was uploaded FROM, when the uploader honestly knows it (memql#4781, design D5): a cockpit push names its own worker registration; a browser physically cannot name a machine and sends nothing -- no identity is ever invented, and nothing here is guessed from a user agent. VERIFIED at write time: the named registration must belong to the uploading user, read under the caller's own actor, and a claim that fails verification REFUSES the upload with a typed error rather than silently blanking -- a silently-dropped field would render as 'uploaded here', which is a lie. This axis is called PROVENANCE; 'origin' stays reserved for the data-origins system (memql#4378). Doubles as the future sync epic's machine half of the (machine, path) key. |
| `uploadedFromWorkerName` | string |  | Human-readable name of the machine uploadedFromWorkerId names, resolved from the caller's own verified worker registration at upload time (displayName when the owner set one, else the reported hostname) -- never taken on faith from the request, so the label the Files app renders is the label the fleet already shows for that machine. Empty whenever uploadedFromWorkerId is. |
| `versionNumber` | integer |  | Which version of this file the CURRENT row holds -- 1 at upload, incremented by supersedeLibraryFileHead each time somebody uploads a new version at this artifact (epic memql#4806, design D1). The head is always the newest version; every superseded one is its own immutable v1:library:fileVersion row. ABSENT MEANS 1, and it has to: every file uploaded before this field existed has no member at all, and a reader that treated absence as 0 would render 'v0' on every file in the Library. The counter lives here rather than being computed from the version rows because a count is not a version number -- a history read the caller could not complete would silently renumber the head. |
| `versionUploadedAt` |  |  | RFC3339 moment the CURRENT version's bytes arrived. Stamped at upload and re-stamped on every supersede. NOT the same fact as the row intrinsic createdAt, which is why it is declared: MemQL is append-only, so an update materialises a NEW row and createdAt is the moment of the LAST WRITE -- an analysis status transition moves it. The history panel says 'uploaded 3 weeks ago' from this field; reading createdAt would have it say 'uploaded a minute ago' because the summariser finished a minute ago. |

**Relationships:** `references` -> `v1:work:run`, `parent` -> `v1:identity:user`, `references` -> `v1:worker:registration`, `references` -> `v1:library:folder`

## `v1:library:fileChunk`

One chunk of a Library file's extracted text, embedded for similarity search. Written by the analysis pass, one row per chunk in file order; librarySimilarArtifacts runs similarTo over these and folds the hits up to their artifacts by best score. Deliberately NOT v1:knowledge:documentChunk, which requires a knowledge domain the engine tree does not declare (design D2). Per-row authz: the composite tier (memql#4312), the same as the file it belongs to -- ownerUserId is stamped from actor.userId, never accepted from caller args.

| Field | Type | Required | Description |
|---|---|---|---|
| `artifactId` | string | yes | v1:library:artifact.id of the index row the file was promoted to. Carried on the chunk so a similarity hit folds straight up to the artifact the Library lists, with no second read to resolve the promotion. Written by the analysis pass, which resolves it through libraryArtifactBySourceConceptRef. |
| `fileId` | string | yes | v1:library:file.id this chunk was extracted from. The grouping key for libraryFileChunksForFile, and what a similarity hit resolves back through. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns the file this chunk came from. Stamped from actor.userId: the analysis pass runs under the file owner's actor, so the chunk lands owned by the same person as its file. @serverSet makes 'never a caller arg' a load-time rejection (memql#3175). The per-row authz key -- it is duplicated here rather than resolved through fileId because a similarity read matches CHUNKS first and must be able to admit or deny each one without a join. |
| `seq` | integer | yes | Zero-based position of this chunk in the file's text, in file order. Chunks overlap by design (about 180 characters), so seq orders them but does not partition the text. |
| `text` | string | yes | The chunk body -- the extracted text this row's embedding was computed from. About 1800 characters, the knowledge splitter's default. This is what a similarity match is actually matching against, and what a citation would quote. |
| `tokenCount` | integer |  | Approximate token count of text, recorded when the embedding was computed. Advisory: it drives batching and cost accounting, and nothing reads it as a correctness signal. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:file`, `references` -> `v1:library:artifact`

## `v1:library:fileVersion`

One superseded version of a Library file: the byte facts, the provenance and the two moments that version had, frozen at the instant it stopped being the head (epic memql#4806, design D1). The newest version is NEVER one of these rows -- it is the v1:library:file itself, which is what lets the artifact index, the content route and the analysis pass go on reading exactly one row. Written only by supersedeLibraryFile through the @serverOnly pair, at the derived id '<fileId>-v<n>' so a retried supersede re-versions the same row instead of appending a duplicate to somebody's history. Per-row authz: the composite tier (memql#4312) -- the owner, or a cluster owner -- matching the file it is a version of.

| Field | Type | Required | Description |
|---|---|---|---|
| `blobUrl` | string | yes | Where THIS version's bytes live: 'library/{userId}/{fileId}/v{n}/{name}'. A STORAGE PATH, not a URL a browser can fetch -- the bytes only ever reach a viewer through GET /artifacts/{id}/content?version={n}, which re-checks row admission and streams them. The reason the version mutations are @serverOnly: a caller-authored blobUrl could name another user's object, and the content route would then serve it. |
| `fileId` | string | yes | v1:library:file.id this is a version of -- the grouping key libraryFileVersionsForFile reads, and the stable identity of the file ACROSS every version. Never changes: the head keeps its id forever, which is the whole point of design D1. |
| `format` | string |  | High-level content classification of THIS version, derived from its own mimeType by the writer that knew it. Frozen with the version for the same reason name and mimeType are. (enum: markdown, document, pdf, spreadsheet, image, text, conversation, other) |
| `mimeType` | string | yes | Content type of THIS version's bytes, as uploaded or sniffed. Same reason as name: a version's own facts are frozen with it, never inherited from whatever the head happens to be now. |
| `name` | string | yes | The filename THIS version had. Carried rather than resolved from the file row because a new version may arrive under a different name (a person re-exports 'q3-final.pdf' over 'q3.pdf'), and a history that renamed the past would be telling the reader something that did not happen. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns the file this version belongs to. Stamped from actor.userId, never accepted as a mutation arg (@serverSet makes that a load-time rejection, memql#3175); the supersede runs under the uploading caller's actor, and the target file was already resolved under that same actor, so the stamped owner is the file's owner by construction. The load-bearing per-row authz key -- it is duplicated here rather than resolved through fileId because the history read admits or denies each version row in its own right, with no join. |
| `sha256` | string |  | Lowercase hex SHA-256 of THIS version's bytes, when it was measured. Absent means 'not measured', never 'no hash exists' -- a chunked upload's handler never holds the whole file, so the head can be superseded before the analysis pass has streamed the blob. Readers render a dash. A dedup hint and an integrity check, NEVER an access key: knowing it grants nothing, because the content route resolves the version under the caller's own actor and there are no signed URLs anywhere in this design. |
| `size` | integer | yes | Size of THIS version's stored bytes. Counted by the storage quota exactly like a file row's (design D9): retention is real, superseding destroys nothing, and a quota that ignored history would refuse a person using numbers they cannot see. |
| `summary` | string |  | The summary the analysis pass had written for THIS version's contents when it was superseded, or empty when the pass never ran or the type was opaque. What lets the history say what each version was ABOUT rather than only how big it was. |
| `supersededAt` | string | yes | RFC3339 moment this version stopped being the head, because a newer one landed. Equal to the row's own createdAt in practice; declared because a reader must not have to know that, and because a future re-write of this row for any reason would move the intrinsic and not this. |
| `uploadedAt` | string | yes | RFC3339 moment THIS version's bytes arrived, copied from the head's versionUploadedAt at snapshot time. Declared rather than read from the row intrinsic createdAt because createdAt on this row is when the SNAPSHOT was written -- which is the supersede moment, not the upload moment. The two are different facts and the history panel shows both. |
| `uploadedFromPath` | string |  | Absolute path THIS version occupied on the uploading machine, where honestly known -- a browser upload carries none. The future watched-folder epic (#4783) keys its re-pushes on (uploadedFromWorkerId, uploadedFromPath), and per-version history of that pair is what lets it say which push produced which version. |
| `uploadedFromWorkerId` | string |  | v1:worker:registration.id of the fleet machine THIS version was uploaded from, when the uploader honestly knew it. Frozen per version and never inherited (the epic's own rule): a file first dropped from a browser and later pushed from a laptop has one version that names a machine and one that does not, and saying otherwise would invent provenance. Verified at ITS OWN upload, exactly as v1:library:file.uploadedFromWorkerId documents. |
| `uploadedFromWorkerName` | string |  | The fleet's own label for the machine uploadedFromWorkerId names, resolved from the verified registration at the moment THIS version was uploaded. Empty whenever uploadedFromWorkerId is. Frozen deliberately: a machine renamed since is still the machine this version came from under the name the fleet used then. |
| `versionNumber` | integer | yes | Which version this row froze, 1-based. Every version of a file has exactly one number: 1..N-1 live on these rows and N is the head file row's own versionNumber. The pair (fileId, versionNumber) is unique by construction -- the row id derives from it -- so a client folding head-plus-history keys on this and a retried supersede cannot produce two rows claiming the same number. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:file`, `references` -> `v1:worker:registration`

## `v1:library:folder`

One folder in the owner's Library tree (memql#4781, design B1/D3): a named collection artifacts and other folders point INTO via ids -- never a path segment, never a namespace. parentFolderId nests it (empty or absent = root); sibling name duplicates are allowed by design, so there is no uniqueness machinery to fight and a rename touches exactly one row. Archiving is the same soft delete every Library row gets -- the client-driven walk archives contents first (design B5), and a folder that vanishes under its children only degrades the picture: the tree fold renders orphans at root with a marker. A folder whose subtree holds no file at all takes the OTHER disposition instead: `deleted`, which no surface shows and no restore undoes, because there is nothing inside it for anybody to want back. Per-row authz: the composite tier (memql#4312) -- the owner, or a cluster owner -- matching artifact and file, whose rows it organizes.

| Field | Type | Required | Description |
|---|---|---|---|
| `archived` | boolean |  | Soft delete, set by archiveLibraryFolder. libraryFolders filters it with the null-safe `archived != true` spelling, so rows written before any future field change keep listing. The client-driven archive walk (design B5) archives a folder's CONTENTS first, children-first, then the folder -- idempotent under interruption, and re-running archives the remainder. Removing a desk shortcut is NEVER this write. |
| `deleted` | boolean |  | The disposition of a folder whose subtree held NO FILE AT ALL, at any depth, when somebody archived it -- set by deleteLibraryFolder, which the archive walk calls instead of archiveLibraryFolder for exactly those folders. Every folder read carries the isNotDeleted trait (the null-safe `deleted != true` spelling, for the reason archived above records), so a deleted folder leaves the tree, the Bin and a by-id resolve together: there is no surface it still appears on. NOT A FLAVOUR OF archived, and the difference is not cosmetic -- nothing archived this row. Archiving exists so a person can get something back, and an empty folder tree has nothing in it to get back, so an archived one would be a line in the Bin that answers no question anybody asked. NO RESTORE PATH RESURRECTS IT: restoreLibraryFolder clears archived and deliberately never touches this field, because a row every surface excludes is a row nothing can ask to have back. |
| `name` | string | yes | Display name of the folder, as the owner typed it. NOT a namespace: sibling duplicates are allowed (design D3), so nothing anywhere compares two folders by name -- the id is the identity, and a rename is one field on one row. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this folder. Stamped from actor.userId on every write and never accepted as a mutation arg (@serverSet makes that a load-time rejection, memql#3175); the engine also server-stamps it from the @rowAuthz declaration on the raw insert() surface. The load-bearing per-row authz key -- a folder is the owner's the way their files are, and confers no permissions of its own. |
| `parentFolderId` | string |  | v1:library:folder.id of the containing folder; empty or absent = a root folder. Declared as a self-referential `references` relationship below -- an edge, not a hierarchy the engine enforces: depth cap (12) and cycle refusal are the CLIENT's in v1 (design D11), and the tree fold tolerates violations defensively, rendering the offender at root with a marker, so a bad write degrades the picture rather than breaking it. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:folder`

## `v1:library:generatedOutput`

A deliverable PRODUCED through the app (as opposed to an uploaded document): a workbench result, a computer-use output, or a standalone agent output. Carries either inline text (body) or a reference to file bytes (attachmentId -> v1:common:attachment). Auto-promoted into the Library by indexGeneratedOutput on creation. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachmentId` | string |  | Back-reference to v1:common:attachment when the output is file-backed (a generated .docx / .pdf / .xlsx). The bytes live on the attachment row in GCS; this concept carries the metadata projection. |
| `body` | string |  | Inline text content for text-style outputs (markdown / plain text) produced directly without a file. File-backed outputs leave this empty and carry bytes on the attachment. |
| `format` | string | yes | Content classification -- picks the Library viewer. Mirrors the artifact.format vocabulary. (enum: markdown, document, pdf, spreadsheet, image, text, other) |
| `mimeType` | string |  | MIME type of the backing bytes when attachment-backed. |
| `ownerUserId` | string | yes | v1:identity:user.id this output belongs to (the user the producing agent / plan acts for). Stamped from actor.userId on every write and never accepted as a mutation arg; the producing integrations run the mutation under that user's actor (auth.ContextWithUserActor), which binds the AccessContext actor.userId resolves from. @serverSet turns 'never accepted as a mutation arg' from a convention into a LOAD-TIME rejection: a mutation that writes this field from caller args now fails to load (memql#3175). The raw insert() surface bypasses accept/stamp entirely and is covered separately -- the engine server-stamps this field from the @rowAuthz declaration above on every non-template write (memql#3059 / #3175). The per-row authz key for Library reads. |
| `partitionId` | string |  | Optional product scope tag, carried through from the artifact index. The engine derives nothing from it. |
| `producedByAgentId` | string |  | v1:agents:agent.id that produced this output, when an agent emitted it. |
| `producedByRunId` | string |  | v1:work:run.id that produced this output, when a run produced it. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE that produced this output, when source=computer_use. Empty otherwise. Copied onto the artifact index row. |
| `producedByWorkerName` | string |  | Human-readable name of the producing worker machine, copied from the worker registration at production time. Empty unless producedByWorkerId is set. |
| `source` | string | yes | Provenance -- where the output was produced. Copied onto the artifact index row's source field. user_created is the portal's own create path: a person typed the content rather than a tool producing it, and calling that 'derived' would render a false provenance label on their own row. (enum: workbench_generated, computer_use, agent_generated, derived, user_created) |
| `summary` | string |  | Optional short description / preview of the output. |
| `title` | string | yes | Display title for the output, e.g. 'Ten most beautiful birds'. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:common:attachment`, `references` -> `v1:work:run`, `references` -> `v1:agents:agent`, `references` -> `v1:worker:registration`

## `v1:library:memory`

A durable memory the assistant retains about the user across sessions (a fact, preference, standing instruction, or episodic recollection). The user-facing LLM-memory concept; surfaced in the Library's Records lens. Per-row authz: owned -- ownerUserId stamped from actor.userId; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | v1:agents:agent.id that formed / owns this memory, when agent-scoped. Empty for user-global memories. |
| `content` | string | yes | The memory text itself -- what the assistant should recall. |
| `kind` | string | yes | Memory flavor. fact = stable truth about the user; preference = how they like things done; instruction = a standing directive; episodic = a specific past interaction worth recalling. (enum: fact, preference, instruction, episodic, other) |
| `ownerUserId` | string | yes | v1:identity:user.id this memory is about / belongs to. Stamped from actor.userId at create time. The per-row authz key. |
| `partitionId` | string |  | Optional product scope tag. The engine derives nothing from it. |
| `summary` | string |  | Optional one-line summary for dense list rendering. |
| `title` | string | yes | Short label for the memory, e.g. 'Prefers concise replies'. The primary display line. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:agents:agent`

## `v1:library:uploadSession`

One chunked upload in flight (memql#4782, design C2): the per-chunk authorization row (row admission is the owner check) and the record of init-time facts the complete step needs. Staged blocks live with the blob in Azure, never in any replica's memory, so any bff serves any chunk. Written ONLY by the upload routes through @serverOnly mutations: blobPath and fileId are storage-layer facts a caller must never author -- a forged blobPath would point complete at somebody else's bytes. Abandoned sessions are inert rows; their staging garbage-collects on Azure's ~7-day clock and no sweeper exists. Per-row authz: the composite tier (memql#4312), matching every other Library concept.

| Field | Type | Required | Description |
|---|---|---|---|
| `blobPath` | string | yes | Where the staged blocks live and the committed blob will land: library/{userId}/{fileId}/{name}, composed SERVER-SIDE at init from the verified actor and the engine-minted fileId. The reason the session mutations are @serverOnly: a caller-authored blobPath could name another user's object, and complete would then mint a file row whose bytes are somebody else's. |
| `chunkSize` | integer | yes | Chunk size in bytes -- 16 MiB, a constant of the design (D8), not a knob. Recorded on the row so complete and resume compute ceil(size / chunkSize) from what THIS session was opened with, even if the constant ever changes between releases. |
| `fileId` | string | yes | The v1:library:file id complete will create -- minted by the engine at init so the blob path, the resume records and the eventual row all agree on one identity before a single byte moves. |
| `folderId` | string |  | v1:library:folder.id the finished file will be filed under -- the same initial-filing semantics file.folderId documents (memql#4781, design B2), recorded at init because complete must not re-ask the client anything. |
| `labels` | array |  | Labels to apply to the promoted artifact at complete, through the same builtin the one-shot route uses -- so a label applied through a chunked upload is indistinguishable from any other. |
| `mimeType` | string |  | Content type as declared at init; complete passes it to createLibraryFile verbatim, where the one-shot route's own rules (any type accepted, opaque when unknown) apply unchanged. |
| `name` | string | yes | Original filename as the owner will see it, sanitised at session init exactly as the one-shot route sanitises it -- it becomes the last segment of blobPath and, at complete, the file row's name. |
| `ownerUserId` | string | yes | v1:identity:user.id that opened this session. Stamped from actor.userId on every write and never accepted as a mutation arg (@serverSet, memql#3175). The per-row authz key, and therefore the WHOLE per-chunk authorization: chunk PUTs resolve the session under the caller's actor, and a session that is not theirs does not resolve. |
| `size` | integer | yes | Declared total size in bytes, bounded by MEMQL_LIBRARY_MAX_UPLOAD_BYTES at init. A CLAIM the commit verifies: complete sums the staged blocks and refuses a mismatch, so a client that lied about size gets a refusal, not a truncated file. Also what the chunk route bounds n against (n <= ceil(size / chunkSize)), so staging is bounded by the declaration. |
| `status` | string | yes | Lifecycle. open = accepting chunks; completed = the block list committed and the file row exists (terminal); abandoned = declared but unwritten in v1 -- a stopped session needs no write to be abandoned, its staging garbage-collects server-side on Azure's ~7-day clock, and the row itself is inert either way. Stamped 'open' at init and never accepted from args: a caller who could re-open a completed session could drive complete twice. (enum: open, completed, abandoned) |
| `targetArtifactId` | string |  | The v1:library:artifact this session uploads a NEW VERSION of, when it is a supersede rather than a fresh upload (epic memql#4806, design D7). Empty is the ordinary case and means complete creates a file row; set means complete supersedes the artifact's existing one, and fileId above is then that EXISTING file's id rather than a fresh mint. Recorded at init because the three target gates -- the artifact resolves under the caller's actor, its kind is file, its backing row resolves -- run there, before anybody streams gigabytes; complete must not re-ask the client anything, least of all which artifact it is allowed to write to. |
| `uploadedFromPath` | string |  | Absolute path the file occupies on the uploading machine, as reported at init. Carried to file.uploadedFromPath at complete; the future sync epic keys on it. |
| `uploadedFromWorkerId` | string |  | Verified machine provenance, exactly as file.uploadedFromWorkerId documents (design D5): verified against the caller's own fleet at INIT -- fail-fast, before anyone streams gigabytes -- and forwarded to the file row at complete. |
| `uploadedFromWorkerName` | string |  | The fleet's own label for the machine, resolved from the caller's verified registration at init (displayName, else hostname). Empty whenever uploadedFromWorkerId is. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:library:folder`, `references` -> `v1:library:file`, `references` -> `v1:library:artifact`, `references` -> `v1:worker:registration`

## `v1:library:watchedFolder`

One folder on one of the owner's fleet machines, continuously backed up into a Library folder (epic memql#4783, the cockpit half memql#4841). The engine holds the arrangement and the state last reported about it; the cockpit does the sweeping, the pushing and the looking-at-the-origin, because it is the only party that can see the origin at all. Per-row authz: the composite tier (memql#4312) -- the owner, or a cluster owner -- matching every other Library concept, so an operator answering "why has this machine stopped backing up" can read the arrangement without being able to rewrite it.

| Field | Type | Required | Description |
|---|---|---|---|
| `archived` | boolean |  | Soft delete: the watch is taken out of the list without destroying the record of what was arranged. Spelled and filtered exactly as its siblings are -- `archived != true`, the null-safe form, so rows written before any future field change keep listing (memql#1685). ARCHIVING A WATCH REMOVES NOTHING THAT ARRIVED THROUGH IT: the files are ordinary Library files owned by the same person, and the one-way invariant does not stop applying because the arrangement ended. |
| `bytesSeen` | integer |  | Total size in bytes of those files at the origin. Same reason and same absence as filesSeen; rendered alongside it so 'watching 1,284 files, 42.1 GB' is one sentence about the origin rather than a claim about the copy. |
| `excludeGlobs` | array |  | Path patterns beneath localPath that are skipped, matched by the cockpit against each entry's path RELATIVE to localPath ('node_modules/**', '*.tmp'). Client-side and cockpit-side only: the engine stores the list and never evaluates it, having nothing to evaluate it against. Empty or absent excludes nothing. |
| `filesSeen` | integer |  | How many files the last sweep found beneath localPath, after exclusions. The origin's own count, which nothing else in the graph can answer -- the Library knows what ARRIVED, and the difference between the two is exactly what a person wants to see when a backup is behind. Absent on a watch nothing has reported yet. |
| `folderId` | string |  | v1:library:folder.id everything from this watch is filed under; empty or absent means the Library root. The DESTINATION, and the only part of the arrangement the person can see the contents of without leaving the browser -- which is why the Files app draws the watch as a link between two named ends rather than as a row of settings. Re-pointing it moves nothing that already arrived: files carry their own folderId, so a change here decides where the NEXT push lands, and the app says so at the moment of the change. |
| `includeHidden` | boolean |  | Whether dot-prefixed entries are swept. Off by default because the common case -- a Documents or a client-work folder -- is full of '.DS_Store' and editor state nobody wants versioned, and a backup that silently fills with them is one people turn off. |
| `lastSweepAt` |  |  | RFC3339 moment the cockpit last finished a pass over this folder. SERVER-STAMPED by reportWatchedFolderSweep rather than accepted from the report, for exactly the reason file.linkCheckedAt is: a caller that could name its own check time could claim to have looked when it did not, and the whole value of this field is that it is what makes a stale `ok` honest -- 'backed up, last checked 3 weeks ago' is a different claim from 'backed up'. Rendered CONTINUOUSLY beside the state and never fingerprinted into an arrival cue: a sweep touches this on a schedule forever, so naming it as news would strobe the list on the sweep's own cycle (the heartbeat rule, clients/os/README.md). |
| `lastSweepError` | string |  | What went wrong on the last pass, in the cockpit's own words, when something did. Empty on a clean pass. Shown verbatim rather than re-worded: the sentence names a path, a permission or an HTTP status the person can act on, and a friendlier paraphrase would lose the only part that helps. |
| `localPath` | string | yes | Absolute path of the folder ON THAT MACHINE, as the person typed it -- '/Users/ana/Clients/2026' or 'C:\Work\Renders'. A string the engine never interprets: it has no filesystem to resolve it against, cannot tell a typo from a folder that is merely offline, and must not pretend otherwise. The cockpit is what finds out, and it says so through originState below. Also the PREFIX half of the (machine, path) key every re-push versions on -- each file's own uploadedFromPath is this path plus its position beneath it. |
| `originState` | string |  | What the cockpit last SAW at localPath -- the folder-level counterpart of file.linkState, and it has the same absent-is-not-a-state discipline: ABSENT means no cockpit has reported yet, which is a genuine further answer ('waiting for that machine to check in') and must not read as ok. `missing` = nothing is at that path, which is the honest answer to a typo AND to a folder somebody moved, and the engine deliberately cannot tell those apart. `unreadable` = it is there and the process cannot read it (permissions, a TCC prompt nobody answered, an unmounted volume). `refused_by_policy` = THE MACHINE'S OWN OWNER HAS NOT ALLOWED THAT PATH, and it is a separate value rather than a flavour of unreadable because the repair is completely different and lives somewhere else: nothing about the folder is wrong, and no amount of looking at the Library will fix it -- somebody has to add the path to that machine's policy.yaml. Collapsing it into `unreadable` would send a person hunting for a permissions problem that does not exist. THE VETO IS THE POINT: this row is written from a browser and read by a cockpit, so the path in it is a path the CLUSTER is naming on somebody else's machine -- the same situation appsession's CheckWorkspace exists for, and the same answer. A watch is a request; the machine decides. No @default on the field, for the reason knowledgeDomain.tier records: nothing stamps a value at create, and an annotation nothing applies is a silent no-op. (enum: ok, missing, unreadable, refused_by_policy) |
| `ownerUserId` | string | yes | v1:identity:user.id that set this watch up. Stamped from actor.userId on every write and never accepted as a mutation arg (@serverSet makes that a load-time rejection, memql#3175). The load-bearing per-row authz key, and also the routing key: a cockpit signed in as this user is the only one that will ever read this row. |
| `status` | string | yes | Whether the cockpit should be sweeping this folder right now. `paused` is a real state a person wants -- 'stop for today, keep the arrangement' -- and is deliberately not modelled as archived: pausing is reversible in one click and keeps the watch in the list, archiving takes it out of it. The cockpit reads both and skips paused ones; it does NOT delete its local record of a paused watch, so resuming does not re-push everything. (enum: active, paused) |
| `workerId` | string | yes | v1:worker:registration.id of the machine that does the watching. Deliberately NOT verified against the caller's fleet at write time -- the row is a preference and the gate that matters is at the upload, where verifyProvenance resolves the claimed machine in the caller's own fleet and refuses anything else (see the header). A watch naming a machine the owner does not have is read by no cockpit and pushes nothing. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:worker:registration`, `references` -> `v1:library:folder`

## `v1:memory:belief`

A durable, distilled belief consolidated from episodic memory (#586) -- a stable fact, preference, or learned outcome the agent should keep across plans. The `content` field is the embedding text: the consolidation + embedding loop stores it into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'), mirroring v1:harness:observation and v1:knowledge:documentChunk, so semantic memories are themselves similarTo-recall-able -- both for the recall path (#585) and for the dedup step of consolidation itself (before writing a new belief, similarTo against existing semanticMemory rows; reinforce the match instead of duplicating). Provenance is the killer feature: `sourceEpisodes` links every belief back to the episodic node ids that formed it, so a belief is always auditable. `confidence` rises on reinforcement and decays when a belief goes unreinforced; `lastReinforced` is the decay clock. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time; only the owner reaches their own beliefs.

| Field | Type | Required | Description |
|---|---|---|---|
| `confidence` | number | yes | How strongly the belief is held, in [0,1]. Rises on reinforcement (a later run distilled the same belief again -- the reinforce mutation takes the new value, computed engine-side, since the MemQL parser has no arithmetic) and decays when the belief goes unreinforced (the decay mutation takes the decayed value, computed engine-side, from lastReinforced age). Beliefs that decay below MEMQL_HARNESS_CONSOLIDATION_PRUNE_CONFIDENCE are pruned, keeping recall sharp. |
| `content` | string | yes | The natural-language statement of the belief -- the embedding source, so semantic memories are similarTo-recall-able. The consolidation + embedding loop stores this into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'). Used by BOTH the recall path (#585) and consolidation's own dedup step (similarTo against existing beliefs before writing a new one). Mirrors the v1:work:observation / v1:knowledge:documentChunk content-as-embedding pattern -- the vector lives in node_vectors keyed by node id, not inline on the row. |
| `embedding` | array |  | The semantic embedding vector for `content`, populated lazily by the consolidation / embedding loop when an inline copy is wanted alongside the canonical node_vectors entry. Until set, dedup + recall read the node_vectors row keyed by this memory's id directly. Carried on the concept per the #586 sketch's @embedding field. |
| `kind` | string | yes | What flavor of belief this is. fact = a stable truth about the user / domain / world the agent learned ('the user's primary repo is memql'). preference = a stated or inferred preference ('the user prefers terse answers'). outcome = a learned result of trying something ('approach Y failed twice for task Z' / 'tool T reliably solves problem P'). Drives how the recall path (#585) weights and presents the belief. (enum: fact, preference, outcome) |
| `lastReinforced` | string | yes | When this belief was last created or reinforced -- the decay clock. The decay sweep measures age as now - lastReinforced; beliefs unreinforced past MEMQL_HARNESS_CONSOLIDATION_DECAY_DAYS lose confidence, and ones that fall below the prune floor are removed. Reset to now on every reinforcement. |
| `ownerUserId` | string | yes | v1:identity:user.id of the belief owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Consolidation runs per owner, so a belief only ever draws on -- and is only ever recall-able by -- its owner's own episodes. |
| `provenanceMutation` | string |  | Name of the mutation that produced this belief version (createMemoryBelief / reinforceMemoryBelief / decayMemoryBelief / pruneMemoryBelief). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `reinforceCount` | integer | yes | How many consolidation runs have distilled this belief. Starts at 1 (the run that created it); the reinforce mutation takes the bumped value (computed engine-side). A high reinforceCount is independent corroboration -- a belief seen across many runs is more trustworthy than a one-off. |
| `sourceEpisodes` | array | yes | Provenance: the episodic node ids (v1:work:observation, v1:work:step, v1:work:run) this belief was distilled from. Every belief traces back to its evidence, so it is always auditable -- the killer feature of doing consolidation in-graph. Reinforcement appends the new run's contributing episodes (deduped) so the provenance grows as evidence accumulates. |
| `status` | string | yes | Belief lifecycle. active = a live belief the recall path returns. pruned = decayed below the confidence floor and retired; the row is kept (append-only model) but filtered out of recall and dedup. Soft-delete because MemQL has no row-removal mutation -- mirrors the safety / platform retention crons. (enum: active, pruned) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:memory:consolidationCursor`

The per-owner consolidation watermark (#586), stored as a node so the consolidation loop's bookkeeping is itself durable + queryable -- no separate cursor store. Holds the createdAt boundary of the most recent episodic batch already consolidated for this owner; each scheduled run reads only episodes with createdAt > watermark, then advances the watermark to the newest episode it processed. This is what makes consolidation INCREMENTAL: cost is bounded by the new-episode delta, not total history, as the agent's log grows without bound. One row per owner (content-addressed id on ownerUserId), updated in place. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time.

| Field | Type | Required | Description |
|---|---|---|---|
| `episodesSeen` | integer |  | Running count of episodic nodes consolidated for this owner across all runs. Diagnostic only -- lets an operator see consolidation throughput per owner. The reinforce/advance mutation takes the bumped value (computed engine-side, since the parser has no arithmetic). |
| `lastRunAt` |  |  | When consolidation last ran for this owner. Diagnostic / observability only -- the watermark (not this) is the correctness-bearing field. Useful for spotting an owner whose consolidation has stalled. |
| `ownerUserId` | string | yes | v1:identity:user.id this cursor belongs to. The per-row authz key (owned tier); stamped from actor.userId at create time. One cursor row per owner -- consolidation is per-owner, so each owner's watermark advances independently. |
| `provenanceMutation` | string |  | Name of the mutation that produced this cursor version (advanceMemoryConsolidationCursor). Pairs with the engine-stamped createdBy intrinsic to name the transition in the audit trail. |
| `watermark` | string | yes | The createdAt of the newest episodic node already consolidated for this owner. The next run reads episodes with createdAt > watermark only; advancing this after each run is what bounds consolidation cost incrementally. Set to the engine-computed max(createdAt) over the batch the run processed. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:models:modelProfile`

A curated model the catalog recommends, by category and machine class.
TIER: public, requiresIdentity. Any signed-in person reads it. The Fleet models surface has to say what this fleet COULD run before anybody has pulled anything, and a catalog narrowed by owner would show a new operator an empty page with no way to tell that from "nothing is recommended". There is nothing here to protect: every row is a public model id and a published size.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | False once an operator removed their entry. A soft delete, because the row is the record that somebody added this id and then took it out again; a hard delete leaves the next operator asking the same question with nothing to read. Separate from `unavailable` on purpose -- that one is about the world (the runtime stopped serving the id), this one is about the operator's list. |
| `category` | string | yes | What the model is FOR. Streaming is deliberately absent and is a flag instead: it is true of models in every category, and a category for it would put one model in two rows -- the exact shape the vendor provider records are losing in this epic. `vision` is a category for a model whose PURPOSE is seeing; a text model that can also see carries the flag and stays in `text`. (enum: text, reasoning, omni, vision, audioIn, audioOut, imageGen, videoGen, embeddings) |
| `contextWindow` | integer |  | The catalog's context ceiling in tokens, which may be capped below the model's published maximum. The working context used for the resident-memory allowance is documented separately in the seed notes. Actual routing eligibility comes from the runtime's advertised context. Zero means not stated. |
| `curated` | boolean |  | False for an entry an operator added by id. A curated entry is a release-time act re-seeded on every boot; an operator's entry is theirs and is not re-seeded, which is also why modelProfileRemove refuses a curated row -- removing one is a lie the next restart undoes. |
| `dimensions` | integer |  | Vector width, for an embeddings entry; zero for every other category. This is the field that makes the embedder binding's width a fact about the PROVIDER rather than a constant in the schema (memql#5142), so an embeddings entry without it is refused by the seed gate -- a binding cannot create its table without knowing the width. |
| `family` | string |  | The model family (qwen3.5, gemma4, gpt-oss), for grouping on a page. Not parsed from modelId: the tag's shape is the runtime's business and has changed before. |
| `flags` | array |  | What the MODEL can do, as the subset of {structured, tools, thinking, vision, audioIn, audioOut, imageGen, streaming} that is TRUE. A LIST rather than an object of booleans, and absence rather than false, for the same reason the registration label omits a flag it does not advertise: the two vocabularies are deliberately the same eight words, and making the two spellings the same shape is what lets the Fleet page compare a profile against a machine without translating. A model listing a flag and a machine not advertising it is the ORDINARY case -- the runtime behind an endpoint is half of every one of these capabilities. |
| `license` | string |  | The weights' licence (apache-2.0, mit, gemma, qwen). Recorded because a person choosing what to run on hardware they own is entitled to know what they are agreeing to, and because two entries in one category can differ on exactly this. |
| `measured` | object |  | Empty until epic memql#5146. Measured throughput and quality with provenance. The catalog ranks nothing on it this release, and an empty object here is 'nobody has measured this', never 'it measured zero'. |
| `memoryNeedBytes` | integer |  | The catalog's resident-memory allowance at the working context and quantization documented in the seed notes, including weights, KV cache and runtime buffers. Curation records estimates and measurement provenance with the seeds; this is a budget, not a promise of free memory on a machine. Zero means not estimated. minMachineClass decides where a model is offered, and the curated set must fit that class's combined budget. |
| `minMachineClass` | string | yes | Gigabytes of unified memory or VRAM below which this model does not run usefully. A machine's recommended set is every profile whose class it meets. A declared floor rather than a computed one: the computation needs a measurement nobody has taken yet, and a floor that is wrong in the permissive direction is a model that swaps to disk on somebody's laptop. (enum: 16, 24, 32, 64, 128) |
| `modelId` | string | yes | The runtime's own id, byte-identical to what a machine advertises as `model:<id>` -- an Ollama tag (qwen3.5:9b) or hf.co/<owner>/<repo>. A catalog hit is therefore a string equality and never a fuzzy match, which is what stops qwen3.5:9b and qwen3.5:9b-q4 from being read as one model. NOT the row id: a tag carries ':' and '/', and the canonical row id is {concept}:{shortId}, so the row id is a slug of this and this is the field everything compares on. |
| `notes` | string |  | One sentence for an operator: what this entry is the best pick FOR. The catalog is a recommendation and a recommendation with no reason is a preference. |
| `offeredOn` | array |  | macos \| linux. A videoGen entry is linux-only and SAYS so, rather than being absent on a Mac and unexplained -- the third of the three reasons the Fleet page gives for a profile this fleet cannot serve. |
| `params` | integer |  | Parameter count expanded to a number (9B -> 9000000000). Zero means the publisher did not state one -- an ORDERING signal, never a capability gate, the same rule fleetModel.params follows. |
| `quant` | string |  | The quantization the recommended tag carries (Q4_K_M, Q8_0, MXFP4). Precision breaks recommendation ties between otherwise equal parameter counts, so larger memory classes can choose the higher-precision tag without inventing a different parameter count. |
| `recommendedFor` | array |  | Levels this model is a good answer for: fast \| strong \| reasoning \| embeddings. EMPTY means listed and recommended for nothing, which is how videoGen is honest: the catalog names those models so an operator can see they exist and were considered, and recommends them nowhere. |
| `runtime` | string | yes | Which runtime serves it. A machine lacking the runtime cannot pull the model at all, which is one of the three reasons the Fleet page gives for a profile this fleet cannot serve. The set is closed because each value is a thing the cockpit knows how to install; a runtime nobody installs is not a recommendation. (enum: ollama, mlx, whispercpp, nemo, kokoro, mflux, comfyui) |
| `sizeBytes` | integer |  | Download size of the recommended tag as the library reported it on the day of seeding. Zero means it was not stated there -- and a zero is left as a zero rather than estimated, because a made-up download size is indistinguishable on a page from a measured one. |
| `source` | string |  | URL of the library or vendor page this entry was verified against, on the day it was seeded. Curation is a release-time act and this is its receipt. |
| `unavailable` | boolean |  | Set when a pull failed because the runtime no longer serves the id. The row STAYS and says so rather than vanishing: curation is a release-time act, and a catalog entry that disappeared answers 'why can I not pull this' with silence. |

## `v1:notes:note`

A user-owned standalone note: an optional title, a body, and tags, plus an updatedAt watermark. The standalone notebook concept -- distinct from the product pack's canvas-state note caption field. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | yes | The note's freeform text content. The substring search operation matches against this field. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this note. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `tags` | array |  | Optional list of user-supplied tags for grouping / filtering. The frontend renders these as chips; the search tool can narrow by a single tag. |
| `title` | string |  | Optional short title / heading for the note. Absence is allowed -- a note can be body-only. The primary display field when present. |
| `updatedAt` |  |  | RFC3339 watermark of the most recent edit. Stamped to `now` on every create / update so the frontend can sort by recency. The authoritative version order is still the row's createdAt history; this is a denormalized convenience for the most-recent version. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:observability:codeMetric`

Aggregate observability rollups for a code reference over a time window. Backed by TimescaleDB continuous aggregates over the code_invocation hypertable -- callCount, p50/p95/p99 durations, errorRate -- so the cockpit's drill-down sparkline can query the metric for any (codeReference, kind, window) in O(few rows) regardless of how many raw invocations the function had. Aggregates outlive raw rows: when codeProfile.retentionDays evicts the underlying invocation chunk, the matching codeMetric rows for that chunk are preserved by the policy so the trendline stays continuous.

| Field | Type | Required | Description |
|---|---|---|---|
| `bucket` | string | yes | Bucket size identifier. Mirrors the continuous-aggregate view used to produce the row, kept as a field so consumers don't have to math out the diff. (enum: 1m, 1h) |
| `callCount` | integer | yes | Number of invocations in [windowStart, windowEnd). |
| `codeReference` | string | yes | Fully-qualified node id. Same join key as codeProfile / invocation. |
| `errorCount` | integer | yes | Subset of callCount where errorMessage was non-empty. |
| `errorRate` | number |  | Convenience: errorCount / callCount, populated by the materialization step. Consumers can compute it themselves if the row was hand-inserted. |
| `p50DurationNs` | integer |  | 50th-percentile latency in nanoseconds across the bucket. |
| `p95DurationNs` | integer |  | 95th-percentile latency. |
| `p99DurationNs` | integer |  | 99th-percentile latency. Same scale as p50/p95. |
| `totalDurationNs` | integer |  | Sum of all durations in the bucket. Lets cockpit show 'time spent in X' on the topology overlay without pulling raw rows. |
| `windowEnd` | string | yes | Exclusive end. windowEnd - windowStart is the bucket size; cockpit reads bucket size from the difference rather than from a separate field. |
| `windowStart` | string | yes | Inclusive start of the aggregation window. Matches a TimescaleDB time_bucket boundary -- typically 1m or 1h aligned. |

## `v1:observability:codeProfile`

Live per-function observability configuration. Created on demand: a function only has a codeProfile row when someone wanted to set a non-default level on it (incident response, hot path under investigation, etc.). Resolution at call time is codeProfile -> MEMQL_OBSERVE_LEVEL default -> off. Keyed by codeReference, which matches the model.Node.ID for the Method or Func node in topology.model.json (e.g. 'method:github.com/znasllc-io/memql/component/auth.(*Handler).Login'). Cockpit writes these from the drill-down 'bump verbosity for this method' control; the observe runtime reads them through a CDC-driven cache.

| Field | Type | Required | Description |
|---|---|---|---|
| `codeReference` | string | yes | Fully-qualified node id from the architecture model. Format documented in component/architecture/model/ids.go. The single join key shared by static topology, live profile, raw invocations, and aggregate metrics. |
| `expiresAt` |  |  | Optional automatic-off timestamp. The codeProfileExpiry cron flips level back to 'off' when now > expiresAt. Lets the cockpit say 'bump to verbose for the next hour' without leaking a hot-path tap into the steady state. |
| `level` | string | yes | Capture verbosity. off = not instrumented. count = duration + error only. meta = + arg types/sizes. verbose = + full arg/return values, subject to redaction. (enum: off, count, meta, verbose) |
| `reason` | string |  | Free-text rationale for non-default levels. Surfaces in the cockpit list view so you can audit 'why is this method being captured at verbose?' at a glance. Example: 'INC-2026-05-14 -- intermittent 500s. |
| `redactArgs` | array |  | Names of arguments to force-redact regardless of value. The default redact-by-name pattern catches obvious cases (pass*, token*, secret*); use this to pin individual params that don't match the pattern. NOTE: a //memql:observe source marker on the function declares the SAFE list (its inverse); when both exist, redactArgs here wins. |
| `retentionDays` | integer |  | How long the resulting code_invocation hypertable rows survive before the retention policy drops them. Aggregates (codeMetric rollups) outlive this -- the trendline is preserved, the forensic detail is short-lived. Convention: 7 -- NOT applied on insert, and no mutation is bound to this concept, so a writer must supply it. |
| `sampleRate` | number |  | Fraction of calls to capture at the chosen level. 1.0 = every call (verbose locally / on incident). 0.01 = 1% (verbose-in-prod sampling). The runtime's PRNG draws once per call. Convention: 1.0 -- NOT applied on insert, and no mutation is bound to this concept, so a writer must supply it; an absent value reads as 0.0, which captures nothing. |
| `setBy` | string |  | v1:identity:user.id of the user who applied this profile. Empty for env-bootstrapped rows. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:observability:invocation`

One captured invocation of a Method or Func. Backed by the code_invocation TimescaleDB hypertable (see scripts/dev/migrations/observability/); rows are time-partitioned, jsonb-compressed after 24h, and dropped per codeProfile.retentionDays. The mutation surface goes through the engine like any other concept so the engine's auth + partition middleware applies uniformly, but the read path on the hot drill-down view is intended to use the continuous aggregates (codeMetric) rather than these raw rows. Hand-querying invocation rows directly is fine for forensic 'last 20 calls to X' lookups.

| Field | Type | Required | Description |
|---|---|---|---|
| `arguments` | object |  | Captured arguments shaped per codeProfile.level: count -> nil, meta -> name -> shape-string (e.g. 'string(len=42)'), verbose -> name -> value. Redacted entries appear as '<redacted>'. Authoritative redaction rules live in component/observe/helper.go. Spelled out in full because `args` is a reserved engine namespace and cannot be a payload property (memql#3613); the backing column is still code_invocation.args. |
| `codeReference` | string | yes | Fully-qualified node id of the Method/Func that ran. Join key shared with codeProfile and codeMetric. |
| `durationNs` | integer | yes | End - start in nanoseconds. Recorded as an integer to keep the column type SQL-friendly; cockpit renders as ms. |
| `errorMessage` | string |  | Empty on success. Captures the error.Error() text the caller deferred-Read at End(). Truncated server-side at 4KB. |
| `level` | string | yes | Level the row was captured at. Echoed onto the record so a consumer reading the hypertable can tell 'this is a meta-level row, args are shape strings not values' without consulting the profile. (enum: count, meta, verbose) |
| `occurredAt` | string | yes | Wall-clock time when the call started. The hypertable time column. |
| `result` | object |  | Captured return value at verbose level only; nil otherwise. Same redaction rules as arguments -- a Result tagged for redaction at the call site never lands here verbatim. |
| `spanId` | string |  | Span id within traceId. Same source as traceId. |
| `traceId` | string |  | Distributed-trace identifier when the caller's context carried one (set via observe.SetTraceExtractor). Lets the cockpit cross-link an invocation row to the corresponding span in any OTel-compatible viewer. |

## `v1:observability:logLine`

One persisted log line from any node type or from the MemQL OS front end (epic memql#4893). Backed by the log_line TimescaleDB hypertable (component/database/memory-nodes/migrations/20260903000000_log_line_hypertable), written by the store sink core/logger installs beside every node's console handler and by logsRecordClient for OS lines, and NEVER a graph row: like invocation, this concept declares the table's shape and nothing maps a field to a column. Rows are read through the @sdk builtins in builtins.memql (logsSearch, logsTail, logsSources), all floored at admin in their Go handlers, which is why the concept declares no row tier -- no row of it ever passes graph admission. Retention is the nightly logsRetentionSweep automation: archive to blob storage first, delete second, thirty days by MEMQL_LOGS_RETENTION_DAYS. `subject` plus `subjectConcept` is the one seam between a line and the thing it is about (a deployment, a site, a plan); logger.Subject stamps both. Design: docs/superpowers/specs/2026-09-03-logs-design.md.

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | string |  | The OS app id for an OS line (`files`, `deployables`); blank for an engine line. The per-app Logs section selects on it. |
| `attributes` | object |  | Every other attribute the line carried, already through the console redactor, keys dotted for groups. Never holds a `payload` or `body` key: those are redacted before they get here. |
| `component` | string | yes | The logger's component attribute, dotted parent.child (`edge`, `packages.pipeline`). An OS line carries `os.<app>` or `os.shell`. |
| `level` | string | yes | The slog level. `debug` persists only on a node whose MEMQL_LOGS_LEVEL says so. (enum: debug, info, warn, error) |
| `message` | string | yes | The line's message, capped at 4 KiB. |
| `node` | string |  | MEMQL_NODE_ID of the writing replica (the pod name). Blank for an OS line, which has no node. |
| `nodeType` | string | yes | Which kind of process wrote it. `os` is the MemQL OS front end, whose lines arrive through logsRecordClient. (enum: identity, bff, agent, planner, workbench, mcp, edge, os) |
| `occurredAt` | string | yes | When the line was written. The hypertable time column; createdAt on the wire. |
| `session` | string |  | The OS tab session that wrote an OS line (`os-<shortId>`, minted once per tab and kept in sessionStorage). A correlation key, never an authority; blank for an engine line. |
| `subject` | string |  | Bare id of what the line is about -- a deployment, a site, a plan -- stamped by logger.Subject. Blank when the line is about nothing in particular. |
| `subjectConcept` | string |  | The concept id of `subject` (`v1:platform:site`). An app's slice of the store is `app` OR any of the concepts the app owns. |
| `userId` | string |  | v1:identity:user.id of the person whose browser wrote an OS line, stamped server-side from the actor and never accepted from the caller. Blank for an engine line. |

**Relationships:** `references` -> `v1:identity:user`

## `v1:observability:siteTraffic`

One bucket of one deployable's traffic, folded from the edge's request log (epic memql#4906, the Run epic of the Deployables program). A DECLARATION OF A RELATION'S SHAPE, the `invocation` and `codeMetric` precedent: rows live in the edge_request_1m / _1h aggregates TimescaleDB maintains, never in the graph, and reach a client as synthetic nodes from `siteTrafficInWindow`. Nothing maps a field here to a column; the mapping is component/sitetraffic's.
AN ABSENT ROW IS THE UNMEASURED ANSWER. A window nothing recorded produces NO ROW for that deployable, and a window with requests and no errors produces a row whose errorCount is 0 -- "nobody visited" and "we were not recording" send a person to two different places, which is the same rule campaignStats states about a unique-open count it could not measure.
windowEnd - windowStart says whether a row is a BUCKET or a SUMMARY: a bucket's span is the bucket size and a summary's is the window the caller asked for. Read the span rather than looking for a flag, which is codeMetric's own convention.

| Field | Type | Required | Description |
|---|---|---|---|
| `bucket` | string | yes | Which aggregate the row came from. A minute bucket answers an hour-long window; an hour bucket answers a day or a week, because a week of minute buckets is ten thousand rows to draw one line. (enum: 1m, 1h) |
| `bytesTotal` | integer | yes | Response bytes served in the window, as counted through the edge's own writer. A hijacked connection (a WebSocket through the API proxy) contributes 0, because its bytes leave through the raw connection -- an undercount that is named rather than guessed at. |
| `clientErrorCount` | integer | yes | The 4xx subset: somebody asking for a page this deployable does not have. Worth showing beside the 5xx count and never instead of it. |
| `errorCount` | integer | yes | The 5xx subset: the deployable failing. Counted apart from clientErrorCount because folding the two together makes a healthy site with a broken inbound link look unhealthy. |
| `lastServedAt` |  |  | The newest request in the window. ABSENT rather than zero when the relation answered no timestamp: a zero datetime renders as the year 1, which is a worse answer than none. |
| `requestCount` | integer | yes | Requests the edge served for this deployable in the window, whatever the outcome -- including the ones it refused to serve because the deployable was paused or in draft. A request to a deployable is a request to it. |
| `siteId` | string | yes | The v1:platform:site this traffic belongs to, as a BARE id -- what the edge stamped on the rows and what a client sends. Authorization is this deployable's own: a caller reads its traffic exactly when they may read it, checked through siteById / sitesAll under their actor. |
| `windowEnd` | string | yes | Exclusive end. Half-open, so two adjacent windows add up rather than double-counting the instant they share. |
| `windowStart` | string | yes | Inclusive start of the row's window, aligned to the bucket boundary for a bucket row and to the caller's own window for a summary row. |

## `v1:os:desktop`

One person's MemQL OS desktop: their desks, the items and folders on each, their dock pins and their theme -- the document `DesktopStore` loads and saves, kept where their other machines can resolve it.
TIER: the plain owner tier, deliberately WITHOUT `clusterOwner`. Every other owner-tier concept in this tree pairs the two because an operator has to support the person -- "why is this workbench node full", "why did this call route there". A desktop layout answers no such question; it is where somebody put their icons. The composite would let a cluster owner read it and buy nothing, so this concept is one of the few places the plain form is the right one.
There is no `deleted` / `active` field and no delete path. A person who wants their desktop back to nothing rearranges it, and the next save carries that; a row that can be absent would make "no desktop yet" and "desktop emptied" the same state to a reader that has to tell them apart.

| Field | Type | Required | Description |
|---|---|---|---|
| `document` | object | yes | The whole DesktopStore document: `version`, desks, the per-desk surfaces (items, folders, widget placements, grid positions), dock pins and the theme pack. OPAQUE HERE ON PURPOSE -- the shape and its invariants live in clients/os/src/system/store.ts, which is the only thing that reads it. `document.version` is the client's own schema generation; the engine never parses it. |
| `ownerUserId` | string | yes | v1:identity:user.id whose desktop this is. THE ROW-AUTHZ OWNER FIELD, stamped from actor.userId by saveMyDesktop and never accepted from caller args -- @serverSet makes that a load-time rejection rather than a convention. It is also the whole of the row's identity: the row id is derived from it, so this field and the id can never disagree. |
| `revision` | integer | yes | The last-writer-wins stamp. A client writes `held + 1`, so a save carries evidence of which document it was made from. It is NOT a lock: two machines saving from revision 5 both write 6 and the second one wins, which is the model this epic chose (the conflict UX is a cue, not a merge editor). What it buys is that a client can tell a row it has already seen from one it has not, and can refuse to adopt a document older than the one it holds. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:planner:responsibility`

A user-authored standing directive aimed at an agent (epic #631 / program #629). Three archetypes discriminated by `trigger`: REACTIVE (a `condition` is evaluated against incoming signals; fires when it matches -- e.g. 'when a customer escalation mentions a refund, draft a reply'), STANDING (a behavioral always-on directive with no schedule or condition -- e.g. 'always keep the project tracker tidy'), and RECURRING (a cron `schedule`; the old standingTask -- e.g. 'every Monday 9am summarize last week's marketing performance'). Per-user; the optional scopePartitionId pins the directive to one space. Consumed by the reactive-loop epic #632 (dueResponsibilities feeds the heartbeat-driven evaluator; recordResponsibilityEvaluation closes the loop). Replaces the retired standingTask concept -- recurring directives carry the same cron schedule + soft-disable + last-run bookkeeping standingTask had.

| Field | Type | Required | Description |
|---|---|---|---|
| `assignedAgentId` | string |  | v1:agents:agent.id of the agent that runs this responsibility, when targetKind names a concrete agent. The agent's domains/keywords/tools are what's available during execution. |
| `assignedRoleSlug` | string |  | Role slug the directive targets when bound by role rather than a concrete agent instance (e.g. 'marketing-analyst'). Resolved to an agent at dispatch time. |
| `condition` | object |  | Match condition for trigger='reactive' -- the structured predicate the evaluator checks incoming signals against (e.g. {kind:'utterance', contains:['refund','escalation']}). Empty/null for standing + recurring. |
| `enabled` | boolean |  | When false the evaluator/runner skips this responsibility. Soft-disable without archiving. |
| `intakeRequest` | object |  | The 0-2 genuinely-ambiguous clarifying questions the responsibilityIntake prompt emitted (issue #637). Shape mirrors Plan.feedbackRequest: {questions:[{id, question, kind:'choice'\|'text', options?:[{label,value}]}], askedAt}. Empty when intake was clear. The frontend's intake card renders these; the user's answers come back through foldResponsibilityIntakeAnswers. |
| `intakeResponse` | object |  | The user's answers to intakeRequest, folded back by foldResponsibilityIntakeAnswers (issue #637): {answers:[{id, answer}], respondedAt}. Carried for audit; the dispatcher uses it to re-infer the final field set before flipping the row to active. |
| `intakeStatus` | string |  | Intake lifecycle (issue #637). Empty = intake has not run yet (freshly created draft). pending = the intake dispatcher claimed this row and is reasoning. awaitingAnswers = intake produced 1-2 clarifying questions on intakeRequest and is parked until the user answers (mirrors the Plan awaitingFeedback surfacing). clear = intake found the statement unambiguous (no questions) -- the row goes straight to status='active'. applied = the user's answers were folded back via foldResponsibilityIntakeAnswers and the row was activated. Distinct from status so the management UI can show 'needs a quick answer' without overloading the draft/active lifecycle. (enum: , pending, awaitingAnswers, clear, applied) |
| `lastEvaluatedAt` |  |  | Last time the evaluator/runner fired this responsibility (reactive: last condition check; recurring: last scheduled tick; standing: last review). Empty means it has never run. Set by recordResponsibilityEvaluation. |
| `lastResult` | string |  | Headline of the most recent evaluation/run's result. UI surface for 'last output' widgets. Set by recordResponsibilityEvaluation. |
| `notifyHow` | string |  | How the run's output reaches the user (epic #631 / issue #637 intake). Free text inferred by the responsibilityIntake prompt -- e.g. 'a chat message in the daily space', 'a notification the day before', 'silently update the tracker'. Empty until intake runs or the user supplies it. |
| `ownerUserId` | string | yes | v1:identity:user.id who authored this responsibility. Per-row authz owner; output posts into this user's surfaces. Server-stamped from actor.userId at create -- never caller-supplied. |
| `schedule` | string |  | Cron-style schedule string for trigger='recurring' (e.g. '0 9 * * 1' for Monday 9am). Empty/null for reactive + standing directives. |
| `scopePartitionId` | string |  | Optional pin to one product scope. When set, the directive only applies within that scope; when empty, it applies across the owner's work. |
| `statement` | string | yes | Human-readable directive the agent acts on (e.g. 'Every Monday morning summarize last week's marketing performance'). The user's words; shown on cards + settings UIs and fed into the agent's prompt at evaluation/run time. |
| `status` | string | yes | Lifecycle. draft = authored, not yet activated; active = live, evaluated/dispatched; paused = temporarily held (distinct from enabled=false which is a per-run skip); archived = retired, hidden from active lists. Transitioned via setResponsibilityStatus. (enum: draft, active, paused, archived) |
| `successCriteria` | string |  | How the user (or evaluator) judges a run as successful -- free text the agent's prompt and the evaluation record use to decide lastResult quality. |
| `targetKind` | string | yes | Who carries out the directive. assistant = the user's General Assistant; specialist = a named specialist agent (assignedAgentId / assignedRoleSlug); unassigned = no agent bound yet (drafted, awaiting assignment). (enum: assistant, specialist, unassigned) |
| `trigger` | string | yes | Archetype discriminator. reactive = fires when `condition` matches an incoming signal; standing = always-on behavioral directive (no schedule, no condition); recurring = cron-scheduled (the old standingTask). dueResponsibilities keys off this: recurring rows are due when `schedule` ticks, reactive rows are due when pending evaluation. (enum: reactive, standing, recurring) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:agents:agent`

## `v1:platform:accountFrontDoor`

One account's reserved MemQL name, served (epic memql#5168, design D of the access program: docs/superpowers/specs/2026-09-08-per-account-front-door-design.md). A client whose own domain is acme.com reserves memql.acme.com through record A's domain walk, and this row is what turns that reservation into three hosts the cluster actually answers on -- app. for the OS shell, api. for the engine's API edge, id. for sign-in.
A NEW CONCEPT RATHER THAN FOUR MORE FIELDS ON THE ACCOUNT ROW, for customDomain's own reason: what a cluster serves at its front door is one DEPLOYMENT's fact, and v1:accounts:account sits on a rank-visible tier where a client-rank member can read it. The reservation belongs on the account (it is a fact about the client); the serving belongs here.
It reuses the custom-domain machinery end to end -- the same DNS resolver, the same six-value status ladder, the same one-transition-per-pass reconciler, the same capability-script provisioner -- and differs in exactly two ways. It checks POINTING ONLY, because record A's TXT walk already proved the parent domain and memqlReservedAt is stamped only on success; and its certificate names THREE hosts, which is what makes activation all-or-nothing without a rule to police (design D8).

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string | yes | The v1:accounts:account this door is served for. Required, and ONE LIVE ROW PER ACCOUNT: a second door for the same account is a second certificate order for the same three names, which spends a Let's Encrypt rate-limit unit to produce the same result -- and because every object is named after the ACCOUNT, the second door would apply the same five object names over the first's and then have them deleted underneath it by the first's unbind. WHERE THAT IS ENFORCED, precisely: the sweep drops an account from its work list the moment it sees ANY non-removed door for it (integrations/customdomain/accountdoor_reconcile.go, and TestAReservationThatAlreadyHasADoorOpensNothing). It is NOT a Go pre-insert guard -- an earlier version of this description said it was refused in account_domain_validation.go, which was never true: that file guards the account WRITE, and a door is created by the sweep. A pre-insert uniqueness guard is still worth having as the belt to the sweep's braces; it is not here yet, and this says so rather than implying otherwise. |
| `driftFailures` | integer |  | How many CONSECUTIVE re-checks a LIVE door has failed, and 0 otherwise. A live door's DNS is re-checked on a slow cadence and demoted to `verifying` after enough sustained failures -- because a door that went live and then had its app. host repointed elsewhere keeps serving, and worse, keeps its callback registered as an OAuth redirect URI. Without the re-check that is a credential-delivery primitive: repoint app.<reservedName> at a server you control, send somebody the cluster's own sign-in link naming that callback, and the auth code arrives at your server through a consent page showing this platform's own name. THE COUNTER EXISTS SO ONE DNS BLIP DOES NOT TAKE A CLIENT'S FRONT DOOR DOWN -- demotion needs sustained drift, not a single unlucky lookup. Reset to 0 by any passing re-check. |
| `failureDetail` | string |  | What the sweep or the bind script actually observed, verbatim -- the address a host resolves to, or cert-manager's own condition message while a certificate is issuing. The rail renders it beside failureReason, because the code says which stage and this says what is in the way. |
| `failureReason` | string |  | The TYPED reason the last attempt did not advance, or empty. dns_not_pointing, no_acme_issuer and issuance_failed today -- the custom-domain vocabulary minus dns_token_missing, which this concept cannot produce because it runs no ownership check of its own. Not an enum, for customDomain.failureReason's reason: a refusal the engine has never seen must still reach the row rather than being refused by its own schema. |
| `hostChecks` | object |  | What the last pass saw at each of the three hosts, keyed by role: { app: { ok, reason, detail }, api: {...}, id: {...} }. Activation is all-or-nothing (D8), so this does NOT gate anything -- it exists so the Accounts rail can name WHICH CNAME is still wrong rather than saying three names are not pointing and leaving an operator to test each one. Written on EVERY pass, including the ones that change nothing, for lastCheckedAt's reason. Keys are frontdoor.AccountRoles(), which is where the three labels are spelled. |
| `issuedAt` |  |  | When the certificate first became Ready and the door went live. Empty until then. |
| `lastCheckedAt` |  |  | When the sweep last looked. Written on EVERY pass, which is what makes 'checked 40 seconds ago, still not pointing' a different statement from 'nobody has looked'. Deliberately NOT in the rail's arrival-cue fingerprint: it moves on a timer, and fingerprinting it would turn the stop into a strobe (clients/os/README.md's heartbeat rule). |
| `removedAt` |  |  | When the unbind completed. Empty on every row that has not been removed; the pair with issuedAt is how long this cluster served the client's name. |
| `reservedName` | string | yes | The name this door serves beneath -- account.memqlDomain as it stood when the door was created, e.g. memql.acme.com. COPIED rather than read through the relationship, and that is the field's whole job: changing an account's domain CLEARS memqlDomain, the token and the verification (record A's resetAccountDomainOnChange), and the reconciler then has to tear down three hosts it can no longer name from the account row. A door that cannot say what it serves is one nothing can unbind. |
| `status` | string | yes | Where this door is on its walk -- the same six customDomain uses, deliberately, so one vocabulary, one panel grammar and one NonTerminal predicate cover both. pending_dns: created, nothing seen yet. verifying: at least one of the three hosts is not pointing here -- read hostChecks for which. issuing: all three point at the cluster and the bind script is applying the Certificate and the four Ingresses. live: the certificate is Ready and the three hosts answer. removing: the reservation is gone (design D9) and the unbind script is taking the objects away. removed: terminal, and the row stays -- the history is the audit. (enum: pending_dns, verifying, issuing, live, removing, removed) |
| `verifiedAt` |  |  | When all three hosts first pointed at the cluster. Empty until they do; never cleared by a later failure, because an issuance that fails afterwards does not un-prove that the records were created. |

**Relationships:** `references` -> `v1:accounts:account`

## `v1:platform:customDomain`

A client's own domain, bound to one of this cluster's deployables (epic memql#4805).
The row is the STATE MACHINE. Nothing else holds it: a scheduled sweep reads these rows, does two DNS lookups per non-terminal one, and writes back what it saw; when both checks pass it dispatches an idempotent capability script that applies the exact-host Ingress + Certificate pair. The engine gains NO Kubernetes client for any of it -- an in-engine client-go reconciler would be a second way to touch cluster objects beside the GitOps/script path, which is the exact thing environment-parity review rejects (design D2).
clusterOwner tier, for the reason v1:platform:packState and v1:platform:site's predecessor both carry it: what a cluster SERVES AT ITS FRONT DOOR is one deployment's fact. Certificate issuance and Ingress objects are cluster-level resources with real rate limits, so v1 automates what was already owner territory rather than widening it (D1). Widening is additive -- the v2 shape is a request-and-approve queue, and it needs no change here.
ROWS SURVIVE REMOVAL. `remove` walks the row to `removed`; nothing deletes. A binding that once existed is the audit trail of what this cluster was serving and when, and a deleted row answers no question anybody asks after an incident.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | PROVENANCE, not authorization. Which account this binding was made for, prefilled from the site's own account tie when one exists. Empty is the ordinary state on a cluster whose accounts epic has not landed: the panel degrades to free entry and the binding works identically. Nothing reads this to decide anything -- the tier above is the whole access story. |
| `failureDetail` | string |  | What the sweep or the bind script actually observed, in the words of whatever produced it -- the value found at the TXT record, the address the hostname resolves to, the capability envelope's error message. The panel renders it BESIDE failureReason, because 'dns_not_pointing' says which record and this says what is in it, and a person fixing DNS needs both. |
| `failureReason` | string |  | The TYPED reason the last attempt did not advance, or empty. Four values today -- dns_token_missing, dns_not_pointing, no_acme_issuer, issuance_failed -- rendered verbatim by the Domains panel, which is the whole reason the field is typed rather than prose: the panel has to name exactly WHICH record is still wrong, and a free-text sentence composed on the server cannot be keyed on. Not an enum, because a refusal the engine has never seen before must still reach the row rather than being refused by its own schema. |
| `hostname` | string | yes | The client's own fully qualified host, e.g. www.acme.com or acme.com. Cluster-unique across BOTH this concept and v1:platform:site -- the edge resolves one Host to one site, so a second live claim makes which site answers depend on row order. Three things it may NOT be, refused at create by component/memql/platform_custom_domain_policy.go: a hostname under the cluster's own domain (that is slug territory, and createSite already owns it), one of the front-door hosts (api / identity / mcp / os / the apex), or a claim past the per-site maximum. None of the three is expressible in a mutation body -- the domain comes from the environment, the maximum is env-tunable, and the collision needs a read. |
| `issuedAt` |  |  | When the certificate first became Ready and the row went live. Empty until then. |
| `lastCheckedAt` |  |  | When the sweep last looked. Written on EVERY pass including the ones that change nothing, which is what makes 'checked 40 seconds ago, still not pointing' a different statement from 'nobody has looked'. Deliberately NOT in the panel's arrival-cue fingerprint: it moves for every row on a timer, and fingerprinting it would turn the list into a strobe (clients/os/README.md's heartbeat rule). |
| `removedAt` |  |  | When the unbind completed. Empty on every row that has not been removed; the pair with issuedAt is how long this cluster served the domain. |
| `siteId` | string | yes | The v1:platform:site row this domain serves. Required: a custom domain with no deployable behind it is a hostname the edge would resolve to nothing, and the alias step reads exactly this field to answer a request. The relationship below is what canonicalizes it, so a client may pass the bare id. |
| `status` | string | yes | Where this binding is on its walk. pending_dns: created, nothing seen yet. verifying: at least one check has run and at least one is still failing -- read failureReason for which. issuing: both DNS checks passed and the bind script is applying the Ingress + Certificate. live: the certificate is Ready and the edge resolves the hostname to the site. removing: the unbind script is taking the pair away. removed: terminal, and the row stays. The sweep only ever touches a non-terminal row, so `live` and `removed` cost nothing per tick. (enum: pending_dns, verifying, issuing, live, removing, removed) |
| `token` | string | yes | The ownership token a client publishes as `TXT _memql-verify.<hostname>`. Minted at create. STORED IN PLAINTEXT and that is deliberate rather than an oversight: the whole point of the value is that DNS publishes it to the world, so hashing it would make the row unable to state the thing the guidance panel has to render. It proves control of the NAME, not of an account -- an attacker who reads it still has to publish it under a domain they do not own. |
| `verifiedAt` |  |  | When both DNS checks first passed. Empty until they do. Never cleared by a later failure -- an issuance that fails after verification does not un-prove control of the name, and clearing it would restart a walk that is already past that stage. |

**Relationships:** `references` -> `v1:platform:site`

## `v1:platform:dataOrigin`

Virtual projection of one concept's DATA-ORIGINS declaration (epic memql#4378): what MemQL's relationship to that concept's data is. Never persisted -- rows are produced at query time by the `dataOrigins` builtin from the live concept registry, the same shape as v1:router:modelCatalog. Lives in the concept registry so the engine can shape results without a database round-trip.
This is the INVENTORY half of the Data origins page. The HEALTH half -- backfill cursors, lag, drift counts, outbox depth -- is per-(concept, connector) operational state that accumulates over time and is a persisted row instead. Serving both from one place would make a staleness bug in either look like the other.

| Field | Type | Required | Description |
|---|---|---|---|
| `conceptId` | string | yes | Canonical id of the concept this row describes. Also the row id -- there is exactly one row per concept and the concept is what it is about. Named conceptId rather than concept because `concept` is a reserved row intrinsic; a payload field by that name is refused at load. |
| `connectors` | array |  | Every connector name this concept depends on -- its external origin plus every mirror target, sorted. Never contains "memql": MemQL is not a connector. This is the set the engine resolves at boot, and an unresolvable name refuses it. |
| `dataState` | string | yes | MemQL's relationship to this concept's data. mirror: an external system owns it and MemQL holds a faithful read-only copy. origin: MemQL owns it and pushes changes out to the systems in mirroredTo. native: MemQL owns it and nobody else has a copy. There is no fourth state -- two systems both authoring one domain is the option the model rejects. (enum: mirror, origin, native) |
| `mirroredTo` | array |  | External systems MemQL pushes this concept's changes out to. Empty unless dataState is "origin". |
| `origin` | string | yes | The system where changes to this concept are made. Never empty: a concept that declared nothing reports "memql", so no client re-derives the default. Not to be confused with a CONSTRUCT's origin, which is where its source file lives. |

## `v1:platform:embedderBinding`

The cluster's ACTIVE embedder, at the literal row id `active` (epic memql#5137, D6).
WHY A BINDING AT ALL. The embedding model was the string "embedding3Small" in five files and `node_vectors` was declared `vector(1536)` -- that model's width, written into the schema. So the cluster could only ever embed with one paid OpenAI model: changing it meant editing five files AND a migration, and doing either without the other produced a table full of vectors of the wrong width. That is not an error anywhere. It is a search space that quietly returns wrong neighbours.
THE LITERAL ID IS LOAD-BEARING, the same way v1:cluster:database's is (memql#4766). A re-write is then a new VERSION of one logical row rather than a second row, so "which embedder is active" has exactly one answer to read -- and a query that returned two would have no way to choose.
SWITCHING IS NOT AN EDIT. Activating a different embedder opens the `reembedLibrary` work goal, which fills a new node_vectors_<dims> table and flips this row only when the counts match. Until then every read follows the binding that is still active, so a switch interrupted half way leaves a cluster that still works rather than one whose vectors half mean one thing and half another.
TIER: public, requiresIdentity, and the row-authz land gate is what settled it. The first cut said clusterOwner, on the reasoning that the embedder is a property of the DEPLOYMENT rather than of a person -- which is true, and is an argument about ownership, not about secrecy. There is nothing here to protect: a model id, a vector width, and when it changed. Meanwhile a person wondering why their search results changed shape has exactly one row that explains it, and hiding it from everyone but the owner would make that unanswerable for the people most likely to ask.
v1:platform:inferenceStatus and v1:models:modelProfile carry the same tier for the same reason. WRITING is a different question and is settled separately: both mutations are @serverOnly, because activating a binding is four ordered steps and not a write.

| Field | Type | Required | Description |
|---|---|---|---|
| `activatedAt` |  |  | When this binding became active. Empty on a row written by an activation that has not completed -- the re-embed is still filling the new table, and until it does this row is a plan rather than a state. |
| `dimensions` | integer | yes | The vector width this provider produces, and therefore which node_vectors_<dims> table its vectors live in. NEVER ZERO on a valid binding: a width of zero cannot have a table and cannot have an index, and pgvector refuses both rather than accepting them quietly. For a fleet model the width comes from the catalog row, because the machine serving it does not know it either. |
| `previousRef` | string |  | The providerRef this binding replaced, kept so an operator reading the row can see what the search space used to be. A vector corpus is not reversible from the vectors, so the only record of what produced them is this. |
| `providerRef` | string | yes | A provider record name (embedding3Small) or a fleet reference (fleet:qwen3-embedding:0.6b). Resolved through the same registry path every other provider name takes, so a fleet embedder is resolved against the ACTING USER's machines exactly like any other fleet call. |
| `reembedRunId` | string |  | The v1:work:run that filled this binding's table. Empty for the FIRST binding a cluster activates, which has nothing to re-embed FROM -- an absence that means 'nothing to carry over', never 'the run is missing'. |

**Relationships:** `references` -> `v1:work:run`

## `v1:platform:fleetModel`

Virtual projection of ONE MODEL the caller's fleet can run right now (epic memql#4676). Never persisted -- rows are produced at query time by the `fleetModels` builtin from live worker registrations, the same shape as v1:platform:dataOrigin and v1:router:modelCatalog.
NEVER PERSISTED, and here the reason is at its sharpest. The answer is which machines are AWAKE right now, so a stored copy could only ever be a second, staler answer -- and its staleness would be indistinguishable from the very condition it describes. A row written four minutes ago saying "llama3.1:8b is available" describes a closed laptop exactly as confidently as an open one.
SCOPED TO THE CALLER. A model call carries the caller's prompts and routes only to their own machines (memql#4678), so a catalog showing somebody else's would promise a model the router will never use -- and would enumerate another user's hardware besides. What this read returns is the caller's own machines PLUS the shared-inference set, which every user may legitimately reach for cluster work because their owners opted them in.
ATTRIBUTES ARE THE UNION over the machines behind a model: if one machine can do structured output, the model can, because a call needing it routes there. The intersection would hide a capability the fleet actually has whenever one machine under-reports.

| Field | Type | Required | Description |
|---|---|---|---|
| `audioIn` | boolean | yes | Whether at least one machine behind this model can TRANSCRIBE -- audio bytes in, text with timestamps out. The local door for hold-to-talk; before this the fleet wire carried chat and embedding only, so transcription had to reach a paid vendor or not happen. |
| `audioOut` | boolean | yes | Whether at least one machine behind this model can SPEAK -- text in, audio bytes out. Served by a small separate runtime (Kokoro) rather than by Ollama, which is why it is advertised per machine and not inferred from the model. |
| `contextWindow` | integer |  | Largest context window any machine behind this model advertises, in tokens. Zero means no machine said, which does not meet any floor -- the fail-closed direction, because a guessed window fails as a truncation three layers away that names nothing. |
| `embeddings` | boolean | yes | Whether at least one machine produces vectors for this model. |
| `imageGen` | boolean | yes | Whether at least one machine behind this model can GENERATE IMAGES. Ollama's image generation is experimental and macOS-only as of 2026-01, so this is false on most fleets and the Fleet page says which of the three reasons applies rather than leaving a blank. |
| `machineCount` | integer | yes | How many machines advertise this model at all. |
| `machines` | array |  | One entry per machine: {registrationId, name, displayName, runtimes[], online, busy, activeCount, maxConcurrent, memoryGb, platform}. `busy` is against the ceiling the machine DECLARED for this model; a machine that declared none is never busy, because it asked for no limit and the limit is not the thing to describe it by. `memoryGb` and `platform` are what the machine IS rather than what it is serving, and they are here so the catalog can CHECK a model's minMachineClass floor -- before memql#5195 no field carried either, so the floor was compared against a fleet size nothing reported and was never checked on any fleet. `memoryGb` is UsableGigabytes: VRAM on a discrete card, 75 percent of the pool on unified memory, and ZERO MEANS THE COCKPIT HAS NOT REPORTED rather than a machine with no memory. `platform` is normalized to the CATALOG's vocabulary (macos \| linux), not the machine's GOOS, so offeredOn compares catalog words against catalog words. |
| `modelId` | string | yes | The runtime-facing model id, exactly as the machine advertised it (llama3.1:8b). Also the row id -- there is one row per model and the model is what it is about. The router selected on this exact string, so no translation happens anywhere between the cockpit and a policy naming fleet:<modelId>. |
| `online` | boolean | yes | Whether at least one machine behind this model is reachable now. A model whose only machine is asleep stays LISTED and reports false: the operator's question is why it is not being used, and an entry that vanished answers with silence. |
| `onlineCount` | integer | yes | How many of them are reachable now. |
| `params` | integer |  | The model's parameter count as the runtime reported it, expanded to a number (Ollama's details.parameter_size: "8B" -> 8000000000). MAX across the machines behind the model, for the reason every capability here is a union: a machine that under-reports must not shrink a model the fleet demonstrably runs at full size. It is an ORDERING signal and never a capability gate -- fleet:* picks the strongest ELIGIBLE model, and a model that never said how big it is stays eligible for everything it advertised, it simply does not WIN by silence (design D5). Zero means no machine said. |
| `quant` | string |  | The quantization level the runtime reported (Q4_K_M, F16), from the first machine that reported one. Operator-facing only: nothing selects on it, because two quantizations of one model are the same model to a caller and ordering by a string nobody agreed on would be an arbitrary preference wearing a technical name. |
| `structuredOutput` | boolean | yes | Whether at least one machine can honour a response schema for this model. False is what keeps a conductor or planner turn away from a model that would answer prose to a structured prompt -- a parse failure with no readable cause. |
| `tools` | boolean | yes | Whether at least one machine behind this model can carry a TOOL-CALLING turn -- tool schemas in, tool calls out (epic memql#5096). It is a RUNTIME capability as much as a model one: the same weights behind an endpoint that does not implement the tools field cannot do it, which is why it is advertised per machine rather than inferred from the model id. False keeps a tool turn away from a model that would answer prose to it, which surfaces three layers away as an agent that appears to have stopped using its tools. |
| `vision` | boolean | yes | Whether at least one machine behind this model can carry a VISION turn -- chat messages with image parts in, text out (epic memql#5137, D4). A union across machines, like every capability here, and a RUNTIME capability as much as a model one: the same weights behind an endpoint that does not implement image parts cannot see. False keeps a vision turn away from a machine that would fail it four layers from the selection. |

## `v1:platform:globalSecret`

Instance-wide encrypted secret. Lives in the reserved _system partition (via @scope("global")). The cleartext value is NEVER stored -- only a NaCl secretbox ciphertext (base64(nonce||ct)) under MEMQL_MASTER_KEY and a short fingerprint for UI display. Used for instance-level API keys, OAuth client secrets, Azure/Graph credentials, etc. For per-tenant overrides (BYOK) use v1:platform:partitionSecret; the resolver falls back partition -> global automatically.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back. Useful for rotating a key without deleting history. |
| `addedBy` | string |  | Identity subject that wrote the secret. |
| `description` | string |  | Human-readable description of the secret's purpose. |
| `encryptedValue` | string | yes | Base64-encoded nonce \|\| NaCl-secretbox ciphertext, sealed under MEMQL_MASTER_KEY. Opaque -- never rendered to humans. @secret redacts a rejected value in the function-args validator ONLY, and matches by ARGUMENT NAME, so a mutation writing encryptedValue: args.somethingElse is not covered -- see Concept.SecretFields for the full scope. |
| `fingerprint` | string | yes | Last 4 chars of the cleartext, prefixed with '...'. For UI display only; lets operators tell rotated secrets apart without leaking the value. |
| `kind` | string |  | Optional tag to group secrets by type. Examples: 'vendor_api_key', 'oauth_secret', 'smtp_password'. Folded router API keys use 'vendor_api_key'. |
| `lastUsedAt` |  |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` |  |  | Timestamp of the most recent rotation (optional). |

## `v1:platform:globalVariable`

Instance-wide plaintext configuration variable. Lives in the reserved _system partition (via @scope("global")) and is visible to every tenant. Used for instance-level defaults like provider names, feature flags, log levels, and tuning knobs. For per-tenant overrides use v1:platform:partitionVariable. For sensitive values use v1:platform:globalSecret.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver ignores this row. |
| `description` | string |  | Human-readable description of the variable's purpose. |
| `name` | string | yes | Variable name (uppercase with underscores by convention). |
| `value` | string | yes | Variable value, always stored as string. Callers parse if they need typed data. |

## `v1:platform:inboundRequest`

A verified inbound delivery (memql#2957): the durable inbox row the engine's inbound receiver stages when a third party POSTs to /inbound/{source} and the request passes the deployment's source allowlist and signature check. Product DSL reacts with an ordinary automation on node.created -- no product Go. The counterpart to v1:platform:outboundRequest: outbound is the outbox a product stages and the engine drains, inbound is the inbox the engine stages and a product drains. Credentials are NEVER on this row -- the signing secret lives in env/globalSecret and only the verdict is recorded. See docs/internal/design/inbound-delivery-adr.md.

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | yes | The verified raw request body, exactly as signed. Capped by MEMQL_INBOUND_MAX_BODY_BYTES at receive time -- a larger request is refused with 413 and no row is staged. Never secret material. (Named body, not payload: shape paths reserve the payload prefix.) |
| `contentType` | string |  | The request's Content-Type, so a product automation can branch on JSON vs form-encoded without re-sniffing the body. |
| `dedupeKey` | string |  | The sender's own idempotency key when it supplies one via MEMQL_INBOUND_SOURCE_<NAME>_DEDUPE_HEADER, otherwise the SHA-256 of the raw body. RECORDED for a product automation to read; it does NOT decide the row id. Identity is the digest of the SIGNED payload, because the vendor signs the body and not this header -- deriving the id from an unsigned header let one captured delivery mint unbounded rows (memql#2957 landing review). |
| `lastError` | string |  | Most recent product-side handling error, truncated to 4KB. Empty on success. |
| `medium` | string | yes | How it arrived. 'webhook' is a third party POSTing to /inbound/{source}. 'mailbox' is the Graph NDR reader (memql#4824) staging a delivery-status report it read out of our OWN sending mailbox -- which is why those rows are stamped signatureVerified even though nobody signed anything: provenance IS the verification there, and the field is what gates campaignIngestFeedback. The enum was written with one value and the note that a second inbound transport should not need a concept change; this is that second transport, and it did. (enum: webhook, mailbox) |
| `processedAt` |  |  | When the product finished handling the row. |
| `receivedAt` |  |  | When the receiver accepted the request. |
| `signatureVerified` | boolean |  | Whether the HMAC signature was checked and matched. Supplied by the receiver through stageInboundRequest rather than stamped; an absent value reads as false. Only ever true, or false for a source explicitly configured scheme='none'; a FAILED check is refused at the edge and never staged, so this records which sources are running unverified rather than which requests failed. |
| `source` | string | yes | Which allowlisted sender this arrived from -- the {source} path segment, matched against MEMQL_INBOUND_SOURCE_ALLOWLIST. Products filter their automation on it. Never caller-chosen beyond the allowlist: an unlisted source is refused before a row exists. |
| `status` | string |  | Product-side handling lifecycle, NOT delivery state -- the delivery already succeeded by the time a row exists. 'received' = staged, awaiting the product automation. 'processing'/'processed'/'failed' are stamped by the product as it works the row. (enum: received, processing, processed, failed) |

## `v1:platform:inferenceStatus`

Virtual SINGLE-ROW answer to "can this caller get inference at all, and through which door" (epic memql#4676, design G). Never persisted. The first-run gate reads it.
ONE ROW BECAUSE IT ANSWERS ONE QUESTION. The gate needs an answer, not material to compute one -- and eligibility computed in a client is a second implementation that drifts from the one the router actually applies. Every input is named on the row anyway, so a person looking at a gate they do not understand can see exactly what it read.

| Field | Type | Required | Description |
|---|---|---|---|
| `appEligible` | boolean | yes | Whether at least one subscription app (Claude Code, Codex) is allowed, signed in and online on a machine whose stream the replica answering this request holds (epic memql#5096). The replica qualifier is real rather than pedantic: the app-session envelope has no cross-node forward yet, so a machine on a sibling replica is skipped during selection -- and a status row that claimed the door was open would be describing a door this node cannot walk through. |
| `appSessionsInstalled` | boolean | yes | Whether the node answering this request can open app sessions at all. The app door's twin of fleetInferenceInstalled, and the same distinction: 'you have signed into nothing' and 'this node has no worker service' look identical on a page and have entirely different fixes. |
| `cloudConfigured` | boolean | yes | Whether any paid provider is configured and callable on this node -- which since epic memql#5088 means a FEDERATED one, there being no other kind. Reported because the park card's cloud-approval affordance keys on it and the Models section uses it to explain why the last door is shut; it is not a door of its own, because a callable cloud provider is a federated one and federation is already a door. |
| `doorsOpen` | array |  | Which of local \| app \| federation are currently usable, IN THE ORDER THE DEFAULT CHAIN TRIES THEM: a local model, then an app the person already pays for, then federation. The order is part of the answer, so a client renders the list rather than re-deriving one. Empty means the gate has something to ask for. There was a fourth, apiKey, and it went with the vendor keys in epic memql#5088: a cloud vendor is reached by workload identity federation or not at all. Note four DOORS, three NAMES -- both vendors federate and the row does not say which one answered. |
| `eligible` | boolean | yes | Whether ANY door is open. This is what the first-run gate branches on. |
| `eligibleModelIds` | array |  | The models that met the profile, so the gate can say which one it is about to use. |
| `federationConfigured` | boolean | yes | Whether Anthropic workload identity federation is fully configured (memql#4333). Read through the same predicate the AI providers page reads, so the two cannot disagree about whether a door is open. |
| `fleetCatalogInstalled` | boolean |  | Whether this node can read the shared graph projection of the caller's available fleet models. Does not imply a local worker dispatcher; public query nodes read the same catalog as agent nodes. |
| `fleetInferenceInstalled` | boolean | yes | Whether the node answering this request can place fleet model calls at all. Distinguishes 'your machines are asleep' from 'this node has no worker service' -- identical from a page, entirely different fixes. |
| `localEligible` | boolean | yes | Whether an online fleet machine advertises a model meeting the MINIMUM CAPABILITY PROFILE: structured output plus the context floor. Deliberately not 'any model at all' -- a fleet whose only model cannot do structured output would pass a naive gate and then refuse every conductor turn, which is a worse place to put a person than the door they were on. |
| `localModelCount` | integer | yes | How many models the caller's fleet offers, eligible or not. Separates 'you have no machines' from 'your machines run nothing that qualifies'. |
| `minimumContextWindow` | integer | yes | The context floor localEligible applied, published so the gate's recommendation and its check cannot drift. It is a floor for the GATE; what enforces capability per CALL is the catalog gating the router applies. |
| `runnableApps` | array |  | The app ids behind appEligible, so a surface can say which one it is about rather than only that there is one. |
| `streamingChatEligible` | boolean |  | Whether this caller has a usable plain streaming chat door for Ask: an online non-embedding fleet model meeting minimumContextWindow, a runnable app that implements plain streaming chat, or an available federated plain streaming chat provider. Read from the caller's own and shared fleet catalog even on query nodes without local worker dispatch. Does not guarantee a particular prompt fits or a call succeeds; routing applies the actual call's needs and policy. |

## `v1:platform:missingCapability`

A capability the platform itself cannot yet provide -- a missing tool, missing integration, missing liveSource connector kind, missing knowledge domain category, etc. Distinct from the capability-gap signal raised when no agent in the catalog can serve an utterance: missingCapability fires when even creating the right specialist wouldn't solve the problem because the underlying platform surface doesn't exist. Logged by the Planner Agent during its capability-gap detection step before agent creation. Becomes the product backlog -- 'these are the things the platform can't do yet that users actually want.' Global-scoped so it's visible across tenants for prioritization.

| Field | Type | Required | Description |
|---|---|---|---|
| `capability` | string | yes | Short identifier for the missing thing, e.g. 'sendSlackMessage', 'jira.createIssue', 'erp.inventory.live'. Stable across multiple sightings so duplicate signals collapse onto one row. |
| `description` | string | yes | Human-readable description: what the platform was being asked to do that it couldn't. Surfaced in the product backlog view. |
| `exampleGoals` | array |  | List of Plan.goal strings that triggered this gap. Capped at the most recent N (engine policy); gives the prioritization view 'real users wanted X, Y, Z'. |
| `firstSeenAt` |  |  | When the first sighting was logged. |
| `kind` | string | yes | What category of platform extension would close this gap. 'tool' = an agent-callable action that doesn't exist yet (e.g. 'sendSlackMessage'). 'integration' = a backing service we don't speak to yet (e.g. Jira). 'liveSource' = a volatile data source we'd want bound to agents but don't have a query for. 'connectorKind' = a brand-new liveConnector implementation kind (e.g. 'snowflake'). 'knowledgeDomain' = a category-level gap, e.g. agents trying to act in a domain we never seeded. 'modelCapability' = a model-level feature we don't support yet (e.g. structured-output with strict schemas on a new provider). (enum: tool, integration, liveSource, connectorKind, knowledgeDomain, modelCapability, other) |
| `lastSeenAt` |  |  | When the most recent sighting was logged. |
| `partitionId` | string |  | Optional space scope where the gap was detected. Useful for attributing 'this gap blocked work in space X'. |
| `partitionScope` | string |  | Partition where the gap was detected. Empty = unknown. Helps de-duplicate platform-wide vs tenant-specific gaps. |
| `requestedByAgentId` | string |  | v1:agents:agent.id of the agent (typically the Planner Agent) that logged the gap. Empty for system-level detection. |
| `requestedFromRunId` | string |  | v1:work:run.id where the gap was detected. Lets the platform team trace back to 'what was the user trying to accomplish when we hit this wall'. |
| `resolution` | string |  | Free-text note when status='resolved' or 'wontfix' explaining what shipped (or why we won't ship it). |
| `sightingCount` | integer |  | How many times this gap has been logged. New sightings of the same (kind, capability) increment rather than creating new rows. Drives 'most-requested capability' prioritization. |
| `status` | string |  | Lifecycle. 'open' = logged, nothing done yet. 'in_progress' = the platform team is working on it (manually set). 'resolved' = the capability shipped; the Planner Agent's next sighting will recreate as a fresh row if it still doesn't work. 'wontfix' = explicit dismissal. (enum: open, in_progress, resolved, wontfix) |

**Relationships:** `references` -> `v1:work:run`, `references` -> `v1:agents:agent`

## `v1:platform:modelEvidence`

One model's week at one level, folded from what actually happened.
A MEASUREMENT AND AN EVIDENCE ROW ANSWER DIFFERENT QUESTIONS. The probe asks a model to do things nobody needed done, under controlled conditions, and reports how it went. This row is the record of real calls: how many, how many failed the structured contract, how often a repair or a retry followed, how often a run parked. Neither substitutes for the other -- a model can probe well and fail in service, and a model with a bad week can be perfectly capable.
IT PROPOSES AND NEVER APPLIES. Above a 0.3 structured failure rate over at least twenty calls, the nightly fold opens a v1:work:approval of kind routingReview carrying a generated rule hashed over its exact text; approving arms it and declining is recorded so the same week's evidence does not re-propose. Automatic demotion was considered and rejected: it violates the never-a-silent-edit rule, and a week of bad luck on one schema is not a reason to route a whole level elsewhere.
THE CALL COUNT IS ON THE ROW EVEN WHEN IT IS UNDER THE FLOOR, so an operator asking why nothing was proposed reads the answer rather than inferring it.
TIER: clusterOwner. It spans every owner's calls by nature -- the question is how a MODEL behaved across the fleet, not how it behaved for one person -- so there is no owner to scope it to.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvalId` | string |  | v1:work:approval.id of the routingReview this row opened, when it opened one. |
| `calls` | integer | yes | Decision records for this model at this level in the week. Recorded even when it is under the twenty-call floor, so a fold that proposed nothing has a readable reason. |
| `foldedAt` | string | yes | When the fold ran. |
| `level` | string | yes | The level these calls were serving. Evidence is per level because a model can be right for one and wrong for another, and a demotion that took a model out of every level for a failure at one would be a heavier act than the evidence supports. (enum: fast, strong, reasoning, embeddings) |
| `modelId` | string | yes | The runtime's own id, matching v1:router:call and the model label byte for byte. |
| `parks` | integer |  | Runs that parked on an approval while this model was serving them. |
| `proposal` | string |  | What the fold did with this week's evidence. `none` is the fold having looked and decided nothing -- distinct from the empty string, which is a row no fold has reached yet. `declined` records a person's decision so the same week's evidence does not re-propose, which is the difference between a proposal and a nag. NO @default, deliberately: every writer of this row is a fold that has already decided, so a declared default would document a create-time value nothing ever stamps. (enum: , none, demotion, promotion, declined) |
| `repairs` | integer |  | Steps re-run with the violation as guidance. A repair is cheaper than a resample and it is evidence, not a failure. |
| `retries` | integer |  | Steps retried after a transient failure. |
| `ruleHash` | string |  | SHA-256 of the RENDERED rule source the proposal carries. The approval hashes the same string, so an approved decision can never carry to a different rule -- which is the whole guarantee, since two renderers of one grammar would drift and the drift would be silent. |
| `structuredFailures` | integer |  | Calls whose structured contract was violated. The numerator of the rate the threshold reads. |
| `week` | string | yes | The ISO week the fold covered, as YYYY-Www. A string rather than a pair of timestamps because it is a KEY -- one row per model per level per week -- and two folds of the same week must land on one row rather than two. |

**Relationships:** `parent` -> `v1:work:approval`

## `v1:platform:modelMeasurement`

One probe's figures for one model on one machine, under one suite version.
KEYED BY (machineId, modelId, suiteVersion), AND THE THIRD IS NOT METADATA. Two figures scored by different suites are not comparable, so a new suite version produces a NEW row rather than overwriting a figure that meant something else. The row id is a digest of the three, so a re-probe under the same suite is a new VERSION of one logical row and the history stays readable.
EVERY FIGURE IS A STAT OR AN ABSENT REASON, never both and never neither. That is component/proving/figure's discipline carried onto a row, and the reason is a page: a machine nobody has probed showing "0 tok/s" reads exactly like a slow machine, and the two lead to opposite actions. Each figure is an object of the shape { measured: true, median, spreadLow, spreadHigh, n } XOR { measured: false, absentReason, absentDetail }, where absentReason is one of unmeasured, refused or failed. `refused` is NOT a failure -- it is the 32K case put to an 8K model, a question the model never claimed to answer -- and counting it as one would penalise a model in every ranking for a limit it had already declared.
A MEASURED ZERO IS A REAL ANSWER. Five structured cases that ran and all failed is 0.0 with n=5, and it says do not route structured work to this model; that is a different sentence from the absence a crashed runtime leaves, and the whole shape above exists to keep them apart.
TIER: the composite owner, clusterOwner. A measurement is a fact about somebody's machine -- it says what their hardware does -- so the owner tier is right, and a plain one would hide every machine's figures from the operator who has to explain the routing.

| Field | Type | Required | Description |
|---|---|---|---|
| `machineId` | string | yes | v1:worker:registration.id the suite ran on. A figure with no machine is a figure about nothing: the whole content of a measurement is which hardware produced it, which is also why a probe names one machine and has nothing to fall through to. |
| `measuredAt` | string | yes | When the machine finished the suite, server-stamped from the report's arrival rather than taken from the machine: a clock this cluster does not control must not decide which of two measurements is newer. |
| `modelId` | string | yes | The runtime's own id, byte-identical to the model label and to v1:models:modelProfile.modelId, so a measurement joins to both by string equality and never by a fuzzy match. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns the machine the suite ran on. THE ROW-AUTHZ OWNER FIELD, stamped from the actor and never taken from caller args. The probe's report arrives on an agent replica, which runs the write under auth.ContextWithUserActor for the registration's owner -- the borrowed-authority shape every other write about somebody's machine already uses. |
| `probeError` | string |  | The machine's own sentence when the probe itself failed. Empty on a clean run, and PRESENT ALONGSIDE FIGURES when some cases ran and some did not -- that is a real state rather than a contradiction, and each figure says for itself which it was. |
| `structuredValidity` | object |  | Figure. Fraction of the structured cases whose output validated against the platform's own schemas. THE FACT THE ROUTER NEEDS: a model's parameter count says nothing about whether its structured output satisfies the schemas this cluster actually sends. |
| `suiteVersion` | string | yes | The probe suite this run was scored under (component/worker/probe.SuiteVersion). Part of the key rather than metadata: two figures from different suites are not comparable, so a bump produces new rows and the machine page shows the older ones as measured under an older suite rather than silently mixing them. |
| `throughputTps` | object |  | Figure, tokens per second, over the 8K and 32K cases as ONE figure with a spread. Two numbers would invite a reader to quote the short prompt, and a single best case is what the spread exists to prevent. |
| `toolCallCorrectness` | object |  | Figure. Fraction of the tool cases where the model called the right tool with arguments satisfying its schema. A runtime handed tools it cannot honour answers prose, which surfaces three layers away as an agent that stopped using its tools for no reason a reader can see. |
| `ttftMs` | object |  | Figure, time to first token in milliseconds, over the same two cases. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`

## `v1:platform:moduleReadiness`

One node's verdict on one module (design record 2026-09-06-configuration-readiness, section 4.4). Rewritten as a new version of the same id, v1:platform:moduleReadiness:<module>--<nodeId>, on every boot and after a providers reload or an integration configure, so a read collapses to the latest. Carries presence and source only, never a value.
TIER: public, requiresIdentity. Any signed-in person reads it -- the setup surface has to tell a viewer "not set up" as honestly as it tells an owner -- and nobody anonymous does. The write is the engine's alone: recordModuleReadiness is @serverOnly.

| Field | Type | Required | Description |
|---|---|---|---|
| `core` | boolean |  | Whether the module is one the first-run wizard walks. |
| `lanes` | array |  | One entry per lane: { name, configurableFrom, complete, slots: [{ name, present, source, optional }] }. Presence and source only. |
| `module` | string | yes | The readiness module id from the env manifest's modules block: ai, storage, email, githubApp, campaigns, workbench, localApps. |
| `nodeId` | string | yes | The reporting node's MEMQL_NODE_ID. |
| `nodeType` | string | yes | The reporting node's type. |
| `reportedAt` | string | yes | When this node evaluated, RFC3339. |
| `state` | string | yes | This node's verdict; notApplicable means the node does not host the module. (enum: configured, partial, unconfigured, notApplicable) |

## `v1:platform:moduleVerdict`

Virtual, never persisted: the cluster-wide fold of moduleReadiness rows, one row per module with id = module name. The moduleReadiness builtin answers it; the OS computes the same fold from the live feed with the mirrored function (component/memql/readiness).
@displayCard's tertiary names "core" rather than the brief's original "disagreement": the loader rejects an array-typed slot ("disagreement" is []string; only string/enum/bool/datetime/int/float display), and core is the one other scalar this concept carries.

| Field | Type | Required | Description |
|---|---|---|---|
| `core` | boolean |  | Whether the module is core. |
| `disagreement` | array |  | nodeId=state for every live reporter when they disagree, worst first; empty otherwise. |
| `module` | string | yes | The module id. |
| `nodes` | array |  | Per live reporting node: { nodeId, nodeType, state, reportedAt }. |
| `state` | string | yes | Worst state across live reporting nodes; partial with disagreement when they differ; unreported when no live node reported. (enum: configured, partial, unconfigured, unreported) |

## `v1:platform:outboundRequest`

A staged outbound delivery (memql#2521): the durable outbox row a product automation or logic body creates when it decides something must leave the cluster (an email, a webhook call). The engine-owned outbound worker drains pending/retrying rows, performs the delivery through the deploy-configured transport (per-medium allowlists, credentials from env/globalSecret -- NEVER from this row), and stamps the status transitions back, so delivery state is ordinary graph state products can query and react to. See docs/internal/design/outbound-delivery-adr.md.

| Field | Type | Required | Description |
|---|---|---|---|
| `attempts` | integer |  | Delivery attempts made so far. Incremented on each failure; bounded by MEMQL_OUTBOUND_MAX_ATTEMPTS. |
| `body` | string | yes | What to deliver: the email text body, or the JSON body POSTed to a webhook. Capped by MEMQL_OUTBOUND_MAX_PAYLOAD_BYTES at drain time. Never secret material. (Named body, not payload: shape paths reserve the payload prefix.) |
| `dedupeKey` | string |  | Optional caller idempotency key, passed through to the receiver (webhook: X-Memql-Dedupe-Key header) so external systems can deduplicate at-least-once redelivery. |
| `lastError` | string |  | Most recent delivery error, truncated to 4KB. Empty on success. |
| `medium` | string | yes | Delivery transport. 'email' delivers via the engine email integration (Graph/SMTP/log per deployment). 'webhook' POSTs the payload as JSON to the target URL. (enum: email, webhook) |
| `nextAttemptAt` |  |  | When a 'retrying' row becomes eligible again (bounded exponential backoff with jitter). Compared Go-side by the worker. |
| `requestedBy` | string |  | Provenance: which product automation/logic staged this row. Free-form; surfaces in delivery audit queries. |
| `sentAt` |  |  | When the transport accepted the delivery. |
| `status` | string |  | Delivery lifecycle. 'pending' = staged, awaiting the worker. 'sending' = a replica claimed it and is delivering. 'sent' = transport accepted it (sentAt stamped). 'retrying' = a retryable failure; eligible again at nextAttemptAt. 'failed' = permanent failure or attempts exhausted (see lastError). (enum: pending, sending, sent, retrying, failed) |
| `subject` | string |  | Email subject line. Ignored for medium='webhook'. |
| `target` | string | yes | Where to deliver: a recipient email address for medium='email', an absolute URL for medium='webhook'. Must match the deployment's per-medium allowlist or the row fails fast. |

## `v1:platform:outboxEntry`

One pending outbound delivery for an ORIGIN concept (epic memql#4378, D5). MemQL owns the data; an external system holds a mirror of it; this row is the durable record that a change has to reach that system. Appended by the engine in the SAME TRANSACTION as the row write, one entry per @mirroredTo target, and drained by that connector's worker.
The append is transactional because the alternative is a change that MemQL believes it propagated and the mirror never heard of. A write that fails writes no entry; an entry that exists names a row write that committed.
clusterOwner: the queue is one deployment's operational state, not any user's rows, and "how deep is the outbox" has to be answerable. The drain worker reads it under the engine's own operator identity -- the campaigns precedent.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | What happened to the row. MemQL has no hard delete -- a retirement is an append that marks the row gone -- so `retire` is a flag on a change rather than a separate verb. (enum: upsert, retire) |
| `attempts` | integer |  | How many delivery attempts have been made. Compared against MEMQL_SYNC_OUTBOX_MAX_ATTEMPTS to decide dead. |
| `conceptId` | string | yes | Canonical id of the concept whose row changed. Named conceptId because `concept` is a reserved row intrinsic. |
| `deliveredAt` |  |  | When the receiver accepted it. Set once; a redelivery that the receiver recognises does not move it. |
| `idempotencyKey` | string | yes | (conceptId, rowRef, version, target), rendered once by the engine so every attempt at this entry presents the same key to the receiver. This is what makes a redelivery arrive once. |
| `lastError` | string |  | Truncated error from the last failed attempt. Never a payload body -- the runtime does not log those. |
| `nextAttemptAt` |  |  | Earliest time a worker may try again. Set on every failure from the backoff schedule; a worker skips entries whose time has not come. |
| `rowRef` | string | yes | Id of the row that changed. Not named rowId to keep it clearly a reference rather than this entry's own id. |
| `status` | string | yes | pending: waiting for a worker. delivering: claimed by one. delivered: the receiver has it. failed: a delivery attempt failed and nextAttemptAt says when to retry. dead: attempts exhausted -- the operator queue, never retried automatically. (enum: pending, delivering, delivered, failed, dead) |
| `target` | string | yes | Connector name this entry is destined for -- one of the concept's @mirroredTo targets. Present even though the worker is per-connector, because an entry that cannot say where it is going is unauditable. |
| `version` | string | yes | The row's version AFTER the change. Half of the idempotency key, and what lets a receiver discard a replay. |

## `v1:platform:packState`

Per-instance pack enablement state (module-registry design, docs/superpowers/specs/2026-08-20-module-registry-design.md section 4). One row per pack at the deterministic id v1:platform:packState:<packDomain>; the append-only version history IS the audit trail of flips. ABSENCE OF A ROW MEANS ENABLED, so a pack ships with zero behavior change and a fresh database needs no seeding. Read once per node at boot (app phase 3, after the database starts and before the DSL loaders run); a flip takes effect as each node restarts, and the module inventory reports enabled-vs-loaded honestly in between. A row naming no registered pack domain is reported by the inventory and otherwise ignored.
clusterOwner tier for the same reason v1:platform:site and v1:campaigns:sendJob carry it: what a cluster RUNS is one deployment's fact, not any individual operator's rows, and "list every pack's state" must be expressible.

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | boolean | yes | Desired per-instance state. false = the pack is mounted-inert on every node's next boot: its namespace stays owned and its concepts (and rows) stay readable, but its queries, mutations, builtins, tools, prompts, automations and Go factories are not loaded. |
| `packDomain` | string | yes | The registered pack domain this row governs (the RegisterTree name, e.g. 'harness', 'referencepack'). Also the row id's short form. |
| `reason` | string |  | Operator note recorded with the flip; shown in the module detail. |

## `v1:platform:package`

A TRACKED SOURCE this cluster can deploy: a memql-project-shaped tree that arrives either as a Git repo or as a zip of exactly the same tree (D1). The two forms are interchangeable and equally validated, which is why `sourceKind` discriminates provenance and nothing else -- every rule downstream of the fetch reads one tree.
Nothing becomes a package by claiming to be one: an analysis decides, offline, before anything deploys (D12, component/packages). A row exists here because an analysis of that source has already succeeded at least once.
The COMPOSITE tier, for the reason v1:platform:site records at length: a plain owner tier has no cluster-owner escape on the read path, so "list every package in this cluster" would not be EXPRESSIBLE and an operator would silently read a subset. The composite keeps both statements true -- a person reads their own packages, an operator reads every one.
AND THE ACCOUNT ARGUMENT, which is a DEPARTURE from the accounts rule and is recorded as one (memql#5303, design 2026-09-11-app-access-grants D12). The rule -- "an account is a record of who work is for, never a visibility scope" (accounts D1) -- holds for campaigns, and it held here until this line. v1:platform:site left it in epic memql#5165, when `account="accountId"` became an argument of the owned tier: a person whose group ties them to the account this row names reads it, and may write it if their role holds the verb, without owning it. This finishes that departure for deployables. A package and its runs are what a client's people, and the cluster's own, work on together, and the alternative -- every deployable visible to exactly its creator and the operator -- was two people on one cluster unable to see each other's. Developer rank and above are standing members of every account-kind group by rule, so the staff read every TIED package; an untied one stays its owner's and the operator's, exactly as before. The compose flow ties a new package to the cluster's own account (`v1:accounts:account:self`) unless a client is picked, which is what makes the departure the default rather than an option.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this package is FOR (memql#5303, D12) -- the account argument of the tier above, so a member of that account's group reads this row and its runs without owning them, and a developer or above reads every tied one. The compose flow sets it to the cluster's own account (`self`) unless a client is picked, and copies it onto every packageDeployment it opens. Optional: EMPTY is an untied package, readable by its owner and a cluster owner and nobody else, which is what every row written before this field existed is. Unlike v1:platform:site's field of the same name this one DOES have a read effect, and the concept doc above says why. |
| `artifactId` | string |  | The v1:library:artifact this package's source zip was read from, for sourceKind='artifact'. Provenance: Files stores and identifies, packages consume (D8). |
| `autoDeploy` | boolean |  | Whether a push to this source deploys itself when the plan has not changed (epic memql#4900). Off by default and off for every row written before this field existed, which is the only safe default: on, a push to the tracked ref starts a run under the OWNER's authority with nobody watching. The run confirms ITSELF only when the new analysis plans exactly what the last confirmed run planned -- the same apps by name, kind and path, the same DSL domains, every placement already remembered -- and parks at the confirm gate for anything else, exactly as a person's deploy does. A person would call turning it on a change, so it IS in the OS's arrival-cue fingerprint. |
| `credentialId` | string |  | The v1:platform:sourceCredential this package fetches under, or EMPTY for a public repository (epic memql#4885, D10). A NAME rather than a value: the token never lands on this row, on a snapshot, or in a log, and is unsealed only at fetch time -- under the PACKAGE OWNER's actor, so a package naming somebody else's credential resolves nothing and is refused as credential_not_found. A row still carrying a token NAME from before this field existed reads as 'no credential' -- there is no shim -- and the OS asks for one on its Source stop. |
| `declares` | array |  | What the SOURCE says it contains: one entry per manifest deployable, {name, kind}, rewritten from the analysis report on every run that reaches one. The package is the thing apps come FROM, and until this existed the only record of what a tree declared lived inside a run's report -- so an app that was declared and never deployed had no site row and was invisible everywhere: absent from the list, absent from the source page's own list of the apps it produces. Skipping one at the confirm gate is exactly that case and the commonest, which is how a person could choose not to deploy an app and then be unable to find it again. A SITE row still means DEPLOYED; this means DECLARED, and the difference between the two lists is the set of apps a person can still deploy. Never a placement: no address is stored here, because a skipped app is not asked for one until it is deployed. |
| `deployedVersion` | string |  | Commit SHA or content hash of the source currently LIVE. Written by the pipeline when a deployment reaches 'succeeded' -- so it lags the repository deliberately, and the gap between it and latestKnownVersion is the whole update cue. |
| `disabledDeployables` | array |  | The manifest deployables this source's OWNER has chosen not to deploy, by name. The OWNER's field, and the pipeline never writes it -- `declares` above is what the manifest says and is rewritten by every analysis, so intent kept there would be erased by the next one. Two fields because there are two authors. A name here means the app is listed and INERT: it appears under its source so it can be found, it is not offered for deploy, and no run builds it. Skipping one at the confirm gate, deactivating a deployable that came from a source (packageDeactivateDeployable) and archiving the source all add to it; activating (enablePackageDeployables) is the deliberate act that removes it, and only then can it be deployed. Before this, a skipped app was merely 'declared with no site' -- indistinguishable from one nobody had got to yet -- so the console offered to deploy it, and discarding the result brought it straight back. A name that no longer appears in `declares` is harmless: it matches nothing, and the manifest is the authority on what exists. |
| `latestKnownVersion` | string |  | Newest upstream version either D11 feed has seen. WRITTEN ONLY BY THE FEEDS. A feed that wrote anything else would be deciding to deploy, which is a person's click. |
| `name` | string | yes | From the manifest at first analysis (memql-package.yaml `name`). Not caller-chosen: the package IS the tree, and a name typed into a form could disagree with what the tree says it is on the very next deploy. |
| `ownerUserId` | string |  | v1:identity:user.id that owns this package, or EMPTY for a cluster-owned one. Stamped from the actor on create, exactly as v1:platform:site stamps its own -- it is the row-authz key the composite tier compares against actor.userId, so a caller-supplied value would record a guarantee nothing provides. NOT `string!`, for the same reason the site's is not: an empty value is the meaningful cluster-owned state. |
| `repoRef` | string |  | Branch, tag or commit to deploy. EMPTY means the repository's default branch, resolved at fetch time -- storing a resolved default here would freeze a package to whatever 'main' meant on the day it was added. |
| `repoUrl` | string |  | HTTPS URL of the tracked repository. Empty for sourceKind='artifact'. Also the match key the webhook feed uses to find this row when a push arrives (D11), which is why it is stored normalized rather than as typed. |
| `sourceKind` | string | yes | Where the source comes from. 'repo' tracks a Git repository as the source of truth and is the form the D11 update feeds watch. 'artifact' is a zip already in the Library -- a complete, self-contained snapshot with nothing upstream to notice, so it never carries an update cue. Both analyze, build, stage, roll and publish through exactly the same pipeline. (enum: repo, artifact) |
| `status` | string | yes | Lifecycle (D10). 'archived' is a PLACE, not a void: archived rows stay listable behind the Archived filter, because the alternative -- the isNotDeleted tradition, which filters rows out of every list -- is precisely what made a deleted deployable unfindable and is why this axis exists at all. Archiving DEACTIVATES every app the package produced first (2026-09-05 design, D3): each app's site is deleted so its address comes free, its name goes on disabledDeployables, and the package flips last. Restoring brings the package back with its apps inactive. (enum: active, archived) |
| `updateAvailable` | boolean |  | Whether latestKnownVersion differs from deployedVersion. WRITTEN ONLY BY THE FEEDS, and stored rather than derived at read time so that flipping it is a row change that BROADCASTS -- which is what lights the OS cue without a reload. Deriving it would leave the OS comparing two strings on a row nobody told it had changed. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:accounts:account`, `references` -> `v1:library:artifact`, `references` -> `v1:platform:sourceCredential`

## `v1:platform:packageDeployment`

ONE ATTEMPT to deploy one version of one package -- the append-only timeline (D7).
APPEND-ONLY IS THE CONTRACT, and it is what makes the row trustworthy. A row at a terminal status (succeeded / refused / failed) accepts no further writes; a retry is a NEW row. So the timeline of a package is the literal history of what was attempted and what happened, and it cannot be rewritten by the next attempt to look like it always went well.
Same composite tier as its package -- the account argument included (memql#5303, D12), so a run is readable by exactly the people its package is -- and broadcast: the OS watches a deploy advance stage by stage, which is only true because each stage's status write is a row change the mesh forwards.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | Copied from the package row at open, for the reason ownerUserId is (memql#5303): it is the account argument of the tier, and taking it from the package is what keeps the run timeline readable by the people the package is tied to. Written by openPackageDeployment alone and never rewritten; EMPTY for the run of an untied package, and for every run opened before the field existed, which read exactly as they did. |
| `automatic` | boolean |  | Whether the source's own auto-deploy switch started this attempt rather than a person (epic memql#4900). FALSE is somebody's click -- the overwhelming majority, and what every row written before this field existed reads as. TRUE means the update feeds noticed the source move and started the run under the package's OWNER (requestedBy still names them, because the deploy is theirs) with nobody at a keyboard: which is what the OS marks on it in Every attempt, and why the run confirms itself only when the plan is unchanged and parks at the gate for anything else. A BOOLEAN rather than an enum of trigger kinds, because there are exactly two answers and the field is not the place to speculate about a third -- and because `provenance`, the word that first suggested itself, is a RESERVED property name (row.provenance.<leaf>) and a concept declaring it is dropped whole. |
| `buildLogTail` | string |  | Bounded tail of the build output, captured whether the build succeeded or failed so 'why did my build fail' is answered inside the OS rather than in a pod log the person cannot reach (design section I). Bounded because a row is not a log store: the WHOLE output goes to the log store with this deployment as its subject (epic memql#4893), and this is the end of it, for the list. |
| `builtOn` | object |  | Where this run built: {surface, nodeId} (epic memql#4900). surface is one of 'prebuilt' (the output was committed and nothing ran), 'workbench' (a sandboxed in-cluster directory) or 'fleet' (a machine in the owner's own Fleet, for a target that needs one). nodeId is the replica that ran the command, and it is on the row because it is the only durable answer to 'where did this build happen' once the directory it happened in is gone -- which it is by the time this row closes, deliberately. Empty surface for a run that never reached the build stage; empty nodeId for the prebuilt path, which ran nowhere. |
| `cancelRequested` | boolean |  | Somebody asked for this run to stop (epic memql#4937). Set by requestPackageDeploymentCancel and read by the node running the attempt -- it does NOT itself end the run, which is the whole shape: the row records the ASK and the running node records the OUTCOME, so the timeline can never claim a run stopped that is still building somewhere. The pipeline checks it at each stage boundary before the next stage begins, and its heartbeat re-reads it on the same cadence so a long single stage -- a build -- learns about a cancel within one beat rather than only at its own end. THE LAST CHECKPOINT IS IMMEDIATELY BEFORE THE ROLL: from staging_dsl on there is no cancel, because a roll restarts the cluster onto staged MemQL and stopping half way through is the one outcome worse than either finishing or not starting. The capability refuses the ask at that point rather than setting a flag nothing will read. |
| `deployables` | array |  | Per-deployable outcome, one entry per manifest deployable: {name, siteId, hostname, bundleRef, version} on success, or {name, refusal:{code, message}} for a half that was refused. A LIST rather than a map because the order is the manifest's and a reader compares it against the report above. |
| `dslVersion` | string |  | Content-addressed prefix of the DSL tree this attempt staged (blob://packages/<domain>/<contentHash>/), or EMPTY when the package carries no DSL or its DSL was unchanged -- which is the D6 fast path where stage and roll are skipped entirely and nothing restarts. |
| `error` | object |  | The typed failure, when there is one: {code, message, scope}. The code is a catalogued refusal (component/packages/refusal.go) so the OS keys its own sentence on a stable string; the message is the server's own sentence, which the OS renders verbatim when it has no copy of its own. |
| `finishedAt` |  |  | When it reached a terminal status. Empty while it is still running. |
| `fromDeploymentId` | string |  | The run this one was started FROM, when it was (task memql#4902, memql#4955). A retry of a lost run re-analyses the snapshot that run stored rather than fetching the source again -- so it deploys the bytes the lost run was deploying, not whatever the branch has moved to since -- and this records that it did. It was consumed at fetch time and written nowhere, so the run kept no trace of its own provenance: the CONFIRM that followed was a fresh call with no fromDeploymentId at all, which meant a person read a report describing commit A and clicked a button that shipped commit B. Empty for an ordinary run. |
| `heartbeatAt` |  |  | When the node running this attempt last said it was still alive (epic memql#4900). Written on a fixed cadence by the running pipeline and by NOTHING else; a run that stops writing it for longer than MEMQL_PACKAGES_ABANDONED_AFTER_SECONDS is closed 'abandoned' by the sweep. A HEARTBEAT, which is why it must never enter an arrival-cue fingerprint: a surface that re-fired on it would announce a change every fifteen seconds of every deploy, which is exactly the 'a heartbeat is not news' failure clients/os/README.md names. Empty on a terminal row and on a run that never started. |
| `nodeId` | string |  | The replica running this attempt (epic memql#4900). Stamped at open from MEMQL_NODE_ID and never rewritten: a run is one call on one node, so this is a fact about the attempt rather than a field that tracks anything. It is what the abandoned sweep's sentence names -- 'this cluster lost the node that was running it' is only useful if it can say WHICH -- and it is deliberately separate from builtOn.nodeId, which names the workbench replica the build ran on. On a two-replica bff building on a two-replica workbench those are four different pods and two different questions. |
| `ownerUserId` | string |  | Copied from the package row this deployment belongs to, never from the actor. It is the row-authz key, and taking it from the package is what keeps a deployment visible to exactly the people the package is -- including when the pipeline, not the person, writes the row. |
| `packageId` | string | yes | The v1:platform:package this attempt is against. |
| `report` | object |  | The analysis report (component/packages, design section E): source version, every deployable with its build plan, every DSL domain with construct counts, any Go pack, every problem found. First-class DATA rather than a log -- it is what the OS renders at the always-present confirm gate, and what a person reads a year later to see what a past deploy decided. |
| `requestedBy` | string |  | v1:identity:user.id of whoever started this attempt. Provenance on an append-only row: the timeline says who asked, not merely what happened. |
| `scopedTo` | array |  | The deployables this run was STARTED FOR, by name. Empty means the whole source, which is what every run written before this field existed was and what a run with nothing skipped still is. Without it a run recorded no trace of whose it was, and runs are routinely scoped to one app -- a redeploy from a deployable's page sends every sibling skip:true, and the compose gate does the same when entered for one declared app -- so every reader had to assume the source's newest run was about whatever it was looking at. It was not: a deployable's page read `web` building and drew ITSELF as Building, hid its own acts, and offered a Cancel that killed the other app's run (memql#4953). Filtering on the run's `deployables` outcomes is not a substitute: those are written at CLOSE, and the window where the reading is wrong is exactly the window where the run is still in flight. Stamped where the placements are read, so it is a fact about the run rather than a reader's guess, and re-stamped at the confirm because the gate is where a person answers which apps they meant. |
| `snapshotArtifactId` | string |  | The v1:library:artifact holding the content-addressed source snapshot this attempt ran against (D8). It is what makes a re-analysis repeatable without refetching, and what a person clicks to see exactly which bytes were deployed. |
| `sourceVersion` | string |  | Commit SHA or content hash of the snapshot this attempt analyzed. Empty only while the fetch itself is what failed. |
| `startedAt` |  |  | When this attempt began. |
| `status` | string | yes | Where this attempt is. The stages advance in the D6 order and each write is one @serverOnly mutation under stamped internal origin. FOUR terminal values, and the difference between them is who has work to do: 'refused' is a typed NO the analysis or a gate produced and a person can act on; 'failed' is something that broke; 'succeeded' is live; and 'abandoned' (epic memql#4900) is the sweep's, for a run whose node died mid-flight -- it is deliberately NOT 'failed', because nothing failed that anyone can name and the D6 order guarantees every site is still serving what it was serving. The sweep is the one writer allowed to close a stranded row. FIVE terminal values since epic memql#4937: 'cancelled' is a person's own stop, and it is NOT a flavour of 'failed' for exactly the reason 'abandoned' is not -- nothing broke, nothing was published, and every site is still serving what it was serving. The distinction is who decided: 'abandoned' is a loss this cluster OBSERVED, 'cancelled' is a choice somebody MADE, and a surface that collapsed the two would tell a person their own click was a fault. Only a run that has not started rolling can reach it -- see cancelRequested. (enum: analyzing, awaiting_confirm, building, staging_dsl, rolling, publishing, succeeded, refused, failed, abandoned, cancelled) |
| `stoppedAt` | string |  | The stage this run had reached when the sweep closed it as 'abandoned' (epic memql#4900). Written by the sweep alone, and only for an abandoned run: it is the one fact closing the row DESTROYS. The status field held 'building', the sweep overwrites it with 'abandoned', and the rail then reads the run's furthest point from its own leftovers -- a report, a staged version, a log tail -- of which a run that died mid-build has none. So it draws the run as having stopped at Analyze, which understates what it achieved and sends somebody looking in the wrong place. Empty for every run that closed itself. |

**Relationships:** `parent` -> `v1:platform:package`, `references` -> `v1:accounts:account`, `references` -> `v1:library:artifact`, `references` -> `v1:platform:packageDeployment`

## `v1:platform:partitionSecret`

Partition-scoped encrypted secret. Holds per-tenant sensitive values (BYOK vendor API keys, per-tenant Twilio/SMTP creds, etc.). Same wire shape as v1:platform:globalSecret, different scope. The cleartext value is NEVER stored -- only a NaCl secretbox ciphertext under MEMQL_MASTER_KEY and a fingerprint. When the partition-scoped resolver (resolveSecret) cannot find a row, it falls back to v1:platform:globalSecret so a tenant's BYOK key wins over the instance default but the instance default is always available.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back to the global v1:platform:globalSecret. |
| `addedBy` | string |  | Identity subject that wrote the secret. |
| `description` | string |  | Human-readable description of the secret's purpose. |
| `encryptedValue` | string | yes | Base64-encoded nonce \|\| NaCl-secretbox ciphertext, sealed under MEMQL_MASTER_KEY. Opaque -- never rendered to humans. @secret redacts a rejected value in the function-args validator ONLY, and matches by ARGUMENT NAME, so a mutation writing encryptedValue: args.somethingElse is not covered -- see Concept.SecretFields for the full scope. |
| `fingerprint` | string | yes | Last 4 chars of the cleartext, prefixed with '...'. For UI display only. |
| `kind` | string |  | Optional tag to group secrets by type. Examples: 'vendor_api_key', 'oauth_secret'. BYOK vendor keys use 'vendor_api_key'. |
| `lastUsedAt` |  |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` |  |  | Timestamp of the most recent rotation (optional). |

## `v1:platform:partitionVariable`

Partition-scoped plaintext configuration variable. Holds per-tenant non-sensitive overrides (default chat provider, default language, feature flags scoped to a single tenant, etc.). Same wire shape as v1:platform:globalVariable, different scope. When the partition-scoped resolver (resolveVariable) cannot find a row, it falls back to v1:platform:globalVariable so a tenant's override wins over the instance default but the instance default is always available.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back to the global v1:platform:globalVariable. |
| `description` | string |  | Human-readable description of the variable's purpose. |
| `name` | string | yes | Variable name (uppercase with underscores by convention). |
| `value` | string | yes | Variable value, always stored as string. Callers parse if they need typed data. |

## `v1:platform:providerAuthStatus`

Virtual projection of one AI PROVIDER's auth state on THIS node (epic memql#4440). Never persisted -- rows are produced at query time by the owner-only `providerAuthStatus` builtin from the live provider registry, the same shape as v1:platform:dataOrigin and v1:router:modelCatalog.
PER-NODE, and that is the point rather than a limitation. Provider auth resolves once per process at boot, so two replicas genuinely can disagree -- one restarted after a key was seeded and one not. That disagreement is the single most useful thing this read surfaces, and it is why `providersReload` broadcasts instead of acting on whichever replica the front door picked.
NO CREDENTIAL, AND NO FINGERPRINT OF ONE. `authSource` names a TIER, never a value. The page never reads a key back; "is this key good" is answered by `providerVerify` making a live call, not by comparing against something rendered here.

| Field | Type | Required | Description |
|---|---|---|---|
| `authSource` | string | yes | Which tier of the resolution chain supplied the credential. federation: Anthropic workload identity, no key at rest anywhere. globalSecret: an encrypted row -- what Settings -> AI providers writes. globalVariable: a plaintext row; right for a baseURL or a federation id, wrong for an API key. env: this pod's environment, the one source an in-app write cannot change. unresolved: nothing configured. Re-resolved at read time, so a key seeded since boot reads as globalSecret before a reload -- which is exactly the "seeded, not yet applied" state an operator is in between Save and Apply. (enum: federation, globalSecret, globalVariable, env, unresolved) |
| `available` | boolean | yes | Whether THIS node can call it right now. False is the ordinary state of a freshly installed cluster: installing spends no inference and asks for no key, so every provider registers unavailable until one is configured in Settings -> AI providers (MemQL OS). |
| `model` | string |  | The vendor model id this entry pins. Empty only for an entry that declares none. |
| `name` | string | yes | The DSL provider entry's name. Also the row id -- there is exactly one row per provider and the provider is what it is about. |
| `reason` | string |  | Why it cannot be called, in the words of the constructor that refused -- which already names the missing variable or the half-configured federation set. Empty when available. |
| `vendor` | string | yes | The provider TYPE the DSL declares (OpenAI, AnthropicChat, ...), which is what selects the Go client. |

## `v1:platform:providerConfigResult`

Virtual single-row RESULT of seeding AI provider configuration from Settings (epic memql#4440) -- `providerFederationSet`. Never persisted.
THERE IS NO VALUE FIELD, AND THERE IS NO READ-BACK CONSTRUCT. Nothing written through this path is a credential any more (epic memql#5088 removed the key-sealing sibling along with every manually entered vendor key): what an operator supplies is a set of federation ids, and what comes back is the row NAMES the resolver will try. "Is this configuration good" is answered by `providerVerify` making a live call, not by showing an operator what they typed.

| Field | Type | Required | Description |
|---|---|---|---|
| `applied` | boolean | yes | Always false: seeding does not reload. Present rather than implied, because "saved" and "in force" are the two states an operator most needs told apart -- a key that is saved and not applied is doing nothing, and the page says so. |
| `fingerprint` | string |  | Four characters derived from the sealed value, enough to tell two keys apart and useless for reconstructing either. Empty for federation, which seals nothing. |
| `message` | string |  | What the operator should do next, in one sentence. |
| `name` | string | yes | The row name written, which is the exact name the auth resolver tries. Also the row id. The VENDOR is what the caller chooses; this name is derived, so a mistyped name the resolver never tries is not a state an operator can reach. |
| `vendor` | string | yes | Which vendor the configuration is for. |
| `written` | array |  | Which variable names a federation write actually created. Empty for a key write. An omitted optional (the workspace id) writes no row at all rather than an empty one -- the resolver reads "" as absent, so an empty row would mean nothing and shadow nothing. |

## `v1:platform:providerVerifyResult`

Virtual single-row RESULT of an owner-only `providerVerify` (epic memql#4440): whether ONE live, token-free call to the vendor was accepted using the credential THIS node resolved.
A REJECTED KEY IS A RESULT, NOT AN ERROR -- verified=false carrying the vendor's own words. The distinction matters to the page: a refusal is something to show the operator in place, and an error is an exception dialog about a question that could not be asked.

| Field | Type | Required | Description |
|---|---|---|---|
| `authSource` | string | yes | Which tier supplied the credential that was tried, so a pass or a failure can be attributed to the right place. Same values as v1:platform:providerAuthStatus.authSource. (enum: federation, globalSecret, globalVariable, env, unresolved) |
| `model` | string |  | The vendor model id this entry pins. |
| `modelsListed` | integer |  | How many models the check listed. Present only on a pass; the call spends no tokens, which is what makes Verify pressable as often as an operator likes. |
| `provider` | string | yes | The provider entry that was verified. Also the row id. |
| `reason` | string |  | Why verification did not pass, in the vendor's or the constructor's own words. Empty when verified. |
| `vendor` | string | yes | The provider TYPE, which decides how verification is performed. Only Anthropic has a live check today; anything else reports that plainly rather than claiming a pass it did not observe. |
| `verified` | boolean | yes | Whether the vendor accepted the credential. False with a reason covers both "the vendor said no" and "this node has no usable client" -- the reason tells them apart, because the second never reached the vendor and must not read as a rejection. |

## `v1:platform:providersReloadResult`

Virtual single-row RESULT of an owner-only `providersReload` (epic memql#4440). Never persisted: an action's outcome is a reply, not a record. What IS recorded is the v1:identity:auditEvent line naming who asked.

| Field | Type | Required | Description |
|---|---|---|---|
| `availableOnThisNode` | integer | yes | How many providers are callable on the node that HANDLED the call, after its reload. Named so it cannot be mistaken for a fleet-wide number: the other replicas reload asynchronously off the broadcast, and their answer comes from re-reading providerAuthStatus. |
| `broadcast` | boolean | yes | Whether the reload request was published to the mesh. False would mean this node has no event bus, and the other replicas were not told. |
| `registered` | integer | yes | How many entries that node holds in total, callable or not. A keyless cluster registers every provider and can call none, so the two numbers differ by design. |
| `requestId` | string | yes | Ties every node's log line back to one Apply. Also the row id. Generated by the engine when the caller supplies none. |

## `v1:platform:readinessRecomputeResult`

Virtual, never persisted: what readinessRecompute answers -- how many modules this node just rewrote, and which node it was. One row, id "current", because it answers one question about one node rather than describing a set.

| Field | Type | Required | Description |
|---|---|---|---|
| `nodeId` | string | yes | The node that re-evaluated. |
| `written` | integer | yes | How many moduleReadiness rows were written. |

## `v1:platform:site`

A web surface this cluster serves at a hostname -- a single-page app, a static website, or the platform's own site. A site is DATA, not infrastructure: deploying one is an upload plus a row write and rolling one back is a row write, so the number of Kubernetes objects does not grow with the number of sites. The graph's own row history IS the version list.
The COMPOSITE tier -- the owner, OR a cluster owner (memql#4312). It replaced a plain clusterOwner tier when deployables became self-serve (memql#4344), and the reason the old tier gave is the reason the composite is the only form that could replace it. That reason was: a plain owner="ownerUserId" tier has NO cluster-owner escape on the read path -- enforceRowAuthzOnPlan ANDs the owned predicate unconditionally -- so on an owner-tier concept "list every site in this cluster" is not merely unimplemented, it is not EXPRESSIBLE, and the caller silently gets a subset. That query is the Deployables app's primary screen, and cluster-wide hostname uniqueness would be uncheckable for the same reason. The composite keeps BOTH statements true at once: it injects (ownerUserId==actor.userId)||(actor.isClusterOwner==true), so a user reads exactly their own deployables and an operator reads every row in the cluster -- which is what makes "list every site" expressible, and what lets the Go hostname-uniqueness probe see rows it does not own. Going the other way (staying clusterOwner and adding an owner field) would have made every self-serve read return nothing to the user who created the row.
ownerUserId EMPTY means cluster-owned, and the seeded platform-site row is the case: sameRowAuthzOwner refuses an empty owner outright, so a cluster-owned row is reachable through the admin branch alone -- never by a caller who happens to have no identity resolved.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The v1:accounts:account this deployable is FOR -- the client whose storefront or site this is (epic memql#4800, D5). Optional, and a plain reference with NO read effect: row authorization on this concept is exactly what it was, no query narrows on this field, and a site with no tie resolves, serves and lists precisely as it always has. An account is a record of who work is for, never a visibility scope (D1) -- the pressure to make it one will arrive because a registry of clients looks like a tenancy model, and the answer is that client ACCESS rides the guest-invitation machinery pointed at an account instead. Together with v1:accounts:account.domain this is the whole of what the custom-domains epic consumes from the registry (D9): a site tied to a client suggests that client's own domain when an operator adds one. Set and cleared from the Deployables site detail's account picker. |
| `apiProxy` | boolean |  | Mount /_memql/* on this origin, forwarded to the bff, so the site is same-origin with its own API. Removes CORS and the SameSite=Lax cookie problem entirely. |
| `artifactId` | string |  | The v1:library:artifact row this site's current bundle was published from, when it was published from the Library rather than uploaded by CI or baked into the image. Provenance, not a serving input -- the edge reads bundleRef and never this. Empty for a site whose bundle arrived through POST /sites/{id}/bundles or file:///app/*. |
| `binding` | object |  | Per-kind connection to the system this site fronts. Shape is decided by `kind`, and only one kind declares one today: shopify_storefront => {storeDomain, storefrontTokenRef}, where storeDomain is the myshopify.com host and storefrontTokenRef NAMES a v1:platform:globalSecret row holding the Storefront API token -- the token itself is never stored here, and the Admin API token never appears in either field. Empty for spa and static. A Storefront token is a client-side credential by Shopify's design, so the edge resolves the named secret at serve time into the site's runtime-config document; that is the only place it is dereferenced. |
| `bundleRef` | string | yes | URI of the bundle to serve, one of three usages. 'file:///app/os' -- the platform's own site, MemQL OS, baked into the image (it was 'file:///app/portal' until epic memql#4984 retired the portal); deploy and rollback are an image rollout and an image rollback. 'file:///app/sites/<name>' -- a site a monorepo cluster bakes into the edge image at build time (or a working-tree path for the dev inner loop); deploy and rollback are the same image rollout/rollback. 'blob://sites/<id>/<version>/' -- an uploaded bundle in object storage; deploy is an upload plus a row flip in seconds, rollback is one row write. Bake what ships with the cluster; upload what changes on its own clock -- a typo fix on a landing page must not roll the node serving every other site, and marketing copy diverges from engine cadence immediately. |
| `deleted` | boolean |  | Soft-delete flag (memql#3717). isNotDeleted filters it out of siteByHostname/sitesAll/siteById so the edge stops resolving a deleted site's hostname; the row survives for history. deleteSite stamps this true. A systemOwned row is refused at the write path regardless of this field -- see the Go guard wired beside executeWrite. |
| `hostname` | string | yes | Fully qualified host this site answers on, e.g. shop.example.com. Cluster-unique. A USER-owned site must be <slug>.<domain> -- slug [a-z0-9-]{3,40}, not one of the reserved labels (api / identity / mcp / portal / www / admin / mail), and the domain is the one the cluster serves, derived through component/frontdoor rather than supplied. Any other hostname -- a custom apex, a second domain -- is cluster-owner-only, because the cloud front-door certificate names exact hosts (memql#4224) and only the *.<domain> Ingress rule routes without an operator step. It is no longer HAND-certified: a CLIENT's own domain is bound through v1:platform:customDomain (epic memql#4805), which verifies two DNS records and then provisions the exact-host Ingress and Certificate itself -- this field stays the site's OWN hostname either way, and a binding never changes it. Enforced in Go beside the systemOwned-delete refusal (component/memql/platform_site_hostname_policy.go), because neither the slug rule, the reserved list, cluster-wide uniqueness nor an actor-conditional exemption is expressible in a mutation body; the mutation carries the shape half (@pattern / @maxLength). |
| `kind` | string | yes | Tail of the request-resolution order. 'spa' falls back to index.html so client-side routing works; 'static' answers 404 so a mistyped path in a multi-page site is visible rather than silently rendering the home page. Authored as an open enum rather than a closed one, and the reason is worth keeping even though the case that motivated it did not ship: a third value, 'server', was designed in epic memql#3718 -- bundleRef naming a container image instead of a bundle prefix, reconciled by a narrow controller into a Deployment + Service with the edge proxying to it rather than serving bytes -- and that epic was CLOSED UNBUILT, because its motivation is migrating a customer's existing Rails/Laravel/Django/Express app and no such migration exists. Do not read 'server' as queued work; read it as the demonstration that a new kind is additive here, touching neither the front-door host rules, the TLS model, the platform's own site, the publish path, nor this concept. Whatever the next kind turns out to be, it costs a value and its resolution tail. 'shopify_storefront' (memql#4344) is the demonstration and the first addition: it is a SPA the edge serves at <slug>.<domain>, so its resolution tail is 'spa' exactly, and everything that makes it a storefront rides `binding` and the runtime-config document. Checkout is Shopify's hosted checkout; orders and inventory arrive by webhook, never through the storefront. Android, iOS and macOS deliberately have NO value here (design D5). They are artifact DISTRIBUTION -- stores, TestFlight, notarisation -- not hostname-resolved web surfaces, so there is nothing for the edge to resolve and a value that never resolves would be the wrong kind of additive. The Deployables app shows them as disabled 'coming soon' kinds with no schema behind them. TestSiteKindEnumIsExactlyThreeValues pins this list so the next addition is a decision rather than a drift. (enum: spa, static, shopify_storefront) |
| `notes` | string |  | Operator-facing notes. |
| `ownerUserId` | string |  | v1:identity:user.id that owns this deployable, or EMPTY for a cluster-owned site. Stamped from the actor on create by createSite, which is what makes the tier below true rather than aspirational. A write made as the DEPLOYMENT -- a cluster owner, a system actor, or trusted server-side Go -- has that stamp undone and produces a cluster-owned row instead; the seeded platform site is the one the platform ships that way, and re-running createSite on an existing id is how an operator hands a site over or takes it back. It is the row-authz key: the composite tier compares it against actor.userId and ORs in the cluster-owner branch, so a user reads and writes exactly their own sites while an operator reads every one. NOT `string!` -- an empty value is the meaningful cluster-owned state, and `string!` would refuse the platform-site seed. |
| `packageDeployableName` | string |  | The manifest deployable name this site serves (epic memql#4794, D2/D7). Together with packageId it is the key a redeploy republishes through -- which is exactly why the manifest refuses two deployables sharing a name. Empty whenever packageId is. |
| `packageId` | string |  | The v1:platform:package this site was deployed from (epic memql#4794, D7), or EMPTY for a hand-made site -- which stays fully supported and is the majority of rows today. Set by the pipeline on the FIRST deploy of a package deployable and never cleared, because it is what a redeploy uses to find the site it published last time instead of creating a second one at a second hostname. |
| `settings` | object |  | Key-values a bundle reads at runtime (epic memql#4906, decision P7): the edge merges them into the site's runtime-config document under `settings`, so a bundle reads `config.settings.apiBase` and one bundle serves two deployables against different endpoints without a rebuild. A flat object of PLAIN STRING values under keys of the form [A-Za-z][A-Za-z0-9_]{0,63}, at most MEMQL_SITE_SETTINGS_MAX_KEYS of them and each value at most MEMQL_SITE_SETTINGS_MAX_VALUE_LENGTH characters -- enforced in Go beside the status guard (component/memql/platform_site_settings_guard.go), because a mutation body sees a value and never an object's keys. NOT A PLACE FOR A SECRET: the document is served to every visitor's browser, unauthenticated, so a value here is public by construction. A key ending in `Ref` is refused so nobody invents a naming convention the edge does not honour -- the storefront binding's storefrontTokenRef on `binding` is the one reference the edge resolves, for exactly one kind. Written whole by updateSiteSettings (a replace, so clearing is expressible); a systemOwned row refuses the write like every other status-class write, because the seed would revert it. Absent and empty read the same: the document carries an empty object. |
| `status` | string | yes | 'draft' resolves for nobody (404); 'live' serves; 'disabled' answers 503 rather than 404 so a deliberately paused site is distinguishable from a typo'd hostname; 'archived' (epic memql#4794, D10) is decommissioned and answers 404, because to the internet it is gone rather than paused. NOTE: @default is never applied on insert (memql#2960) -- createSite fills this with ??. The lifecycle is draft -> live <-> disabled -> archived, and ARCHIVE REQUIRES DISABLED FIRST plus a typed-name confirmation the SERVER verifies (updateSiteStatus / archiveSite); a systemOwned row is exempt from the whole axis and refused at the write path. Adding a fourth value was safe only because component/edge stopped listing what does NOT serve and started listing what does -- a serve-by-default switch would have made an archived site keep answering 200. (enum: draft, live, disabled, archived) |
| `systemOwned` | boolean |  | Blocks deletion. The platform's own site only -- MemQL OS: its row is re-seeded at boot, so an operator cannot brick cluster management by deleting it. Does NOT branch the serving path -- see TestPlatformSiteHasNoSpecialCaseInTheServingPath. |
| `title` | string |  | Operator-facing label shown in the site list (MemQL OS, Deployables). |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:platform:package`, `references` -> `v1:library:artifact`, `references` -> `v1:accounts:account`

## `v1:platform:sourceCredential`

A PERSON'S credential for reading a private source (epic memql#4885, D10). One row is one token on one host, sealed once, server-side, and named by the packages that fetch under it.
It replaces the cluster-wide globalSecret a package used to NAME: any package owner could name any secret, so the fetcher could be made to fetch under an owner's token by whoever knew the name. Here the credential belongs to the person, the composite tier decides who reads it, and the fetcher resolves it under the PACKAGE OWNER's actor -- so a package naming somebody else's credential resolves zero rows and is refused by name, before any request leaves the cluster.
The COMPOSITE tier, for the reason v1:platform:site and v1:platform:package record: a plain owner tier has no cluster-owner escape on the read path, so "every credential in this cluster" would not be EXPRESSIBLE and an operator would silently read a subset. A cluster owner reads every row's METADATA -- host, label, fingerprint, last used -- which is the oversight the tier exists for, and can decrypt none of it from a browser: `sourceCredentialCard` projects everything but the ciphertext, and decryption happens only inside a fetch.
A REVOKED ROW IS NEVER DELETED. It is the audit history of what fetched under it -- every deployment whose source arrived through this token is a fact about this row -- and a deleted row answers no question anybody asks after an incident. Revocation flips `status` and stamps `revokedAt`; rotation is adding a new credential and switching a source to it.

| Field | Type | Required | Description |
|---|---|---|---|
| `encryptedValue` | string | yes | Base64-encoded nonce \|\| NaCl-secretbox ciphertext of the token, sealed under MEMQL_MASTER_KEY by component/secret.Encrypt on the node that received it. Opaque -- never rendered to humans, never projected by a client-readable shape, and unsealed only inside a fetch into a local that dies with the call. @secret redacts a rejected value in the function-args validator ONLY, and matches by ARGUMENT NAME, so a mutation writing encryptedValue: args.somethingElse is not covered -- see Concept.SecretFields for the full scope. |
| `expiresAt` |  |  | When the user token in `encryptedValue` stops working. Compared before a user-scoped call and refreshed server-side when it has passed; never a reason to refuse on its own, because a refresh is the ordinary path and only its failure is news. |
| `externalId` | string |  | The GitHub user id (a number, stored as text). The stable key a reconnect updates IN PLACE, which is what stops a person accumulating one row per connect and what makes a rename a no-op. Empty for kind='token'. |
| `fingerprint` | string | yes | The last four characters of the token, prefixed with '...', for telling two credentials apart in a list without revealing either. Display only. |
| `host` | string | yes | The host this token authenticates against. `github.com` today, and the only value sourceCredentialCreate admits; the probe and the fetcher match on it, so a credential can never be presented to a host it was not minted for. |
| `installationIds` | array |  | The GitHub App installations this grant can reach, read from GET /user/installations at connect and kept current by `installation` and `installation_repositories` webhooks. It is what makes 'the app is not installed on that repository' answerable as repository_not_installed with an installation link, instead of arriving as a 404 the fetcher would have to read as 'private, or not there'. Empty for kind='token', and empty for a grant whose only installation is still awaiting an organization owner's approval -- a pending installation is not a reachable one. |
| `kind` | string |  | How this credential was obtained, and therefore what the engine may do with it. `token` is a value a person pasted; `github_app` is an authorization grant from the GitHub App, whose `encryptedValue` is a user token the engine refreshes and whose background work runs on installation tokens minted from the app's private key instead. NOT `string!` and DELIBERATELY not required: every row written before Connect existed carries no value, and an ABSENT kind must read as `token` -- the pre-Connect behaviour, the reading that asserts least. A row is never rewritten to add it. (enum: token, github_app) |
| `label` | string | yes | The person's own name for it -- 'work laptop', 'acme deploy key'. Display only; nothing keys on it. |
| `lastUsedAt` |  |  | When the fetcher or the poll last unsealed this credential. A HEARTBEAT stamped by the engine on every fetch and every poll, and it must never enter an arrival-cue fingerprint: a surface that re-fired on it would announce a change every time a scheduled poll ran, which is exactly the 'a heartbeat is not news' failure clients/os/README.md names. Empty until the first use. |
| `login` | string |  | The GitHub login the grant belongs to -- what 'Connected to GitHub as @octocat' says. Display only, and re-read from GET /user on every connect, so a rename follows: the STABLE key is externalId, never this. Empty for kind='token'. |
| `ownerUserId` | string |  | v1:identity:user.id of the person this credential belongs to. Stamped from the actor by the writer (createSourceCredential), never accepted from an argument -- it is the row-authz key the composite tier compares against actor.userId, and a caller-supplied value would record a guarantee nothing provides. NOT `string!`, for the reason its siblings are not: the declaration form is shared, and an empty value is the meaningful cluster-owned state even though nothing writes one here. |
| `refreshToken` | string |  | Base64-encoded nonce \|\| NaCl-secretbox ciphertext of the OAuth refresh token, sealed exactly as `encryptedValue` is. A user token expires in eight hours and this is how the engine mints the next one WITHOUT sending the person back through the browser; the refresh token itself lasts six months, after which reconnecting is the only repair and the fetch says so by name (reconnect_required). Projected by no client-readable shape, for the reason `encryptedValue` is not. |
| `revokedAt` |  |  | When it was revoked. Set by revokeSourceCredential and never cleared; the row is never deleted. Read it only alongside `status`: a grant that was disconnected and then reconnected is `active` and still carries the timestamp of the last disconnect, because a datetime cannot be cleared and the fact is true history rather than current state. |
| `status` | string | yes | 'active' fetches; 'revoked' refuses every fetch and poll under it with credential_revoked, and the row stays. The transition is one-way: a revoked credential is not reactivated, a new one is added. (enum: active, revoked) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:platform:syncState`

Per-(concept, connector) SYNC HEALTH (epic memql#4378, D7). Health is a ROW, not a log line: an operator asking "is the Shopify mirror current" needs an answer that survives a restart and can be read from a page, not a grep over one replica's stdout.
Written ONLY by the sync runtime -- the inbound dispatcher, the backfill and reconciliation runners, and the outbox drain worker. Deterministic id per (concept, connector, direction), so the append-only version history IS the health timeline.
clusterOwner for the same reason outboxEntry is: this is the deployment's operational state.

| Field | Type | Required | Description |
|---|---|---|---|
| `backfillCursor` | string |  | Opaque connector cursor for a resumable backfill. Persisted after EVERY page, so a restart resumes rather than restarts. |
| `backfillStatus` | string |  | Where the backfill stands. `none` is the default -- never run -- and is distinct from `complete`. (enum: none, running, complete, failed) |
| `conceptId` | string | yes | Canonical id of the concept this row reports on. |
| `connector` | string | yes | Connector name on the other side. |
| `deadLetterCount` | integer |  | Entries that exhausted their attempts and are waiting for an operator. Never decreases on its own. |
| `direction` | string | yes | inbound: MemQL mirrors this concept and the connector fills it. outbound: MemQL originates it and the connector drains the outbox. A concept can have a row in each direction. (enum: inbound, outbound) |
| `driftCount` | integer |  | Rows the last sweep found disagreeing with the origin. Zero after a clean sweep; non-zero is the number worth investigating even after healing, because repeated drift is a webhook that is not arriving. |
| `lagSeconds` | integer |  | Seconds between the origin's version of the last applied write and when MemQL applied it. A mirror's staleness, in the only unit an operator can act on. |
| `lastError` | string |  | Truncated error from the last failure on this domain, whichever runner produced it. |
| `lastInboundAt` |  |  | When the last inbound delivery for this domain was applied. |
| `lastReconcileAt` |  |  | When the last reconciliation sweep finished. |
| `outboxDepth` | integer |  | Pending + failed entries for this (concept, connector). The number that says whether the drain is keeping up. |
| `paused` | boolean |  | Operator pause switch. Stops the backfill and reconciliation runners and the drain for this domain, without unregistering the connector or changing any declaration. |

## `v1:rbac:capability`

A single authorization GRANT: the right to apply one primitive verb to one resource type, attached to a role. Capability = (verb x resourceType) for a role. This is the atomic unit of the consolidated RBAC model (epic memql#2062). The five verbs (read/create/update/delete/execute) are UNIFORM across every resourceType, including `principal` -- applying a verb to the principal resource is how user-management governance is expressed (E1.3): e.g. `update` on a principal, gated by a rank+self predicate, means 'edit a user'; `create` on a principal means 'add a user' WITHOUT necessarily being able to edit existing ones (the create != update split). A role's effective grants are the union of its capability rows. Global / immutable reference data: authored as `seed` rows materialized into _system, readable by every principal, never per-user-owned. PUBLIC per-row-authz tier -- it is deployment-wide config, not user data. roleSlug points at the role this grant belongs to; the role rows themselves land in E1.2 (memql#2070), so until then capabilities reference a role purely by its stable slug string.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. An inactive capability is ignored at resolution time but kept for audit. Lets a custom role's grant be retired without churning the row history. |
| `description` | string |  | Human-readable note explaining WHY this grant exists. Surfaced in the cockpit RBAC view. Optional; seeded capabilities carry one for auditability. |
| `effect` | string | yes | Whether this capability GRANTS (allow) or explicitly REVOKES (deny) the (verb,resourceType) for the role. allow is the overwhelming common case and the default. deny exists so a higher-ranked role or a custom role can carve a hole in an otherwise-broad grant (e.g. a finance role that is otherwise admin-like but must never `execute` on `deployment`); a deny always wins over an allow at resolution time. E1.6 (memql#2074) resolves an effective decision as: an allow capability exists AND no deny capability exists for the same (role,verb,resourceType). (enum: allow, deny) |
| `predefined` | boolean |  | True for capability rows authored by dsl/rbac/*.memql `seed` declarations on every startup -- the immutable base-role grant set (E1.2 marks these read-only at runtime so a base role can never be redefined to escalate). User-/custom-role capabilities minted via the rank-bounded mutation (E1.4) default to predefined=false and are editable within their creator's rank bound. |
| `resourceType` | string | yes | The kind of resource the verb applies to. Uniform verb set means the SAME five verbs are meaningful against every resourceType. Canonical values seeded in this domain: `principal` (a user/identity -- the governance-bearing resource; verbs on it gate user management per E1.3), `construct` (DSL authoring -- create/update/delete map to the MCP define/author surface, execute maps to inline DSL), `data` (graph rows -- the read/write data plane), `deployment` (cut-version / deploy / rollback actions, reached via `execute`), `agent` (agent templates), `group` (org groups), `role` (the RBAC role catalog itself -- create/update/delete on `role` is what bounds custom-role authoring in E1.4). resourceType is an open string (not a closed enum) so product layers can introduce their own resource kinds without an engine change; the seeded set above is the core vocabulary. |
| `roleSlug` | string | yes | Stable kebab-case slug of the role this capability is granted to (e.g. 'owner', 'developer', 'admin', 'user', or a custom-role slug). A foreign-key-by-slug into the v1:rbac:role catalog -- matched against role.slug, not the role's node id (mirrors how v1:agents:agent.roleSlug references v1:agents:agentRole.slug). A role's effective capability set is every capability row with a matching roleSlug. |
| `verb` | string | yes | The primitive verb this capability grants. The five verbs are the COMPLETE, uniform set across every resourceType -- there is deliberately no separate `grant`/`manage`/`admin` verb. read = observe a resource. create = bring a new resource into existence. update = modify an existing resource. delete = remove a resource. execute = run/invoke a resource (a tool, an automation, a deploy action). The create != update split is load-bearing for governance (E1.3): a role can hold `create` on principals of a given rank without holding `update`, i.e. 'mint developers but not edit existing ones'. (enum: read, create, update, delete, execute) |

## `v1:rbac:grant`

A GRANT TO A PERSON OR A GROUP: one (verb x resourceType) decision, allow or deny, whose subject is a v1:identity:user or a v1:identity:group rather than a role (epic memql#5294, the app access grants record, decision D6). It sits BESIDE the role catalog and never inside it: `capability` says what a ROLE holds and `grant` says what a PERSON or a GROUP holds over and above their role, and the two have different lifecycles and different caches -- the catalog is loaded once and reloaded on its events, a grant is read per request and never cached.
A ROLE IS NEVER A SUBJECT HERE. A role's abilities are edited on the role, as capability rows, and putting them in two places is how they drift: a `deny` on a role written here and an `allow` written there would be two answers to one question with nothing to say which wins. `subjectKind` is therefore a closed two-value set, and a resolver that met a third would have no level to place it at (the record's rule is person over group over role).
THIS ROW IS THE DEPLOYMENT'S, NOT ANYONE'S PROPERTY, and that is why the tier is `@rowAuthz(clusterOwner, rankFloor="admin")` with no owner field at all. The obvious owner would be the subject -- and an owned row admits its owner's INSERTS, so scoping a grant to the person it names would hand every signed-in person a primitive for granting themselves an app. The granting user is not the owner either: a grant outlives the person who wrote it and is revoked by whoever holds the authority then, not by whoever held it once. So the row belongs to the deployment, is READABLE from admin rank (the floor relaxes the read and leaves the write at clusterOwner, memql#5216), and is WRITTEN only by Go under internal origin through the two @serverOnly mutations below -- exactly as v1:identity:group and groupMembership are.
THE ROW ID IS DERIVED from (subjectKind, subjectId, verb, resourceType), the way groupMembership derives its id from (group, user): re-granting writes a new VERSION of one logical row rather than a second row, and revoking writes `active: false` at the same id so history survives. Every reader collapses to the newest version per id first, because MemQL rows are append-only.
`subjectId` IS POLYMORPHIC AND STORED BARE, discriminated by `subjectKind` -- the v1:identity:auditEvent `targetType` / `targetId` shape. A single field cannot carry two @relationship targets, and a relationship declared for one kind would canonicalize the other kind's id under the wrong concept; two nullable typed fields would make the derived id and the resolver branch on which one is set. So the field is exempted from the id-bearing-field gate by name, and the resolver matches it against both spellings of the actor's ids.
RESOLUTION (component/auth.CapableFor): the role catalog answers first, with its own deny-wins inside that level; the actor's active GROUP grants overlay it, deny winning if the actor's groups disagree; the actor's own USER grants overlay that. Most specific wins across levels, deny wins within a level. No expiry: a stale grant is revoked by a person, not by a clock.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag, as capability.active. Revoking writes a new version with active=false at the same derived id, so the decision and its reversal are both history. Only an ACTIVE grant is consulted at resolution time. |
| `effect` | string | yes | Whether this grant WIDENS (allow) or NARROWS (deny) what the subject's role answers. Both are legal at every level (D1): a person can be handed an app their role lacks, and a person can be barred from one their role holds. (enum: allow, deny) |
| `grantedBy` | string |  | The v1:identity:user who wrote this version of the grant -- the audit answer to 'who decided this'. NOT the owner: the row belongs to the deployment, and the writer's authority was checked in Go before the write. |
| `resourceType` | string | yes | The open resource string the catalog already uses, so an app (`app:<appId>`) or a part of one (`app:<appId>/<part>`) is written the way `deployment` or `construct` is. A grant may name any resource kind a role can hold. |
| `subjectId` | string | yes | The BARE id of the v1:identity:user or v1:identity:group the grant is for, discriminated by subjectKind. Stored bare (the wire spelling) and matched against both spellings on read; a person's or group's own id, never a role slug. |
| `subjectKind` | string | yes | What kind of principal the grant names. `user` points subjectId at a v1:identity:user; `group` at a v1:identity:group. A role is deliberately NOT a value here -- a role's abilities live on v1:rbac:capability and nowhere else. (enum: user, group) |
| `verb` | string | yes | The catalog's five verbs, uniform across every resource type. Opening an app is `read` on `app:<id>`; a named part of an app is `execute` on `app:<id>/<part>`. (enum: read, create, update, delete, execute) |

**Relationships:** `references` -> `v1:identity:user`

## `v1:rbac:role`

A named, RANKED bundle of capabilities -- the role half of the consolidated RBAC model (epic memql#2062). A role's effective authorization is the union of its v1:rbac:capability grants (joined by roleSlug). E1.2 (memql#2070) authors the FOUR base roles as immutable seed rows: owner (400) > developer (300) > admin (200) > user (100). The rank ordering is the locked decision -- developer OUTRANKS admin (the power axes differ: developer is engineering authority, admin is user-management authority) and owner is self-managed only. Ranks are spaced integers (not 1/2/3/4) precisely so E1.4 (memql#2072) custom roles can SLOT BETWEEN existing ranks (e.g. a 'lead' at 250 sits above admin but below developer) without renumbering. The governance predicates in E1.3 (memql#2071) compare actor.rank vs target.rank to decide who-can-manage-whom. Base roles are IMMUTABLE at runtime: predefined=true rows are re-materialized from this DSL on every boot and a Go pre-insert guard (validateRbacBaseRoleImmutable) rejects any non-system-actor write to them, so a base role can never be redefined as data to escalate privilege. Custom roles (predefined=false) are addable as DATA via the rank-bounded createRole path in E1.4. Global / _system reference data: readable by every principal so any node resolves a rank locally; PUBLIC per-row-authz tier.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  | The ACCOUNT this role is scoped to, or empty for a global one (epic memql#5166, D10). A scoped role is offered to and holdable by members of that account's groups only -- auth.MayAssignRole refuses to put it on somebody outside, at both seams that assign a role. What is scoped is who may HOLD it, never who may SEE that it exists: a scoped role appears in the ladder like every other, because every client draws ranks on the whole ladder and a rung missing from one client's copy is a rank that resolves differently there. Empty is the overwhelming common case and the only value the seeds write. THE AUTHOR IS NOT A FIELD HERE and deliberately so -- `createdBy` is a row intrinsic the engine stamps from the acting caller, so a payload copy would be a second answer to the same question, free to disagree with the row it sits in. |
| `active` | boolean |  | Soft-deactivate flag. An inactive role disappears from pickers but principals already carrying it keep resolving (their grants still apply) until reassigned. Base roles are never deactivated (the immutability guard blocks it). |
| `aliases` | array |  | Other slugs that resolve to THIS rung. The legacy five on v1:identity:user.role (owner/admin/developer/writer/reader) are not the five this catalog seeds (owner/developer/admin/user/viewer): `writer` is an alias of `user` and `reader` of `viewer`. Those two facts lived only in prose -- in this file, in seeds.memql, and in component/auth/rbac_model.go's translation table -- which meant every consumer that wanted the ladder needed its own copy of the mapping. That is exactly how the engine and MemQL OS came to ship two ladders that disagreed (epic memql#4832, D1). As DATA the ladder is self-describing: a client reads activeRoles, sorts by rank, resolves its own role slug through slug-or-alias, and carries no table of its own. A custom role may declare aliases too; a slug already taken by a base role wins, so an alias can never re-point an existing rung. And a PREDEFINED role's alias claims are applied before a custom role's (epic memql#5166): `writer` and `reader` are alias-ONLY rungs, so there is no slug to win them back, and without that ordering a custom role could claim `reader` outright and re-rank every viewer in the cluster. |
| `description` | string |  | One- or two-line description of the role's authority. Surfaced in the role picker's expanded view and the cockpit RBAC audit surface. |
| `name` | string | yes | Display name shown in the cockpit RBAC view and role pickers, e.g. 'Owner', 'Developer', 'Admin', 'Member'. |
| `predefined` | boolean |  | True for the four base-role rows authored by dsl/rbac/seeds.memql on every startup. predefined=true marks the row IMMUTABLE at runtime: the validateRbacBaseRoleImmutable Go guard rejects any non-system-actor write to it (a base role cannot be redefined / re-ranked / deactivated as data -- the escalation-by-redefinition block). User-created custom roles (E1.4) default to predefined=false and are editable within their creator's rank bound. |
| `rank` | integer | yes | Numeric privilege rank -- HIGHER is more privileged (the inverse of the legacy auth.RoleLevel where lower=higher; the DSL model flips it so 'higher rank' reads naturally). The locked base ranks are owner=400 > developer=300 > admin=200 > user=100. Spaced by 100 so custom roles slot between without renumbering (E1.4). The E1.3 governance predicates gate management on actor.rank > target.rank (plus the self / owner-only carve-outs). A creator minting a custom role in E1.4 may not set a rank at or above their own -- enforced by the validateRbacCustomRoleRankBound Go guard (a creator can only author roles STRICTLY BELOW their own rank). |
| `slug` | string | yes | Stable kebab-case identifier -- the value v1:rbac:capability.roleSlug points to and the value a principal's role resolves to. Never renamed (rename = new row + migration). The four base slugs are 'owner', 'developer', 'admin', 'user'; custom roles pick their own stable slug. |

**Relationships:** `references` -> `v1:accounts:account`

## `v1:router:budget`

Spend limit for a partition or a specific agent within a partition. The router checks the current-period spend against this cap before every AI call; over-budget calls are refused with a typed error that surfaces in the UI as a clear 'budget reached' state. Rolls over at periodType boundary (UTC day, week, or month).

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the budget is ignored (calls proceed unchecked). Useful for temporary overrides during incident response. |
| `alertSent` | boolean |  | True when the threshold alert for the current period has been emitted. setBudget does not write it, and it does not need to: an absent value reads as false, i.e. not yet alerted, which is the correct born state. Reset to false on period rollover. |
| `alertThresholdPct` | integer |  | Emit an alert event when spend crosses this percentage of the limit (e.g. 80 for early warning). 0 disables early alerts. |
| `limitUSD` | number | yes | Maximum USD spend allowed during one period. The router refuses calls once ledger totals reach this figure. |
| `periodType` | string | yes | Budget window. Resets at UTC midnight / Monday / first-of-month. (enum: daily, weekly, monthly) |
| `resetAt` |  |  | The next UTC moment the period rolls over. The router uses this to decide whether to reset alertSent. |
| `scope` | string | yes | Whether this budget caps the whole partition or a single agent. (enum: partition, agent) |
| `scopeId` | string |  | When scope=agent, the v1:agents:agent id being capped. Empty when scope=partition. |

**Relationships:** `references` -> `v1:agents:agent`

## `v1:router:call`

One AI invocation recorded by the MemQL AI Router. Every call through the router -- agent replies, prompt renders, suggest endpoints, TTS, transcription -- produces exactly one row here with attribution, token counts, latency, and cost. Partition-scoped usage ledger; the time-series axis rides the shared MemoryNodes hypertable. @rowAuthz(public, requiresIdentity) -- THE TIER THAT IS TRUE OF THIS ROW, and it is not the one memql#5162 recommended. The issue asked for an unowned RANK FLOOR; measuring the readers showed a rank floor cannot serve them.
`userId` here is ATTRIBUTION -- the person whose call was served -- and not ownership. The row is the DEPLOYMENT'S: nobody can delete it, nobody can edit it, and it exists whether or not that person still does. So `owner="userId"` was the obvious declaration and the wrong one; it asserts a guarantee nothing provides, and TestDeclaredOwnerFieldsAreServerStamped refuses it, correctly -- recordRouterCall writes the field from CALLER ARGS. It cannot be server-stamped either, because the writer's actor IS system:router, so stamping actor.userId would make the router the owner of every row.
THREE CONSTRUCTS READ THIS CONCEPT AND THEIR AUTHORIZATIONS ARE THREE DIFFERENT KINDS. That is the measurement memql#5162 did not have, and it is what rules a rank floor out:
  routerDecisionsRecent   @requiresRank("admin")        admin and above   routerCallsInWindow     actor.isClusterOwner==true    the maintenance principal   routerCallsOnMachine    NO rank gate -- fleetSharingLedger proves the                           caller owns the machine first, and the surface                           argument is derived from a registration already                           proven theirs                 ANY rank
The Fleet app carries no role floor, so the third reader is a plain writer who paired a laptop, asking how busy their own machine has been. A rank floor on the ROWS would empty that surface for exactly the person it is for -- and with no error, which fleetSharingLedger's own description refuses by name: a read that fails answers `readable: false` rather than zero, because telling somebody who lent their machine that nobody used it is a specific claim and a failed read is not evidence for it.
So the honest tier is the one that says there is no row-level distinction this concept can draw, AND that this is not an invitation to the internet. That is what requiresIdentity is for in its own words, and its documentation prescribes what comes next: authorization for such a concept lives at the SURFACE, where @requiresRank puts it. All three gates above are already there.
WHAT THIS CHANGES, since a tier that changed nothing would be the failure memql#5162 is about: the concept leaves the undeclared population, where it admitted EVERY caller on the read path and on the subscription path -- including an anonymous one, because `rowAuthzAdmits` answers ADMIT for an undeclared concept. An anonymous caller is refused now. What it does not change is which signed-in callers reach it through an unbound read; that stays the surfaces' business, and saying so plainly is the point.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Agent whose reply this call was generating; empty for non-agent AI calls (suggest, render, TTS, etc). |
| `billing` | string |  | Who PAID for this call (memql#4362, memql#4681). metered = MemQL's own vendor spend, which is what totalCost is about and what the dollar ceiling counts. subscription = the call ran inside an app the user already pays for, so the tokens are real but MemQL was not billed for them. local = the call ran on a model hosted by one of the user's OWN MACHINES, so there is no vendor and no bill at all; it must be STAMPED EXPLICITLY by the fleet path and is never inferred, because inferring it would claim work ran on somebody's hardware when nobody established that. unknown = the surface could not tell, which is recorded AS unknown rather than folded into any of the others -- the number the owner asked for, what they were actually charged for, is only worth having if silence stays visible. An absent value reads as metered, the conservative direction: unattributed spend counts against the ceiling rather than disappearing into a bucket the ceiling cannot see. (enum: metered, subscription, local, unknown) |
| `cachedInputCost` | number |  | USD cost of the cached-input portion. |
| `cachedInputTokens` | integer |  | Portion of input tokens served from the provider's prompt cache. |
| `considered` | array |  | The door report: [{entry, door, reason}] for every chain entry the walk passed over, in the order it tried them, plus the one it took. KEPT ON SUCCESS as well as on a refusal -- what a chain did not pick is half the decision, and it is the only way to tell a policy that had no alternative from one whose alternatives were all shut. |
| `degraded` | boolean |  | True when the chain was exhausted at the requested level and the winning rule said degrade, so the router walked down a level. No degradation is silent: this field and servedLevel are what say so. |
| `door` | string |  | Which door the winning entry belongs to: a model on the user's own hardware, a signed-in subscription app, or a metered vendor. The same three words v1:platform:inferenceStatus.doorsOpen uses. (enum: local, app, federation) |
| `errorCategory` | string |  | Short classifier when outcome=error: timeout, rate_limit, auth, upstream, cancelled, other. |
| `errorMessage` | string |  | Truncated error string for debugging (max 500 chars). Must not contain PII or secrets. |
| `executionSurface` | string |  | Where the call ran (memql#4362, memql#4681): empty for MemQL's own provider calls, 'cockpit-app:<appId>' for a call made by a local app on a user's machine through a delegated session, 'fleet:<registrationId>' for a model served by a machine in the user's fleet. Lets a cost reader separate 'what we spent' from 'what ran somewhere we do not pay for' without joining to the session or registration row -- and, for the fleet case, answers 'which of my machines did this' from the ledger alone. |
| `fallbackFromModel` | string |  | On outcome=fallback_used rows, the model that failed and triggered the retry. Empty on ok/error/cancelled rows. |
| `inputCost` | number |  | USD cost of non-cached input tokens for this call. |
| `inputTokens` | integer |  | Tokens in the input/prompt. |
| `level` | string |  | The level the call was resolved at, after any rule override. A call declares a level rather than a model; the four are closed. (enum: fast, strong, reasoning, embeddings) |
| `machineOwnerUserId` | string |  | Whose machine served a local call. Empty until shared team machines land (epic memql#5146); a local call on the caller's own machine leaves it empty rather than repeating userId. |
| `minContextTokens` | integer |  | The context-window floor this resolution was made against, estimated from the rendered prompt plus the completion budget. Never zero. It sits beside the winning model's window, which is what makes an under-counted estimate diagnosable rather than merely wrong. |
| `model` | string | yes | Model identifier as sent to the vendor (e.g. gpt-5.4-mini, claude-sonnet-4-6). |
| `outcome` | string | yes | Final state of this call. `fallback_used` marks a failed pre-flight attempt in a policy chain whose successor succeeded (or failed and fell further). (enum: ok, error, cancelled, fallback_used) |
| `outputCost` | number |  | USD cost of output tokens for this call. |
| `outputTokens` | integer |  | Tokens generated in the output. |
| `policy` | string |  | Name of the policy that rule named, after policy: expansion. Distinct from policyName, which is the pre-rules field and is kept for rows written before this epic. |
| `policyName` | string |  | Routing policy that picked the provider. Reserved for Phase 2+ when policies land; Phase 1 leaves this empty. |
| `pricingConfigured` | boolean |  | True when the provider declared pricing annotations in its .memql file. False means cost fields are 0 because nobody has configured pricing yet, not because the call was free. |
| `promptName` | string |  | Name of the MemQL prompt invoked when the call went through InvokeAI (e.g. agentReply, plannerAgent). |
| `providerName` | string | yes | MemQL provider registry name (e.g. stream54Mini, streamClaudeSonnet). |
| `requestId` | string | yes | Correlates this AI call to an upstream request -- an agent turn, a suggest envelope, a prompt invocation. Free-form string; uniqueness is not enforced across partitions. |
| `requestedLevel` | string |  | The level the CALL declared, before a rule overrode it. Equal to level when no rule raised or lowered it, which is what makes a rule's effect visible without diffing the rule set. (enum: fast, strong, reasoning, embeddings) |
| `rule` | string |  | Name of the rule that matched. Empty only for a call pinned with an explicit provider, which consults no rule. |
| `servedLevel` | string |  | The level that actually served. It differs from level only when degraded is true. (enum: fast, strong, reasoning, embeddings) |
| `streaming` | boolean |  | True when the call used a streaming provider path. |
| `timeToFirstTokenMs` | integer |  | Wall-clock ms from call start to first streamed token. 0 for non-streaming calls (chat, suggest, TTS). |
| `tokensEstimated` | boolean |  | True when token counts are derived from a char-count heuristic rather than provider-reported usage. Phase 1 always estimates; Phase 2 will flip this to false when the vendor's real usage is available. |
| `tokensPerSec` | number |  | Output tokens per second for streaming calls (computed end-of-stream). 0 for non-streaming or too-short calls. |
| `totalCost` | number |  | USD total cost for this call. Equal to inputCost + outputCost + cachedInputCost. |
| `totalDurationMs` | integer | yes | Wall-clock ms from call start to completion (success or error). |
| `touches` | array |  | The call's footprint: a work step's footprint union, or an agent turn's knowledge-domain concept ids. Empty otherwise. A rule matches it with startsWith semantics, so a decision can be filtered by what the call was about. |
| `userId` | string |  | Identity subject of the end-user driving this call, when resolvable. Empty for system-triggered calls. |
| `vendor` | string | yes | Vendor family: openai or anthropic. Derived from provider .memql @type. |

## `v1:router:modelCatalog`

Virtual projection of a registered AI provider entry. Never persisted -- rows are produced at query time by the integration.router.listModels capability from the live provider registry. Lives in the concept registry so the engine can shape results without a database round-trip.

| Field | Type | Required | Description |
|---|---|---|---|
| `available` | boolean |  | True when the provider was instantiated successfully (auth + client). |
| `cachedInputCostPerMillion` | number |  | USD per million cached-input tokens. |
| `contextWindow` | integer |  | Maximum token context window. |
| `description` | string |  | Human-readable description from the .memql @description annotation. |
| `inputCostPerMillion` | number |  | USD per million input tokens. |
| `isDefault` | boolean |  | True when the provider carries the @default annotation. |
| `modality` | string |  | text, tts, stt, embedding, etc. |
| `model` | string |  | Vendor-side model id. |
| `outputCostPerMillion` | number |  | USD per million output tokens. |
| `pricingConfigured` | boolean |  | True when any non-zero pricing annotation is set. |
| `providerName` | string |  | Registry name (e.g. stream54Mini). |
| `providerType` | string |  | Raw @type annotation from the .memql file (OpenAI, AnthropicStream, etc). |
| `vendor` | string |  | Vendor family (openai, anthropic). |

## `v1:router:policyCatalog`

Virtual projection of a registered AI Router policy. Never persisted -- rows are produced at query time by the integration.router.listPolicies capability from the live policy registry. Lives in the concept registry so the engine can shape results without a database round-trip.

| Field | Type | Required | Description |
|---|---|---|---|
| `chain` | array |  | Full chain (primary + fallbacks) for convenience. |
| `description` | string |  | Human-readable description from the @description annotation. |
| `fallbacks` | array |  | Fallback provider registry names, in try-order. |
| `name` | string |  | Policy name, e.g. balancedChat. |
| `primary` | string |  | Primary provider registry name. |

## `v1:safety:approvalRequest`

One row per Ask-verdict approval request. The Gate's ApprovalSink creates a `pending` row on first encounter (keyed by correlationKey for idempotency), then `resolveApprovalRequest` flips it to `approved` / `denied`. The Gate's bypass check queries by correlationKey: an approved non-expired row returns proceed=true on the next retry of the same gated action; otherwise the refusal text references the request id so a human can resolve it. Distinct from v1:safety:classification -- classification is the per-decision audit row (one per evaluation); approvalRequest is the per-(surface, action, payload) bypass token (one per unique action, reused across retries).

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Same enum as classification.action. |
| `agentId` | string |  | Agent id that triggered the Ask. Lets the cockpit group pending requests by agent. |
| `argsRedacted` | string |  | JSON-encoded redacted payload. Same scrub semantics as classification.argsRedacted (Body + Args run through safety.RedactedPayload; Command/URL/Paths dropped on credential_access). Lets the approver see what they're approving without seeing credentials. |
| `categories` | string |  | Comma-separated category list (e.g. `destructive,credential_access`). |
| `correlationKey` | string | yes | SHA-256 hex of the normalized descriptor (surface \| action \| command/url/paths/tool-name + ToolArgs). Idempotency key -- repeated Ask verdicts for the same action collapse to the same row. Generated by safety.ApprovalCorrelationKey(). |
| `decidedAt` |  |  | When status moved off `pending`. Empty while pending. |
| `decidedBy` | string |  | User id of the human who resolved the request. Empty while status=`pending`. |
| `decisionReason` | string |  | Free-text rationale supplied by the approver (e.g. 'one-off; confirmed safe by ops'). Optional. |
| `expiresAt` |  |  | Advisory TTL. Approved rows older than expiresAt should be treated as expired by the bypass check; the retention sweep that flips them to status=`expired` lands as a follow-up. Empty / zero = no TTL. |
| `ownerUserId` | string |  | Owning user id (whose run / agent triggered this). Drives the cockpit's per-user inbox. |
| `reason` | string |  | Why approval was required -- usually the classifier's reason field copied verbatim. |
| `runId` | string |  | Run id, when the action was run-scoped. Lets a reader deep-link the request back to the parked run. |
| `status` | string | yes | `pending` (created, awaiting human decision) \| `approved` (bypass token live until expiresAt) \| `denied` (subsequent retries refused) \| `expired` (advisory; set by retention sweep). Initial value on create is always `pending`. |
| `surface` | string | yes | Same enum as classification.surface. Captured here so cockpit / CLI can render the request without joining back to a classification row. |
| `tier` | string | yes | Risk tier the classifier assigned. |

## `v1:safety:classification`

One row per safety-classifier decision. Captures what the Gate decided, the verdict source (rule / model / cache), the surface + action it was deciding about, and the (redacted) payload. Retention is governed by the MEMQL_SAFETY_CLASSIFICATION_RETENTION_DAYS env var (default 90); the daily purge automation hard-deletes rows whose `createdAt + retentionDays < now`. This concept covers the safety-classifier verdict + final gate decision per command. (It used to be contrasted here with v1:platform:policyTrace, which covered the decision-policy evaluation tree; that whole subsystem was removed in memql#4114 -- the decision-policy tier it belonged to was retired in #984 and nothing ever wrote a row.)

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Abstract action: exec / fs_read / fs_write / fs_list / fs_stat / http_fetch / gui_input / screenshot / webhook / tool_call. |
| `agentId` | string |  | Calling agent id. |
| `argsRedacted` | string |  | JSON-encoded redacted payload. Body + Args go through safety.RedactedPayload (TOKEN/SECRET/PASSWORD/API_KEY/Authorization fragments -> [REDACTED]). Command / URL / Paths / Method / ToolName are passed through verbatim UNLESS the classifier flagged `credential_access` (URL with userinfo, env-var assignment in a shell command, etc.), in which case the recorder drops those surface fields entirely so credentials never reach the persisted row -- the rule's reason field still carries enough context for triage. Empty when the descriptor's payload was already empty. |
| `categories` | string |  | Comma-separated category list (e.g. `destructive,credential_access`). Empty for tier=none. |
| `confidence` | number |  | Classifier self-reported confidence [0, 1]. Rule verdicts are 1.0 by convention; model verdicts carry the model's own estimate. |
| `correlationId` | string |  | Correlation id linking back to the dispatch + any auditEvent. |
| `decision` | string | yes | What the Gate decided: `allow`\|`ask`\|`deny`. In shadow mode the surface always proceeds regardless; in enforce mode this is honoured. |
| `latencyMs` | number |  | Total classification latency in ms (chain time including rules + model + cache lookup). float rather than `number`, which isn't a DSL primitive. |
| `mode` | string | yes | Gate mode at decision time: `off`\|`shadow`\|`enforce`. `shadow` rows are observation-only -- the surface proceeded regardless of `decision`. |
| `ownerUserId` | string |  | Owning user id. |
| `reason` | string |  | Short human-readable explanation -- which specific pattern fired. <= 200 chars. |
| `ruleId` | string |  | Stable rule identifier (`shell.destructive`, `model.classify_v1`, ...). Empty for noop/disabled sources. |
| `runId` | string |  | Run id, when the action is run-scoped. |
| `source` | string | yes | Classifier source: `rule`\|`model`\|`cache`\|`noop`\|`disabled`. Lets ops tell rule-engine hits from LLM verdicts in queries. |
| `surface` | string | yes | Execution surface: `computer_use_headless`/`_embodied`, `workbench`, `tool_webhook`, `tool_integration`. |
| `tier` | string | yes | Risk tier: `none`\|`low`\|`medium`\|`high`\|`critical`. |

## `v1:safety:outputScreening`

One row per output-screening decision. Captures what the OutputGate decided about a single piece of incoming content before the model re-ingested it. Distinct from v1:safety:classification: classification covers agency (should this command run?); outputScreening covers ingress (should this string land in the model's context?). Retention is governed by MEMQL_SAFETY_OUTPUT_SCREENING_RETENTION_DAYS (default 90).

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Agent that triggered the ingress (where applicable; tool outputs always have one; HTTP fetches usually do). |
| `categories` | string |  | Comma-separated category list: `prompt_injection` / `instruction_override` / `role_hijack` / `exfiltration` / `delimiter_abuse`. Empty for tier=none. |
| `confidence` | number |  | Screener self-reported confidence [0, 1]. Rule verdicts are 1.0 by convention. |
| `contentLength` | number |  | Byte length of the screened content BEFORE the redactedSample truncation. Useful for spotting bloat-attack vectors (megabyte-scale content with one tiny injection buried). |
| `contentType` | string | yes | Ingress channel: `tool_output` / `http_fetch` / `file_read` / `knowledge_seed`. Lets ops slice screening data by attack surface. |
| `correlationId` | string |  | Correlation id linking back to the dispatch. |
| `latencyMs` | number |  | Total screening latency in ms. float (matches classification.latencyMs) since `number` isn't a DSL primitive. |
| `mode` | string | yes | OutputGate mode at decision time: `off`\|`shadow`\|`enforce`. `shadow` rows are observation-only -- the surface re-ingested the content regardless of `verdict`. |
| `ownerUserId` | string |  | Owning user id. |
| `reason` | string |  | Short human-readable explanation -- which specific pattern fired. <= 200 chars. |
| `redactedSample` | string |  | First N bytes of the content after secret-redaction. Capped at 4 KiB by the recorder so a poisoned 100 MB document doesn't blow the row up. Lets ops inspect what fired the verdict without keeping the whole payload. |
| `ruleId` | string |  | Stable rule identifier (`prompt_injection.ignore_previous`, etc.). Empty for noop/disabled sources. |
| `runId` | string |  | Run id, when the ingress was run-scoped. |
| `screener` | string | yes | Verdict source: `rule` (deterministic pattern) / `model` (LLM classifier; not shipped today) / `cache` / `noop` / `disabled`. |
| `tier` | string | yes | Risk tier the screener assigned: `none` (clean) / `low` / `medium` / `high` (suspicious) / `critical` (overt injection). |
| `verdict` | string | yes | What the OutputGate decided: `clean` / `suspicious` / `blocked`. In shadow mode the gate always returns clean to the surface regardless; in enforce mode this is honoured (suspicious -> log + pass; blocked -> drop). |

## `v1:shopify:abandonedCheckout`

Shopify AbandonedCheckout, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `abandonedCheckoutUrl` | string |  |  |
| `billingAddress` | object |  |  |
| `completedAt` | string |  |  |
| `customAttributes` | array |  |  |
| `customerGid` | string |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `discountCodes` | array |  |  |
| `gid` | string | yes |  |
| `name` | string |  |  |
| `note` | string |  |  |
| `shippingAddress` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `subtotalPriceSet` | object |  |  |
| `syncedAt` | string | yes |  |
| `taxLines` | array |  |  |
| `taxesIncluded` | boolean |  |  |
| `totalDiscountSet` | object |  |  |
| `totalDutiesSet` | object |  |  |
| `totalLineItemsPriceSet` | object |  |  |
| `totalPriceSet` | object |  |  |
| `totalTaxSet` | object |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:article`

Shopify Article, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `author` | object |  |  |
| `blogGid` | string |  |  |
| `body` | string |  |  |
| `commentsCount` | object |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `image` | object |  |  |
| `isPublished` | boolean |  |  |
| `metafields` | object |  |  |
| `parentGid` | string | yes |  |
| `publishedAt` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `summary` | string |  |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `templateSuffix` | string |  |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:blog`

## `v1:shopify:articleComment`

Shopify Comment, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `articleGid` | string |  |  |
| `author` | object |  |  |
| `body` | string |  |  |
| `bodyHtml` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `ip` | string |  |  |
| `isPublished` | boolean |  |  |
| `parentGid` | string | yes |  |
| `publishedAt` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: SPAM, REMOVED, PUBLISHED, UNAPPROVED, PENDING) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `userAgent` | string |  |  |

**Relationships:** `parent` -> `v1:shopify:article`

## `v1:shopify:blog`

Shopify Blog, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `articlesCount` | object |  |  |
| `commentPolicy` | string |  | (enum: AUTO_PUBLISHED, CLOSED, MODERATED) |
| `deleted` | boolean |  |  |
| `feed` | object |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `metafields` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `templateSuffix` | string |  |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:businessEntity`

Shopify BusinessEntity, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | object |  |  |
| `archived` | boolean |  |  |
| `companyName` | string |  |  |
| `deleted` | boolean |  |  |
| `displayName` | string |  |  |
| `gid` | string | yes |  |
| `legalEntityId` | string |  |  |
| `primary` | boolean |  |  |
| `shopifyPaymentsAccount` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:catalog`

Shopify Catalog, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `operations` | array |  |  |
| `priceListGid` | string |  |  |
| `publicationGid` | string |  |  |
| `status` | string |  | (enum: ACTIVE, ARCHIVED, DRAFT) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:channel`

Shopify Channel, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string |  |  |
| `accountName` | string |  |  |
| `activeRegions` | array |  |  |
| `app` | object |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `marketsCount` | object |  |  |
| `name` | string |  |  |
| `productsCount` | object |  |  |
| `resourceFeedback` | object |  |  |
| `specificationHandle` | string |  |  |
| `storeId` | string | yes |  |
| `supportsFuturePublishing` | boolean |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:collection`

Shopify Collection, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `activeOperations` | object |  |  |
| `availablePublicationsCount` | object |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `descriptionHtml` | string |  |  |
| `feedback` | object |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `image` | object |  |  |
| `legacyResourceId` | string |  |  |
| `metafields` | object |  |  |
| `productsCount` | object |  |  |
| `productsGids` | array |  |  |
| `resourcePublicationsCount` | object |  |  |
| `resourcePublicationsGids` | array |  |  |
| `seo` | object |  |  |
| `sortOrder` | string |  | (enum: ALPHA_ASC, ALPHA_DESC, BEST_SELLING, MOST_RELEVANT, CREATED, CREATED_DESC, MANUAL, PRICE_ASC, PRICE_DESC) |
| `sources` | array |  |  |
| `storeId` | string | yes |  |
| `subCollectionEligibility` | object |  |  |
| `syncedAt` | string | yes |  |
| `templateSuffix` | string |  |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:company`

Shopify Company, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `contactsCount` | object |  |  |
| `customerSince` | string |  |  |
| `defaultCursor` | string |  |  |
| `defaultRole` | object |  |  |
| `deleted` | boolean |  |  |
| `draftOrdersGids` | array |  |  |
| `externalId` | string |  |  |
| `gid` | string | yes |  |
| `hasTimelineComment` | boolean |  |  |
| `lifetimeDuration` | string |  |  |
| `locationsCount` | object |  |  |
| `mainContactGid` | string |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `note` | string |  |  |
| `ordersCount` | object |  |  |
| `ordersGids` | array |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `totalSpent` | object |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:companyContact`

Shopify CompanyContact, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `companyGid` | string |  |  |
| `customerGid` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `isMainContact` | boolean |  |  |
| `lifetimeDuration` | string |  |  |
| `locale` | string |  |  |
| `parentGid` | string | yes |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:company`

## `v1:shopify:companyLocation`

Shopify CompanyLocation, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `billingAddress` | object |  |  |
| `buyerExperienceConfiguration` | object |  |  |
| `catalogsCount` | object |  |  |
| `catalogsGids` | array |  |  |
| `companyGid` | string |  |  |
| `currency` | string |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `externalId` | string |  |  |
| `gid` | string | yes |  |
| `hasTimelineComment` | boolean |  |  |
| `locale` | string |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `note` | string |  |  |
| `ordersCount` | object |  |  |
| `parentGid` | string | yes |  |
| `phone` | string |  |  |
| `shippingAddress` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeCreditAccountsGids` | array |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `taxSettings` | object |  |  |
| `totalSpent` | object |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:company`

## `v1:shopify:complianceJob`

One queued Shopify privacy request.
A job rather than an immediate action, because both windows are measured in days: customers/redact has thirty and shop/redact a 48-hour hold, and the receiver has five seconds. Running on receipt would also override a merchant's own grace period if one is configured.
It is deliberately NOT a v1:platform:outboxEntry. The outbox is for MemQL-authored rows the connector PUSHES, and its drain hands every entry to Propagate -- a compliance job handed to Propagate would try to write a customer's export into Shopify. Same shape of work, different destination, so a different queue.

| Field | Type | Required | Description |
|---|---|---|---|
| `completedAt` |  |  |  |
| `customerGid` | string |  |  |
| `dueAt` | string | yes |  |
| `lastError` | string |  |  |
| `outcome` | string |  |  |
| `requestId` | string |  |  |
| `shopDomain` | string |  |  |
| `status` | string |  | (enum: pending, done, failed) |
| `storeId` | string | yes |  |
| `topic` | string | yes |  |

## `v1:shopify:customer`

Shopify Customer, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `amountSpent` | object |  |  |
| `canDelete` | boolean |  |  |
| `companyContactProfilesGids` | array |  |  |
| `dataSaleOptOut` | boolean |  |  |
| `defaultAddress` | object |  |  |
| `defaultEmailAddress` | object |  |  |
| `defaultPhoneNumber` | object |  |  |
| `deleted` | boolean |  |  |
| `displayName` | string |  |  |
| `firstName` | string |  |  |
| `gid` | string | yes |  |
| `identityProviderSubjects` | array |  |  |
| `image` | object |  |  |
| `lastName` | string |  |  |
| `lastOrderGid` | string |  |  |
| `legacyResourceId` | string |  |  |
| `lifetimeDuration` | string |  |  |
| `locale` | string |  |  |
| `mergeable` | object |  |  |
| `metafields` | object |  |  |
| `multipassIdentifier` | string |  |  |
| `note` | string |  |  |
| `numberOfOrders` | string |  |  |
| `ordersGids` | array |  |  |
| `productSubscriberStatus` | string |  | (enum: ACTIVE, CANCELLED, EXPIRED, FAILED, NEVER_SUBSCRIBED, PAUSED) |
| `sourceCreatedAt` | string |  |  |
| `state` | string |  | (enum: DECLINED, DISABLED, ENABLED, INVITED) |
| `statistics` | object |  |  |
| `storeId` | string | yes |  |
| `subscriptionContractsGids` | array |  |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `taxExempt` | boolean |  |  |
| `taxExemptions` | array |  |  |
| `taxSettings` | object |  |  |
| `updatedAt` | string | yes |  |
| `verifiedEmail` | boolean |  |  |

## `v1:shopify:customerPaymentMethod`

Shopify CustomerPaymentMethod, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `customerGid` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `instrument` | object |  |  |
| `parentGid` | string | yes |  |
| `revokedAt` | string |  |  |
| `revokedReason` | string |  | (enum: AUTHORIZE_NET_GATEWAY_NOT_ENABLED, AUTHORIZE_NET_RETURNED_NO_PAYMENT_METHOD, FAILED_TO_UPDATE_CREDIT_CARD, STRIPE_API_AUTHENTICATION_ERROR, STRIPE_API_INVALID_REQUEST_ERROR, STRIPE_GATEWAY_NOT_ENABLED, STRIPE_RETURNED_NO_PAYMENT_METHOD, STRIPE_PAYMENT_METHOD_NOT_CARD, BRAINTREE_API_AUTHENTICATION_ERROR, BRAINTREE_GATEWAY_NOT_ENABLED, BRAINTREE_RETURNED_NO_PAYMENT_METHOD, BRAINTREE_PAYMENT_METHOD_NOT_CARD, PAYMENT_METHOD_VERIFICATION_FAILED, THREE_D_SECURE_FLOW_IN_VERIFICATION_NOT_IMPLEMENTED, MANUALLY_REVOKED, FAILED_TO_RETRIEVE_BILLING_ADDRESS, MERGED, CUSTOMER_REDACTED, TOO_MANY_CONSECUTIVE_FAILURES, CVV_ATTEMPTS_LIMIT_EXCEEDED) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:customer`

## `v1:shopify:deliveryCarrierService`

Shopify DeliveryCarrierService, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  |  |
| `callbackUrl` | string |  |  |
| `deleted` | boolean |  |  |
| `formattedName` | string |  |  |
| `gid` | string | yes |  |
| `icon` | object |  |  |
| `name` | string |  |  |
| `storeId` | string | yes |  |
| `supportsServiceDiscovery` | boolean |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:deliveryCustomization`

Shopify DeliveryCustomization, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `enabled` | boolean |  |  |
| `errorHistory` | object |  |  |
| `functionId` | string |  |  |
| `gid` | string | yes |  |
| `metafields` | object |  |  |
| `shopifyFunction` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:deliveryProfile`

Shopify DeliveryProfile, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `activeMethodDefinitionsCount` | integer |  |  |
| `coversAllItems` | boolean |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `locationsWithoutRatesCount` | integer |  |  |
| `name` | string |  |  |
| `originLocationCount` | integer |  |  |
| `productVariantsCount` | object |  |  |
| `profileLocationGroups` | array |  |  |
| `sourceDefault` | boolean |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `unassignedLocationsGids` | array |  |  |
| `updatedAt` | string | yes |  |
| `version` | integer |  |  |
| `zoneCountryCount` | integer |  |  |

## `v1:shopify:discountNode`

Shopify DiscountNode, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `discount` | object |  |  |
| `gid` | string | yes |  |
| `metafields` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:draftOrder`

Shopify DraftOrder, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptAutomaticDiscounts` | boolean |  |  |
| `allVariantPricesOverridden` | boolean |  |  |
| `allowDiscountCodesInCheckout` | boolean |  |  |
| `amountDueLaterSet` | object |  |  |
| `amountDueNowSet` | object |  |  |
| `anyVariantPricesOverridden` | boolean |  |  |
| `appliedDiscount` | object |  |  |
| `billingAddress` | object |  |  |
| `billingAddressMatchesShippingAddress` | boolean |  |  |
| `completedAt` | string |  |  |
| `currencyCode` | string |  |  |
| `customAttributes` | array |  |  |
| `customerGid` | string |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `deposit` | object |  |  |
| `discountCodes` | array |  |  |
| `email` | string |  |  |
| `gid` | string | yes |  |
| `hasTimelineComment` | boolean |  |  |
| `invoiceEmailTemplateSubject` | string |  |  |
| `invoiceSentAt` | string |  |  |
| `invoiceUrl` | string |  |  |
| `legacyResourceId` | string |  |  |
| `lineItemsSubtotalPrice` | object |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `note2` | string |  |  |
| `orderGid` | string |  |  |
| `paymentTerms` | object |  |  |
| `phone` | string |  |  |
| `platformDiscounts` | array |  |  |
| `poNumber` | string |  |  |
| `presentmentCurrencyCode` | string |  |  |
| `purchasingEntity` | object |  |  |
| `ready` | boolean |  |  |
| `reserveInventoryUntil` | string |  |  |
| `shippingAddress` | object |  |  |
| `shippingLine` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: COMPLETED, INVOICE_SENT, OPEN) |
| `storeId` | string | yes |  |
| `subtotalPriceSet` | object |  |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `taxExempt` | boolean |  |  |
| `taxLines` | array |  |  |
| `taxesIncluded` | boolean |  |  |
| `totalDiscountsSet` | object |  |  |
| `totalLineItemsPriceSet` | object |  |  |
| `totalPriceSet` | object |  |  |
| `totalQuantityOfLineItems` | integer |  |  |
| `totalShippingPriceSet` | object |  |  |
| `totalTaxSet` | object |  |  |
| `totalWeight` | string |  |  |
| `transformerFingerprint` | string |  |  |
| `updatedAt` | string | yes |  |
| `visibleToCustomer` | boolean |  |  |
| `warnings` | array |  |  |

## `v1:shopify:fulfillment`

Shopify Fulfillment, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `deliveredAt` | string |  |  |
| `displayStatus` | string |  | (enum: ATTEMPTED_DELIVERY, CANCELED, CONFIRMED, DELAYED, DELIVERED, FAILURE, FULFILLED, CARRIER_PICKED_UP, IN_TRANSIT, LABEL_PRINTED, LABEL_PURCHASED, LABEL_VOIDED, MARKED_AS_FULFILLED, NOT_DELIVERED, OUT_FOR_DELIVERY, READY_FOR_PICKUP, PICKED_UP, SUBMITTED) |
| `estimatedDeliveryAt` | string |  |  |
| `fulfillmentOrdersGids` | array |  |  |
| `gid` | string | yes |  |
| `inTransitAt` | string |  |  |
| `legacyResourceId` | string |  |  |
| `locationGid` | string |  |  |
| `name` | string |  |  |
| `orderGid` | string |  |  |
| `originAddress` | object |  |  |
| `parentGid` | string | yes |  |
| `requiresShipping` | boolean |  |  |
| `service` | object |  |  |
| `shippingLabel` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: SUCCESS, CANCELLED, ERROR, FAILURE) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `totalQuantity` | integer |  |  |
| `trackingInfo` | array |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:order`

## `v1:shopify:fulfillmentOrder`

Shopify FulfillmentOrder, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `assignedLocation` | object |  |  |
| `deleted` | boolean |  |  |
| `deliveryMethod` | object |  |  |
| `destination` | object |  |  |
| `fulfillAt` | string |  |  |
| `fulfillBy` | string |  |  |
| `fulfillmentHolds` | array |  |  |
| `fulfillmentsGids` | array |  |  |
| `gid` | string | yes |  |
| `internationalDuties` | object |  |  |
| `orderGid` | string |  |  |
| `orderId` | string |  |  |
| `orderName` | string |  |  |
| `orderProcessedAt` | string |  |  |
| `remainingLineItemsWeight` | object |  |  |
| `requestStatus` | string |  | (enum: UNSUBMITTED, SUBMITTED, ACCEPTED, REJECTED, CANCELLATION_REQUESTED, CANCELLATION_ACCEPTED, CANCELLATION_REJECTED, CLOSED) |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: OPEN, IN_PROGRESS, CANCELLED, INCOMPLETE, CLOSED, SCHEDULED, ON_HOLD) |
| `storeId` | string | yes |  |
| `supportedActions` | array |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:giftCard`

Shopify GiftCard, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `balance` | object |  |  |
| `crossCurrencyRedemptionStrategy` | string |  | (enum: NONE, MARKET_FX, SPOT_FX) |
| `customerGid` | string |  |  |
| `deactivatedAt` | string |  |  |
| `deleted` | boolean |  |  |
| `enabled` | boolean |  |  |
| `expiresOn` | string |  |  |
| `gid` | string | yes |  |
| `initialValue` | object |  |  |
| `isRedeemable` | boolean |  |  |
| `lastCharacters` | string |  |  |
| `lineItemGid` | string |  |  |
| `maskedCode` | string |  |  |
| `note` | string |  |  |
| `orderGid` | string |  |  |
| `recipientAttributes` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `templateSuffix` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:inventoryItem`

Shopify InventoryItem, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `countryCodeOfOrigin` | string |  |  |
| `deleted` | boolean |  |  |
| `duplicateSkuCount` | integer |  |  |
| `gid` | string | yes |  |
| `harmonizedSystemCode` | string |  |  |
| `inventoryHistoryUrl` | string |  |  |
| `legacyResourceId` | string |  |  |
| `locationsCount` | object |  |  |
| `measurement` | object |  |  |
| `provinceCodeOfOrigin` | string |  |  |
| `requiresShipping` | boolean |  |  |
| `sku` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `tracked` | boolean |  |  |
| `trackedEditable` | object |  |  |
| `unitCost` | object |  |  |
| `updatedAt` | string | yes |  |
| `variantsGids` | array |  |  |

## `v1:shopify:inventoryLevel`

Shopify InventoryLevel, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `canDeactivate` | boolean |  |  |
| `deactivationAlert` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `isActive` | boolean |  |  |
| `itemGid` | string |  |  |
| `locationGid` | string |  |  |
| `parentGid` | string | yes |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:inventoryItem`

## `v1:shopify:inventoryShipment`

Shopify InventoryShipment, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `barcode` | string |  |  |
| `dateCreated` | string |  |  |
| `dateReceived` | string |  |  |
| `dateShipped` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `lineItemTotalQuantity` | integer |  |  |
| `lineItemsCount` | object |  |  |
| `name` | string |  |  |
| `status` | string |  | (enum: DRAFT, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED, OTHER) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `totalAcceptedQuantity` | integer |  |  |
| `totalReceivedQuantity` | integer |  |  |
| `totalRejectedQuantity` | integer |  |  |
| `tracking` | object |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:inventoryTransfer`

Shopify InventoryTransfer, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `dateCreated` | string |  |  |
| `deleted` | boolean |  |  |
| `destination` | object |  |  |
| `gid` | string | yes |  |
| `hasTimelineComment` | boolean |  |  |
| `lineItemsCount` | object |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `note` | string |  |  |
| `origin` | object |  |  |
| `receivedQuantity` | integer |  |  |
| `referenceName` | string |  |  |
| `status` | string |  | (enum: DRAFT, READY_TO_SHIP, IN_PROGRESS, TRANSFERRED, CANCELED, OTHER) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `totalQuantity` | integer |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:location`

Shopify Location, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `activatable` | boolean |  |  |
| `address` | object |  |  |
| `addressVerified` | boolean |  |  |
| `deactivatable` | boolean |  |  |
| `deactivatedAt` | string |  |  |
| `deletable` | boolean |  |  |
| `deleted` | boolean |  |  |
| `fulfillmentService` | object |  |  |
| `fulfillsOnlineOrders` | boolean |  |  |
| `gid` | string | yes |  |
| `hasActiveInventory` | boolean |  |  |
| `hasUnfulfilledOrders` | boolean |  |  |
| `inventoryLevelsGids` | array |  |  |
| `isActive` | boolean |  |  |
| `isFulfillmentService` | boolean |  |  |
| `legacyResourceId` | string |  |  |
| `localPickupSettingsV2` | object |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `shipsInventory` | boolean |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `suggestedAddresses` | array |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:market`

Shopify Market, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `catalogsCount` | object |  |  |
| `conditions` | object |  |  |
| `currencySettings` | object |  |  |
| `deleted` | boolean |  |  |
| `delivery` | object |  |  |
| `discountsCount` | object |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `priceInclusions` | object |  |  |
| `sourceType` | string |  | (enum: NONE, REGION, LOCATION, COMPANY_LOCATION, CHANNEL) |
| `status` | string |  | (enum: ACTIVE, DRAFT) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:marketWebPresence`

Shopify MarketWebPresence, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `alternateLocalesGids` | array |  |  |
| `defaultLocaleGid` | string |  |  |
| `deleted` | boolean |  |  |
| `domain` | object |  |  |
| `gid` | string | yes |  |
| `parentGid` | string | yes |  |
| `rootUrls` | array |  |  |
| `storeId` | string | yes |  |
| `subfolderSuffix` | string |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:market`

## `v1:shopify:marketingActivity`

Shopify MarketingActivity, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `activityListUrl` | string |  |  |
| `adSpend` | object |  |  |
| `app` | object |  |  |
| `appErrors` | object |  |  |
| `budget` | object |  |  |
| `deleted` | boolean |  |  |
| `formData` | string |  |  |
| `gid` | string | yes |  |
| `hierarchyLevel` | string |  | (enum: AD, AD_GROUP, CAMPAIGN) |
| `inMainWorkflowVersion` | boolean |  |  |
| `isExternal` | boolean |  |  |
| `marketingChannelType` | string |  | (enum: SEARCH, DISPLAY, SOCIAL, EMAIL, REFERRAL) |
| `marketingEventGid` | string |  |  |
| `parentActivityId` | string |  |  |
| `parentRemoteId` | string |  |  |
| `sourceAndMedium` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: ACTIVE, DELETED, DELETED_EXTERNALLY, DISCONNECTED, DRAFT, FAILED, INACTIVE, PAUSED, PENDING, SCHEDULED, UNDEFINED) |
| `statusBadgeTypeV2` | string |  | (enum: DEFAULT, SUCCESS, ATTENTION, WARNING, INFO, CRITICAL) |
| `statusLabel` | string |  |  |
| `statusTransitionedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `tactic` | string |  | (enum: ABANDONED_CART, AD, AFFILIATE, LINK, LOYALTY, MESSAGE, NEWSLETTER, NOTIFICATION, POST, RETARGETING, TRANSACTIONAL, STOREFRONT_APP, SEO) |
| `targetStatus` | string |  | (enum: ACTIVE, DELETED, DELETED_EXTERNALLY, DISCONNECTED, DRAFT, FAILED, INACTIVE, PAUSED, PENDING, SCHEDULED, UNDEFINED) |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |
| `urlParameterValue` | string |  |  |
| `utmParameters` | object |  |  |

## `v1:shopify:marketingEvent`

Shopify MarketingEvent, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | object |  |  |
| `channelHandle` | string |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `endedAt` | string |  |  |
| `gid` | string | yes |  |
| `legacyResourceId` | string |  |  |
| `manageUrl` | string |  |  |
| `marketingChannelType` | string |  | (enum: SEARCH, DISPLAY, SOCIAL, EMAIL, REFERRAL) |
| `previewUrl` | string |  |  |
| `remoteId` | string |  |  |
| `scheduledToEndAt` | string |  |  |
| `sourceAndMedium` | string |  |  |
| `sourceType` | string |  | (enum: ABANDONED_CART, AD, AFFILIATE, LINK, LOYALTY, MESSAGE, NEWSLETTER, NOTIFICATION, POST, RETARGETING, TRANSACTIONAL, STOREFRONT_APP, SEO) |
| `startedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `utmCampaign` | string |  |  |
| `utmMedium` | string |  |  |
| `utmSource` | string |  |  |

## `v1:shopify:menu`

Shopify Menu, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `isDefault` | boolean |  |  |
| `items` | array |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:metafieldDefinition`

Shopify MetafieldDefinition, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `access` | object |  |  |
| `capabilities` | object |  |  |
| `constraints` | object |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `gid` | string | yes |  |
| `key` | string |  |  |
| `metafields` | object |  |  |
| `metafieldsCount` | integer |  |  |
| `name` | string |  |  |
| `namespace` | string |  |  |
| `ownerType` | string |  | (enum: API_PERMISSION, COMPANY, COMPANY_LOCATION, PAYMENT_CUSTOMIZATION, VALIDATION, CUSTOMER, DELIVERY_CUSTOMIZATION, DRAFTORDER, GIFT_CARD_TRANSACTION, TRANSFER, MARKET, CARTTRANSFORM, COLLECTION, PRODUCT, PRODUCTVARIANT, SELLING_PLAN, ARTICLE, BLOG, PAGE, FULFILLMENT_CONSTRAINT_RULE, ORDER_ROUTING_LOCATION_RULE, DISCOUNT, ORDER, LOCATION, SHOP) |
| `pinnedPosition` | integer |  |  |
| `sourceType` | object |  |  |
| `standardTemplate` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `useAsCollectionCondition` | boolean |  |  |
| `validationStatus` | string |  | (enum: ALL_VALID, IN_PROGRESS, SOME_INVALID) |
| `validations` | array |  |  |

## `v1:shopify:metaobject`

Shopify Metaobject, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `capabilities` | object |  |  |
| `createdByApp` | object |  |  |
| `createdByStaffGid` | string |  |  |
| `definitionGid` | string |  |  |
| `deleted` | boolean |  |  |
| `displayName` | string |  |  |
| `fields` | array |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `sourceCreatedBy` | object |  |  |
| `sourceType` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `thumbnailField` | object |  |  |
| `updatedAt` | string | yes |  |
| `values` |  |  |  |

## `v1:shopify:metaobjectDefinition`

Shopify MetaobjectDefinition, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `access` | object |  |  |
| `capabilities` | object |  |  |
| `createdByApp` | object |  |  |
| `createdByStaffGid` | string |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `displayNameKey` | string |  |  |
| `fieldDefinitions` | array |  |  |
| `gid` | string | yes |  |
| `hasThumbnailField` | boolean |  |  |
| `metaobjectsCount` | integer |  |  |
| `name` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `sourceType` | string |  |  |
| `standardTemplate` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:onlineStoreTheme`

Shopify OnlineStoreTheme, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `name` | string |  |  |
| `prefix` | string |  |  |
| `processing` | boolean |  |  |
| `processingFailed` | boolean |  |  |
| `role` | string |  | (enum: MAIN, UNPUBLISHED, DEMO, DEVELOPMENT, ARCHIVED, LOCKED) |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `themeStoreId` | integer |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:order`

Shopify Order, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `additionalFees` | array |  |  |
| `agreementsGids` | array |  |  |
| `alerts` | array |  |  |
| `app` | object |  |  |
| `attribution` | object |  |  |
| `billingAddress` | object |  |  |
| `billingAddressMatchesShippingAddress` | boolean |  |  |
| `canMarkAsPaid` | boolean |  |  |
| `canNotifyCustomer` | boolean |  |  |
| `cancelReason` | string |  | (enum: CUSTOMER, DECLINED, FRAUD, INVENTORY, STAFF, OTHER) |
| `cancellation` | object |  |  |
| `cancelledAt` | string |  |  |
| `capturable` | boolean |  |  |
| `cartDiscountAmountSet` | object |  |  |
| `cartToken` | string |  |  |
| `checkoutToken` | string |  |  |
| `clientIp` | string |  |  |
| `closed` | boolean |  |  |
| `closedAt` | string |  |  |
| `confirmationNumber` | string |  |  |
| `confirmed` | boolean |  |  |
| `currencyCode` | string |  |  |
| `currentCartDiscountAmountSet` | object |  |  |
| `currentShippingPriceSet` | object |  |  |
| `currentSubtotalLineItemsQuantity` | integer |  |  |
| `currentSubtotalPriceSet` | object |  |  |
| `currentTaxLines` | array |  |  |
| `currentTotalAdditionalFeesSet` | object |  |  |
| `currentTotalDiscountsSet` | object |  |  |
| `currentTotalDutiesSet` | object |  |  |
| `currentTotalPriceSet` | object |  |  |
| `currentTotalTaxSet` | object |  |  |
| `currentTotalWeight` | string |  |  |
| `customAttributes` | array |  |  |
| `customerAcceptsMarketing` | boolean |  |  |
| `customerGid` | string |  |  |
| `customerJourneySummary` | object |  |  |
| `customerLocale` | string |  |  |
| `deleted` | boolean |  |  |
| `discountApplicationsGids` | array |  |  |
| `discountCode` | string |  |  |
| `discountCodes` | array |  |  |
| `displayAddress` | object |  |  |
| `displayFinancialStatus` | string |  | (enum: PENDING, AUTHORIZED, PARTIALLY_PAID, PARTIALLY_REFUNDED, VOIDED, PAID, REFUNDED, EXPIRED) |
| `displayFulfillmentStatus` | string |  | (enum: UNFULFILLED, PARTIALLY_FULFILLED, FULFILLED, RESTOCKED, PENDING_FULFILLMENT, OPEN, IN_PROGRESS, ON_HOLD, SCHEDULED, REQUEST_DECLINED) |
| `disputes` | array |  |  |
| `dutiesIncluded` | boolean |  |  |
| `edited` | boolean |  |  |
| `email` | string |  |  |
| `estimatedTaxes` | boolean |  |  |
| `fulfillable` | boolean |  |  |
| `fulfillmentOrdersGids` | array |  |  |
| `fulfillmentsCount` | object |  |  |
| `fullyPaid` | boolean |  |  |
| `gid` | string | yes |  |
| `hasTimelineComment` | boolean |  |  |
| `legacyResourceId` | string |  |  |
| `merchantBusinessEntityGid` | string |  |  |
| `merchantEditable` | boolean |  |  |
| `merchantEditableErrors` | array |  |  |
| `merchantOfRecordApp` | object |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `netPaymentSet` | object |  |  |
| `note` | string |  |  |
| `number` | integer |  |  |
| `originalTotalAdditionalFeesSet` | object |  |  |
| `originalTotalDutiesSet` | object |  |  |
| `originalTotalPriceSet` | object |  |  |
| `paymentCollectionDetails` | object |  |  |
| `paymentGatewayNames` | array |  |  |
| `paymentTerms` | object |  |  |
| `phone` | string |  |  |
| `poNumber` | string |  |  |
| `presentmentCurrencyCode` | string |  |  |
| `processedAt` | string |  |  |
| `productNetwork` | boolean |  |  |
| `publicationGid` | string |  |  |
| `purchasingEntity` | object |  |  |
| `refundDiscrepancySet` | object |  |  |
| `refundable` | boolean |  |  |
| `registeredSourceUrl` | string |  |  |
| `requiresShipping` | boolean |  |  |
| `restockable` | boolean |  |  |
| `retailLocationGid` | string |  |  |
| `returnStatus` | string |  | (enum: IN_PROGRESS, INSPECTION_COMPLETE, NO_RETURN, RETURNED, RETURN_FAILED, RETURN_REQUESTED) |
| `risk` | object |  |  |
| `shippingAddress` | object |  |  |
| `shippingLine` | object |  |  |
| `shippingLinesGids` | array |  |  |
| `shopifyProtect` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `sourceIdentifier` | string |  |  |
| `sourceName` | string |  |  |
| `staffMemberGid` | string |  |  |
| `statusPageUrl` | string |  |  |
| `storeId` | string | yes |  |
| `subtotalLineItemsQuantity` | integer |  |  |
| `subtotalPriceSet` | object |  |  |
| `suggestedRefund` | object |  |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `taxExempt` | boolean |  |  |
| `taxLines` | array |  |  |
| `taxesIncluded` | boolean |  |  |
| `test` | boolean |  |  |
| `totalCapturableSet` | object |  |  |
| `totalCashRoundingAdjustment` | object |  |  |
| `totalDiscountsSet` | object |  |  |
| `totalOutstandingSet` | object |  |  |
| `totalPriceSet` | object |  |  |
| `totalReceivedSet` | object |  |  |
| `totalRefundedSet` | object |  |  |
| `totalRefundedShippingSet` | object |  |  |
| `totalShippingPriceSet` | object |  |  |
| `totalTaxSet` | object |  |  |
| `totalTipReceivedSet` | object |  |  |
| `totalWeight` | string |  |  |
| `transactionsCount` | object |  |  |
| `unpaid` | boolean |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:orderLineItem`

Shopify LineItem, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `contractGid` | string |  |  |
| `currentQuantity` | integer |  |  |
| `customAttributes` | array |  |  |
| `deleted` | boolean |  |  |
| `discountAllocations` | array |  |  |
| `discountedTotalSet` | object |  |  |
| `discountedUnitPriceAfterAllDiscountsSet` | object |  |  |
| `discountedUnitPriceSet` | object |  |  |
| `duties` | array |  |  |
| `gid` | string | yes |  |
| `image` | object |  |  |
| `isGiftCard` | boolean |  |  |
| `lineItemGroup` | object |  |  |
| `merchantEditable` | boolean |  |  |
| `name` | string |  |  |
| `nonFulfillableQuantity` | integer |  |  |
| `originalTotalSet` | object |  |  |
| `originalUnitPriceSet` | object |  |  |
| `parentGid` | string | yes |  |
| `priceAfterAllDiscountsBeforeTaxesSet` | object |  |  |
| `productGid` | string |  |  |
| `quantity` | integer |  |  |
| `refundableQuantity` | integer |  |  |
| `requiresShipping` | boolean |  |  |
| `restockable` | boolean |  |  |
| `sellingPlan` | object |  |  |
| `sku` | string |  |  |
| `staffMemberGid` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `taxLines` | array |  |  |
| `taxable` | boolean |  |  |
| `title` | string |  |  |
| `totalDiscountSet` | object |  |  |
| `unfulfilledDiscountedTotalSet` | object |  |  |
| `unfulfilledOriginalTotalSet` | object |  |  |
| `unfulfilledQuantity` | integer |  |  |
| `updatedAt` | string | yes |  |
| `variantGid` | string |  |  |
| `variantTitle` | string |  |  |
| `vendor` | string |  |  |
| `weight` | object |  |  |

**Relationships:** `parent` -> `v1:shopify:order`

## `v1:shopify:orderTransaction`

Shopify OrderTransaction, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `accountNumber` | string |  |  |
| `amountRoundingSet` | object |  |  |
| `amountSet` | object |  |  |
| `authorizationExpiresAt` | string |  |  |
| `currencyExchangeAdjustment` | object |  |  |
| `deleted` | boolean |  |  |
| `device` | object |  |  |
| `errorCode` | string |  |  |
| `fees` | array |  |  |
| `formattedGateway` | string |  |  |
| `gateway` | string |  |  |
| `gid` | string | yes |  |
| `kind` | string |  | (enum: SALE, CAPTURE, AUTHORIZATION, VOID, REFUND, CHANGE, EMV_AUTHORIZATION, SUGGESTED_REFUND) |
| `locationGid` | string |  |  |
| `manualPaymentGateway` | boolean |  |  |
| `manuallyCapturable` | boolean |  |  |
| `maximumRefundableV2` | object |  |  |
| `multiCapturable` | boolean |  |  |
| `orderGid` | string |  |  |
| `parentGid` | string | yes |  |
| `parentTransactionGid` | string |  |  |
| `paymentDetails` | object |  |  |
| `paymentIcon` | object |  |  |
| `paymentId` | string |  |  |
| `processedAt` | string |  |  |
| `receiptJson` |  |  |  |
| `settlementCurrency` | string |  |  |
| `settlementCurrencyRate` | string |  |  |
| `shopifyPaymentsSet` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: SUCCESS, FAILURE, PENDING, ERROR, AWAITING_RESPONSE, UNKNOWN) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `test` | boolean |  |  |
| `totalUnsettledSet` | object |  |  |
| `updatedAt` | string | yes |  |
| `userGid` | string |  |  |

**Relationships:** `parent` -> `v1:shopify:order`

## `v1:shopify:page`

Shopify Page, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string |  |  |
| `bodySummary` | string |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `handle` | string |  |  |
| `isPublished` | boolean |  |  |
| `metafields` | object |  |  |
| `publishedAt` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `templateSuffix` | string |  |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:paymentTermsTemplate`

Shopify PaymentTermsTemplate, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `dueInDays` | integer |  |  |
| `gid` | string | yes |  |
| `name` | string |  |  |
| `paymentTermsType` | string |  | (enum: RECEIPT, NET, FIXED, FULFILLMENT, UNKNOWN) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `translatedName` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:priceList`

Shopify PriceList, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `catalogGid` | string |  |  |
| `currency` | string |  |  |
| `deleted` | boolean |  |  |
| `fixedPricesCount` | integer |  |  |
| `gid` | string | yes |  |
| `name` | string |  |  |
| `parent` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:priceListPrice`

Shopify PriceListPrice, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `compareAtPrice` | object |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `originType` | string |  | (enum: FIXED, RELATIVE) |
| `parentGid` | string | yes |  |
| `price` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `variantGid` | string |  |  |

**Relationships:** `parent` -> `v1:shopify:priceList`

## `v1:shopify:product`

Shopify Product, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `availablePublicationsCount` | object |  |  |
| `bundleConsolidatedOptions` | array |  |  |
| `category` | object |  |  |
| `collectionsGids` | array |  |  |
| `combinedListing` | object |  |  |
| `combinedListingRole` | string |  | (enum: PARENT, CHILD) |
| `compareAtPriceRange` | object |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `descriptionHtml` | string |  |  |
| `featuredMedia` | object |  |  |
| `feedback` | object |  |  |
| `gid` | string | yes |  |
| `giftCardSettings` | object |  |  |
| `giftCardTemplateSuffix` | string |  |  |
| `handle` | string |  |  |
| `hasOnlyDefaultVariant` | boolean |  |  |
| `hasOutOfStockVariants` | boolean |  |  |
| `hasVariantsThatRequiresComponents` | boolean |  |  |
| `isGiftCard` | boolean |  |  |
| `legacyResourceId` | string |  |  |
| `mediaCount` | object |  |  |
| `mediaGids` | array |  |  |
| `metafields` | object |  |  |
| `onlineStorePreviewUrl` | string |  |  |
| `onlineStoreUrl` | string |  |  |
| `options` | array |  |  |
| `priceRangeV2` | object |  |  |
| `productComponentsCount` | object |  |  |
| `productType` | string |  |  |
| `publishedAt` | string |  |  |
| `requiresSellingPlan` | boolean |  |  |
| `resourcePublicationsCount` | object |  |  |
| `resourcePublicationsGids` | array |  |  |
| `sellingPlanGroupsCount` | object |  |  |
| `sellingPlanGroupsGids` | array |  |  |
| `seo` | object |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: ACTIVE, ARCHIVED, DRAFT, UNLISTED) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `tags` | array |  |  |
| `templateSuffix` | string |  |  |
| `title` | string |  |  |
| `totalInventory` | integer |  |  |
| `tracksInventory` | boolean |  |  |
| `updatedAt` | string | yes |  |
| `variantsCount` | object |  |  |
| `vendor` | string |  |  |

## `v1:shopify:productFeed`

Shopify ProductFeed, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `channelId` | string |  |  |
| `country` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `language` | string |  |  |
| `status` | string |  | (enum: ACTIVE, INACTIVE) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:productVariant`

Shopify ProductVariant, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `availableForSale` | boolean |  |  |
| `availablePublicationsCount` | object |  |  |
| `barcode` | string |  |  |
| `compareAtPrice` | string |  |  |
| `defaultCursor` | string |  |  |
| `deleted` | boolean |  |  |
| `deliveryProfileGid` | string |  |  |
| `displayName` | string |  |  |
| `gid` | string | yes |  |
| `inventoryItemGid` | string |  |  |
| `inventoryPolicy` | string |  | (enum: DENY, CONTINUE) |
| `inventoryQuantity` | integer |  |  |
| `legacyResourceId` | string |  |  |
| `metafields` | object |  |  |
| `parentGid` | string | yes |  |
| `position` | integer |  |  |
| `price` | string |  |  |
| `productGid` | string |  |  |
| `requiresComponents` | boolean |  |  |
| `resourcePublicationsCount` | object |  |  |
| `selectedOptions` | array |  |  |
| `sellableOnlineQuantity` | integer |  |  |
| `sellingPlanGroupsCount` | object |  |  |
| `sellingPlanGroupsGids` | array |  |  |
| `showUnitPrice` | boolean |  |  |
| `sku` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `taxable` | boolean |  |  |
| `title` | string |  |  |
| `unitPrice` | object |  |  |
| `unitPriceMeasurement` | object |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:product`

## `v1:shopify:publication`

Shopify Publication, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `autoPublish` | boolean |  |  |
| `catalogGid` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `includedProductsCount` | object |  |  |
| `operation` | object |  |  |
| `storeId` | string | yes |  |
| `supportsFuturePublishing` | boolean |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:quantityRule`

Shopify QuantityRule, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `increment` | integer |  |  |
| `isDefault` | boolean |  |  |
| `maximum` | integer |  |  |
| `minimum` | integer |  |  |
| `originType` | string |  | (enum: FIXED, RELATIVE) |
| `parentGid` | string | yes |  |
| `productVariantGid` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:priceList`

## `v1:shopify:refund`

Shopify Refund, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `duties` | array |  |  |
| `gid` | string | yes |  |
| `legacyResourceId` | string |  |  |
| `note` | string |  |  |
| `orderGid` | string |  |  |
| `parentGid` | string | yes |  |
| `processedAt` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `sourceReturnGid` | string |  |  |
| `staffMemberGid` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `totalRefundedSet` | object |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:order`

## `v1:shopify:reverseDelivery`

Shopify ReverseDelivery, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `deliverable` | object |  |  |
| `gid` | string | yes |  |
| `parentGid` | string | yes |  |
| `reverseFulfillmentOrderGid` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:reverseFulfillmentOrder`

## `v1:shopify:reverseFulfillmentOrder`

Shopify ReverseFulfillmentOrder, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `orderGid` | string |  |  |
| `parentGid` | string | yes |  |
| `status` | string |  | (enum: CANCELED, CLOSED, OPEN) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `thirdPartyConfirmation` | object |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:shopifyReturn`

## `v1:shopify:segment`

Shopify Segment, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `creationDate` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `lastEditDate` | string |  |  |
| `name` | string |  |  |
| `query` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:sellingPlan`

Shopify SellingPlan, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `billingPolicy` | object |  |  |
| `category` | string |  | (enum: OTHER, PRE_ORDER, SUBSCRIPTION, TRY_BEFORE_YOU_BUY) |
| `deleted` | boolean |  |  |
| `deliveryPolicy` | object |  |  |
| `description` | string |  |  |
| `gid` | string | yes |  |
| `inventoryPolicy` | object |  |  |
| `metafields` | object |  |  |
| `name` | string |  |  |
| `options` | array |  |  |
| `parentGid` | string | yes |  |
| `position` | integer |  |  |
| `pricingPolicies` | array |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:sellingPlanGroup`

## `v1:shopify:sellingPlanGroup`

Shopify SellingPlanGroup, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `appId` | string |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `gid` | string | yes |  |
| `merchantCode` | string |  |  |
| `name` | string |  |  |
| `options` | array |  |  |
| `position` | integer |  |  |
| `productVariantsCount` | object |  |  |
| `productVariantsGids` | array |  |  |
| `productsCount` | object |  |  |
| `productsGids` | array |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `summary` | string |  |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:shop`

Shopify Shop, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `accountOwnerGid` | string |  |  |
| `alerts` | array |  |  |
| `allProductCategoriesList` | array |  |  |
| `checkoutApiSupported` | boolean |  |  |
| `contactEmail` | string |  |  |
| `countriesInShippingZones` | object |  |  |
| `currencyCode` | string |  |  |
| `currencyFormats` | object |  |  |
| `customerAccounts` | string |  | (enum: REQUIRED, OPTIONAL, DISABLED) |
| `customerAccountsV2` | object |  |  |
| `deleted` | boolean |  |  |
| `description` | string |  |  |
| `email` | string |  |  |
| `enabledPresentmentCurrencies` | array |  |  |
| `entitlements` | object |  |  |
| `features` | object |  |  |
| `fulfillmentServices` | array |  |  |
| `gid` | string | yes |  |
| `ianaTimezone` | string |  |  |
| `marketingSmsConsentEnabledAtCheckout` | boolean |  |  |
| `merchantApprovalSignals` | object |  |  |
| `metafields` | object |  |  |
| `myshopifyDomain` | string |  |  |
| `name` | string |  |  |
| `navigationSettings` | array |  |  |
| `orderNumberFormatPrefix` | string |  |  |
| `orderNumberFormatSuffix` | string |  |  |
| `paymentSettings` | object |  |  |
| `plan` | object |  |  |
| `primaryDomain` | object |  |  |
| `resourceLimits` | object |  |  |
| `richTextEditorUrl` | string |  |  |
| `searchFilters` | object |  |  |
| `setupRequired` | boolean |  |  |
| `shipsToCountries` | array |  |  |
| `shopAddress` | object |  |  |
| `shopOwnerName` | string |  |  |
| `shopPoliciesGids` | array |  |  |
| `sourceCreatedAt` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `taxShipping` | boolean |  |  |
| `taxesIncluded` | boolean |  |  |
| `timezoneAbbreviation` | string |  |  |
| `timezoneOffset` | string |  |  |
| `timezoneOffsetMinutes` | integer |  |  |
| `transactionalSmsDisabled` | boolean |  |  |
| `unitSystem` | string |  | (enum: IMPERIAL_SYSTEM, METRIC_SYSTEM) |
| `updatedAt` | string | yes |  |
| `url` | string |  |  |
| `weightUnit` | string |  | (enum: KILOGRAMS, GRAMS, POUNDS, OUNCES) |

## `v1:shopify:shopLocale`

Shopify ShopLocale, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `locale` | string |  |  |
| `marketWebPresencesGids` | array |  |  |
| `name` | string |  |  |
| `primary` | boolean |  |  |
| `published` | boolean |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:shopPolicy`

Shopify ShopPolicy, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `sourceCreatedAt` | string |  |  |
| `sourceType` | string |  | (enum: REFUND_POLICY, SHIPPING_POLICY, PRIVACY_POLICY, TERMS_OF_SERVICE, TERMS_OF_SALE, LEGAL_NOTICE, SUBSCRIPTION_POLICY, CONTACT_INFORMATION) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `title` | string |  |  |
| `updatedAt` | string | yes |  |
| `url` | string |  |  |

## `v1:shopify:shopifyPaymentsBalanceTransaction`

Shopify ShopifyPaymentsBalanceTransaction, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `adjustmentReason` | string |  |  |
| `adjustmentsOrders` | array |  |  |
| `amount` | object |  |  |
| `associatedOrder` | object |  |  |
| `associatedPayout` | object |  |  |
| `deleted` | boolean |  |  |
| `fee` | object |  |  |
| `gid` | string | yes |  |
| `net` | object |  |  |
| `sourceId` | string |  |  |
| `sourceOrderTransactionId` | string |  |  |
| `sourceType` | string |  | (enum: ADJUSTMENT_REVERSAL, CHARGE, REFUND, SYSTEM_ADJUSTMENT, DISPUTE, ADJUSTMENT, TRANSFER) |
| `sourceTypeField` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `test` | boolean |  |  |
| `transactionDate` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:shopifyPaymentsDispute`

Shopify ShopifyPaymentsDispute, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | object |  |  |
| `deleted` | boolean |  |  |
| `disputeEvidence` | object |  |  |
| `evidenceDueBy` | string |  |  |
| `evidenceSentOn` | string |  |  |
| `finalizedOn` | string |  |  |
| `gid` | string | yes |  |
| `initiatedAt` | string |  |  |
| `legacyResourceId` | string |  |  |
| `orderGid` | string |  |  |
| `reasonDetails` | object |  |  |
| `sourceType` | string |  | (enum: CHARGEBACK, INQUIRY) |
| `status` | string |  | (enum: ACCEPTED, LOST, NEEDS_RESPONSE, PREVENTED, UNDER_REVIEW, WON) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:shopifyPaymentsPayout`

Shopify ShopifyPaymentsPayout, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `businessEntityGid` | string |  |  |
| `deleted` | boolean |  |  |
| `externalTraceId` | string |  |  |
| `gid` | string | yes |  |
| `issuedAt` | string |  |  |
| `legacyResourceId` | string |  |  |
| `net` | object |  |  |
| `status` | string |  | (enum: SCHEDULED, PAID, FAILED, CANCELED) |
| `storeId` | string | yes |  |
| `summary` | object |  |  |
| `syncedAt` | string | yes |  |
| `transactionType` | string |  | (enum: DEPOSIT, WITHDRAWAL) |
| `updatedAt` | string | yes |  |

## `v1:shopify:shopifyReturn`

Shopify Return, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `closedAt` | string |  |  |
| `decline` | object |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `name` | string |  |  |
| `orderGid` | string |  |  |
| `parentGid` | string | yes |  |
| `refundsGids` | array |  |  |
| `requestApprovedAt` | string |  |  |
| `returnShippingFees` | array |  |  |
| `sourceCreatedAt` | string |  |  |
| `staffMemberGid` | string |  |  |
| `status` | string |  | (enum: CANCELED, CLOSED, OPEN, REQUESTED, DECLINED) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `totalQuantity` | integer |  |  |
| `transactionsGids` | array |  |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:order`

## `v1:shopify:staffMember`

Shopify StaffMember, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `accountType` | string |  | (enum: REGULAR, RESTRICTED, INVITED, REQUESTED, COLLABORATOR, COLLABORATOR_TEAM_MEMBER, SAML, INVITED_STORE_OWNER) |
| `active` | boolean |  |  |
| `avatar` | object |  |  |
| `deleted` | boolean |  |  |
| `email` | string |  |  |
| `exists` | boolean |  |  |
| `firstName` | string |  |  |
| `gid` | string | yes |  |
| `initials` | array |  |  |
| `isShopOwner` | boolean |  |  |
| `lastName` | string |  |  |
| `locale` | string |  |  |
| `name` | string |  |  |
| `phone` | string |  |  |
| `privateData` | object |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:store`

A configured Shopify store. NATIVE, not a mirror: this is MemQL's own record of how to reach a store, and Shopify has no corresponding object. One connector, many stores -- every mirrored row carries the storeId of the row it came from, and every read is scoped by it.

| Field | Type | Required | Description |
|---|---|---|---|
| `adminTokenRef` | string |  |  |
| `apiVersion` | string |  |  |
| `appClientId` | string |  |  |
| `domain` | string | yes |  |
| `health` | object |  |  |
| `name` | string |  |  |
| `ownerUserId` | string |  |  |
| `plan` | string |  |  |
| `protectedDataLevel` | string |  | (enum: none, level1, level2) |
| `redactedAt` |  |  |  |
| `scopesGranted` | array |  |  |
| `status` | string |  | (enum: configured, backfilling, live, paused, error) |
| `storefrontTokenRef` | string |  |  |
| `subscriptionsCheckedAt` |  |  |  |
| `webhookSecretRef` | string |  |  |

## `v1:shopify:storeCreditAccount`

Shopify StoreCreditAccount, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `balance` | object |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `owner` | object |  |  |
| `parentGid` | string | yes |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

**Relationships:** `parent` -> `v1:shopify:customer`

## `v1:shopify:subscriptionContract`

Shopify SubscriptionContract, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | object |  |  |
| `appAdminUrl` | string |  |  |
| `billingPolicy` | object |  |  |
| `currencyCode` | string |  |  |
| `customAttributes` | array |  |  |
| `customerGid` | string |  |  |
| `customerPaymentMethodGid` | string |  |  |
| `deleted` | boolean |  |  |
| `deliveryMethod` | object |  |  |
| `deliveryPolicy` | object |  |  |
| `deliveryPrice` | object |  |  |
| `gid` | string | yes |  |
| `lastBillingAttemptErrorType` | string |  | (enum: PAYMENT_ERROR, CUSTOMER_ERROR, INVENTORY_ERROR, OTHER) |
| `lastPaymentStatus` | string |  | (enum: SUCCEEDED, FAILED) |
| `linesCount` | object |  |  |
| `nextBillingDate` | string |  |  |
| `note` | string |  |  |
| `originOrderGid` | string |  |  |
| `revisionId` | string |  |  |
| `sourceCreatedAt` | string |  |  |
| `status` | string |  | (enum: ACTIVE, PAUSED, CANCELLED, EXPIRED, FAILED) |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `updatedAt` | string | yes |  |

## `v1:shopify:tenderTransaction`

Shopify TenderTransaction, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | object |  |  |
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `orderGid` | string |  |  |
| `paymentMethod` | string |  |  |
| `processedAt` | string |  |  |
| `remoteReference` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `test` | boolean |  |  |
| `transactionDetails` | object |  |  |
| `updatedAt` | string | yes |  |
| `userGid` | string |  |  |

## `v1:shopify:urlRedirect`

Shopify UrlRedirect, mirrored. Cluster-owner tier: commerce data is business data, not per-user data (design D5).

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted` | boolean |  |  |
| `gid` | string | yes |  |
| `path` | string |  |  |
| `storeId` | string | yes |  |
| `syncedAt` | string | yes |  |
| `target` | string |  |  |
| `updatedAt` | string | yes |  |

## `v1:skills:skill`

First-class capability bundle: a named unit of (knowledgeDomains + toolSlugs + liveSources) that the Planner Agent attaches to agents in createSpecialist / extendSpecialist. After the full skills rollout (#157 -> #158 -> #159) the agent factory pulls skills off the catalog rather than threading parallel flat lists; this concept is the spine of that surface. Phase 1 (this PR) lands the schema + a 13-row predefined catalog; consumers don't read skills yet. Phase 2 migrates roles + agents to skillIds[]; Phase 3 lands the mintSkill authority + approval card.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive skills disappear from the picker but agents that already carry the skill keep functioning. Lets us retire a poorly-shaped catalog row without churning every agent that bound to it. |
| `category` | string |  | Coarse grouping mirroring agentRole.category, with three additional buckets for cross-cutting platform skills (foundational, engineering, product) that don't fit the user-domain taxonomy. The role manager groups skills by this field in the picker. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby, foundational, engineering, product) |
| `constructRefs` | array |  | The catalog constructs this skill contributes (query / mutation / logic / automation names). Two skills naming the same construct is what a `duplicates` edge is proposed from, and it is why this is a list of names rather than prose. |
| `description` | string |  | One- or two-line description of what an agent with this skill can do. Surfaced in tooltips + the skill picker's expanded view. |
| `domainIds` | array |  | v1:knowledge:knowledgeDomain.id references the skill bundles. Resolved into the agent's effective domain union at retrieval / scoring / prompt-rendering time by traversing capabilities.skillIds[] (Phase 2 cut: #158 -- the agent row no longer stores a flat domains list). Load-time validation: every id ideally resolves to a known knowledgeDomain seed; the Phase 1 carve-out documented in skill_tier_validation.go warns-not-fails for unseeded ids. |
| `effects` | object |  | The declared footprint of this skill's scripts: {concepts[], files, machine, external, spend}. Spec section B's typed-action claim -- a step's expected footprint is the union over what it calls, and the safety gate reads it before a side effect. Absent means UNDECLARED, never 'no effects': a skill that has not said what it touches is one the gate treats as touching everything. |
| `instructions` | object |  | The three-tier progressive-disclosure body (spec section C): {summary, body, references[]}. `summary` is loaded with the name and description on every selection and must stay short enough that carrying twenty skills costs nothing; `body` loads when the skill is ACTIVATED for a step; `references` are Library file ids fetched only when the body points at one. The tiers exist because a skill that always loads everything is a skill nobody can afford to have many of. |
| `lastReinforced` |  |  | When reliability last moved up. Empty for a skill that has never been used successfully; the decay-on-disuse rule reads it, and an empty value means the skill has nothing to decay from. |
| `liveSourceIds` | array |  | v1:knowledge:liveSource.id references for live-knowledge bindings. Empty for most skills; populated for skills that need a current-state feed (e.g. inventory, weather, market data). Phase 2 cut (#158): resolved into the agent's effective live-source union by traversing capabilities.skillIds[]; the agent row no longer stores a flat liveSources list. |
| `mintedByRunId` | string |  | Provenance: the v1:work:run.id whose compile emitted the mint. Empty for predefined catalog rows. Replaces mintedByAgentId, and the change is not cosmetic -- work never routes to an agent row (decision D3), so the agent that used to be recorded here no longer exists as a step's executor. What a person wants from this field is 'which run decided I needed this', and the run is what can answer it. |
| `name` | string | yes | Display name shown in the role manager and the agent edit modal. Example: 'Web Research'. |
| `originatingGoalId` | string |  | Provenance: the v1:work:goal.id whose work surfaced the need for this skill (spec section C). Empty for predefined catalog rows. Replaces originatingPlanId, which named a v1:planner:plan -- the concept the spine retires. Pre-release, so this is a rename and not a second field: nothing reads the old name. |
| `ownerUserId` | string |  | v1:identity:user.id of the person whose planner minted this skill; present-and-empty for a predefined catalog row. PROVENANCE ONLY -- the tier is public, so this narrows nothing. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/skills/*.memql on every startup. Predefined rows are LOCKED in the cockpit's Skills admin view: slug / category / tier / domain+tool composition are read-only; only tags / description edits are accepted. User-created skills default to predefined=false and stay fully editable. |
| `reinforceCount` | integer |  | How many successful runs have used this skill. Absent reads as 0. |
| `reliability` | number |  | How well this skill has done, 0.0 to 1.0. Climbs on a run that succeeded using it and decays on a mismatch and on disuse, exactly as the action library's ladder did. Absent reads as 0 -- a skill nobody has run is untrusted, which is the fail-closed direction and the honest one. |
| `resources` | array |  | v1:library:artifact ids the skill's instructions may refer to -- a checklist, a schema, a worked example. Fetched on demand, which is the third disclosure tier. |
| `scripts` | array |  | [{platform, artifactId, entry, argsSchema}] -- executables this skill can run. `platform` is linux / darwin / windows / any; `artifactId` is a LIBRARY ARTIFACT and never a path on a machine, which is the whole point of capture (integrations/skills/capture.go); `entry` is the command line with {script} standing for the shipped path. runScript ships the bytes by content hash and verifies them on the far side before executing. |
| `slug` | string | yes | Canonical slug -- stable, kebab-case identifier. Examples: workbench-baseline, web-research, go-backend-engineering. Never renamed (rename = new row + migration). |
| `status` | string |  | Where the skill stands. `candidate` is minted and not yet proven -- selection may bind it, and the ladder is what promotes it. `active` is the predefined catalog and anything that earned its way there. `deprecated` is retired: still readable, so a run that bound it can be explained, and never selected as a direct match. DISTINCT FROM `active` above, which is the soft-delete flag the picker reads; this is the ladder's own axis, and collapsing them would make 'retired by an operator' and 'never proved itself' the same state. (enum: candidate, active, deprecated) |
| `tags` | array |  | UI grouping labels for cross-cutting product surfaces (e.g. ['research', 'category-baseline']). Purely cosmetic; no behavioral effect. Lets a single skill appear in multiple curated lists without forcing a category change. |
| `tier` | string | yes | Safety tier mirroring v1:knowledge:knowledgeDomain.tier. The materializer enforces skill.tier >= max(tier across domainIds[]) at load time: a skill cannot bundle a Tier-C medical domain while declaring itself Tier-A. A = general; B = safety-relevant; C = high-stakes regulated. The disclaimer effect flows from the skill's DOMAINS, not from this field or from agentRole.tier: a Tier-B domain carries disclaimerChunkText as chunk 0 (integrations/knowledge/seed_domain_content.go), and an agent inherits that by carrying the domain. There is no 'effective tier' propagation and no system-prompt disclaimer injection keyed on a tier field -- this description claimed both, which is the same defect memql#3068 corrected one field up. (enum: A, B, C) |
| `toolSlugs` | array |  | Tool / integration slugs the skill grants. Phase 2 cut (#158): resolved into the agent's effective tool union by traversing capabilities.skillIds[]; the agent row no longer stores a flat tools list. Composes through the existing tool-slug expansion (e.g. operator-computer-use expands to workerHost + workerComputer + cross-cutting trio). |
| `version` | integer |  | Bumped when the instructions, scripts or effects change. A run's binding records the version it bound, so a replay can say the skill moved underneath it rather than silently using the new one. |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:work:goal`, `references` -> `v1:work:run`

## `v1:skills:skillEdge`

A typed relationship between two skills. Compile may propose an edge; a run that succeeds commits it (the propose-then-commit protocol, spec section C). Selection reads committed edges beside vector matches.

| Field | Type | Required | Description |
|---|---|---|---|
| `edgeType` | string | yes | What the edge means. Named edgeType, not type: `type` is a reserved row intrinsic and a concept that declares it is DROPPED whole at load, with an error that blames the file-top imports instead. (enum: dependsOn, conflictsWith, specializes, duplicates) |
| `evidence` | array |  | [{runId, stepKey}] -- the executions that established it. |
| `fromSkillId` | string | yes | The skill the edge starts at. |
| `ownerUserId` | string |  | Who proposed it, when a person's run did; present-and-empty for a system-proposed edge. Provenance only -- the tier is public. |
| `proposedBy` | string | yes | Who proposed it. (enum: system, user) |
| `status` | string | yes | proposed until a successful run commits it. (enum: proposed, committed) |
| `toSkillId` | string | yes | The skill the edge points to. |

**Relationships:** `references` -> `v1:skills:skill`, `references` -> `v1:skills:skill`

## `v1:todos:todo`

A user-owned to-do item: a titled task with a done flag plus optional due date, priority, and a back-pointer to the responsibility that spawned it. The standalone source-of-truth to-do concept the assistant manages on the user's behalf. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `done` | boolean |  | Completion flag. Flipped to true by the complete operation; the row keeps its history so an undo is just another version with done=false. |
| `dueAt` |  |  | Optional due date / time in RFC3339. Used by the frontend to sort + surface overdue items; absence means no deadline. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this to-do. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `priority` | string |  | Optional priority bucket. Absence means unprioritized; the frontend sorts high > medium > low > unset. (enum: low, medium, high) |
| `sourceResponsibilityId` | string |  | Optional back-pointer to the responsibility (or plan / automation) that spawned this to-do. Empty for user-created to-dos. Lets the frontend group app-generated tasks under their originating responsibility and lets a responsibility reconcile the to-dos it created. |
| `title` | string | yes | Short human-readable description of the task. The primary display field. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:work:approval`

One human gate. Every kind of gate is this concept; an approval never carries to a modified artifact, because resume compares artifactHash. It broadcasts.

| Field | Type | Required | Description |
|---|---|---|---|
| `answer` | object |  | The person's answer, for kind feedback. |
| `artifactHash` | string | yes | Hash of the exact artifact approved: the command, the patch, the message, the draft template. |
| `decidedAt` |  |  | When the decision landed. |
| `decidedBy` | string |  | v1:identity:user.id of the decider. |
| `decision` | string |  | Empty while pending. (enum: , approved, rejected, answered) |
| `evidence` | object |  | {tier, reason, ruleId, source} from the classifier. |
| `expiresAt` |  |  | When a pending approval lapses. |
| `kind` | string | yes | Which gate. `inferenceUnavailable` (epic memql#5096) is the one raised by a CONDITION rather than by a decision: no door to a model is open, so the run parked. It is the only kind the sweep re-checks on its own -- a lid opening or somebody signing into Claude Code changes the answer with nobody deciding anything, where every other kind waits on a person and must not be re-dispatched behind their back. `routingReview` (epic memql#5146, D5) is the only kind raised by a SWEEP rather than by a run: the nightly evidence fold proposes excluding a model at a level, hashed over the exact rule text, and a person decides. It is therefore the only kind whose runId is empty -- see that field. (enum: sideEffect, scopeElevation, budget, skillMint, feedback, planReview, inferenceUnavailable, routingReview) |
| `options` | array |  | [{label, value}] for a choice question. |
| `ownerUserId` | string |  | Copied from the run's owner: the person whose decision this is. |
| `question` | string |  | The question put to the person, for kind feedback. |
| `requestedAt` | string | yes | When the run parked. |
| `runId` | string |  | v1:work:run.id parked on this approval. REQUIRED IN EFFECT for every kind but one, and the exception is why the bang is gone: `routingReview` (epic memql#5146, D5) is raised by a nightly FOLD rather than by a run, so there is no run to park -- and a synthetic one would be a run that never ran, sitting in every list of runs forever. component/work's approval builder refuses an empty runId for every other kind, so the invariant is enforced where it can name the kind rather than by a schema that cannot. |
| `stepKey` | string |  | The step that raised it. |
| `subject` | object |  | What is being approved, structured. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:work:run`

## `v1:work:goal`

The intent, owned by a person. Execution state does not live here: it lives on the run, so a goal that has been re-run, forked or repaired still reads as one thing.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountIds` | array |  | Optional v1:accounts:account tags -- a record of who the work is for, never a visibility scope. |
| `ceilings` | object |  | {tokenBudget, costCeiling, wallClockMs, maxRetries, maxModelCalls, maxEvents} -- inherited by every run of this goal. |
| `closeReason` | string |  | Why it closed, in words a person can read. |
| `closedAt` |  |  | When status reached closed. |
| `input` | object |  | The typed input object, the shape the chosen template's args declare. |
| `origin` | string | yes | Who asked: a person, a standing responsibility, or the platform itself (the Library analysis pass). (enum: user, responsibility, system) |
| `ownerUserId` | string |  | v1:identity:user.id of the person this goal belongs to, stamped from the actor; present-and-empty for a cluster-owned goal. |
| `requestedVia` | string |  | The surface the goal arrived through. Empty when unknown. `agent` is a goal an agent opened for itself -- the agent() builtin or the produceArtifact tool (memql#5048). (enum: , api, ask, nexus, responsibility, library, materializer, agent) |
| `responsibilityId` | string |  | v1:planner:responsibility.id this goal was created for, when origin is responsibility. |
| `statement` | string | yes | The goal in the person's own words. |
| `status` | string | yes | Coarse lifecycle. open = accepted, no run finished; active = a run is in flight; closed = the person or the system closed it. (enum: open, active, closed) |

**Relationships:** `parent` -> `v1:identity:user`, `references` -> `v1:planner:responsibility`

## `v1:work:modelCall`

One model request, journaled so a replay can serve it without a provider. Owner tier, a hypertable with retention (epic A2), never broadcast.

| Field | Type | Required | Description |
|---|---|---|---|
| `cost` | number |  | Cost attributed to this call. |
| `error` | string |  | The provider's error, when there was one. |
| `inputTokens` | integer |  | Tokens in. |
| `latencyMs` | integer |  | Wall-clock latency of the call. |
| `model` | string | yes | Model id as the router resolved it. |
| `outputTokens` | integer |  | Tokens out. |
| `ownerUserId` | string |  | Copied from the run's owner. |
| `promptRef` | string |  | The prompt construct name. |
| `promptVersion` | string |  | The prompt construct version at call time. |
| `provider` | string | yes | Provider name as the router resolved it. |
| `requestHash` | string | yes | Hash over provider, model, settings, messages, tools and output schema -- the replay key. |
| `response` | object |  | The response, structured output or text. |
| `runId` | string | yes | v1:work:run.id the call was made for. |
| `served` | string | yes | live = a provider answered; journal = served from a recorded response; local = a fleet model answered. (enum: live, journal, local) |
| `settings` | object |  | Temperature, max tokens and the rest of the request settings. |
| `stepKey` | string |  | The step that made the call. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:work:run`

## `v1:work:observation`

What a step observed beyond its result: a tool result, an error, a note, a decision. The embedding source for recall, so the journal is the episodic memory. Never broadcast.

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | yes | The text rendering -- the embedding source, so observations are recall-able. |
| `data` | object |  | Structured per-kind data. Named data, not payload, because payload is a reserved row intrinsic. |
| `embedding` | array |  | The embedding vector for content, populated lazily by the embed hook. |
| `kind` | string | yes | What kind of event this records. (enum: tool_result, error, note, decision) |
| `ownerUserId` | string |  | Copied from the run's owner. |
| `runId` | string | yes | v1:work:run.id the observation belongs to. |
| `stepKey` | string |  | The step that produced it. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:work:run`

## `v1:work:run`

One execution against a goal, or -- in epic A1 -- one automation execution with no goal. Created the moment the run starts so every later write has a home. The node and heartbeat fields follow the deployment-run pattern (exactly-once per replica, the abandoned sweep in A2).

| Field | Type | Required | Description |
|---|---|---|---|
| `actualFootprint` | object |  | What the run observed itself touching (epic A2). |
| `automationName` | string | yes | The automation this run executes -- the template's name in the registry. |
| `callerSuppliedPayload` | boolean |  | The trigger payload came from a caller (MCP, a dry-run), so a resume must NOT restore internal origin to it (memql#2888, memql#2890). |
| `cancelRequested` | boolean |  | Somebody asked for this run to stop. |
| `cancelledBy` | string |  | v1:identity:user.id when a person cancelled, or a system sentinel. |
| `chainHead` | string |  | Chain-tracking head after the last recorded step. |
| `errorCode` | string |  | A catalogued code when the run failed. |
| `errorMessage` | string |  | The failure in words. |
| `expectedFootprint` | object |  | The union of the declared effects of the steps (epic A2). |
| `finishedAt` |  |  | When status reached a terminal value. |
| `forkAtStepKey` | string |  | The step key the fork diverged at. |
| `forkedFromRunId` | string |  | The run this one was forked from, when mode is fork. |
| `goalId` | string |  | v1:work:goal.id this run executes, or EMPTY for an automation run that no goal asked for. |
| `heartbeatAt` |  |  | When the running node last wrote a step boundary. |
| `initialChainHead` | string |  | Chain-tracking head before the first step. |
| `input` | object |  | The automation's input envelope, restored on resume. |
| `inputFingerprint` | string |  | Hash of input, for verification on resume. |
| `mode` | string | yes | live serves nothing from the journal; replay serves every model call from it; fork serves the shared prefix. (enum: live, replay, fork) |
| `nodeId` | string |  | MEMQL_NODE_ID of the replica running this run. Stamped at open by whichever node OPENED it, and rewritten by the replica that CLAIMS it for execution (memql#5054). It used to say 'stamped at open, never rewritten' -- and under design-record section H those are different nodes, the planner opening and an agent running, so the field held the opener while claiming to hold the runner. The abandoned sweep names this node when it closes a run, which is the reader that was being misled. |
| `outcome` | object |  | The terminal result, structured. |
| `ownerUserId` | string |  | Copied from the goal's owner when there is one; present-and-empty for a system run. |
| `replayPolicy` | string |  | strict raises a divergence on a journal miss during replay; permissive makes a fresh call and journals it. (enum: strict, permissive) |
| `spent` | object |  | {tokens, tokensSubscription, tokensLocal, cost, modelCalls, retries, events, wallClockMs} so far. |
| `startedAt` | string | yes | When the run started. |
| `status` | string | yes | Where the run is. (enum: compiling, running, waiting, succeeded, failed, cancelled, abandoned) |
| `stepOrder` | array |  | Step keys in execution order. |
| `summary` | object |  | Folded from the journal before its retention window closes (epic A2). |
| `templateConstructId` | string |  | v1:authoring:construct.id when the template is an authored construct (epic A2). |
| `templateFingerprint` | string | yes | Automation.DefinitionFingerprint at start. Resume refuses a run whose automation changed under it. |
| `templateVersion` | string |  | The construct version compiled to (epic A2). |
| `triggerEvent` | object |  | {topic, kind, payload} of the triggering event, when there was one. Restored on resume. |
| `triggeredBy` | string |  | How the run was triggered: schedule, event, manual, a sub-automation, or resumed:<runId>. |
| `variables` | object |  | The bound args (epic A2). |
| `waitingOn` | object |  | {kind, subject, since} while status is waiting. kind is approval\|feedback\|timer\|external\|subrun, or one of the three the failure path writes -- retry\|replan\|repair (epic memql#5127) -- each of which the sweep serves on the node that can. A retry and a replan also carry reason and ruleId, which is the classifier verdict a person reads without opening an approval. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:work:goal`, `references` -> `v1:authoring:construct`

## `v1:work:step`

A node of a run. A retry is a NEW VERSION of the same row with attempt incremented; the intent is the `running` version written before the body executes and the receipt is the `done` or `failed` version written after. Resolved step arguments are deliberately NOT recorded here (they may carry resolved secrets); `call` names what ran, `result` is the trimmed result shape.

| Field | Type | Required | Description |
|---|---|---|---|
| `actualFootprint` | object |  | Observed effects (epic A2). |
| `approvalId` | string |  | The approval a human step waits on (epic A2). |
| `attempt` | integer | yes | 1 on first execution; incremented on each retry of the same key. |
| `binding` | object |  | {skillIds, providerPolicy, provider, model, surface, machineLabels, workerId, nodeId} recorded at dispatch (epic A3). |
| `call` | object |  | {construct, name} -- what the step invoked, by name only. |
| `childRunId` | string |  | The child run a subrun step opened (epic A2). |
| `cost` | number |  | Cost attributed to this step (epic A2). |
| `dependsOn` | array |  | Step keys this step depends on. |
| `durationMs` | integer |  | Body duration in milliseconds. |
| `errorCode` | string |  | A catalogued code when the step failed. |
| `errorMessage` | string |  | The failure in words. |
| `expectedFootprint` | object |  | Declared effects of what the step calls (epic A2). |
| `externalKey` | string |  | The inbound key an external wait resumes on (epic A2). |
| `finishedAt` |  |  | When the receipt was written. |
| `idempotencyKey` | string |  | runId:key:attempt -- the key a side effect runs under (epic A2 wires the receipts). |
| `input` | object |  | The bound input, when it is safe to record (epic A2 decides redaction). Empty in A1. |
| `key` | string | yes | The stable step key from the template (the automation step id). |
| `kind` | string |  | Derived kind (spec section B). Epic A1 derives it for every type except function, which stays empty until the A2 loader rule. (enum: , deterministic, reasoning, decision, human, loop, subrun) |
| `ownerUserId` | string |  | Copied from the run's owner; present-and-empty for a system run. |
| `postcondition` | object |  | {kind: spec\|schema\|check, ref, passed, message} (epic A2). |
| `result` | object |  | The trimmed result: {status, result, error, metadata, contentId} -- the MinimalStepResult shape resume rehydrates from. |
| `resultFingerprint` | string |  | StepDeterministicFingerprint of the result. |
| `resumeAt` |  |  | When a timer wait resumes (epic A2). |
| `runId` | string | yes | v1:work:run.id this step belongs to. |
| `seq` | integer | yes | Position in the run's step order, 0-based. |
| `startedAt` |  |  | When the body started. |
| `status` | string | yes | Where the step is. (enum: pending, ready, running, waiting, done, failed, skipped, cancelled) |
| `stepType` | string | yes | The automation step type: query, mutation, shape, webhook, event, function, action, automation, forEach, parallel, switch, detectLeadSignal, emitConceptCard. |
| `symptom` | string |  | What the classifier decided on failure (epic A2). (enum: , transient, environment, contract, plan, human) |
| `tokens` | integer |  | Tokens spent inside this step (epic A2). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:work:run`

## `v1:workbench:workspace`

Per-Plan workbench workspace. Tracks the persistent filesystem mounted into every per-Task container running under the run. Created lazily on first workbenchHost call; released when the parent Plan transitions to a terminal status (succeeded / failed / cancelled). Universal authorization -- no scope grants, no kill switch, no per-agent gating; the workbench is sandboxed inside the cluster and the blast radius is contained to the per-Plan directory tree. TIER: the composite `owner, clusterOwner` (memql#4312). A workspace is a directory of one person's working files -- whatever their plan wrote -- so it is theirs; the operator who has to answer "why is this workbench node full" needs to see all of them. ownerUserId is stamped from the parent plan's requestedBy at provision time and never from a caller argument.

| Field | Type | Required | Description |
|---|---|---|---|
| `lastUsedAt` |  |  | Bumped on every successful workbenchHost dispatch. Backs idle-detection metrics; not used to drive teardown (teardown is run-terminal-driven). |
| `nodeId` | string |  | MEMQL_NODE_ID of the workbench replica whose disk holds this directory (memql#4354). Stamped at provision time by the serving node. THE FIX FOR THE TWO-WORKSPACES-PER-PLAN SPLIT: pickWorkbenchPeer was any-fit, so with two workbench replicas one plan got a directory on each and neither side was told -- a call would write a file and the next call, landing on the other replica, would not find it. The picker now prefers this node, and falls back only when it is gone. |
| `ownerUserId` | string | yes | v1:identity:user.id this workspace's files belong to, taken from the parent run's ownerUserId at provision time. THE ROW-AUTHZ OWNER FIELD. Denormalized rather than joined because the row gate decides one row at a time and cannot follow runId to find out whose it is. |
| `releasedAt` |  |  | When the workspace was released and the directory torn down. Empty for status=provisioned. |
| `releasedReason` | string |  | Discriminator for status=released rows. run_terminal = the releaseWorkspaceOnRunTerminal automation fired. explicit = an admin / mutation explicitly released. ttl_expired = future ttl-driven sweep. node_lost = the workbench replica this workspace lived on left the mesh, so the directory is gone with it and the run was given a fresh workspace elsewhere (memql#4354). The files are NOT migrated: the design accepts a fresh directory and records why, because a file tree cannot be recovered from a node that is no longer there. (enum: , run_terminal, explicit, ttl_expired, node_lost) |
| `runId` | string | yes | v1:work:run.id this workspace belongs to. One workspace per run; the unique key. Was planId until memql#5053: a run is the unit of execution the spine dispatches, and a workspace is torn down when its run reaches a terminal status. A fork or a replay is a DIFFERENT run and therefore gets a clean tree, which is what replay means. |
| `status` | string | yes | Lifecycle. provisioned = workspace directory exists and is mountable. released = Plan reached terminal, directory torn down. (enum: provisioned, released) |
| `storageRoot` | string | yes | Absolute path to the workspace's root directory on the workbench node's local filesystem. Implementation default: /var/lib/memql/workbenches/{runId}/. Per-run isolation is filesystem-level; cgroup / user-namespace isolation is per-call. |

**Relationships:** `parent` -> `v1:work:run`, `parent` -> `v1:identity:user`

## `v1:worker:appSession`

One delegated run of a local app on a cockpit machine (memql#4360). A session is the unit because a headless `claude -p` can run for an hour: the row is created at start, its transcript appends from streamed chunks while the run is live, and it reaches a terminal status at end. The transcript on the row is BOUNDED -- the full one is pushed to the Library as a produced artifact when the session ends, so the row stays a readable summary rather than growing without limit. Owner-tier with the cluster-owner gate ORed in: an operator debugging a delegated run must be able to read it, and a plain owner tier would hide every other user's sessions from them.

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | string | yes | Which local app. The engine's runnable set is closed; a cockpit that reports another app can store it on the registration but can never open a session for it. (enum: claude-code, codex) |
| `appSessionRef` | string |  | The app's OWN session id, as it reported at end. What a later kind='attach' resumes by; empty when the app has no such notion. |
| `billing` | string | yes | Who paid. subscription = the run went through an app the user already pays for, so the tokens are covered and excluded from the plan's dollar ceiling. metered = MemQL's own vendor spend. unknown = the app reported nothing; counted in the loop caps, excluded from the dollar ceiling, and visible as unknown rather than quietly folded into either side. (enum: metered, subscription, unknown) |
| `cancelReason` | string |  | Free text carried from the cancel that ended the session. |
| `credentialExpiresAt` |  |  | When the current back-channel bearer expires. A run that outlives it gets a renew_credential control message carrying a replacement. |
| `credentialRef` | string |  | The label the per-run back-channel credential was minted under (`app-session:<sessionId>`). NOT a v1:identity:identity row id and deliberately not named like one: the credential is a class="service_account" JWT verified through the DB-free JWKS path, so no row exists to point at and no revocation handle exists either. It is here for audit correlation -- matching this against the identity service's app_session_credential_issued lines is how a reader ties a bearer to the run it was handed to. |
| `endedAt` |  |  | When the session reached a terminal status. Empty while live. |
| `errorMessage` | string |  | Populated when status reaches failed. Empty otherwise. |
| `exitCode` | integer |  | The app process's exit code. 0 on a clean run. |
| `inputArtifactIds` | array |  | Library artifact ids the cockpit pulled with the session credential before the run started. The consent card named them; keeping them is what makes a later 'what was this agent shown' answerable. |
| `kind` | string | yes | run = headless and autonomous, the engine reads the output. open = launch the app for the HUMAN with the workspace and prompt loaded; it ends when the window closes, or immediately with a failure if the app cannot be opened. attach = stream a run the human started, named by appSessionRef. (enum: run, open, attach) |
| `mcpEndpoint` | string |  | The streamable-HTTP MCP URL the app was pointed at (https://mcp.<domain>/mcp). Recorded so an audit reader can see which surface the credential was good for. |
| `ownerUserId` | string | yes | v1:identity:user.id the session runs AS. The back-channel credential is minted with this as its subject, so everything the app reads over MCP is what this user could read -- row authz applies to a delegated app exactly as it does to a browser. |
| `producedArtifactIds` | array |  | Library artifact ids the cockpit pushed at end, including the full transcript. |
| `prompt` | string |  | The prompt the app was given. Kept because the transcript alone does not say what was asked. |
| `responseSchema` | string |  | The JSON Schema the harness was asked to answer against, as it was sent on AppSessionStart (epic memql#5096). EMPTY MEANS NONE WAS ASKED FOR, which is not the same state as asking and getting nothing back -- only a session that asked can be disappointed by one that ends with no structured answer. Kept on the row so an app that reaches back over MCP (`nextTask`) can be told what shape its answer must take, which the wire told the cockpit and nothing told the app. |
| `result` | object |  | The harness's STRUCTURED final answer (epic memql#5096, design D7), from AppSessionEnd.result_json or from a `submit` call the app made over MCP. It does NOT imply success and is deliberately separate from exitCode and errorMessage: a harness can answer the schema and still exit non-zero, and folding the two would make an answer we actually have unreadable because the run that produced it failed. Empty when the session produced none, which is the ordinary case for a free-text run. |
| `resultSubmittedAt` |  |  | When a `submit` over MCP recorded the result, as distinct from the session END carrying it. The two are different evidence about the same answer -- one is the app volunteering it mid-run, the other the harness reporting it -- and a reader deciding whether a result is final needs to know which happened. |
| `runId` | string |  | v1:work:run.id this session serves. Empty for a session opened outside a run. Was planId until memql#5053. |
| `startedAt` | string | yes | When the session row was created and AppSessionStart went on the wire. |
| `status` | string | yes | Lifecycle. starting = the row exists and AppSessionStart has been sent; running = the first chunk arrived; ended = a clean AppSessionEnd; failed = the worker reported an error or disconnected mid-run; cancelled = a cancel was honoured. A session that never reaches a terminal status is one whose node died holding it -- the sweep in workerAppSessionStaleSweep marks those failed. (enum: starting, running, ended, failed, cancelled) |
| `stepId` | string |  | v1:work:step.id this session serves. Empty for a session opened outside a step. Was taskId until memql#5053. |
| `transcript` | string |  | Streamed output, appended from AppSessionChunk in seq order and BOUNDED by the delegation policy's maxTranscriptBytes. Truncation is marked inline rather than silent: a transcript that stops without saying why reads as a run that stopped. |
| `transcriptBytes` | integer |  | Bytes appended so far, including those dropped past the bound. Lets a reader see that truncation happened and by how much. |
| `transcriptTruncated` | boolean |  | True once the bound was reached. The full transcript is the artifact named in producedArtifactIds. |
| `usage` | object |  | What the app REPORTED about its own spend: {inputTokens, outputTokens, costUSD, known}. known=false means the app said nothing, which the ledger records as billing 'unknown' -- never as a free call. Never inferred from anything else. |
| `workerId` | string | yes | v1:worker:registration.id of the machine the app ran on. |
| `workspace` | string |  | Absolute directory on the machine the app ran in. Named on the consent card, so the user approved this specific path. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`, `parent` -> `v1:work:run`, `parent` -> `v1:work:step`

## `v1:worker:delegationPolicy`

Per-user preference deciding when the planner delegates a task to a local app instead of running it in-process (memql#4362). Delegation is a PREFERENCE with a fallback, never a requirement: the planner asks whether a machine with an allowed, signed-in app is online, and runs in-process when none is. A plan never waits for a laptop to wake up.

| Field | Type | Required | Description |
|---|---|---|---|
| `appOrder` | array |  | Which apps to try, in order. The first app in this list that a machine has allowed and signed in wins; an app not listed is never selected even when it is available. |
| `credentialLifetimeSeconds` | integer |  | How long the back-channel bearer is good for. Default 4 hours; a run that outlives it is handed a replacement rather than being killed. |
| `eligibleKinds` | array |  | Planner task kinds that may be delegated, starting with the coding and file-production kinds. A kind absent from this list runs in-process regardless of what is online. |
| `maxConcurrentSessions` | integer |  | How many app sessions this user may have live at once, across every machine. Zero reads as the default rather than as 'none', because a zero here would silently disable a feature the user turned on. |
| `ownerUserId` | string | yes | v1:identity:user.id this policy belongs to. One row per user; the id is derived from the user id so a second write updates rather than forks. |
| `preferSubscriptionApps` | boolean |  | The master switch. False means never delegate, whatever else the row says -- so a user who has not opted in is not surprised by an agent running on their laptop. |
| `updatedAt` |  |  | When the policy was last written. |
| `workspaceRoot` | string |  | Directory under which per-run workspaces are created on the machine. The cockpit refuses a workspace outside its own policy.yaml roots, so this is a preference the machine still gets to veto. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:worker:invocation`

Per-call telemetry for worker tool invocations. Written once on call completion (success / failure / cancelled / timeout / denied). Operator reads these for plan debugging; auditor reads identity:auditEvent for the security timeline. Linkage between the two layers is via correlationId. Retention default 90 days, tunable via WORKER_INVOCATION_RETENTION_DAYS; the workerInvocationRetentionSweep cron soft-deletes rows past their TTL.
TIER: the composite `owner, clusterOwner` (memql#4406). It carries `argsRedacted` and `outputPreview`, and outputPreview's own field doc says the quiet part out loud -- "Sensitive tokens are NOT scrubbed here -- preview is for owner eyes". That sentence described an intent the schema did not enforce: with no tier declared, every row was admitted to every caller on the read path. The composite rather than a plain owner tier for the same reason v1:worker:registration takes it -- a plain owner tier hides every other user's calls from the operator who has to support them.
What it cost, recorded because the issue was filed to STOP it being discovered: the retention sweep is a system-actor path, and `contextWithSystemActor` stamps RoleReader, so an owned tier makes it read zero rows and retire nothing -- silently, with WORKER_INVOCATION_RETENTION_DAYS quietly ceasing to mean anything. That is now decided rather than found: workerInvocationRetentionSweep runs under the cluster's maintenance principal (component/automations/maintenance_actor.go) and `expiredWorkerInvocations` carries `actor.isClusterOwner==true` so the arrangement is legible at the read.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Action discriminator within the tool. workerHost: exec / fs_read / fs_write / fs_list / fs_stat / http_fetch. workerComputer: capabilities / wait / screenshot / cursor_position / mouse_move / mouse_click / mouse_down / mouse_up / mouse_drag / mouse_scroll / key_type / key_combo / key_hold / display_info / window_list / window_focus. |
| `agentId` | string | yes | v1:agents:agent.id the call originated from. |
| `argsRedacted` | object |  | Args with secret-shaped fields redacted. Tokens, passwords, Authorization headers, env vars matching SECRET/KEY/PASSWORD scrubbed. |
| `bytesIn` | integer |  | Bytes the worker streamed in (e.g. fs_write payload). |
| `bytesOut` | integer |  | Bytes the worker streamed out (stdout + stderr + fs_read body, etc). |
| `completedAt` |  |  | When ToolResult landed back on the agent. Empty for in-flight rows that haven't completed yet -- those are rare; usually the row is written once at completion. |
| `correlationId` | string |  | Random ID linking this row to the matching v1:identity:auditEvent row when one was emitted (denied-by-policy, scope-elevation, etc). |
| `deleted` | boolean |  | Soft-delete flag. softDeleteWorkerInvocation stamps this true once the workerInvocationRetentionSweep cron retires a row past its WORKER_INVOCATION_RETENTION_DAYS window; the underlying time-series row survives for forensic recovery. Queries filter deleted rows out via isNotDeleted (payload.deleted!=true). |
| `durationMs` | integer |  | completedAt - startedAt in milliseconds. |
| `errorCode` | string |  | Worker-side error code from Failure.error_code: exec_failed / fs_denied / http_blocked / etc. |
| `errorMessage` | string |  | Human-readable error detail. Empty on success. |
| `exitCode` | integer |  | Process exit code for workerHost.exec. Empty for non-exec actions. |
| `outcome` | string | yes | Terminal status. denied_* outcomes also produce a v1:identity:auditEvent row. denied_by_classifier is the safety classifier's refusal (integrations/agent/worker/dispatch.go's gate) -- it was emitted by the Go before it was a value here. rerouted means the call did not run on the machine first chosen: either the workbench returned environment_mismatch and the router sent it to the fleet, or a candidate refused before starting and fallback=nextMatching moved it on. The routing object below says which. (enum: success, failure, cancelled, timeout, denied_by_scope, denied_by_policy, denied_by_classifier, kill_switch_engaged, no_worker_available, rerouted) |
| `outputPreview` | string |  | First 1024 chars of stdout/data, for quick debugging without fetching the full body. Sensitive tokens are NOT scrubbed here -- preview is for owner eyes, audit-log readers don't see this field. |
| `ownerUserId` | string | yes | v1:identity:user.id of the worker's owner. Same as WorkerRegistration.ownerUserId; denormalized so the frontend's per-user invocations query doesn't need to join. THE ROW-AUTHZ OWNER FIELD (memql#4406), stamped from actor.userId by createWorkerInvocation and never accepted from caller args -- @serverSet makes that a load-time rejection rather than a convention, and TestDeclaredOwnerFieldsAreServerStamped fails the build on a mutation that writes it from args. Both Go writers (component/worker/store.go, integrations/agent/worker/store.go) already know the owner and run the create under auth.ContextWithUserActor for it. |
| `routing` | object |  | How this call's destination was chosen (memql#4351). Keys: policyId (v1:worker:routingPolicy.id, empty when the owner has none and the default applied), strategy (firstFit / roundRobin / leastLoaded / labelMatch), candidatesConsidered ([]string of registration ids the router filtered down to, in the order it would try them), attempts (int -- 1 unless fallback=nextMatching moved past a refusal), selectedBy (policy / reroute / only_candidate), reroutedFrom (workbench, or worker:<registrationId>, empty when nothing was rerouted), requireLabels / preferLabels (the merged agent+policy requirement the candidates were filtered and ordered by). Empty object on rows written before the router existed, and on paths that never picked (a denial before the pick). |
| `runId` | string |  | v1:work:run.id when the call was made inside a run. Empty for an ad-hoc agent call. Was planId until memql#5053. |
| `signal` | string |  | If exec was killed by signal, the signal name. Empty otherwise. |
| `startedAt` | string | yes | When dispatch was received from the agent (ToolDispatch envelope sent on the wire). |
| `stepId` | string |  | v1:work:step.id when the call was made inside a step. Empty for an ad-hoc agent call. Was taskId until memql#5053 -- a step is the run's unit, and it is what a tool call happens inside. |
| `tool` | string | yes | Umbrella tool the action belongs to. (enum: workerHost, workerComputer) |
| `workerId` | string | yes | v1:worker:registration.id the call dispatched to. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`, `parent` -> `v1:agents:agent`, `parent` -> `v1:work:run`, `parent` -> `v1:work:step`

## `v1:worker:modelProbe`

One probe in flight, and the record of how it went (epic memql#5146, D3).
v1:worker:modelPull's SIBLING, deliberately, down to the claim field and the stale sweep. A probe runs a suite of generations and takes minutes, which is the same shape of problem a download is: a person presses a button, something long happens on hardware the cluster does not own, and the only honest way to watch it is a row that moves.
IT IS NOT THE MEASUREMENT. The figures land on v1:platform:modelMeasurement, and the split is what keeps a measurement clean: this row carries a status, a case counter and a failure sentence -- the mechanics of one attempt -- where a measurement carries only what was measured, keyed by the suite that measured it. A probe that crashed leaves a failed row here and no measurement at all, which is exactly right: nothing was measured.
A ROW LEFT AT `requested` OR `running` is one whose replica died holding it, and workerModelProbeStaleSweep marks those failed. A spinner that never resolves is the one outcome this surface must not produce, and a probe is more exposed to it than a pull: it holds somebody's GPU, so a request nobody picked up costs them nothing but a request nobody FINISHED might.
TIER: the composite owner, clusterOwner, matching the pull and the registration it names.

| Field | Type | Required | Description |
|---|---|---|---|
| `completedCases` | integer |  | Cases finished so far. UNLIKE A PULL'S COUNTERS these do not go backwards: the suite has a known length and runs its cases in order, so a surface may draw a real fraction rather than a status line. |
| `currentCase` | string |  | The id of the case that just finished, e.g. structured.triage. It is what tells a person WHICH part of the measurement is slow, which a percentage cannot. |
| `endedAt` |  |  | When the probe reached a terminal status. Empty while live. |
| `errorMessage` | string |  | Populated when status reaches failed. The runtime's own words where it spoke: a probe can fail inside a healthy stream (the model runner exits, a case times out), so the sentence arrives here rather than as a dropped connection. |
| `measurementId` | string |  | v1:platform:modelMeasurement.id this probe produced, once it produced one. Empty while live and empty forever on a failure -- a probe that crashed measured nothing, and pointing at a measurement row that does not exist would be worse than pointing at none. |
| `model` | string | yes | The model id in the runtime's own vocabulary, carried VERBATIM for the reason the pull carries it so: the router selects on this exact string. |
| `ownerUserId` | string | yes | v1:identity:user.id who asked. THE ROW-AUTHZ OWNER FIELD -- stamped from the caller's actor by fleetModelProbe, never from an argument. A probe spends minutes of this person's own machine, so the owner of the row and the owner of the hardware are the same by construction. |
| `requestedAt` | string | yes | When the act was accepted and this row written. |
| `status` | string | yes | Lifecycle. requested = the row exists and the replica holding the machine has not picked it up; running = the suite is executing; succeeded = every case reached a verdict and the figures are written; failed = the runtime or the transport said no; cancelled = somebody stopped it. succeeded does NOT mean the model scored well -- a model that failed every structured case succeeded at being measured, and the figures say the rest. (enum: requested, running, succeeded, failed, cancelled) |
| `suiteVersion` | string | yes | The suite this run is scored under. Echoed back by the machine on the End, so a measurement can never be filed under a suite the machine did not actually run. |
| `targetNodeId` | string |  | MEMQL_NODE_ID of the agent replica that held the machine's stream when the probe was requested. The claim is deterministic and needs no lock, exactly as the pull's is: one replica acts on this row, the one whose own id this names, and a machine that has reconnected to a sibling is reached by that replica forwarding over ModelProbeForward rather than by the request being dropped. |
| `totalCases` | integer |  | Cases in the suite. Reported by the machine rather than assumed here, so a cockpit running a suite version this engine pinned cannot disagree with the page about how far along it is. |
| `updatedAt` |  |  | When progress was last recorded. Written per CASE rather than on a throttle -- a suite emits ten observations in total, where a pull emits several a second, so there is no write storm to throttle away and every case is worth a row version. |
| `workerId` | string | yes | v1:worker:registration.id of the machine being measured. A probe names ONE machine because a measurement OF A DIFFERENT MACHINE answers a question nobody asked -- the whole content of a figure is which hardware produced it. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`, `references` -> `v1:platform:modelMeasurement`

## `v1:worker:modelPull`

One request to pull a model onto a fleet machine, and the record of how it went (epic memql#5103, design D3).
PERSISTED, DELIBERATELY, and it is the one row in this file whose persistence needs defending. Its siblings v1:platform:fleetModel and v1:platform:inferenceStatus are VIRTUAL because they answer "what is true right now" and a stored copy could only be a staler second answer. A pull is the opposite kind of fact: it is an EVENT WITH A DURATION that somebody started and is watching, so there is no live source to re-derive it from -- the download exists only in one process on one replica, and if that process dies the row is the only thing that can say a pull was ever asked for.
IT IS ALSO THE PROGRESS FEED. A pull runs for minutes to hours and the person who pressed Pull is watching, so progress has to reach a browser. A virtual concept is produced at query time and cannot stream; a graph row broadcasts, and the OS's live surfaces are already fed that way. So the row is written at request, updated on a throttle while the download runs, and finalised at the end -- and the same rows answer "why is this model here" long after anyone stopped watching.
THE COUNTERS DESCRIBE ONE LAYER, NEVER THE WHOLE PULL. Ollama fetches a model as a set of blobs and reports completed/total PER BLOB, restarting at zero for each. There is no whole-pull denominator anywhere in the protocol, so this row does not invent one: a reader renders progress WITHIN the current step and reads `statusLine` for where the pull as a whole has got to. A percentage across layers would be a number this cluster made up, and it would be wrong in a way nobody could see.

| Field | Type | Required | Description |
|---|---|---|---|
| `completedBytes` | integer |  | Bytes fetched FOR THE CURRENT LAYER. Resets to zero on every new layer, by construction -- see the concept's own note. Never a running total across the pull. |
| `endedAt` |  |  | When the pull reached a terminal status. Empty while live. |
| `errorMessage` | string |  | Populated when status reaches failed. The runtime's own words where it spoke -- a pull can fail inside an HTTP 200, so "no space left on device" arrives here rather than as a dropped connection. |
| `layer` | string |  | The blob the counters below belong to, when the runtime names one. Empty during phases that are not a download. It is what makes the counters legible: without it, a bar that jumps backwards looks like a bug rather than the next layer starting. |
| `model` | string | yes | The model id in the runtime's own vocabulary -- llama3.1:8b, hf.co/owner/repo:Q4_K_M. Carried VERBATIM: the router selects on this exact string, so a translation anywhere between the OS and the runtime would leave the pulled model unreachable under the name it was pulled with. |
| `ownerUserId` | string | yes | v1:identity:user.id who asked. THE ROW-AUTHZ OWNER FIELD -- stamped from the caller's actor by fleetModelPull, never from an argument. A pull writes gigabytes to this person's own machine, so the owner of the row and the owner of the hardware are the same by construction. |
| `readvertised` | boolean |  | Whether the machine pushed its new label set at once rather than waiting for the next fingerprint change (design D3). False after a success means the model is on disk and the CLUSTER cannot see it yet -- a materially different thing to tell the person watching from either success or failure, and the reason the two are separate fields. |
| `requestedAt` | string | yes | When the act was accepted and this row written. |
| `status` | string | yes | Lifecycle. requested = the row exists and the agent replica holding the machine has not picked it up yet; running = the machine is downloading; succeeded = the model is present AND allowed on the machine; failed = the runtime or the transport said no; cancelled = somebody stopped it. A row left at requested or running is one whose replica died holding it -- workerModelPullStaleSweep marks those failed, because a spinner that never resolves is the one outcome this surface must not produce. (enum: requested, running, succeeded, failed, cancelled) |
| `statusLine` | string |  | The runtime's own most recent line, verbatim ("pulling 8eeb52dfb3bb", "verifying sha256 digest"). It is carried rather than parsed into a phase enum because it is what actually tells a person where the pull has got to, and a phase vocabulary here would have to be kept in step with somebody else's release. |
| `targetNodeId` | string |  | MEMQL_NODE_ID of the agent replica that held the machine's stream when the pull was requested. The claim is deterministic and needs no lock: exactly one replica acts on this row, the one whose own id this names. If the machine has reconnected to a sibling since, that replica forwards over ModelPullForward rather than dropping the request -- which is not hypothetical, since a cockpit reconnects on every restart and a person pressing Pull after waking a laptop hits exactly that race. |
| `totalBytes` | integer |  | Size of the CURRENT LAYER, or zero when the runtime did not say. Zero is never filled in with a guess: an invented denominator produces a percentage that is wrong and unfalsifiable. |
| `updatedAt` |  |  | When progress was last recorded. Written on a throttle rather than per observation: a pull emits several a second and a row version each would be tens of thousands of versions for one download. |
| `workerId` | string | yes | v1:worker:registration.id of the machine being pulled to. A pull names ONE machine because a person pressed Pull on that machine's page; there is no routing here and no second machine to fall through to. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`

## `v1:worker:registration`

Operational registration of a worker -- the runtime record for a memql-cockpit instance running in worker mode and connected to this cluster. Persists stable identity + capabilities + last-seen state. The currently-connected gRPC stream + per-call concurrency live in-memory on whichever agent node holds the stream; this concept is for everything that needs to survive disconnect and binary restart. Per-user routing: every registration is owned by exactly one v1:identity:user; only agents in sessions owned by that user can dispatch tools to this worker. TIER: the composite `owner, clusterOwner` (memql#4312). A registration is one person's machine -- it carries their hostname, their platform, the IP it last connected from -- so the owner tier is the right one, and a plain owner tier would hide every machine from the operator who has to support them. The engine ANDs `(ownerUserId==actor.userId)||(actor.isClusterOwner==true)` onto every read and refuses a write onto a row failing the same test.
The tier is why `component/worker`'s store stamps `auth.ContextWithUserActor(ctx, ownerUserId)` on its registration reads and writes: the worker authenticates as `worker:<id>`, not as its owner, so an unstamped read of the row the register handshake needs would be refused for having no actor at all. The owner id it stamps comes from the worker_token's identity row, resolved by the interceptor before any of this runs -- never from the Register message.

| Field | Type | Required | Description |
|---|---|---|---|
| `activeCount` | integer |  | Calls in flight on this machine, as the worker reported on its most recent heartbeat (summed across capabilities). leastLoaded orders on activeCount against the per-capability concurrency cap. Best-effort and up to one heartbeat stale -- a routing input, never a correctness one; the machine's own Acquire is the real valve. |
| `appDescriptors` | array |  | How the cockpit DRIVES each app it reported (epic memql#5096, design D8). Each entry is {id, harness, structuredResult, followUps}, where harness is one of claude-headless \| codex-app-server \| codex-mcp. Reported on REGISTER only -- Register is accepted once per stream, so unlike `apps` this cannot change mid-connection and a cockpit that gains a harness advertises it on reconnect. Unlike `apps` it is NOT stored verbatim: an entry whose app id or harness word this engine does not know is dropped, because a protocol name with no client behind it is not a fact the engine can act on. An app with no entry is not the same as an app whose harness does neither -- every reader takes the absent case as 'this cockpit predates the field', never as a declared no. |
| `apps` | array |  | Local apps the cockpit detected on this machine (memql#4359). Each entry is {id, version, signedIn, subscription, allowed}: `allowed` is the machine's own policy.yaml apps.allow verdict, `signedIn` is the app's auth state as the cockpit can observe it, and `subscription` is unknown\|none\|present as the app REPORTS it -- never inferred. Stored verbatim including ids this engine cannot drive; only an entry that is both allowed and signedIn, with an id in the engine's closed runnable set, derives an `app:<id>` routing label into `labels`. |
| `buildTag` | string |  | Cockpit build flavor: 'computeruse' or 'headless'. |
| `capabilities` | array | yes | Capability set advertised at registration. HEADLESS is mandatory; COMPUTERUSE is added by the computer-use build, with actual desktop availability reported in its descriptor; MODEL is added when the worker offers local inference models. Order is not significant. |
| `capabilityDescriptor` | object |  | Optional structured capability self-description sent at registration (schemaVersion 1): {platform, displayServer: quartz\|x11\|wayland\|none, computerUseAvailable, actions: [supported workerComputer action names], schemaVersion}. Lets dispatch degrade/refuse per-action up front without a live worker round-trip. Empty object when the worker did not send one (older builds). |
| `concurrency` | object | yes | Per-capability max-parallel limits, e.g. {HEADLESS: 8, COMPUTERUSE: 1}. Scheduler enforces; calls beyond cap queue (FIFO) up to the calling tool's timeout. |
| `connectedNodeId` | string |  | MEMQL_NODE_ID of the agent replica currently holding this worker's gRPC stream. Stamped on register and on every heartbeat flush; CLEARED on disconnect. This is what makes a machine reachable from a replica that is not holding its stream: the router forwards the dispatch to this node over NodeService (WorkerForward*, memql#4352) instead of finding nothing. Empty means no replica holds the stream, i.e. offline. |
| `displayName` | string |  | The name the OWNER gave this machine from the Fleet page (renameWorker). `name` stays the cockpit's -- a hostname by default, re-stamped from the Register message on every reconnect -- so a rename does not survive one. Empty until renamed; every surface reads `displayName` falling back to `name`. |
| `hardware` | object |  | What the machine IS, as its cockpit reported it (epic memql#5146, D1): {chip, memoryBytes, gpu:{name, vramBytes, backend}, cpuCores, osVersion, diskFreeBytes, runtimes:[{name, version}], reportedAt}. PRESENCE FACTS ONLY -- no serial numbers, no user names, no paths. Sent on Register and refreshed on every tenth heartbeat, so an installed runtime shows within minutes rather than at the next reconnect. ABSENT MEANS THIS COCKPIT PREDATES THE FIELD, never a machine with no memory: machineClass reads an absent inventory as the EMPTY STRING rather than `unsupported`, because the second one is an accusation and on the day this shipped it would have been levelled at every machine in every fleet. The MACHINE CLASS and the RECOMMENDED SET are computed from this (component/memql/fleet_class.go, fleet_recommend.go) and stored NOWHERE -- a stored copy of a derived value is a second answer that ages while the inventory it came from does not. `gpu.vramBytes` is ZERO on a unified-memory machine, where memoryBytes is the pool; `gpu.backend` is what tells that apart from a card with no memory, and it reports what the machine can RUN rather than what is installed, so a discrete card whose driver does not work says `none`. `runtimes` is stored VERBATIM including names this engine does not drive, the rule `apps` already follows -- only the closed six (ollama, mlx, whispercpp, kokoro, mflux, docker) derive a `runtime:<name>` routing label. |
| `identityId` | string | yes | v1:identity:identity.id of the worker_token credential the worker authenticated with. Lookup target on every reconnect; when a new token arrives for the same physical install (stable labels.machineId), refresh rebinds this field on the existing registration rather than inserting a duplicate row. |
| `labels` | object |  | Free-form key=value tags AS THE COCKPIT REPORTS THEM. os, arch and hostname are auto-populated by the worker; the whole map is OVERWRITTEN from the Register message on every reconnect, which is why an operator's own tags cannot live here. They live in operatorLabels. Routing matches on the MERGE of the two, operator side winning. |
| `lastConnectedFromIP` | string |  | Source IP of the most recent connect attempt. Audit + abuse signal. |
| `lastSeenAt` |  |  | Bumped on every heartbeat (15s cadence). Drives the online/offline indicator. Heartbeat batching keeps DB write rate manageable. |
| `lastSelectedAt` |  |  | When the router last picked this machine for a call. Stamped by touchWorkerSelected on every successful pick. roundRobin is `oldest lastSelectedAt first`, which is how two agent replicas agree on a rotation with no shared counter. |
| `name` | string | yes | User-chosen display name. Defaults to hostname. Shown in /me/workers and /admin/workers. |
| `operatorLabels` | object |  | Free-form key=value tags THE OWNER set, from the Fleet page (setWorkerOperatorLabels). Never written by register or heartbeat, so they survive a reconnect -- the whole reason this is a second field rather than a merge into `labels` (design D3). Merged over `labels` with precedence when the router matches requireLabels / preferLabels. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this worker. THE ROW-AUTHZ OWNER FIELD, stamped from actor.userId by createWorkerRegistration and never accepted from caller args -- @serverSet makes that a load-time rejection rather than a convention, and TestDeclaredOwnerFieldsAreServerStamped fails the build on a mutation that writes it from args. The worker authenticates as worker:<id>, not as its owner, so component/worker's store runs the create under auth.ContextWithUserActor for the owner the worker_token's identity row named. Dispatch-time access check: caller's session-owner must equal this value. |
| `permissions` | object |  | TCC / X11 status snapshot at register time: {accessibility, screen_recording, x11_display, detail}. Surfaced in /me/workers; the worker re-registers on reconnect so this stays accurate. |
| `platformInfo` | object |  | os, arch, hostname snapshot at register time. |
| `registeredAt` | string | yes | When the registration row was first created. |
| `revokeReason` | string |  | Free text; surfaced in audit + the worker's offline-row tooltip. |
| `revokedAt` |  |  | When the user (or admin) revoked the worker. Non-nil = dispatch refuses; the worker's gRPC stream is dropped on next health check. |
| `revokedBy` | string |  | v1:identity:user.id who revoked the worker. Empty for self-revocation. |
| `rttAt` |  |  | When rttMs was measured, on the agent replica's clock (epic memql#5218, D11). Written with rttMs and only with it; the pair is left out of a flush entirely while nothing has been measured, so an absent rttAt is the ONE reading for `not measured` and a present one dates the figure beside it. The OS renders it as `checked N s ago` so a stale sample reads as stale rather than as current. |
| `rttMs` | integer |  | The latest round trip from the agent replica holding this machine's stream to the cockpit and back, in milliseconds (epic memql#5218, D11). lastSeenAt is the MACHINE's word that it is there; this is the CLUSTER's own evidence that the return path works, and how fast. Written by component/worker on the heartbeat flush after a Pong lands: the agent sends a Ping a few seconds after RegisterAck and then once a minute (component/worker.PingInterval), the cockpit echoes it, and the agent measures the round trip against ITS OWN clock, so no clock on the machine can shape the figure. ABSENT MEANS NOT MEASURED -- no Pong has landed on this stream, which is what a cockpit predating the message looks like -- and NEVER slow; a reader that shows this without checking rttAt first shows nothing as a number. Not a routing input: it decides nothing and is shown beside `checked N s ago`. |
| `sharing` | object |  | The OWNER's half of the consent that lets this machine serve the cluster (epic memql#5146, D6): {mode: 'owner' \| 'cluster', sharedAt, sharedBy}. `owner` -- the default and the absent case -- means the machine serves its owner's calls and nobody else's; `cluster` means the owner has offered it to everyone. IT IS ONE HALF OF TWO: the COCKPIT's half is capabilityDescriptor.inferenceServe, read from that machine's own policy.yaml, and a machine serves another user only when BOTH say cluster. That is the `allowed` and `signedIn` shape the local-app door already uses, for the same reason -- a person may own a machine they are not entitled to volunteer, and a machine may sit somewhere its policy forbids serving strangers. THE TWO CONSENTS ARE RENDERED SEPARATELY and never as one derived flag, because the REPAIRS are in different places: the owner's is one act on the Fleet page, the cockpit's is a line in that machine's policy.yaml, and a single 'not shared' sentence sends half the operators to the wrong machine. Revoking takes effect on the NEXT resolution -- a call already in flight completes, because stopping a generation mid-token would lose work somebody is waiting for and change nothing about the prompt already sent. |
| `version` | string |  | Cockpit binary version (e.g. v2026.5.4-computeruse). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `parent` -> `v1:identity:user`

## `v1:worker:routingPolicy`

The owner's routing policy: which of their machines gets a piece of work, and what happens when the first choice refuses. ONE ACTIVE ROW PER USER -- createRoutingPolicy and updateRoutingPolicy enforce it, and the router reads the active one through routingPolicyForOwner.
ABSENT IS A VALID STATE and the common one. A user who never opened the Fleet page has no row, and the router applies `firstFit` + `nextMatching`: today's behaviour plus a re-pick. The default is deliberately the safest pair rather than the cleverest -- firstFit is what Registry.PickWorker did, and nextMatching only ever moves past a candidate that refused BEFORE running anything (design D5).
THE AGENT NEVER WRITES THIS, and cannot name a machine at all: the dispatch builtins take requireLabels / preferLabels and no workerId (design D4). An agent expresses what the work needs; the policy decides where it lands. That is what makes a hallucinated machine id a failure mode this design does not have.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean | yes | Exactly one active row per owner. Superseded rows are kept rather than deleted -- an invocation's routing.policyId points at the row that made the choice, and a deleted policy would leave that record unreadable. |
| `fallback` | string | yes | What happens when the chosen machine refuses BEFORE the call starts -- busy at its concurrency cap, or its stream went away before dispatch. nextMatching tries the next candidate; none reports the refusal. Neither ever re-picks after a call has started: an exec that lost its stream mid-run may have run (design D5). (enum: none, nextMatching) |
| `modelPreference` | array |  | An explicit ordered list of model ids, consulted when a policy names fleet:* (epic memql#5096, design D5). It ORDERS; it does not filter -- a model absent from the list is still eligible, it is simply tried after every model the list names, because a preference that silently removed one would take the fleet's only tool-capable model out of every tool turn. Empty for most users, which is why the default ordering (parameters, then context window, then model id, with unknown size LAST) has to be good on its own rather than being a fallback nobody exercises. |
| `ownerUserId` | string | yes | v1:identity:user.id whose fleet this policy routes. THE ROW-AUTHZ OWNER FIELD -- stamped from actor.userId by createRoutingPolicy, never from args. |
| `preferLabels` | object |  | Ordering hint, not a filter. Under labelMatch, candidates matching more of these sort first; under the other strategies they break ties. |
| `requireLabels` | object |  | Labels a machine MUST carry to be a candidate at all, AND-ed with whatever the agent's call requires. Narrows, never widens: a policy cannot make a machine eligible for work the agent did not ask to run there. |
| `strategy` | string | yes | How the router orders the candidates that survived the requireLabels filter. firstFit = registration order, the pre-policy behaviour. roundRobin = oldest lastSelectedAt first, so two agent replicas rotate identically without a shared counter. leastLoaded = lowest activeCount against the capability's concurrency cap. labelMatch = most preferLabels hits first, then registration order. (enum: firstFit, roundRobin, leastLoaded, labelMatch) |

**Relationships:** `parent` -> `v1:identity:user`

