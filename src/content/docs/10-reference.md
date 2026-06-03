# memQL — Complete Reference (Concepts, Tools, Providers, Policies)

This is the exhaustive enumeration layer of the memQL documentation: the dense,
grouped lists that the conceptual and how-to docs point into. It catalogs every
**concept** (the schemas), every **tool** (the SI-callable surface), every
**provider** (the SI vendor/model records), every **routing policy**, and every
**builtin** (Go-backed DSL functions) currently shipped in the `dsl/` tree of
the public memQL repository.

> **This is the most drift-prone document in the set.** It is a hand-verified
> snapshot of the `dsl/` tree on the current `main` branch. Counts and
> descriptions are copied from the `@description` annotations in the source
> `.memql` files. When the DSL tree changes, regenerate this page from
> `dsl/*/concepts.memql`, `dsl/*/tools*.memql`, `dsl/providers/providers.memql`,
> `dsl/policies/policies.memql`, and `dsl/*/builtins.memql`. Where a count or
> claim could not be confirmed against source, it is marked inline.

## How the DSL tree is organized

The public repo uses a **flat per-namespace** layout (one directory per
namespace, with per-construct files inside it), not the nested
`dsl/v1/<type>/v1/<namespace>/` layout described in some internal docs:

```
dsl/<namespace>/concepts.memql      # all concepts in the namespace
dsl/<namespace>/tools.memql         # all tools (or dsl/<namespace>/tools/*.memql)
dsl/<namespace>/builtins.memql      # all builtins in the namespace
dsl/providers/providers.memql       # all SI providers (single file)
dsl/policies/policies.memql         # all SI Router routing policies (single file)
```

Each `concepts.memql` carries file-level `@version` and `@namespace`
annotations; an individual construct's canonical id is composed as
`v{major}:{namespace}:{conceptName}`. For example, the `agent` concept in
`dsl/agents/concepts.memql` (`@namespace("agents")`, `@version("1.0.0")`) is
addressed canonically as `v1:agents:agent`.

```
// dsl/agents/concepts.memql (header)
@version("1.0.0")
@namespace("agents")
```

### A note on `@scope`

Internal narrative in several `@description` strings refers to concepts being
"global-scoped" (living in the reserved `_system` partition). However, the
canonical reference doc `dsl/_reference/_concept.memql` states that the
`@scope("global")` annotation was **retired in the partition-removal pivot**
(section 5: "Authoring a `@scope` annotation on a concept is a load-time
error"). That same reference file is internally inconsistent — a later section
(13) still documents `@scope("global")` and a worked example uses it. No
`concepts.memql` file in the tree carries a live `@scope` annotation. Treat
the "global-scoped" language in concept descriptions below as historical
intent, not a confirmed runtime property. *(File: `dsl/_reference/_concept.memql`.)*

---

## Concepts (101 total, 22 namespaces)

Concepts are schemas for time-series nodes — the base of the DSL dependency
tree; every other construct references one or more concept ids. The
one-line summaries below are condensed from each concept's `@description`.
Source files: `dsl/<namespace>/concepts.memql`.

| Namespace | Count |
|-----------|-------|
| agents | 7 |
| calendar | 1 |
| cluster | 7 |
| cognition | 18 |
| common | 2 |
| curriculum | 2 |
| data | 3 |
| guide | 2 |
| harness | 5 |
| identity | 12 |
| knowledge | 12 |
| library | 3 |
| memql | 1 |
| notes | 1 |
| observability | 3 |
| planner | 4 |
| platform | 6 |
| router | 4 |
| safety | 3 |
| todos | 1 |
| workbench | 1 |
| worker | 2 |
| **Total** | **100** |

### `agents` — `dsl/agents/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:agents:agent` | AI assistant templates with configurable capabilities, personalities, and provider settings; per-user platform agents keyed by `ownerUserId`, addressed as `_system:v1:agents:agent:<seedName>-<userShortId>`. |
| `v1:agents:agentAuthorization` | Standing authorization granting an agent permission to trigger Plans of certain kinds without per-Plan user approval (tiered-trust / opt-in autonomy, per `(agentId, planKind, spaceScope)` with token cap + expiry). |
| `v1:agents:agentRole` | First-class catalog of agent roles — picks locked minimum skills, recommended LLM policy, and a cap on skills an agent in the role may carry. |
| `v1:agents:skill` | First-class capability bundle: a named unit of `(knowledgeDomains + toolSlugs + liveSources)` the Planner Agent attaches in createSpecialist/extendSpecialist. |
| `v1:agents:skillChangeEvent` | Append-only audit log for every skill attach/reconfigure event on an agent. |
| `v1:agents:operatorMemory` | Session-scoped memory for UI-driving agents; one record per user, accumulates notes across takeovers. |
| `v1:agents:avatarPersona` | Operator-curated avatar persona catalog; each row minted once from an operator image into one vendor (Anam or Simli). Carries an operator-configurable `avatarModel` (Anam: `cara-3` / `cara-4`) threaded to the vendor handshake. |

### `calendar` — `dsl/calendar/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:calendar:calendarEvent` | A single calendar event owned by one user; app-native source of truth (`source` discriminates native vs externalSync; `recurrence` is an optional RFC-5545 RRULE carried verbatim). |

### `cluster` — `dsl/cluster/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:cluster:cluster` | A memQL cluster — top-level deployment unit (shared database + seed nodes bff/cognition/planner). |
| `v1:cluster:database` | A PostgreSQL instance backing a cluster; tracks connection info, engine version, installed extensions. |
| `v1:cluster:identityProvider` | An identity provider used for auth/user management; typically the in-house identity service. |
| `v1:cluster:node` | A registered node in the cluster; updated on every liveness transition (states mirror `NodeHealthStatus` in `component/node/node.proto`). |
| `v1:cluster:nodeType` | Definition of a node type and its expected capabilities. |
| `v1:cluster:spawnEvent` | Lifecycle event recording node state transitions (started/stopped/failed); legacy name retained for data compatibility. |
| `v1:cluster:trainingResult` | Ephemeral result node returned by trainAgent / trainAgentRetryStep handlers (per-run summary; transit container, not persisted). |

### `cognition` — `dsl/cognition/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:cognition:audioOverride` | Per-`(spaceId, agentId)` audio control override (on/off/mirror_user) for one space; deterministic id `audioOverride:<spaceId>:<agentId>`. |
| `v1:cognition:chunk` | A streaming text chunk emitted incrementally during AI response generation; frontend accumulates chunks into a real-time message. |
| `v1:cognition:request` | Ephemeral request envelope for a client-executed tool call bridging cluster nodes (cognition's client-tool relay). |
| `v1:cognition:response` | Ephemeral response envelope paired with a client:tool:request; inserted by the browser after dispatching the tool. |
| `v1:cognition:context` | Queryable runtime context snapshot for a space (participants, sessions, media activity). |
| `v1:cognition:micState` | Per-`(spaceId, userId)` mic state record; lets the cognition handler resolve `mirror_user` audio control. |
| `v1:cognition:participant` | A human or SI participant instance within a space. |
| `v1:cognition:presence` | UI-friendly presence snapshot for a participant (thinking/responding/waiting). |
| `v1:cognition:session` | Real-time interaction state (device + stream + activity) for a participant; audio gated by user mic toggle + agent audioControl. |
| `v1:cognition:space` | Persistent multi-participant rooms where humans and AI meet (bounded human + agent capacity; no 1:1 vs group distinction). |
| `v1:cognition:state` | Conversation turn-taking state — who is speaking and AI participation permissions. |
| `v1:cognition:utterance` | A single multi-modal contribution to the conversation stream. |
| `v1:cognition:videoOverride` | Per-`(spaceId, agentId)` video control override mirroring audioOverride; governs lip-synced avatar video. |
| `v1:cognition:guardrailHealth` | Rolled-up guardrail health metrics for a time window; advisory signal for tuning the fit-score threshold. |
| `v1:cognition:unmetCapability` | A single instance of the router determining no agent could meet the user's request (specialist_gap or full_gap). |
| `v1:cognition:privateUtterance` | Per-user private "Team-tab" utterance; `forUserId` is server-stamped from `actor.userId`. Authz tier: owned. |
| `v1:cognition:misrouteFeedback` | Append-only audit row capturing the misroute classifier's prediction and the user's response. Authz tier: owned. |
| `v1:cognition:greetSuppression` | Short-lived marker suppressing the greet-on-join greeting while a first-run walkthrough starts; TTL-bounded. |

### `common` — `dsl/common/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:common:attachment` | A file attachment uploaded to a space, with extracted transcription. |
| `v1:common:media` | Audio, video, image, and document assets referenced by utterances. |

### `curriculum` — `dsl/curriculum/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:curriculum:curriculum` | A guided lesson plan an app-control agent can run, executed segment by segment (first consumer: first-login demo `copresent.welcome.v1`). |
| `v1:curriculum:segment` | One step in a curriculum: narration, recommended tool calls, and the options the user can pick to advance the graph. |

### `data` — `dsl/data/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:data:log` | Audit log entry for validation state transitions (who checked/confirmed/reverted, when, why). |
| `v1:data:policy` | Validation policy defining check/confirm requirements for a record type. |
| `v1:data:record` | Data record with validation lifecycle draft → checked → confirmed; visibility governed by validation state + policy. |

### `guide` — `dsl/guide/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:guide:guide` | A persisted, re-runnable Guide: an ordered sequence of Scenes the General Assistant narrates while driving CoPresent UI/Canvas in a voice walkthrough. |
| `v1:guide:scene` | One Scene in a Guide: narration intent, Canvas actions, optional avatar directives, interruptibility contract; ordered by `order`. |

### `harness` — `dsl/harness/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:harness:plan` | Desired state of a unit of agent work — the spine the reconciler drives (open → running → done/failed/cancelled); `ownerUserId` is the owned-tier authz key. |
| `v1:harness:step` | A unit of work inside a Plan — one DAG node (pending → ready → running → done/failed/blocked); invalid transitions rejected by `harness_step_validation.go`. |
| `v1:harness:observation` | What actually happened during a step — durable, recall-able; `content` is the embedding text stored to `node_vectors`. |
| `v1:harness:semanticMemory` | A durable, distilled belief consolidated from episodic memory; `sourceEpisodes` link the belief back to forming episodes; confidence rises/decays. |
| `v1:harness:consolidationCursor` | Per-owner consolidation watermark stored as a node; makes consolidation incremental (cost bounded by new-episode delta). |

### `identity` — `dsl/identity/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:identity:accessRequest` | Self-service access request on the waitlist queue; created when an unknown email registers under approval mode. |
| `v1:identity:auditEvent` | Append-only audit log of security-relevant events; retention via `IDENTITY_AUDIT_LOG_RETENTION_DAYS`. `prevEventHash` reserved for future hash-chain. |
| `v1:identity:authCode` | One-time OAuth authorization code (RFC 6749 §4.1); single-use, redirect-URI + client-ID bound, ~60s TTL. |
| `v1:identity:authSession` | Bearer-token session record; one row per access token, looked up on every authenticated request for per-session revocation. |
| `v1:identity:clusterSettings` | Runtime-editable cluster settings, single-row (`id='cluster'`); operator-tunable knobs bootstrapped from `IDENTITY_*` env vars. |
| `v1:identity:delegation` | Grants an AI agent the right to act through a user's identity for a bounded role/scope/lifetime. |
| `v1:identity:identity` | An account or credential set owned by a user (magic-link email, OAuth, PAT, service account, worker token); agents borrow via delegation. |
| `v1:identity:invitation` | Token-hashed invitation credential mapping an invitee to an optional product scope hint (pending/accepted/expired/cancelled). |
| `v1:identity:magicLinkRequest` | Pending magic-link auth request; the plain token is SHA-256 hashed before persistence, single-use via `consumedAt`. |
| `v1:identity:user` | A person (or synthetic principal); owns identities; same record cluster-wide. |
| `v1:identity:workerPairingCode` | Short-lived pairing credential for the computer-use enrollment flow (XXXX-XXXX code, single-use, ~10min TTL). |
| `v1:identity:group` | Organization group; users belong to groups, agents assigned to groups for scoped access (`externalId` preserved for legacy sync rows). |

### `knowledge` — `dsl/knowledge/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:knowledge:document` | A user-uploaded file (or chat-promoted segment) analyzed into queryable items; container concept owning metadata + back-references. |
| `v1:knowledge:documentChunk` | A single retrievable text chunk attached to a knowledge domain; embedding lives in `node_vectors` keyed by chunk id. *(Note: a `documentChunk` is also described in `dsl/common`; this is the knowledge-namespace definition.)* |
| `v1:knowledge:domainEntitySchema` | Per-domain entity schema (entityKind, keyFields, displayFields) powering cross-file dedup; inferred on the second validated Document. |
| `v1:knowledge:entityIndex` | The cross-file dedup lookup table; one row per validated entity keyed by `sha256(normalized key field values)`. |
| `v1:knowledge:imageRegion` | One detected region inside an image Document — bounding box, vision-generated caption, lazy visual embedding. |
| `v1:knowledge:knowledgeBridge` | Synthetic bridge combining multiple knowledge domains for a role; hash-keyed by `(roleSlug, sortedDomainIds)` to reuse across matching agents. |
| `v1:knowledge:knowledgeDomain` | A knowledge domain agents can specialise in; carries scope (workspace/private) + ownerId and seed tier (A/B/C). |
| `v1:knowledge:spreadsheetRow` | One row extracted from a spreadsheet Document; typed so queries filter `data.<columnName>=<value>` as native column predicates. |
| `v1:knowledge:validationEvent` | Append-only audit log for every validation status transition on any data-bearing concept. |
| `v1:knowledge:liveSource` | A named query against a volatile data source — the "live knowledge" counterpart to a knowledge domain; results carry citations. |
| `v1:knowledge:liveConnector` | Defines a backing data source for liveSources (memql concepts, postgres/mysql/mssql, REST, GraphQL, custom plug-ins); auth via partitionSecret references. |
| `v1:knowledge:liveSnapshot` | Cached result of a liveSource read, keyed by `(liveSourceId, queryArgsHash)`; bounded-stale reuse until `expiresAt`. |

### `library` — `dsl/library/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:library:artifact` | A single Library index row pointing at one backing source (document/output/note/todo/event/memory/liveSource); owned-tier authz. |
| `v1:library:generatedOutput` | A deliverable produced through the app (workbench result, computer-use output, agent output); auto-promoted into the Library. |
| `v1:library:memory` | A durable memory the assistant retains about the user across sessions; surfaced in the Library's Records lens; owned-tier authz. |
| `v1:library:liveSource` | A connected, refreshable source backing the knowledge/skill layer; visibility can be **workspace-scoped via a non-owned authz tier** (#723), not strictly per-row owned. |

### `memql` — `dsl/memql/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:memql:checkpoint` | Automation execution checkpoints for failure recovery and audit history. |

### `notes` — `dsl/notes/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:notes:note` | A user-owned standalone note (title, body, tags, updatedAt); distinct from copresent's canvasState note caption; owned-tier authz. |

### `observability` — `dsl/observability/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:observability:codeProfile` | Live per-function observability configuration; keyed by `codeReference` (matches `model.Node.ID` in topology model). |
| `v1:observability:invocation` | One captured invocation of a Method or Func; backed by the `code_invocation` TimescaleDB hypertable (time-partitioned, jsonb-compressed). |
| `v1:observability:codeMetric` | Aggregate observability rollups (callCount, p50/p95/p99, errorRate) backed by TimescaleDB continuous aggregates; outlive raw rows. |

### `planner` — `dsl/planner/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:planner:plan` | A user-visible unit of work the planner orchestrates; Plans can nest via `parentPlanId`; lifecycle queued/routing/running/.../succeeded/failed/cancelled. |
| `v1:planner:responsibility` | A user-authored standing directive aimed at an agent — REACTIVE / STANDING / RECURRING archetypes; replaces the retired standingTask concept. |
| `v1:planner:task` | One executable step inside a Plan — `semantic` (planner decomposition) or `toolInvocation` (auto-stamped per tool call); one level of mechanical recursion. |
| `v1:planner:taskState` | Persisted working state of a Task parked awaiting user feedback or paused; bootstrap context for planner re-invocation on resume. |

### `platform` — `dsl/platform/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:platform:globalSecret` | Instance-wide encrypted secret (NaCl secretbox under `MEMQL_MASTER_KEY`); cleartext never stored; resolver falls back partition → global. |
| `v1:platform:globalVariable` | Instance-wide plaintext config variable visible to every tenant; per-tenant overrides via partitionVariable. |
| `v1:platform:partitionSecret` | Partition-scoped encrypted secret (BYOK vendor keys, per-tenant creds); falls back to globalSecret when no row found. |
| `v1:platform:partitionVariable` | Partition-scoped plaintext config variable; falls back to globalVariable. |
| `v1:platform:policyTrace` | Persisted trace tree for a single policy evaluation; written when `@traces_persisted` or `PersistTrace=true`; retention via `MEMQL_POLICYTRACE_RETENTION_DAYS` (default 90). |
| `v1:platform:missingCapability` | A capability the platform itself cannot yet provide (missing tool/integration/connector kind); logged by the Planner during capability-gap detection. |

### `router` — `dsl/router/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:router:budget` | Spend limit for a partition or specific agent; the router checks current-period spend before every SI call (rolls over at periodType boundary). |
| `v1:router:call` | One SI invocation recorded by the SI Router; one row per call with attribution, token counts, latency, cost (usage ledger). |
| `v1:router:modelCatalog` | Virtual projection of a registered SI provider entry — never persisted, produced at query time by `integration.router.listModels`. |
| `v1:router:policyCatalog` | Virtual projection of a registered SI Router policy — never persisted, produced at query time by `integration.router.listPolicies`. |

### `safety` — `dsl/safety/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:safety:classification` | One row per safety-classifier decision (verdict source rule/model/cache, surface + action, redacted payload); retention `MEMQL_SAFETY_CLASSIFICATION_RETENTION_DAYS` (default 90). |
| `v1:safety:approvalRequest` | One row per Ask-verdict approval request; keyed by `correlationKey` for idempotency; flipped approved/denied to unblock a gated action. |
| `v1:safety:outputScreening` | One row per output-screening decision (ingress: should this string land in the model's context?); retention `MEMQL_SAFETY_OUTPUT_SCREENING_RETENTION_DAYS` (default 90). |

### `todos` — `dsl/todos/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:todos:todo` | A user-owned to-do (title, done flag, optional due date/priority, back-pointer to spawning responsibility); owned-tier authz. |

### `workbench` — `dsl/workbench/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:workbench:workspace` | Per-Plan workbench workspace tracking the persistent filesystem mounted into every per-Task container; universal authorization (sandboxed in-cluster). |

### `worker` — `dsl/worker/concepts.memql`

| Concept | Summary |
|---------|---------|
| `v1:worker:invocation` | Per-call telemetry for worker tool invocations; retention default 90 days (`WORKER_INVOCATION_RETENTION_DAYS`), soft-deleted by the retention sweep cron. (Concept id corrected in #667.) |
| `v1:worker:registration` | Operational registration of a worker (a memql-cockpit instance in worker mode); per-user routing — owned by exactly one user. |

---

## Tools (24 total)

Tools are the SI-callable surface — the discoverable, schema-typed entry points
an agent's tool loop binds call args to. Each tool declares a `@handler` (the
function it forwards to) and an `@executionTime` hint (`fast` or `medium`). The
tool body is its input schema (a field list with types and
`@required`/`@default`/`@description` annotations).

**Handler types observed:** `type="query"` (15 tools — forward to a query or
mutation function) and `type="function"` (9 tools — forward to a named Go-backed
function handler). **Execution times observed:** `fast` (20) and `medium` (4).

A representative tool body, copied from source:

```memql
@handler(type="query", query="mutationCreateCalendarEvent({...})")
@executionTime("fast")
@description("Create a native calendar event for the caller...")
tool calendarCreate {
  title       string  @required @description("Event title, e.g. 'Karate class'.")
  startsAt    string  @required @description("Event start as an RFC3339 timestamp.")
  endsAt      string  @description("Event end as an RFC3339 timestamp. Omit for a point-in-time reminder.")
  allDay      boolean @default("false") @description("True for a date-scoped all-day event.")
  location    string  @description("Free-form location text.")
  notes       string  @description("Free-form notes / description.")
  recurrence  string  @description("Optional RFC-5545 RRULE recurrence rule.")
}
```
*File: `dsl/calendar/tools.memql`.*

### `calendar` — `dsl/calendar/tools.memql`

| Tool | Handler | Time | Summary |
|------|---------|------|---------|
| `calendarList` | query `queryUpcomingEvents` | fast | List the caller's upcoming events whose start falls in `[windowStart, windowEnd]`; caller's own events only. |
| `calendarFind` | query `queryFindEvents` | fast | Find the caller's events by exact title; caller's own events only. |
| `calendarCreate` | query `mutationCreateCalendarEvent` | fast | Create a native calendar event for the caller (`ownerUserId` server-stamped, `source='native'`). |
| `calendarUpdate` | query `mutationUpdateCalendarEvent` | fast | Update an existing event the caller owns; only the fields in `payload` change. |
| `calendarDelete` | query `mutationDeleteCalendarEvent` | fast | Soft-delete a calendar event the caller owns (recoverable in history). |

### `memql` — `dsl/memql/tools.memql`

| Tool | Handler | Time | Summary |
|------|---------|------|---------|
| `describeFunction` | query `help` | fast | Get detailed usage guidance for a MemQL named function (docs, args schema, calling rules). |
| `searchUsers` | query `concept==v1:memql:backend:user` | fast | Search for users. |

### `notes` — `dsl/notes/tools.memql`

| Tool | Handler | Time | Summary |
|------|---------|------|---------|
| `notesList` | query `queryNotes` | fast | List the caller's notes (id, title, body, tags, updatedAt); read-only, owned. |
| `notesCreate` | query `mutationCreateNote` | fast | Create a note for the user (server-stamped owner); body required, title/tags optional. |
| `notesUpdate` | query `mutationUpdateNote` | fast | Update a note's fields (title/body/tags) with a full merged payload; ownership re-enforced. |
| `notesSearch` | query `queryNotesByTag` | fast | Search the caller's notes by tag; owned, read-only. |

### `todos` — `dsl/todos/tools.memql`

| Tool | Handler | Time | Summary |
|------|---------|------|---------|
| `todosList` | query `queryTodos` | fast | List the caller's to-dos; optional `done` filter; read-only. |
| `todosCreate` | query `mutationCreateTodo` | fast | Create a to-do (server-stamped owner); optional dueAt/priority/sourceResponsibilityId. |
| `todosComplete` | query `mutationCompleteTodo` | fast | Mark a to-do complete (or re-open); pass the full updated payload with the `done` flag set. |
| `todosUpdate` | query `mutationUpdateTodo` | fast | Update a to-do's fields (title/dueAt/priority) with a full merged payload. |

### `agents` — `dsl/agents/tools/*.memql`

| Tool | Handler | Time | Summary | File |
|------|---------|------|---------|------|
| `askSpecialist` | function `askSpecialist` | medium | Query a specialist agent for a structured answer `{response, rationale?, confidence, needsMore?}`. | `askSpecialist.memql` |
| `ensureAgent` | function `ensureAgentForGoal` | medium | Ensure an agent exists that can handle a goal (match/extend/create from the role catalog); returns `{agentId, action, reasoning}`. | `ensureAgent.memql` |
| `requestUserFeedback` | function `requestUserFeedback` | fast | Pause the active Plan and ask the user for missing detail mid-task (Plan → awaitingFeedback). | `requestUserFeedback.memql` |
| `webSearch` | function `webSearch` | medium | Issue a web search; returns `{url, title, snippet}` list. **STUB:** no web-search provider wired in-repo yet (returns empty + note). | `trainerTools.memql` |
| `fetchUrl` | function `fetchUrl` | medium | Fetch and extract readable content from a URL; returns `{url, status, contentType, text, truncated}`. | `trainerTools.memql` |
| `writeKnowledgeChunk` | function `mutationWriteKnowledgeChunk` | fast | Persist a distilled knowledge chunk (`source='trainerAgent'`, validated/canonical); `sourceRef` REQUIRED (no fabricated citations). | `trainerTools.memql` |
| `markChunkSuperseded` | function `mutationMarkChunkSuperseded` | fast | Flag a chunk as outdated (`superseded=true`, refresh mode only); row preserved for audit. | `trainerTools.memql` |
| `embedChunk` | function `embedChunk` | fast | Embed a just-written chunk so it becomes semantically retrievable; idempotent. | `trainerTools.memql` |

### `cognition` — `dsl/cognition/tools/recentChat.memql`

| Tool | Handler | Time | Summary |
|------|---------|------|---------|
| `recentChat` | function `recentChat` | fast | Read recent space-chat content + space context; read-only; the assistant's window into the utterance stream. |

---

## Providers (57 total, single file)

Providers are SI vendor + model + auth records. They come in two forms:

- **Base providers** (`@base` + `@type`) carry vendor-level auth and type. There
  are **6**: `anthropic`, `google`, `groq`, `mistral`, `openai`, `xai`.
- **Model providers** (`@extends("<base>")` + `@model` + optional `@type`)
  declare a concrete model, optional `@description`, and a `params` block
  (context window, completion-token cap, cost-per-million).

The default chat provider is **`stream54`** (carries the `@default`
annotation — "every caller that does not explicitly pick a provider lands
here"). Source file: `dsl/providers/providers.memql`.

A representative model provider with its `params` block:

```memql
@extends("openai")
@model("gpt-5.4-mini")
@description("OpenAI GPT-5.4 Mini - balanced cost/latency chat (non-streaming)")
provider chat54Mini {
  params {
    contextWindow              128000
    maxCompletionTokens        16384
    inputCostPerMillion        0.15
    outputCostPerMillion       0.60
    cachedInputCostPerMillion  0.075
  }
}
```
*File: `dsl/providers/providers.memql`.*

### Base providers

| Provider | `@type` |
|----------|---------|
| `anthropic` | Anthropic |
| `openai` | OpenAI |
| `google` | Google |
| `groq` | Groq |
| `mistral` | Mistral |
| `xai` | xAI |

### Model providers

Grouped by capability. Each row lists the provider name, its `@model`, and the
`@type` where one is declared (model providers that only set `@extends`
inherit the base `@type`).

#### Chat — non-streaming

| Provider | Model | Notes |
|----------|-------|-------|
| `chat53Latest` | gpt-5.3-chat-latest | Auto-updated chat-tuned alias (non-streaming). |
| `chat54` | gpt-5.4 | Flagship standard-tier chat (non-streaming). |
| `chat54Mini` | gpt-5.4-mini | Balanced cost/latency chat. |
| `chat54Nano` | gpt-5.4-nano | Cheapest high-volume chat for low-complexity tasks. |
| `chat54Pro` | gpt-5.4 | Pro tier; aliases to gpt-5.4 (gpt-5.4-pro is responses-API only). |
| `claudeHaiku` | claude-haiku-4-5-20251001 | Anthropic Haiku. |
| `claudeOpus` | claude-opus-4-6 | Anthropic Opus. |
| `claudeSonnet` | claude-sonnet-4-6 | Anthropic Sonnet. |
| `geminiFlash` | gemini-2.0-flash | Fastest + cheapest Gemini tier (OpenAI-compatible endpoint). |
| `geminiPro` | gemini-2.0-pro | Higher-capability Gemini for long-context reasoning. |
| `grok2` | grok-2-latest | xAI Grok-2 flagship reasoning. |
| `groqLlama70B` | llama-3.3-70b-versatile | Groq-accelerated, high tokens/sec. |
| `mistralLarge` | mistral-large-latest | Mistral's top-tier general-purpose model. |
| `codestral` | codestral-latest | Mistral Codestral — coding-specialized, cheap and fast. |

#### Chat — streaming (`@type` ends in `Stream`)

| Provider | Model | `@type` | Notes |
|----------|-------|---------|-------|
| `stream53Latest` | gpt-5.3-chat-latest | OpenAIStream | Auto-updated chat-tuned alias (streaming). |
| `stream54` | gpt-5.4 | OpenAIStream | **`@default`** — flagship standard-tier streaming chat. |
| `stream54Mini` | gpt-5.4-mini | OpenAIStream | Balanced cost/latency streaming. |
| `stream54Nano` | gpt-5.4-nano | OpenAIStream | Cheapest high-volume streaming. |
| `stream54Pro` | gpt-5.4 | OpenAIStream | Pro tier (streaming); aliases to gpt-5.4. |
| `streamClaudeHaiku` | claude-haiku-4-5-20251001 | AnthropicStream | |
| `streamClaudeOpus` | claude-opus-4-6 | AnthropicStream | |
| `reasoningClaudeOpus` | claude-opus-4-6 | AnthropicStream | Opus 4.6 with extended-thinking (8192-token internal reasoning budget). |
| `streamClaudeSonnet` | claude-sonnet-4-6 | AnthropicStream | |
| `streamCodestral` | codestral-latest | MistralStream | Coding-specialized (streaming). |
| `streamCodex51Max` | gpt-5.1-codex-max | OpenAIStream | Heavy long-context coding (multi-file refactors). |
| `streamCodex53` | gpt-5.3-codex | OpenAIStream | Coding-specialized chat (NemoClaw / code-gen flows). |
| `streamGeminiFlash` | gemini-2.0-flash | GoogleStream | Fastest + cheapest Gemini, tool-calling enabled. |
| `streamGeminiPro` | gemini-2.0-pro | GoogleStream | Higher-capability Gemini (streaming). |
| `streamGrok2` | grok-2-latest | xAIStream | Grok-2 flagship reasoning (streaming). |
| `streamGroqLlama70B` | llama-3.3-70b-versatile | GroqStream | First-token latency under 300ms. |
| `streamMistralLarge` | mistral-large-latest | MistralStream | Top-tier general-purpose streaming with tool support. |
| `streamReasoning4Mini` | o4-mini | OpenAIStream | Efficient reasoning-focused o-series model (streaming). |

#### Embedding (`@type` OpenAIEmbedding)

| Provider | Model | Notes |
|----------|-------|-------|
| `embedding3Large` | text-embedding-3-large | High-fidelity embeddings (3072 dims). |
| `embedding3Small` | text-embedding-3-small | Cheaper embeddings (1536 dims); default for high-volume retrieval. |

#### Speech-to-text (`@type` OpenAISTT)

| Provider | Model | Notes |
|----------|-------|-------|
| `whisper1` | whisper-1 | Verbatim STT; the memQL default STT model (`MEMQL_WHISPER_MODEL`). |
| `transcribeDiarize` | gpt-4o-transcribe-diarize | STT with speaker diarization. Placeholder type until the diarization-aware client lands. |

#### Text-to-speech (`@type` OpenAITTS)

| Provider | Model | Notes |
|----------|-------|-------|
| `tts4oMini` | gpt-4o-mini-tts | Newest natural-sounding TTS. |
| `tts1Hd` | tts-1-hd | Classic HD TTS; reliable fallback. |

#### Audio / realtime / multimodal (placeholder types — clients not yet landed)

The descriptions on these note "Placeholder type until the … client lands."

| Provider | Model | `@type` | Purpose |
|----------|-------|---------|---------|
| `audio15` | gpt-audio-1.5 | OpenAIAudio | Unified audio in/out single-shot. |
| `audioMini` | gpt-audio-mini | OpenAIAudio | Smaller unified audio in/out. |
| `realtime15` | gpt-realtime-1.5 | OpenAIRealtime | Bidirectional audio+text over WebSocket (Polyphon voice chat). |
| `realtimeMini` | gpt-realtime-mini | OpenAIRealtime | Smaller/cheaper realtime for high-volume voice. |
| `computerUse` | computer-use-preview | OpenAIComputerUse | Agentic control of a virtual machine. |
| `moderationOmni` | omni-moderation-latest | OpenAIModeration | Self-updating moderation for text + image safety. |
| `image15` | gpt-image-1.5 | OpenAIImage | Newest generative image model. |
| `image1Mini` | gpt-image-1-mini | OpenAIImage | Smaller/cheaper generative image. |
| `sora2` | sora-2 | OpenAIVideo | Generative video. |
| `sora2Pro` | sora-2-pro | OpenAIVideo | Higher-quality / longer-duration generative video. |
| `research3` | o3-deep-research | OpenAIDeepResearch | Higher-tier long-form deep-research pipeline. |
| `research4Mini` | o4-mini-deep-research | OpenAIDeepResearch | Long-form deep-research pipeline (cheaper tier). |
| `search5` | gpt-5-search-api | OpenAISearch | Web-search-grounded chat. |

---

## Policies (5 total — SI Router routing policies)

The policies that ship in the public `dsl/` tree are **SI Router routing
policies** (block syntax: `@primary` / `@fallback` / latency knobs). They
select which provider serves a given workload and define a fallback chain.
Source file: `dsl/policies/policies.memql`.

> **Scope note.** The internal `CLAUDE.md` describes a *second*, distinct policy
> system — cross-cutting **decision policies** (`func (Policy) name(ctx) { ... }`
> with `@tier` / `@frontend_visible` / `@audited` annotations, under
> `dsl/policies/core/` and `dsl/policies/bff/`). **No such decision policies
> exist in this repo's `dsl/` tree.** The only `func (Policy)` references are in
> the documentation/reference files (`dsl/_reference/_trait.memql`). The
> `v1:platform:policyTrace` concept and the `EvaluatePolicy` engine path exist,
> but the public DSL ships only the five routing policies below.

Routing-policy fields:
- `@primary("<provider>")` — first-choice provider.
- `@fallback("<provider>")` — ordered fallback chain (repeatable).
- `@maxLatencyMs` / `@maxTimeToFirstTokenMs` — latency envelopes.
- `@preferredRole("<role>")` — agent roles the policy targets (repeatable).

| Policy | Primary | Fallbacks | Latency caps | Preferred roles | Summary |
|--------|---------|-----------|--------------|-----------------|---------|
| `balancedChat` | streamClaudeSonnet | stream54Pro, streamGeminiPro | maxLatency 60000ms | assistant, specialist | Default chat policy for non-operator agents; Sonnet-class floor for agent replies (Mini-primary produced hedged, un-cited replies). |
| `cheapestCapable` | streamGeminiFlash | streamGroqLlama70B, streamCodestral | maxLatency 15000ms | — | Bulk suggestion + classification work where cost per call matters more than model ceiling. |
| `fastCoding` | streamCodestral | streamGroqLlama70B, stream54Mini | maxLatency 20000ms | — | Cheap + quick code generation / refactor assistance. |
| `lowLatencyVoice` | streamGroqLlama70B | streamGeminiFlash, stream54Mini | TTFT 800ms, maxLatency 10000ms | — | Turn-taking in multi-party voice; Groq for best first-token latency. |
| `strongReasoning` | streamClaudeSonnet | stream54Pro, streamGeminiPro | maxLatency 60000ms | operator | Operator-enabled UI-driving agents and complex tool-calling choreography. |

Full source for one policy:

```memql
@primary("streamClaudeSonnet")
@fallback("stream54Pro")
@fallback("streamGeminiPro")
@maxLatencyMs(60000)
@preferredRole("assistant")
@preferredRole("specialist")
@description("Default chat policy for non-operator agents...")
policy balancedChat { }
```
*File: `dsl/policies/policies.memql`.*

---

## Builtins (66 total, 7 namespaces)

Builtins wrap Go integrations behind a declarative schema so they look like
regular DSL function calls. Each declares an `@executor` (the Go integration or
engine intrinsic it dispatches to); the body is the builtin's input schema.

A representative builtin:

```memql
@executor("integration.similarity.similarTo")
@args(profile="object", additionalProperties="true")
@description("Retrieve top-K nodes of the given concept ranked by cosine similarity...")
builtin similarTo {
  text      string  @required
  concept   string  @required
  limit     int
  provider  string
}
```
*File: `dsl/common/builtins.memql`.*

Two kinds of `@executor` value appear: **integration executors**
(`integration.<area>.<op>` — dispatch to a registered Go integration plug-in)
and **engine-intrinsic executors** (bare names like `concepts`, `help`,
`validate`, `error` — handled directly by the engine).

### `agents` — `dsl/agents/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `agent` | integration.agents.invoke | Async-invoke a DSL-registered agent by name; creates a queued Plan (kind=agentInvocation) and returns its id. |
| `askSpecialist` | integration.agents.askSpecialist | Synchronously query a specialist agent by role; returns one `{response, rationale?, confidence, needsMore?}` object. |
| `requestUserFeedback` | integration.agents.requestUserFeedback | Transition the active Plan to awaitingFeedback with a `feedbackRequest{question, kind, options?, timeoutAt}`. |
| `ensureAgentForGoal` | integration.agents.ensureForGoal | Match-extend-or-create an agent that can handle a goal; returns `{agentId, action, reasoning}`. |

### `cognition` — `dsl/cognition/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `recentChat` | integration.chat.recentChat | Read recent utterances + space context (readRecent / readByKeyword / readByTime / getSpaceContext / listParticipants). |
| `ensureDailySpaceForUser` | integration.dailyspace.ensureForUser | Ensure today's daily space exists for a given user; idempotent, no-op if disabled. |
| `ensureDailySpaceForCaller` | integration.dailyspace.ensureForCaller | Ensure today's daily space exists for the authenticated caller; no-op for system actors. |
| `rolloverDailySpacesAllUsers` | integration.dailyspace.rolloverAllUsers | Hourly cron entry point; ensures today's daily for every active user. |

### `common` — `dsl/common/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `authCheckPermission` | integration.auth.checkPermission | Check if the current user has a specific role; returns boolean. |
| `authResolveUser` | integration.auth.resolveUser | Resolve the current authenticated user from request context. |
| `cognitionScore` | integration.cognition.scoreUtterance | Score an utterance against agent candidates using the Polyphon turn-taking algorithm. |
| `cognitionTrackPresence` | integration.cognition.trackPresence | Update participant presence state (idle/thinking/typing/responding). |
| `concepts` | concepts | Return metadata for all registered concepts. |
| `contentId` | contentId | Predict the content-addressed id for a concept+payload without inserting. |
| `databaseHealthCheck` | integration.database.healthCheck | Check database connectivity; returns healthy/unhealthy + response time. |
| `databaseStats` | integration.database.stats | Return DB connection pool statistics (open/idle/in use/wait count). |
| `ensureKnowledgeBridge` | integration.knowledge.ensureKnowledgeBridge | Ensure a cross-domain bridge corpus exists for an agent's `(roleSlug, sortedDomainIds)`; idempotent, hash-keyed. |
| `error` | error | Construct and return an error from a message string. |
| `filesExtractText` | integration.files.extractText | Extract plain text from a file by MIME type (PDF, DOCX, images, text). |
| `functions` | functions | Return a minimal list of all registered functions (name + description). |
| `help` | help | Return full details for a specific function or tool by name. |
| `knowledgeAugmentDomainAnalyze` | integration.knowledge.augmentDomainAnalyze | Decide whether a chat exchange warrants augmenting an agent's knowledge domain; returns `{outcome, domainId, topic, reasoning, confidence}`. |
| `knowledgeAugmentDomainGenerate` | integration.knowledge.augmentDomainGenerate | Generate + embed + persist topic-focused chunks for a domain; inserts a Plan for audit. |
| `knowledgeIngest` | integration.knowledge.ingest | Chunk + embed + persist a document into a domain; `source` REQUIRED (provenance class). |
| `knowledgeSeedStandardDomains` | integration.knowledge.seedStandardDomains | Seed standard knowledge domains + CoPresent UI corpus on startup; idempotent. |
| `avatarDirectStartSession` | integration.avatardirect.startSession | Start a direct/Guide avatar session for an Anam-vendor agent; mints a LiveKit room + join token. |
| `avatarDirectStopSession` | integration.avatardirect.stopSession | Stop a direct/Guide avatar session; best-effort, always returns `{ok:true}`. |
| `realtimeCreateClientSecret` | integration.openairealtime.createClientSecret | Mint a short-lived OpenAI Realtime ephemeral `client_secret` for a browser↔OpenAI WebRTC session. |
| `memqlDocs` | memqlDocs | Return embedded MemQL documentation as queryable nodes. |
| `openaiVoiceSynthesize` | integration.openaiVoice.synthesize | Synthesize text to speech using OpenAI TTS; returns base64 PCM16 audio. |
| `previewInsert` | previewInsert | Validate payload, predict id, and check existence — without inserting. |
| `routerListModels` | integration.router.listModels | List every SI provider registered at startup (vendor, model id, pricing, availability). |
| `routerListPolicies` | integration.router.listPolicies | List all routing policies loaded from `policies/v1/*.memql`. |
| `routerSetApiKey` | *(none)* | Set a router vendor API key (`vendor`, `plaintextKey` required; optional `label`, `addedBy`). **Carries no `@executor` annotation in source** — the declaration sits directly after `routerListPolicies` with no executor line; verify intended dispatch in `dsl/common/builtins.memql`. |
| `seedAllDomainContent` | integration.knowledge.seedAllDomainContent | Run seedDomainContent across every shipped domain; optional tier/prefix filters. |
| `seedDomainContent` | integration.knowledge.seedDomainContent | Generate + embed + store seeded chunks for one domain (Tier-A LLM-generates, Tier-B disclaimer, Tier-C Wikipedia/placeholder). |
| `webSearch` | integration.knowledge.webSearch | Issue a web search for the Trainer Agent. **STUB:** no provider wired in-repo (returns empty + note). |
| `fetchUrl` | integration.knowledge.fetchUrl | Fetch + extract readable text from a URL (bounded http.Client); returns `{url, status, contentType, text, truncated}`. |
| `embedChunk` | integration.knowledge.embedChunk | Embed one knowledge chunk so it becomes retrievable via similarTo; idempotent. |
| `embedDomainItems` | integration.knowledge.embedDomainItems | Embed every unembedded validated chunk in a domain, recompute the Document's embeddingStatus; idempotent. |
| `serviceVersion` | serviceVersion | Return the current memQL service version. |
| `shapeHelp` | shapeHelp | Get full details for a shape template by name. |
| `shapeTemplates` | shapeTemplates | List available shape templates, optionally filtered by concept. |
| `similarTo` | integration.similarity.similarTo | Retrieve top-K nodes ranked by cosine similarity to a free-text query, optionally scoped to domains. |
| `storageUpload` | integration.storage.upload | Upload file data to cloud storage; returns storage URL. |
| `sttTranscribe` | integration.stt.transcribe | Transcribe audio data to text (non-streaming batch). |
| `tools` | tools | Return MCP-compatible tool definitions (name, description, inputSchema). |
| `trainAgent` | integration.training.trainAgent | Train an agent: replace domains+tools, eager-embed chunks, refresh identity vector, distill system prompt (bracketed by a Plan + 3 Tasks). |
| `trainAgentRetryStep` | integration.training.trainAgentRetryStep | Re-run a single failed training step (identity vector or distilled prompt). |
| `validate` | validate | Validate a payload against a concept's JSON schema; returns valid flag, errors, schema info. |
| `voicePickForGender` | integration.voice.pickForGender | Pick a canonical voice name for an agent of a given gender, biased away from voices the owner already uses. |
| `voiceResolve` | integration.voice.resolve | Resolve a canonical voice name + provider to the provider-specific voice id. |
| `dateKeyInTimezone` | integration.timeutil.dateKeyInTimezone | Compute today's YYYY-MM-DD date key in a given IANA timezone; falls back to UTC. |

### `identity` — `dsl/identity/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `identityCreateDelegation` | integration.identity.createDelegation | Create a delegation granting an agent scoped authority to act on behalf of an identity. |
| `identityResolveDelegation` | integration.identity.resolveDelegation | Resolve the active delegation chain for an agent subject. |
| `identityRevokeDelegation` | integration.identity.revokeDelegation | Revoke an existing delegation by id, deactivating all scoped authority. |
| `identityValidateScope` | integration.identity.validateScope | Check whether a delegation permits a specific operation; returns boolean. |

### `workbench` — `dsl/workbench/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `workbenchDispatchHost` | integration.workbench.dispatchHost | Dispatch a `workbenchHost.<action>` call to the per-Plan workspace; lazily provisions on first call. |
| `workbenchTeardownDirectory` | integration.workbench.teardownDirectory | Remove the on-disk workbench workspace directory for a Plan; idempotent. |

### `worker` — `dsl/worker/builtins.memql`

| Builtin | Executor | Summary |
|---------|----------|---------|
| `agentworkerDispatchComputer` | integration.agentworker.dispatchComputer | Dispatch a `workerComputer.<action>` call to the user's GUI-capable worker. |
| `agentworkerDispatchHost` | integration.agentworker.dispatchHost | Dispatch a `workerHost.<action>` call to the user's connected worker. |
| `agentworkerListWorkers` | integration.agentworker.listWorkers | List workers connected for a supplied user; returns `{registrationId, name, capabilities, ...}`. |
| `agentworkerRequestScope` | integration.agentworker.requestScope | Create a scope-elevation Plan + canvas card for a computer_use task awaiting approval. |
| `agentworkerStatus` | integration.agentworker.status | Resolve the live computer-use availability for the calling agent's owner user. |

### `harness` — `dsl/harness/queries.memql`

These two builtins are declared in the harness namespace's `queries.memql` file
(not a `builtins.memql`), alongside the harness query functions.

| Builtin | Executor | Summary |
|---------|----------|---------|
| `recall` | integration.harnessRecall.recall | Recall top-k memories of a concept (default `v1:harness:observation`) by a single hybrid recency × relevance score (pgvector cosine + exponential time-decay), scored server-side in one SQL statement; owner-scoped, tunable halfLife/weights. |
| `harnessTrace` | integration.harnessTrace.trace | Fetch a harness plan's full execution timeline (every plan/step version transition + all observations) reconstructed from the append-only event stream; owner-scoped; backs the cockpit `harness trace` CLI. |

---

## Verification summary

All counts and names in this document were enumerated directly from the `dsl/`
tree of the public repo (`grep "^concept "`, `grep "^tool "`, `grep "^provider "`,
`grep "^builtin "`, and the single `dsl/policies/policies.memql` file). Totals:

- **100** concepts across 22 namespaces.
- **24** tools across 5 namespaces.
- **57** providers (6 base + 51 model) in one file.
- **5** SI Router routing policies in one file.
- **66** builtins across 7 namespaces (45 in `common`, 4 each in `agents` /
  `cognition` / `identity`, 5 in `worker`, 2 in `workbench`, and 2 in
  `harness`'s `queries.memql`).

When this snapshot ages, re-run those greps against the source tree to refresh
the tables.
