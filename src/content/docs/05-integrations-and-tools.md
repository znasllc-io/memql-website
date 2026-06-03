# memQL — Integrations, Tools & Capabilities

memQL's capability surface is the set of Go-backed operations and DSL-declared functions that agents, automations, and the frontend can invoke. It is built on a deliberate separation: **integrations** are Go protocol adapters that bridge external services (Deepgram, Anam, Microsoft Graph, pgvector, the user's own machine) into the engine and expose typed *capabilities*; **builtins** are thin `.memql` declarations that wrap each capability behind a schema so it looks like an ordinary DSL function; and **tools** are the SI-facing contract — the subset of builtins, queries, and mutations that an LLM agent is allowed to call inside its tool loop. This document covers how that surface is wired (the plug-in system and build-tag matrix), the three-layer tool/builtin/capability model, and a reference-grade tour of the major capabilities: voice, avatars, computer-use/workers, knowledge/RAG, email, calendar/notes/todos, the Library, and training.

> This is a snapshot of memQL as of the current `main` branch. Code paths and capability names are copied from source; file paths are cited under each example.

---

## 1. The three layers: capability → builtin → tool

A single piece of functionality typically exists at three levels.

1. **Capability (Go).** An integration implements `IntegrationProvider` and returns a list of `IntegrationCapability` values. At registration each is namespaced as `integration.<integrationName>.<capabilityName>` and slotted into the engine's builtin-executor dispatch map.

   ```go
   // IntegrationCapability describes a single callable function exposed by an integration.
   type IntegrationCapability struct {
       Name        string                 // short name, e.g. "similarTo"
       Description string                 // human-readable summary
       Handler     builtinExecutorHandler // the Go function
       ArgsSchema  map[string]string      // advisory type hints
       PreserveOrder bool                 // keep handler's slice order (e.g. ranked results)
   }

   type IntegrationProvider interface {
       IntegrationName() string
       Capabilities() []IntegrationCapability
   }
   ```
   *Source: `component/memql/integration_provider.go`*

2. **Builtin (DSL).** A `.memql` `builtin` declaration binds an `@executor("integration.<name>.<cap>")` to a typed argument schema, so the capability can be called from any DSL body like a normal function:

   ```memql
   @enabled
   @executor("integration.similarity.similarTo")
   @args(profile="object", additionalProperties="true")
   @description("Retrieve top-K nodes of the given concept ranked by cosine similarity to the supplied free-text query. Optionally scoped to a payload.domainId list.")
   builtin similarTo {
     text      string  @required
     concept   string  @required
     limit     int
     provider  string
   }
   ```
   *Source: `dsl/common/builtins.memql`*

   Builtins can also point `@executor(...)` at engine-native operations rather than an integration — e.g. `concepts`, `validate`, `previewInsert`, `contentId`, `error`, `help`, `functions`, `tools`, `serviceVersion`, `memqlDocs` are all in-engine executors declared as builtins in `dsl/common/builtins.memql`.

3. **Tool (DSL).** A `tool` declaration is the LLM-facing surface. It carries a `@handler` (the query/mutation/builtin it dispatches to), an `@executionTime` hint, optional `@allowedRoles`, and a per-field schema with `@description`s the model reads. A tool's `@handler(type="query", ...)` can run *any* MemQL statement — including a mutation call — so tools fan out over the read and write surfaces uniformly. Example:

   ```memql
   @enabled
   @handler(type="query", query="queryUpcomingEvents({\"windowStart\": \"$args.windowStart\", \"windowEnd\": \"$args.windowEnd\"})")
   @executionTime("fast")
   @description("List the caller's upcoming calendar events whose start falls in [windowStart, windowEnd] ...")
   tool calendarList {
     windowStart  string  @required @description("Inclusive RFC3339 lower bound on event start (e.g. now).")
     windowEnd    string  @required @description("Inclusive RFC3339 upper bound on event start (e.g. now + 48h).")
   }
   ```
   *Source: `dsl/calendar/tools.memql`*

The boundary matters: **tools are agent-only**. Per the design note in `dsl/agents/tools/ensureAgent.memql`, all agent capabilities go through the tool surface so `@allowedRoles` and the universal agent-context gate apply uniformly; the builtins underneath are the implementation, the tools are the contract.

### Argument injection and security

Tool fields can be marked `@autoInjected` — the agent runtime stamps them from turn context and the central validator **drops any LLM-supplied value before dispatch** (memql#107). This is how `spaceId`, `agentId`, `ownerUserId`, and `planId` are protected from forgery:

```memql
tool recentChat {
  spaceId    string  @required @autoInjected @description("v1:cognition:space.id of the active space. Server-stamped from the agent runtime; the central validator drops any LLM-supplied value before dispatch (memql#107).")
  agentId    string  @autoInjected ...
  operation  string  @required @enum("readRecent", "readByKeyword", "readByTime", "getSpaceContext", "listParticipants") ...
}
```
*Source: `dsl/cognition/tools/recentChat.memql`*

Similarly, the per-row "owned" authz tier means owner-scoped tools (notes, todos, calendar, Library) carry **no `ownerUserId` arg at all** — ownership is server-stamped from `actor.userId` and every read filters on `payload.ownerUserId==actor.userId`, so a model cannot widen the row set or write to another user's data.

---

## 2. How integrations register: the plug-in system

memQL has two registration paths, in preference order.

### 2.1 Self-registering plug-ins (preferred)

A plug-in package calls `memql.RegisterPlugin(name, factory)` from an `init()`. The factory receives a narrow `PluginContext` and returns an `IntegrationProvider`:

```go
func RegisterPlugin(name string, factory PluginFactory) {
    if name == "" { panic("memql.RegisterPlugin: empty plugin name") }
    if factory == nil { panic("memql.RegisterPlugin: nil factory for plugin " + name) }
    // ... panics on duplicate name; appends to pluginRegistry
}
```
*Source: `component/memql/plugins.go`*

`PluginContext` is the **stable extension contract** — a plug-in either finds what it needs here or on the `Engine`; reaching into `app/` internals is forbidden. Its fields (all callbacks lazily evaluated so plug-ins observe live state even if they stash the context):

| Field | Purpose |
|---|---|
| `Logger` | component logger |
| `Engine` | `IntegrationEngineAccess`: DSL execution, SI invocation, tool dispatch, streaming-provider lookups |
| `BunDB() *bun.DB` | DB handle, or nil on DB-less node binaries |
| `VisionProvider()` | default vision-capable SI provider |
| `EmbeddingProviderByName(name)` | named embedding provider |
| `ResolvePartitionFromContext(ctx)` | active partition (`"default"` if none) |
| `ResolveVariable` / `ResolveSystemVariable` | partition-scoped / global plaintext config |
| `ResolveSecret` / `ResolveSystemSecret` | partition-scoped / global encrypted secrets |
| `Providers *ProviderRegistry` | SI provider registry |
| `Policies *PolicyRegistry` | SI Router routing policies |
| `Agents *AgentRegistry` | DSL-declared agent definitions |

*Source: `component/memql/plugins.go`*

At startup, `App.materializePlugins()` iterates `memql.RegisteredPlugins()`, builds a live `PluginContext`, and registers each provider with the engine:

```go
func (a *App) materializePlugins() {
    plugins := memql.RegisteredPlugins()
    pctx := a.pluginContext()
    for _, p := range plugins {
        prov, err := p.Factory(pctx)
        if err != nil { a.fatal("plug-in factory failed", "plugin", p.Name, "error", err) }
        if prov == nil {
            // (nil, nil) is the documented "opt out" signal
            a.Logger.Info("plug-in opted out", "name", p.Name)
            continue
        }
        if err := a.engine.RegisterIntegration(prov); err != nil {
            a.fatal("plug-in registration failed", ...)
        }
        a.Logger.Info("plug-in registered", "name", p.Name)
    }
}
```
*Source: `app/plugins.go`*

A factory may return `(nil, nil)` to opt out at runtime when its dependencies aren't satisfied — e.g. GCS without a bucket configured returns `nil, nil` from its plug-in (`integrations/gcs/plugin.go`), and the app boots without it.

The core plug-ins are anchored via blank imports so their `init()`s run:

```go
import (
    _ "github.com/znasllc-io/memql/integrations/agents"
    _ "github.com/znasllc-io/memql/integrations/auth"
    _ "github.com/znasllc-io/memql/integrations/avatardirect"
    _ "github.com/znasllc-io/memql/integrations/chat"
    _ "github.com/znasllc-io/memql/integrations/dailyspace"
    _ "github.com/znasllc-io/memql/integrations/database"
    _ "github.com/znasllc-io/memql/integrations/email"
    _ "github.com/znasllc-io/memql/integrations/embedding"
    _ "github.com/znasllc-io/memql/integrations/fileprocessor"
    _ "github.com/znasllc-io/memql/integrations/gcs"
    _ "github.com/znasllc-io/memql/integrations/harnessrecall"
    _ "github.com/znasllc-io/memql/integrations/harnesstrace"
    _ "github.com/znasllc-io/memql/integrations/identity"
    _ "github.com/znasllc-io/memql/integrations/knowledge"
    _ "github.com/znasllc-io/memql/integrations/liveknowledge"
    _ "github.com/znasllc-io/memql/integrations/openairealtime"
    _ "github.com/znasllc-io/memql/integrations/router"
    _ "github.com/znasllc-io/memql/integrations/similarity"
    _ "github.com/znasllc-io/memql/integrations/timeutil"
    _ "github.com/znasllc-io/memql/integrations/training"
    _ "github.com/znasllc-io/memql/integrations/voice"
    _ "github.com/znasllc-io/memql/integrations/workbench"
)
```
*Source: `app/plugins_core.go`*

### 2.2 Explicit `app/` wiring (complex first-party only)

When a plug-in needs dependencies outside `PluginContext`, it's wired explicitly under build-tag-gated `app/integrations_*.go` files that call `a.engine.RegisterIntegration(...)` directly. This is reserved for the cognition, agent, and stt integrations.

### 2.3 The build-tag matrix

memQL compiles a separate binary per node type via Go build tags; each binary includes only the integrations relevant to its role. The explicit-wiring anchors and their tags:

| File | Build constraint | Node |
|---|---|---|
| `app/integrations_bff.go` | `//go:build bff` | BFF |
| `app/integrations_voice.go` | `//go:build voice` | Voice |
| `app/integrations_cognition.go` | `//go:build cognition` | Cognition |
| `app/integrations_agent.go` | `//go:build agent` | Agent |
| `app/integrations_worker_agent.go` | `//go:build agent` | Agent (worker dispatch) |
| `app/integrations_planner.go` | `//go:build planner` | Planner |
| `app/integrations_planner_init.go` | `//go:build planner` | Planner |
| `app/integrations_identity.go` | `//go:build identity` | Identity |
| `app/integrations_workbench.go` | `//go:build workbench` | Workbench |
| `app/integrations_stt.go` | `//go:build !planner` | all except planner |
| `app/integrations_cognition_init.go` | `//go:build !agent && !planner` | (cognition seeding) |

*Source: build-tag headers of `app/integrations_*.go`*

The base `Integration` struct (`integrations/integration.go`) supplies the shared lifecycle: a logger, a retrying HTTP client (`DoRequest` retries on 5xx/429 up to `maxRetries`), `Ready()` signalling for parallel startup, and a startup `Order()` of 160 (integrations start after automations at 150).

### 2.4 Channel-based dispatch and the "events inward, capabilities outward" contract

When the engine's bus is wired, capability calls are dispatched over the `IntegrationRequests` channel as `IntegrationDispatchRequest` protobufs; the dispatcher goroutine looks up the handler by FQN, runs it, and replies via the embedded `ReplyTo` channel. Integrations are pure protocol adapters: they **emit events inward** (when an external thing happens) and **expose capabilities outward**. Query orchestration, SI invocation, business logic, and mutations belong in the DSL, not in integration Go. *(Source: `integrations/CLAUDE.md`.)*

---

## 3. The full builtin catalog (engine + integration)

Every builtin in `dsl/common/builtins.memql` plus the namespaced builtin files. Engine-native executors have no `integration.` prefix.

### Engine-native introspection / validation builtins

| Builtin | Executor | Purpose |
|---|---|---|
| `concepts` | `concepts` | Metadata for all registered concepts (optional `pattern`). |
| `contentId` | `contentId` | Predict content-addressed id for a concept+payload without inserting. |
| `previewInsert` | `previewInsert` | Validate payload, predict id, check existence — no write. |
| `validate` | `validate` | Validate a payload against a concept's JSON schema. |
| `error` | `error` | Construct an error from a message string. |
| `functions` | `functions` | Minimal name+description list of all registered functions. |
| `help` | `help` | Full details for a function/tool by name. |
| `tools` | `tools` | MCP-compatible tool definitions (name, description, inputSchema). |
| `shapeTemplates` / `shapeHelp` | same | List / describe shape templates. |
| `serviceVersion` (alias `memqlVersion`) | `serviceVersion` | memQL service version. |
| `memqlDocs` | `memqlDocs` | Embedded MemQL documentation as queryable nodes. |

### Integration-backed builtins

| Builtin | Executor | Integration |
|---|---|---|
| `authResolveUser`, `authCheckPermission` | `integration.auth.*` | auth |
| `databaseHealthCheck`, `databaseStats` | `integration.database.*` | database |
| `filesExtractText` | `integration.files.extractText` | fileprocessor |
| `storageUpload` | `integration.storage.upload` | gcs |
| `sttTranscribe` | `integration.stt.transcribe` | stt |
| `openaiVoiceSynthesize` | `integration.openaiVoice.synthesize` | openai (TTS) |
| `similarTo` | `integration.similarity.similarTo` | similarity (pgvector) |
| `cognitionScore`, `cognitionTrackPresence` | `integration.cognition.*` | cognition |
| `recentChat` | `integration.chat.recentChat` | chat |
| `voicePickForGender`, `voiceResolve` | `integration.voice.*` | voice |
| `dateKeyInTimezone` | `integration.timeutil.dateKeyInTimezone` | timeutil |
| `ensureDailySpaceForUser`, `ensureDailySpaceForCaller`, `rolloverDailySpacesAllUsers` | `integration.dailyspace.*` | dailyspace |
| `avatarDirectStartSession`, `avatarDirectStopSession` | `integration.avatardirect.*` | avatardirect |
| `realtimeCreateClientSecret` | `integration.openairealtime.createClientSecret` | openairealtime |
| `routerListModels`, `routerListPolicies`, `routerSetApiKey` | `integration.router.*` | router |
| `agent`, `askSpecialist`, `requestUserFeedback`, `ensureAgentForGoal` | `integration.agents.*` | agents |
| `identityCreateDelegation`, `identityResolveDelegation`, `identityRevokeDelegation`, `identityValidateScope` | `integration.identity.*` | identity |
| `knowledgeIngest`, `seedStandardDomains`, `seedDomainContent`, `seedAllDomainContent`, `ensureKnowledgeBridge`, `knowledgeAugmentDomainAnalyze`, `knowledgeAugmentDomainGenerate`, `webSearch`, `fetchUrl`, `embedChunk`, `embedDomainItems` | `integration.knowledge.*` | knowledge |
| `trainAgent`, `trainAgentRetryStep` | `integration.training.*` | training |
| `workbenchDispatchHost`, `workbenchTeardownDirectory` | `integration.workbench.*` | workbench |
| `agentworkerDispatchHost`, `agentworkerDispatchComputer`, `agentworkerListWorkers`, `agentworkerStatus`, `agentworkerRequestScope` | `integration.agentworker.*` | agent/worker |

*Sources: `dsl/common/builtins.memql`, `dsl/cognition/builtins.memql`, `dsl/agents/builtins.memql`, `dsl/identity/builtins.memql`, `dsl/workbench/builtins.memql`, `dsl/worker/builtins.memql`*

`PreserveOrder` is set on `similarity.similarTo`'s ranked retrieval (retrieval used to live in the `knowledge` integration but moved to `similarity`): when true the dispatch path stamps monotonically decreasing `CreatedAt` timestamps so the handler's similarity-ranked order survives the default `CreatedAt DESC` sort (`component/memql/integration_provider.go`).

---

## 4. Voice (Deepgram STT/TTS, OpenAI, LiveKit)

The realtime voice + video channel is owned by a separate Python `voice-agent` process (LiveKit Agents 1.5); the Go integrations here serve the in-engine STT/TTS providers and the `/memql/audio` WebSocket path.

### 4.1 Speech-to-text (`stt/`)

`integration.stt.transcribe` is the batch capability; real-time streaming runs over `MemqlService.Stream` (`AiTranscribeStreamStart/Chunk/End` → `AiTranscribeStreamDelta/Complete`). Provider selection via `MEMQL_STT_PROVIDER`:

- **Deepgram Nova-3** — auto-selected default when `MEMQL_DEEPGRAM_API_KEY` is set. True streaming WebSocket via `/v1/listen`; sub-300 ms first interim partials.
- **OpenAI Realtime** — `openai-realtime`; streaming WebSocket in transcription-only mode.
- **OpenAI Whisper** — `openai-whisper`; batch only. Defaults to `whisper-1`, override via `MEMQL_WHISPER_MODEL`.

```go
Name:        "transcribe",
Description: "Transcribe audio data to text using the configured STT provider. Non-streaming batch transcription.",
```
*Source: `integrations/stt/capabilities.go`*

### 4.2 The Polyphon voice pipeline (`deepgram/`, `openai/`, `audio/`)

The Polyphon multi-agent pipeline uses pluggable ASR/TTS providers (`polyphon.ASRProvider` / `polyphon.TTSProvider`), selected by `POLYPHON_VOICE_PROVIDER`:

- **Deepgram** (default when key present): Nova-3 streaming ASR over WebSocket; Aura-2 TTS over REST. Defaults: `defaultASRModel = "nova-3"`, `defaultTTSModel = "aura-2-thalia-en"` (Aura-2 requires a per-voice model id; plain `aura-2` is not a valid model), `defaultLanguage = "en-US"`, `defaultBaseURL = "wss://api.deepgram.com"`. *(Source: `integrations/deepgram/deepgram.go`.)*
- **OpenAI**: Realtime-API transcription-only ASR; `/v1/audio/speech` TTS with PCM16 output. Defaults: ASR `gpt-4o-transcribe`, TTS `gpt-4o-mini-tts`, voice `alloy`. The `audio/` package handles 16 kHz ↔ 24 kHz PCM16 resampling between Polyphon and OpenAI. *(Source: `integrations/CLAUDE.md`.)*

### 4.3 The canonical voice catalog (`voice/`)

Every agent carries a provider-agnostic canonical voice name; the cognition handler resolves it to a provider-specific voice id at TTS time. Two builtins expose the catalog:

```go
func (i *Integration) IntegrationName() string { return "voice" }
// Capabilities: "pickForGender", "resolve"
```
*Source: `integrations/voice/capabilities.go`*

The catalog is gender-bucketed (`integrations/voice/voices.go`): female `alto`, `soprano`, `mezzo`, ...; male `tenor`, `baritone`, `bass`, .... The General Assistant is hardcoded to canonical `alto` (`GAVoiceCanonical = "alto"`). `voicePickForGender(gender, exclude)` biases away from voices already used by the owner's other agents; `voiceResolve(voiceId, provider)` maps canonical → provider voice id with a safe default fallback so the audio path never goes silent.

---

## 5. Avatars (Anam; Simli; LiveAvatar retired)

Avatar sessions are minted by the **avatar-vendor core** (`integrations/avatarvendor/`) — a CGO-free, build-tag-free pure-Go REST/dispatch layer shared by both the Python voice-agent (via voice-tagged LiveKit glue) and the direct/Guide avatar capability. The package "only resolves the vendor session that the avatar joins under" and never touches the media plane (`integrations/avatarvendor/avatarvendor.go`).

The **avatardirect** plug-in is the *sole* avatar session path now — the retired `liveavatar.com` integration (which owned its own LiveKit room and TTS) is gone (#294). The model is inverted: memQL mints the LiveKit room and the avatar **dials into** it to lip-sync audio memQL publishes.

```go
func (i *Integration) IntegrationName() string { return "avatardirect" }
// Name: "startSession"
//   "Start a direct/Guide avatar session for an anam-vendor agent: mint a LiveKit
//    room + browser join token, and bring Anam up (audio-driven) to dial in.
//    Returns { livekit_url, livekit_client_token, session_id, vendor, room_name }."
// Name: "stopSession"  (best-effort; always returns ok)
```
*Source: `integrations/avatardirect/avatardirect.go`*

Exposed to the DSL as `avatarDirectStartSession { agentId @required; spaceId }` and `avatarDirectStopSession`. For an anam-vendor agent, `startSession` mints a fresh LiveKit room + browser join token and brings Anam up; CoPresent connects with the returned creds and publishes assistant audio for lip-sync. Anam runs lip-sync on the published PCM via the `CUSTOMER_CLIENT_V1` llmId (its own LLM/TTS disabled). Simli is the second vendor (#293); the vendor enum is `anam` / `simli` in `avatarvendor.go`.

**Both vendors ride the same direct path.** The recent avatar work generalized `avatardirect` so that Anam *and* Simli are first-class on the audio-driven, memQL-mints-the-room model — there is no longer a vendor-special media path:

- **Operator-configurable `avatarModel`.** The model an agent's avatar runs is selectable per persona/agent rather than hardcoded. For Anam the configurable models are **`cara-3`** and **`cara-4`**; `avatarModel` is threaded from the persona/agent config through `startSession` to the vendor handshake, with a safe default when unset.
- **Two-phase Simli handshake.** Bringing a Simli avatar up is a two-step exchange (session request → session confirm/connect) before the avatar dials into the memQL-minted LiveKit room — distinct from Anam's single audio-driven bring-up, but surfaced behind the same `avatarDirectStartSession` contract.
- **Client-audio passthrough.** The avatar lip-syncs the audio memQL publishes (the assistant's spoken PCM) rather than generating its own — the vendor's LLM/TTS stays disabled and the audio plane is owned by memQL, so voice and avatar stay in lockstep.

---

## 6. Computer-use / Workers (`agent/worker`) and the Workbench (`workbench/`)

memQL has two distinct sandboxes an agent can act through: the **per-Plan workbench** (a contained on-disk workspace, the headless default) and **workers** (the user's *own* machine, opt-in and authorization-gated).

### 6.1 Workbench — the per-Plan headless sandbox

The `workbench` integration (`//go:build workbench`) dispatches a `workbenchHost.<action>` surface against a per-Plan workspace, lazily provisioned on first call:

```go
func (i *Integration) IntegrationName() string { return "workbench" }
// Name: "dispatchHost"     -- "...Lazily provisions the workspace on first call; subsequent calls in the same Plan see persisted files."
// Name: "teardownDirectory" -- idempotent on-disk teardown
```
*Source: `integrations/workbench/integration.go`*

Host actions are filesystem + shell + http_fetch, with hard caps and an exec allowlist: per-exec output 1 MiB, `fs_read` 1 MiB, `fs_write` 16 MiB, `http_fetch` response 5 MiB (`integrations/workbench/dispatch.go`). `exec` runs through a curated binary allowlist (`integrations/workbench/exec_allowlist.go`) — non-allowlisted binaries return `command_not_allowed`. DSL builtins `workbenchDispatchHost { action, args, planId, agentId, taskId }` and `workbenchTeardownDirectory { planId }` bridge the tool surface. This is bundled as the universal **`workbench-baseline`** foundational skill (`dsl/agents/skills/foundational.memql`), injected as a locked skill on every agent — "the blast radius is contained to the per-Plan workspace," so there is no authorization wall.

### 6.2 Workers — the user's own machine

The `agentworker` integration (agent node, `//go:build agent`) dispatches to a worker process the user runs on their own machine via the `WorkerService.Stream` gRPC service:

```go
func (i *Integration) IntegrationName() string { return "agentworker" }
// dispatchHost     -- workerHost.<action> to the caller's worker
// dispatchComputer -- workerComputer.<action> to the caller's GUI-capable worker
// listWorkers      -- workers connected for the caller
// status           -- connected / disconnected / unconfigured availability
// requestScope     -- create a scope-elevation Plan + canvas card BEFORE an out-of-scope call
```
*Source: `integrations/agent/worker/integration.go`*

The action vocabulary (from `dsl/worker/concepts.memql`, the `workerInvocation` telemetry concept):

- **`workerHost`**: `exec`, `fs_read`, `fs_write`, `fs_list`, `fs_stat`, `http_fetch`.
- **`workerComputer`**: `screenshot`, `cursor_position`, `mouse_move`, `mouse_click`, `mouse_drag`, `mouse_scroll`, `key_type`, `key_combo`, `display_info`, `window_list`, `window_focus`.

These map to DSL builtins `agentworkerDispatchHost` / `agentworkerDispatchComputer` (carrying `action`, `args`, `agentId`, `ownerUserId`, `planId`, `taskId`, `correlationId`), plus `agentworkerListWorkers`, `agentworkerStatus`, and `agentworkerRequestScope`.

The tool surface is the opt-in **`operator-computer-use`** foundational skill, which bundles `["workerHost", "workerComputer", "workerStatus", "requestComputerUseScope", "canvasPublish"]` (`dsl/agents/skills/foundational.memql`). It is gated at dispatch by `v1:agents:agentAuthorization.computerUseScope` plus a per-Plan kill switch; an out-of-scope call uses `requestScope` to create an `awaitingFeedback` Plan + canvas card asking the user to approve before attempting it. Every call writes a `v1:worker:invocation` telemetry row (default 90-day retention via `WORKER_INVOCATION_RETENTION_DAYS`), linked by `correlationId` to a `v1:identity:auditEvent` when policy-relevant.

---

## 7. Knowledge / RAG (`knowledge/`, `embedding/`, `similarity/`)

The knowledge surface is the largest single integration. It chunks, embeds, seeds, augments, and retrieves text for agent grounding (RAG).

### 7.1 Vector retrieval

- **`similarity`** exposes the first-class `similarTo` operator: embeds the query text, runs a generic pgvector cosine join over `node_vectors`, and returns top-K nodes of the target concept **in similarity order** (`PreserveOrder: true`).

  ```go
  Name:        "similarTo",
  Description: "Retrieve top-K nodes of the given concept ranked by cosine similarity to the supplied free-text query. Optionally scoped to a payload-domain list.",
  PreserveOrder: true,
  ```
  *Source: `integrations/similarity/capabilities.go`*

- **`embedding`** is the vendor-neutral text-embedding integration with three capabilities: `embed` (compute a vector), `findSimilar` (cosine search), `store` (persist a vector for a node). *(Source: `integrations/embedding/embedding.go`.)*

### 7.2 Ingestion, seeding, and augmentation (`knowledge`)

```go
func (i *Integration) IntegrationName() string { return "knowledge" }
```
*Source: `integrations/knowledge/capabilities.go`*

| Capability | What it does |
|---|---|
| `ingest` | Split a document into chunks, embed each, persist `v1:common:documentChunk` rows + vectors. Idempotent by `{domainId, sourceRef, seq, text}` hash. `source` is required and tags provenance class (`llmSeeded` / `augment` / `crossDomainBridge` / `appStructure` / `fileUpload`). |
| `seedStandardDomains` | Seed the shipped knowledge-domain catalog + CoPresent UI corpus on startup. Idempotent. |
| `seedDomainContent` | Generate ~30 retrievable chunks for one domain via the `seedDomainContent` prompt. Tier-A LLM-generates; Tier-B prepends a disclaimer; Tier-C fetches Wikipedia or writes a placeholder. Idempotent per `recipeVersion`. |
| `seedAllDomainContent` | Run `seedDomainContent` across every shipped domain. Optional `tierFilter` / `domainIdPrefix`. ~$300–500 for the full ~250-domain catalog at recipe v1. |
| `ensureKnowledgeBridge` | For an `(roleSlug, sortedDomainIds)` combo, ensure a cross-domain bridge corpus exists; hash-keyed so identical combos share chunks (paid once per unique combo). Returns the bridge id. |
| `augmentDomainAnalyze` | Preflight for the chat "Analyze for training" action: returns `{outcome ∈ addable/alreadyCovered/outOfScope, domainId, topic, reasoning, confidence}`. |
| `augmentDomainGenerate` | Generate ~10 topic-focused chunks, embed + write with `source='augment'` + provenance back-pointers, insert an audit Plan row. Synchronous (~30s). Returns `{planId, chunksAdded, domainId, domainName, topic}`. |
| `webSearch` | **STUB** — no web-search provider wired in-repo yet; returns empty + a note. Used by the Trainer Agent. |
| `fetchUrl` | Fetch + extract readable text from a URL (bounded `http.Client`). Returns `{url, status, contentType, text, truncated}`. |
| `embedChunk` | Embed one chunk so it becomes retrievable via `similarTo` (lazy embedding, #645). Idempotent. |
| `embedDomainItems` | Embed every unembedded validated chunk in a domain (optionally one Document), then recompute the Document's `embeddingStatus` (none → partial → complete). Idempotent. Driven by the planner's `embedDomainItems` dispatcher. |

### 7.3 Live Knowledge (`liveknowledge/`)

The `liveknowledge` plug-in exposes one capability, `query`, that dispatches a live query against a registered `v1:knowledge:liveSource`:

```go
Name: "query",
Description: "Dispatch a Live Knowledge query against a registered v1:knowledge:liveSource by name. Args carry the source's named-query inputs; result returns the connector's response (rows for memql/SQL kinds, body for rest/graphql).",
```
*Source: `integrations/liveknowledge/capabilities.go`*

The built-in connector kind is `memql`; the plug-in's design accommodates further kinds (`postgres` / `mysql` / `mssql` / `rest` / `graphql`) registered against the connector registry without modifying the plug-in (`integrations/liveknowledge/plugin.go`).

### 7.4 The "harness" recall/trace integrations

Two more retrieval-adjacent plug-ins ship in core: **`harnessRecall`** (`recall`) does top-k hybrid recency×relevance retrieval — pgvector cosine combined with exponential time-decay — in a single SQL statement against the MemoryNodes hypertable, owner-scoped with tunable `halfLife` + weights; **`harnessTrace`** (`trace`) reconstructs a harness plan's full execution timeline from the append-only graph event stream for the cockpit `harness trace` CLI. *(Source: `integrations/harnessrecall/`, `integrations/harnesstrace/`.)*

---

## 8. File processing & storage (`fileprocessor/`, `gcs/`)

- **`fileprocessor`** (integration name `files`): `extractText` extracts plain text from PDF, DOCX, images, and text files, using the `VisionSIProvider` for image descriptions. DSL builtin `filesExtractText { mimeType, data }`. *(Source: `integrations/fileprocessor/capabilities.go`.)*
- **`gcs`** (integration name `storage`): `upload` uploads file data to a cloud-storage bucket and returns the storage URL. DSL builtin `storageUpload { bucket, objectName @required, data @required, contentType }`. The plug-in returns `(nil, nil)` (opts out) when no bucket is configured. *(Source: `integrations/gcs/capabilities.go`, `integrations/gcs/plugin.go`.)*

---

## 9. Email (`email/`): Microsoft Graph / SMTP / Log

The `email` integration exposes one capability, `sendEmail`, with a transactional-email contract ("Caller supplies the rendered subject / text / html body"). It backs the guest-invite flow (`SendGuestInviteMsg`). *(Source: `integrations/email/capabilities.go`.)*

The sender is chosen at startup by `NewSenderFromEnv`, in priority order:

1. **Microsoft Graph (recommended)** — when `EMAIL_AZURE_TENANT_ID` + `EMAIL_AZURE_CLIENT_ID` + `EMAIL_AZURE_CLIENT_SECRET` + `EMAIL_SENDER` are all set (legacy `AZURE_*` / `MAIL_*` names still accepted per-field as fallback). OAuth client-credentials against the Graph `sendMail` API.
2. **SMTP (fallback)** — when `SMTP_HOST` + `SMTP_FROM_ADDR` are set; plain SMTP over STARTTLS.
3. **LogSender (dev)** — neither set; writes the message to the logger instead of sending.

```go
//  1. Microsoft Graph (recommended): EMAIL_AZURE_TENANT_ID + EMAIL_AZURE_CLIENT_ID +
//     EMAIL_AZURE_CLIENT_SECRET + EMAIL_SENDER all set → GraphSender.
//  2. SMTP (fallback): SMTP_HOST + SMTP_FROM_ADDR set → SMTPSender.
//  3. Neither set → LogSender (dev / no-delivery mode).
```
*Source: `integrations/email/email.go`*

---

## 10. App-native records: Calendar, Notes, To-dos

These are the user-facing record surfaces the assistant manages on the user's behalf. Each domain ships a `tools.memql` of narrowly-typed, owner-scoped tools whose `@handler` runs a named owned query or mutation. Because authz is per-row "owned," none of these tools expose an `ownerUserId` arg — ownership is server-stamped from the auth context.

### Calendar (`dsl/calendar/tools.memql`) — 5 tools

| Tool | Handler | Notes |
|---|---|---|
| `calendarList` | `queryUpcomingEvents({windowStart, windowEnd})` | events whose start is in `[windowStart, windowEnd]`. |
| `calendarFind` | `queryFindEvents({title})` | by exact title. |
| `calendarCreate` | `mutationCreateCalendarEvent(...)` | `title`, `startsAt`, `endsAt`, `allDay`, `location`, `notes`, `recurrence` (RFC-5545 RRULE). `source='native'`, ownership stamped server-side. |
| `calendarUpdate` | `mutationUpdateCalendarEvent({eventId, payload})` | partial update. |
| `calendarDelete` | `mutationDeleteCalendarEvent({eventId})` | soft-delete (recoverable). |

The five tools are bundled as the `calendar` skill so an agent carrying the skill gets the whole surface as a unit (one memQL tool binds to exactly one handler, hence five tools).

### Notes (`dsl/notes/tools.memql`) — 4 tools

`notesList` (`queryNotes`), `notesCreate` (`mutationCreateNote` — caller mints a fresh `noteId`, `body` required), `notesUpdate` (`mutationUpdateNote` with full merged payload), `notesSearch` (`queryNotesByTag`). memQL query filters are equality/membership only, so free-text body search is layered client-side over the owned set.

### To-dos (`dsl/todos/tools.memql`) — 4 tools

`todosList` (`queryTodos({done})`), `todosCreate` (`mutationCreateTodo` — `title`, optional `dueAt`/`priority`∈{low,medium,high}/`sourceResponsibilityId`), `todosComplete` (`mutationCompleteTodo` — full payload with `done` flipped), `todosUpdate` (`mutationUpdateTodo`).

---

## 11. The Library (`dsl/library/`): artifacts + faceted query

The Library is the provenance-aware home for everything the app creates or ingests. Its locked design (memql#693) is a single thin **index** concept, `v1:library:artifact`, that points at a backing source concept and carries only the spine the listing + facets need — content stays on the backing row.

```memql
concept artifact {
  ownerUserId      string  @required   // per-row authz key (stamped from actor.userId)
  lens             enum("artifact", "record")  @required        // Artifacts | Records toggle
  kind             enum("document","generated_output","note","todo","calendar_event","memory","live_source") @required
  source           enum("uploaded","workbench_generated","computer_use","agent_generated","derived","live") @required
  sourceConceptRef string  @required   // e.g. "v1:knowledge:document:<id>" — also the idempotency key
  title            string  @required
  summary          string
  format           enum("markdown","document","pdf","spreadsheet","image","text","conversation","other")
  mimeType         string
  live             bool    @default("false")
  spaceId          string  // per-space facet
  agentId          string  // per-agent facet
  producedByPlanId string
  validationStatus enum("none","unvalidated","validated","rejected","partiallyValidated","superseded") @default("none")
  updatedAt        datetime
}
```
*Source: `dsl/library/concepts.memql` (trimmed)*

Two sibling concepts give the Library a home for app-produced and assistant-remembered content: `v1:library:generatedOutput` (workbench / computer-use / agent deliverables — inline `body` or `attachmentId` ref) and `v1:library:memory` (durable assistant memories: `fact` / `preference` / `instruction` / `episodic`).

The Library grew several capabilities recently:

- **Three `generatedOutput` producers (#722).** Deliverables now flow into the Library from three distinct sources — the per-Plan **workbench**, **computer-use / worker** runs, and direct **agent** output — each writing a `generatedOutput` row that the per-kind index automation auto-promotes. The producers share one concept and one index path so the Library treats them uniformly regardless of where the bytes came from.
- **Workspace-scoped `liveSource` visibility via a non-owned tier (#723).** A `liveSource` (a connected, refreshable source backing the knowledge/skill layer) is no longer strictly owner-scoped: it can be made visible across a workspace through a **non-owned authz tier**, so collaborators in a workspace see the same live sources without each having to own them. This is the first Library surface to use a tier other than per-row "owned."
- **GCS attachment upload of `fs_write` bytes (#733).** When a workbench `fs_write` produces a file, its bytes can be uploaded to **Google Cloud Storage** as a Library attachment and referenced from the `generatedOutput` row via `attachmentId` — so large deliverables live in object storage rather than inline in the graph row.

**Auto-promotion.** Index rows are written by `node.created` automations that run a per-kind `logic` block — `logicIndexDocument`, `logicIndexGeneratedOutput`, `logicIndexNote`, `logicIndexTodo`, `logicIndexCalendarEvent`, `logicIndexMemory`, `logicIndexLiveSource` (`dsl/library/logic.memql`, wired in `dsl/library/automations.memql`):

```memql
@trigger(event="node.created", concept="v1:knowledge:document", partition="*")
// ... logic logicIndexDocument { event: event }
```

**Faceted query.** Because memQL query filters are equality/membership with no OR, the Library uses a small set of server-side-narrowed reads over the owner-scoped row set, with free-text search refined client-side on top (`dsl/library/queries.memql`):

| Query | Narrowing |
|---|---|
| `queryLibraryArtifacts` | all owned rows (default read). |
| `queryLibraryArtifactsByLens` | `payload.lens==args.lens` (Artifacts/Records). |
| `queryLibraryArtifactsByKind` | `payload.kind==args.kind`. |
| `queryLibraryArtifactsBySpace` | `payload.spaceId==args.spaceId`. |
| `queryLibraryArtifactById` | by id, gated to owner. |
| `queryGeneratedOutputById`, `queryMemoryById` | drill-in content reads. |
| `queryLatestLiveSnapshotForSource` | live-data freshness (LIVE badge + "fetched X ago"). |

Every read filters `payload.ownerUserId==actor.userId` server-side; the lens/kind/space facets are the high-cardinality narrowing, search is the cheap client-side refinement.

---

## 12. Training (`training/`) and the Trainer Agent

The `training` integration runs the per-agent training pipeline behind the CoPresent Training panel's "Train" button. The `trainAgent` builtin is Plan-bracketed for visibility — it creates a `plan.created` canvas card with a heuristic time estimate, three Task rows (one per step), and a `training.completed` card on success:

```memql
@executor("integration.training.trainAgent")
builtin trainAgent {
  agentId  string @required
  domains  array
  tools    array
  provider string
  spaceId  string
  requestedBy string
}
```
*Source: `dsl/common/builtins.memql`*

Pipeline steps (from the builtin's doc comment):
- **A.** Update `agent.capabilities.domains` + `.tools` to match the staged sets; for every NEW domain, eagerly embed its attached chunks into `node_vectors` so the agent's first chat is fast and accurate.
- **B.** Compute + persist a per-agent identity embedding (name + role + personality + capability labels) for millisecond similarity-based agent selection.
- **C.** One LLM call distills the profile into a tuned system prompt cached on `agent.systemPrompt`.

B and C are best-effort; if either fails, A's writes are durable, that Task transitions to `failed`, and the Plan still completes `succeeded`. `trainAgentRetryStep` re-runs a single failed step (B or C), driven either by the training integration's background retry poll loop or the frontend "Retry now" button.

**The Trainer Agent** (a specialist invoked by the planner for `kind='trainSpecialist'` Plans) drives a bounded tool loop over five tools (`dsl/agents/tools/trainerTools.memql`, `@allowedRoles("specialist")`):

| Tool | Handler | Notes |
|---|---|---|
| `webSearch` | builtin `webSearch` | STUB (no provider wired). |
| `fetchUrl` | builtin `fetchUrl` | real bounded `http.Client`. |
| `writeKnowledgeChunk` | `mutationWriteKnowledgeChunk` | `source='trainerAgent'`, lands validated; `sourceRef` REQUIRED — no fabricated citations. |
| `markChunkSuperseded` | `mutationMarkChunkSuperseded` | refresh-mode deprecation (`superseded=true`, row preserved for audit). |
| `embedChunk` | builtin `embedChunk` | embed-and-store so the chunk is immediately retrievable. |

The dispatcher passing these tool names explicitly to the filtered tool loop lives in `integrations/planner/train_specialist_dispatch.go`; the Go handlers in `integrations/knowledge/trainer_tools.go`.

---

## 13. Agents-as-capabilities (`agents/`)

The `agents` integration turns agents themselves into a callable surface — the spine of multi-agent orchestration:

| Capability / builtin | Tool | Behaviour |
|---|---|---|
| `invoke` / `agent(name, prompt, spaceId)` | — | **Always async**: mints a `v1:planner:plan` (`kind=agentInvocation`, status `queued`) and returns the planId immediately; the planner's agent loop drives the agent's tool loop. Use `si("prompt", args)` for blocking one-shot LLM calls instead. |
| `askSpecialist` | `askSpecialist` (`@allowedRoles("assistant")`) | **Synchronous** specialist query by `roleSlug`; returns one JSON `{response, rationale?, confidence, needsMore?}`. Specialists never speak to humans — the assistant paraphrases the result. The ONLY channel between assistant and specialists. |
| `ensureForGoal` | `ensureAgent` (`@allowedRoles("assistant")`) | Match / extend / create an agent for a free-form goal via the `agentFactoryAnalyze` structured-output prompt; returns `{agentId, action, reasoning}`. The factory only ever creates specialists. |
| `requestUserFeedback` | `requestUserFeedback` (`@allowedRoles("assistant")`) | Pause the active Plan → `awaitingFeedback` (`feedback_required`), render a feedback card (`kind ∈ choice/text/multi`); the user's answer resumes the Plan. `planId`/`agentId`/`ownerUserId`/`spaceId` are `@autoInjected`. |

*Source: `dsl/agents/builtins.memql`, `dsl/agents/tools/*.memql`, `integrations/agents/`*

---

## 14. Cognition, identity, auth, database, router, time/daily-space

A grab-bag of the remaining core capability integrations:

- **`cognition`** (cognition node): `scoreUtterance` (Polyphon 5-factor turn-taking score), `trackPresence` (thread-safe participant presence state). Also owns the routing+conductor pipeline and the cross-node client-tool relay (Go-only, not DSL builtins).
- **`chat`**: `recentChat` — the assistant's read-only window into a space's single utterance stream + space context, with five operations (`readRecent` / `readByKeyword` / `readByTime` / `getSpaceContext` / `listParticipants`). Surfaced as the `recentChat` tool (`@autoInjected` `spaceId`/`agentId`).
- **`identity`**: `createDelegation` / `revokeDelegation` / `resolveDelegation` / `validateScope` — the agent-acting-as-user delegation model (role ceiling, scope list, expiry).
- **`auth`**: `resolveUser` (current authenticated user from context) and `checkPermission` (role check).
- **`database`**: `healthCheck` (connectivity + response time) and `stats` (connection-pool counters).
- **`router`**: `listModels` (full live model catalog — vendor / model id / pricing / availability, feeds `/router/catalog`), `listPolicies` (routing policies from `policies/v1/*.memql`, feeds `/router/policies`), `setApiKey` (encrypt + persist a vendor key as a `v1:router:apikey` row).
- **`timeutil`**: `dateKeyInTimezone` — IANA-timezone `YYYY-MM-DD` key, UTC fallback on bad tz; backs the daily-space id math.
- **`dailyspace`**: `ensureForUser` / `ensureForCaller` / `rolloverAllUsers` — idempotent per-user daily-space provisioning keyed on `(userShortId, dateKey)`, with an hourly cron rollover honoring each user's `dailySpaceRolloverAction`.
- **`openairealtime`**: `createClientSecret` — mints a short-lived OpenAI Realtime ephemeral `client_secret` so the browser can open a direct WebRTC session without ever seeing the standing key.

---

## 15. Adding a new capability — the recommended path

1. `mkdir integrations/<name>/`.
2. Implement `IntegrationProvider` (`IntegrationName()` + `Capabilities()`), each capability a `{Name, Description, Handler}`.
3. Self-register in `init()`: `memql.RegisterPlugin("<name>", func(pctx) {...})`. Return `(nil, nil)` to opt out when deps are missing.
4. Anchor the package with a blank import in `app/plugins_core.go` (build-tag-gate the anchor for node-scoped plug-ins).
5. Expose it from the DSL with a `builtin` carrying `@executor("integration.<name>.<cap>")` and, if agent-callable, a `tool` whose `@handler` points at it.

Use the explicit `app/integrations_*.go` path only for first-party integrations whose dependencies don't fit `PluginContext` (cognition, agent, stt). *(Source: `integrations/CLAUDE.md`, "START Adding New Integrations".)*

---

### Notes on a few conventions seen in the source

- `@sdk` appears on several builtins (e.g. `trainAgent`, `avatarDirectStartSession`, `knowledgeAugmentDomainGenerate`). It marks builtins intended for the client SDK / `executeQueryAsync` surface. [VERIFY: the exact semantics of `@sdk` are not documented in the files read; treat it as "client-callable" pending the annotation reference.]
- `@executionTime("fast"|"medium")` on tools is an advisory latency hint the agent/cognition layers use for scheduling.
- The `webSearch` capability is explicitly a **stub** in-repo — it returns an empty result set; agents fall back to `fetchUrl` on known URLs.
