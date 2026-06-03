# memQL — Overview & Architecture

memQL is an AI-native, distributed time-series memory graph with its own declarative DSL. A single language declares **concepts** (schemas), **queries**, **mutations**, **specs** (predicates), **shapes** (projections), **tools** (LLM-callable surfaces), **prompts**, **providers**, **policies**, and event-driven **automations** side-by-side, then executes them across specialized nodes backed by PostgreSQL + TimescaleDB. The goal is to collapse the integration glue that AI teams normally hand-write — a vector store, a workflow engine, an AI gateway, and a voice stack — into one deployable primitive. This document is the front door: what memQL is, the layered architecture, how the pieces fit, and where things live in the tree. It describes the current `main` branch and is a snapshot of a pre-1.0, actively-evolving system.

> **Status:** Alpha / pre-1.0. Per the README, "the DSL, engine API, and wire surface are still evolving; expect breaking changes between commits." (`README.md`, line 22)

---

## 1. What memQL is (and what it replaces)

The README states the thesis directly:

> "memQL is a distributed time-series memory graph with its own DSL — a single language for declaring concepts (schemas), queries, mutations, tools, and event-driven automations side-by-side, then executing them across specialized nodes. It replaces the integration glue AI-native teams typically hand-write — vector store + workflow engine + AI gateway + voice stack — with one deployable primitive."
>
> — `README.md`, lines 28–30

A useful mental model:

- **Time-series graph store.** Every record ("node") is an immutable, append-only row in a TimescaleDB hypertable keyed by `(partition, id, createdAt)`. History is intrinsic — you don't update rows in place, you append new versions.
- **A schema + behavior language.** A `.memql` file can hold a concept schema *and* the query, mutation, tool, and automation that operate on it, in the same place and the same language.
- **An AI runtime.** SI ("Synthetic Intelligence" — memQL's term for LLM/model operations) is a first-class layer: providers, prompts, tool loops, routing, and a voice pipeline are built in, not bolted on.

The canonical README example shows a concept and an LLM-callable tool in one file:

```
@version("1.0.0")
@namespace("acme")
concept ticket {
  id          string   @required
  subject     string   @required
  priority    string
  createdAt   datetime @required
}

@enabled
@handler(type="query", query="concept==v1:acme:ticket && ticket.priority==args.priority")
@executionTime("fast")
@description("List tickets by priority")
tool listByPriority {
  priority string @required
}
```
*Source: `README.md`, lines 38–55*

---

## 2. The layered architecture

memQL is best understood as a stack: declarative `.memql` source at the top, a Go engine in the middle that parses/compiles/executes it, and PostgreSQL + TimescaleDB at the bottom. SI operations and the event bus hang off the engine as cross-cutting services.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │  AUTHORING LAYER  —  .memql DSL source (dsl/, embedded or on disk)      │
 │                                                                        │
 │   concepts · shapes · specs · queries · mutations · builtins           │
 │   providers · prompts · tools · automations · policies                 │
 │                                                                        │
 │   (one declarative language; constructs depend only "downward")        │
 └───────────────────────────────┬────────────────────────────────────────┘
                                  │  loaded at startup
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  ENGINE LAYER  (Go — component/memql/, component/language/parser+compiler)│
 │                                                                        │
 │   Source ──▶ Lexer/Parser ──▶ AST ──▶ Compiler ──▶ Executor ──▶ SQL     │
 │                                                                        │
 │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
 │   │  SI Router   │  │  Event Bus   │  │ Provider     │                 │
 │   │ (every SI    │  │ (graph.*     │  │ Registry     │  ◀── prompts/    │
 │   │  call flows  │  │  events →    │  │ (OpenAI,     │      providers   │
 │   │  through it) │  │  automations)│  │  Anthropic…) │                 │
 │   └──────────────┘  └──────────────┘  └──────────────┘                 │
 │                                                                        │
 │   Component Bus: typed Go channels (component/bus/bus.proto) wire the   │
 │   engine to integrations, the event bus, telemetry, and config.        │
 └───────────────────────────────┬────────────────────────────────────────┘
                                  │  bun ORM / SQL
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  DATA LAYER  —  PostgreSQL 16 + TimescaleDB                             │
 │                                                                        │
 │   MemoryNodes (hypertable)        node_vectors (embeddings)            │
 │   PK: (partition, id, createdAt)  partition-isolated, append-only      │
 └──────────────────────────────────────────────────────────────────────┘
```

The columns of the `MemoryNodes` table are verifiable in the export tooling:

> `COPY "MemoryNodes" (partition, id, "createdAt", "createdBy", schema, payload, metadata, type, concept) FROM STDIN;`
>
> — `scripts/dev/knowledge-export.sh`, line 123

and the primary key is documented as `(partition, id, createdAt)` (`docs/core/memql-authoring-rules.md`, line 458). Embeddings live in a parallel `node_vectors` table keyed the same way (`scripts/dev/knowledge-export.sh`, line 133).

### 2.1 Why a time-series graph

Because the primary key includes `createdAt`, a "row" is really an ordered series of versions. A concept instance's current state is the latest row for its `(partition, id)`; its history is the rest. This makes memQL append-only by construction — `docs/core/memql.md` describes it as "a deterministic, append-only interface for reading and writing concept-backed data stored in TimescaleDB." New records are written via `insert()` mutations; there is no destructive in-place update at the storage layer.

---

## 3. The engine pipeline (how a request becomes a result)

The engine follows a classic compiler shape — lex, parse, compile, execute — documented in `docs/core/arch.md`. The phases:

| Phase | Package | Input → Output | Responsibility |
|-------|---------|----------------|----------------|
| **Lexer** | `component/language/parser` | source string → token stream | Tokenization, keyword/operator/literal scanning |
| **Parser** | `component/language/parser` | tokens → AST | Recursive-descent syntax analysis |
| **Compiler** | `component/language/compiler` | AST → JSON / function defs | Code generation (notably AST → JSON automations) |
| **Executor** | `component/memql` | query plan → results | Spec resolution, SQL build, relationship traversal, shaping |

*Source: responsibility matrix in `docs/core/arch.md`, lines 112–119; package locations confirmed against `component/memql/*.go` (engine.go, executor.go, etc.).*

The query-execution flow (from `docs/core/arch.md`) resolves any referenced **specs** and **functions**, checks a result cache, builds and runs SQL against TimescaleDB, traverses relationship edges, applies sort/pagination, and finally applies an optional **shape** template to transform the output structure. When a query's shape calls `si(...)`, the SI runtime is invoked during post-processing.

A MemQL filter expression is terse. From the lexer example in `docs/core/arch.md`:

```
concept==v1:crm:lead;payload.active==true
```

Here `;` is the AND operator and `,` is OR (`docs/core/arch.md`, lines 174–175). The basic query form from the language reference:

```
concept==v1:examples:world;payload.status=="active"
```
*Source: `docs/core/memql.md`. Responses use omission semantics — fields are present only when they contain data.*

---

## 4. The DSL construct layers

The DSL is not a flat bag of file types; the constructs form a dependency hierarchy where each layer may depend only *downward*, and cycles are rejected at load time. Per the top-level `CLAUDE.md` dependency tree:

- **Concepts** — pure schemas (the base of everything). Every other construct references one or more concept ids.
- **Shapes** — reusable field-projection templates, declared as `@row` (concept payload + row intrinsics), `@caller` (the auth/engine envelope), or mixed. Shapes can `include` other shapes.
- **Specs** — atomic boolean predicates, each bound to a shape via `@shape("name")`. Row-specs compile to SQL `WHERE` fragments and push down to the database; context-specs (caller-only) evaluate in-process.
- **Mutations** — write to concepts via a single `insert { ... }` or `update { ... }` block per body.
- **Builtins** — declarative wrappers over Go integrations (`@executor("integration.X.Y")`), callable like ordinary DSL functions.
- **Providers** — SI vendor + model + auth records. **Prompts** pin a default provider and render templates over it.
- **Queries** — stitch a concept + filter (specs) + projection (shape) + args into a typed read.
- **Automations** — event-triggered side-effects; they consume the layers above and never the reverse.
- **Tools** — the SI-facing surface of queries/mutations/builtins; the tool loop binds tool-call args to handler args.
- **Policies** — top of stack: cross-cutting caller-based decisions (authorization, vendor selection, feature flagging, UI gating).

All constructs share one argument model: caller args are declared in an `args { ... }` block and read as `args.X`; the resolved auth context is `actor.X`; engine values are bare names (`now`, `partition`, `config.X`). Row fields (`payload.X`, `id`, `concept`, `createdAt`, etc.) are available only in a query's `filter`/`shape` (SQL pushdown). *Source: "Argument resolution" section of `CLAUDE.md`.*

A representative struct-form query and mutation (from `CLAUDE.md`):

```memql
use cognition.participant

@description("Get space participants")
query querySpaceParticipants {
  args {
    spaceId  string  @required
  }
  filter  payload.spaceId==args.spaceId; specIsActiveRecord
  shape   participantFull
}
```

```memql
use cognition.space

@description("Create a cognition space")
mutation mutationCreateSpace {
  args {
    spaceId  string  @required
    name     string  @required
  }
  insert {
    id:        args.spaceId
    name:      args.name
    status:    "active"
    createdAt: now
    createdBy: actor.userId
  }
}
```

> **[VERIFY: DSL tree layout]** The top-level `CLAUDE.md` documents a `dsl/v1/<type>/v1/<namespace>/...` layout. The actual public repo organizes `.memql` files **domain-first**: `dsl/<domain>/<type>.memql` — e.g. `dsl/cognition/concepts.memql`, `dsl/cognition/queries.memql`, `dsl/cognition/mutations.memql`, plus `prompts/` and `tools/` subdirectories per domain (verified by `ls dsl/cognition/` and `find dsl -name "*.memql"`, 154 files across domains such as `common`, `cognition`, `cluster`, `identity`, `knowledge`, `planner`, `router`, `guide`, `calendar`). The `CLAUDE.md` per-type-tree description is stale relative to this mirror; the *dependency hierarchy* it describes still holds, only the on-disk grouping differs.

The DSL tree is embedded into the binary by default (`dsl/embed.go`), and can be overridden on disk via `MEMQL_DSL_PATH` — useful for dev hot-reload, per-deploy patches, or test fixtures (`CLAUDE.md`, "MEMQL_DSL_PATH override").

---

## 5. SI: the model layer

SI operations are centralized behind a pluggable **provider registry** (`component/memql/si_providers.go`). The registry exposes typed interfaces — `SIProvider`, `StreamingSIProvider`, `RealtimeSIProvider`, `TTSSIProvider`, and the shared `common.ChatSIProvider` / `common.ToolCallingChatSIProvider` (verified at `component/memql/si_providers.go`, lines 197–235 and the `var _ common.ChatSIProvider = (*openSIProvider)(nil)` / `(*anthropicProvider)(nil)` assertions). Concrete backends today are OpenAI and Anthropic. Providers are declared in `.memql` provider files; prompts pin a default provider via `@defaultProvider(...)`.

Two distinct things are called "router" in the codebase — keep them separate:

1. **The SI Router (engine layer).** The app bootstrap wires an "SI Router" as a bootstrap phase, described in code as "the single point every SI call flows through" (`app/app.go`, lines 76–77, "Phase 3c: SI Router"). This is the central chokepoint for model invocations.
2. **The `router` integration (`integrations/router/`).** A BYOK (bring-your-own-key) credential + budget admin surface exposed to the DSL so a settings page can add/rotate/delete API keys without plaintext ever being persisted — keys "leave encrypted via `component/secret.Encrypt` and are inserted into `v1:router:apikey`" (`integrations/router/integration.go`, package doc).

Separately, **cognition** does *conversational* routing — deciding which agent should respond to an utterance — via an LLM "conductor" on the text path and a standalone router LLM call on the latency-sensitive voice path (`CLAUDE.md`, "Cognition (Routing + Conductor)"). Don't conflate it with the SI Router chokepoint.

Two further AI-facing subsystems hang off this layer and are worth flagging here so the overview doesn't silently omit them:

- **Knowledge / embeddings / vector search.** User files are analyzed into knowledge domains and chunked, embedded, and stored in the parallel `node_vectors` table for semantic retrieval. The DSL surface lives under `dsl/knowledge/` (concepts, queries, mutations, prompts), backed by the `embedding`, `similarity`, and `knowledge` Go integrations (`integrations/embedding/`, `integrations/similarity/`, `integrations/knowledge/`).
- **Agent execution surfaces — workers (computer-use) and claw (coding agent).** Capability-flagged agents can drive the user's own machine (shell, filesystem, mouse/keyboard/screenshot) through the worker/computer-use surface (`dsl/worker/`) and run coding/automation tasks through the claw coding-agent tools. Both are gated by per-agent capability flags (`computer_use`, `claw`) and standing authorization. *Source: `CLAUDE.md`, "Workers (computer_use)" and "Coding Agent".*

---

## 6. Events and automations

The engine publishes graph events as records are written. Event topics follow `graph.node.created.<partition>.<concept>` (global-scoped concepts fire under the reserved `_system` partition). Automations subscribe to these patterns and run side-effects:

```memql
@trigger(event="graph.node.created.*.v1:cognition:participant")
func (Automation) autoJoinSI() { ... }
```
*Source: `CLAUDE.md`, "Automations". The `*` wildcard matches any partition.*

Events flow over the **component bus** — typed Go channels carrying protobuf messages defined in `component/bus/bus.proto`. Per `docs/core/arch.md` (lines 70–81), the bus provides typed channels (`EngineRequests`, `IntegrationRequests`, `EventPublishCh`, `ConfigCh`, `TelemetryCh`, `ReadyCh`, `ShutdownCh`), a request/response `ReplyTo` pattern, buffered backpressure (default 64), per-message `correlation_id` for tracing, and a `Ready() <-chan struct{}` signal on every component for parallel startup.

---

## 7. Partitions: the isolation boundary

Partitions are memQL's multi-tenancy primitive. Concepts are partition-scoped by default — every row stamps the request envelope's partition into its PK, and reads auto-filter on it; there are no cross-partition reads of user data. Infrastructure metadata that every tenant must see identically (cluster topology `v1:cluster:*`, identity `v1:identity:*`, the partition registry `v1:platform:partition`) is marked `@scope("global")` and lives in the reserved `_system` partition regardless of envelope.

Isolation is enforced at the gRPC boundary: "Every gRPC envelope is checked against the caller's `PartitionACL` by the auth-access middleware; mismatched partitions are rejected." Subscription patterns are rewritten server-side so a `*` wildcard subscriber cannot observe other tenants' events. Partition names are DNS-label-shaped (lowercase alphanumeric + inner dashes, 1–50 chars, no leading underscore). *Source: `CLAUDE.md`, "Partitions".*

Node IDs carry the partition prefix, e.g. `acme:v1:common:agent:a9f3b7c2...`; global concepts use `_system:v1:cluster:node:bff-local`.

---

## 8. Distributed nodes (cluster mode)

memQL compiles to separate binaries per **node type** via Go build tags. The BFF binary is the default (no tag). Verified node-type constants in `component/node/identity.go`:

| Node type | Constant | Role |
|-----------|----------|------|
| **bff** (default) | `NodeTypeBFF` | Backend-for-frontend, domain-specific API surface |
| **voice** | `NodeTypeVoice` | Voice transport (audio WS, LiveKit) |
| **cognition** | `NodeTypeCognition` | Cognition/routing pipeline, Polyphon |
| **agent** | `NodeTypeAgent` | Task execution, SI work, tool calling |
| **planner** | `NodeTypePlanner` | Task planning / orchestration |
| **workbench** | `NodeTypeWorkbench` | (present in the node identity table) |
| **identity** | `NodeTypeIdentity` | Auth / identity service |

*Source: `component/node/identity.go`, lines 19–45.* The `CLAUDE.md` distributed-architecture section documents bff/voice/cognition/agent/planner as the primary five and cites binary-size reductions of up to 53% from tag-gating; `workbench` and `identity` also exist as node types.

```bash
go build .                 # bff (default)
go build -tags voice .     # voice
go build -tags cognition . # cognition
go build -tags agent .     # agent
go build -tags planner .   # planner
```

All nodes share one PostgreSQL + TimescaleDB database. Inter-node communication rides a `NodeService` gRPC bidirectional stream; a `PeerManager` handles mesh discovery, an `EventBridge` propagates events across nodes with dedup + TTL, and a `CapabilityRouter` routes function calls to the node type that owns a given concept prefix (`docs/core/arch.md`, "Distributed Node Architecture", lines 809–828).

---

## 9. The wire surface (gRPC-first)

memQL is **gRPC-first by hard policy**. The primary surface is the single bidirectional stream `MemqlService.Stream` (multiplexed via a `oneof` payload). Browsers reach it through a WebSocket bridge at `/memql/ws` that tunnels to the same gRPC stream. HTTP is allowed only as documented exceptions:

| Category | Endpoints | Reason |
|----------|-----------|--------|
| Auth (identity) | `/auth/*`, `/oauth/token`, `/.well-known/jwks.json` | OAuth/magic-link needs HTTP redirects + JWKS publishing |
| Health | `/healthz` | Docker / Cloud Run probes expect HTTP GET |
| WebSocket upgrades | `/memql/ws`, `/memql/audio` | Browser upgrade handshake |
| File uploads | `/spaces/{id}/attachments` | Multipart form-data |

*Source: `CLAUDE.md`, "Endpoint Protocol Policy". The legacy SI and Polyphon HTTP paths have been retired; all SI ops (`AiChatMsg`, `AiSpeechMsg`, `AiTranscribeMsg`, `AiSuggestMsg`) ride the gRPC stream, with cross-node proxying over `NodeService.Stream`.*

Authentication is the in-house **identity service** (`component/identity`): magic-link login, OAuth-style token exchange, JWKS-published EdDSA signing keys, and PATs for CLI clients. Other node binaries verify identity-issued JWTs locally via a per-node verifier that refreshes the JWKS document on a background timer (`README.md` "Authentication"; `CLAUDE.md` "Authentication").

---

## 10. Service bootstrap and project layout

The entry point (`main.go`) is a thin orchestrator: it dispatches CLI subcommands, decrypts a "genesis" secrets envelope in-process when `MEMQL_GENESIS_AUTOLOAD=true` (set-if-absent so env overrides win), layers a local `.env`, then calls `app.Run(...)` with graceful-shutdown wiring (`main.go`, lines 27–91).

`app.Build()` runs phased bootstrap (`app/app.go`, package doc + phase comments):

| Phase | File | What it does |
|-------|------|--------------|
| 1. config | `app/config.go` | Config load + auth middleware |
| 2. database | `app/database.go` | Database + concept loading |
| 3. engine | `app/engine.go` | Engine + component bus + event bus + automation scheduler |
| 3b. polyphon | (cognition/standalone) | Polyphon score engine |
| 3c. SI Router | — | The single point every SI call flows through |
| 4. integrations | `app/integrations.go` | Integration provider registration |
| 5. transport | `app/transport.go` | gRPC + HTTP + WebSocket endpoints |
| 6. cluster | `app/cluster.go` | Distributed node bootstrap |

*Source: `app/app.go` phase comments (lines 1–94) and `app/engine.go`. Build tags control which phases compile into each node-type binary.*

The repository top-level layout (verified by `ls`):

```
memql/
├── main.go              Entry point (subcommand dispatch + app.Run)
├── app/                 Phased service bootstrap (config → cluster)
├── component/           Core Go components
│   ├── memql/           Query engine, executor, SI providers, sense
│   ├── language/        parser + compiler (lexer, AST, codegen)
│   ├── node/            Distributed node system (identity, peers, mesh)
│   ├── bus/             Channel-based inter-component bus (bus.proto)
│   ├── grpc/            gRPC service + handlers (memql.proto)
│   ├── identity/        In-house auth service
│   ├── database/        DB providers + memory-nodes table
│   ├── server/          HTTP/WS servers, health, attachment upload
│   └── ...              auth, config, events, secret, observe, metadata
├── dsl/                 All .memql source (domain-first: dsl/<domain>/<type>.memql)
├── integrations/        Go integrations + DSL-callable capabilities
│   └── router/ cognition/ agent/ ...
├── core/                Shared utilities (logger, env, id)
├── cmd/                 CLI tools (memql-cockpit, healthcheck, ...)
├── sdk/                 Client SDK code
├── voice-agent/ (in private tree) Python LiveKit voice agent
├── scripts/             Dev / migration / deploy shell scripts
├── deploy/, infra/      Kubernetes manifests + infra config
├── docker/              Docker Compose stacks (full, cluster, overlays)
└── docs/                Documentation (core/, api/, guides/, auth/, ...)
```

> **[VERIFY: README project-structure block]** The `README.md` "Project Structure" section (lines 184–216) lists top-level `automations/`, `queries/`, `mutations/`, `specs/`, `tools/` directories. These do **not** exist at the repo root in this mirror — all `.memql` source lives under `dsl/`. The README block and the `engine/parser` path references in `docs/core/arch.md` (which says `engine/parser/`) describe an older layout; the actual parser/compiler live under `component/language/` (`component/language/parser`, `component/language/compiler`).

---

## 11. Tech stack at a glance

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Go 1.26.4+ | Toolchain pinned (govulncheck fix); `README.md`, `TECH_STACK_AND_PRACTICES.md` |
| Database | PostgreSQL 16 + TimescaleDB | Hypertable `MemoryNodes`, PK `(partition, id, createdAt)` |
| ORM | uptrace/bun | `docs/core/arch.md` dependency graph |
| API | gRPC (`MemqlService.Stream`) + WebSocket bridge + minimal HTTP | gRPC-first policy |
| SI | OpenAI + Anthropic via central provider registry | `component/memql/si_providers.go` |
| Auth | In-house identity service (magic-link + JWT, JWKS) | `component/identity` |
| Query language | MemQL DSL | `.memql` files under `dsl/` |
| Containers | Docker / Docker Compose | `docker/docker-compose.full.yml` |
| Deploy | Azure Kubernetes Service (AKS) + Tiger Cloud DB | `README.md`, `DEPLOYMENT_STRATEGY.md` |

> **[VERIFY: deployment target]** `README.md` and `TECH_STACK_AND_PRACTICES.md` in this mirror describe deployment on **Azure AKS** (cluster `aks-memql-staging`, ACR `acrmemql.azurecr.io`) with Tiger Cloud (Timescale Cloud) databases. The top-level `CLAUDE.md` instead describes **Google Cloud Run** (us-central1) for staging/production. The two docs disagree; the README/TECH_STACK pair is the more recently dated and matches the `deploy/` + `scripts/deploy/aks-deploy.sh` tooling, so AKS is the likely current target.

---

## 12. Getting running (5-minute path)

```bash
# Full stack: Postgres + TimescaleDB + a near-complete cluster
# (bff, cognition, planner, voice, agent, identity all start by default)
docker compose -f docker/docker-compose.full.yml up --build

# Same topology, with iterative dev convenience wrappers
make dev-cluster-restart

# Tests
go test ./...

# Build the default (BFF) binary
go build -o bin/memql .
```

The full stack brings up Postgres + TimescaleDB plus a near-complete cluster: the `bff`, `cognition`, `planner`, `voice`, `agent`, and `identity` nodes all start as default services (only `app` and `pgadmin` are profile-gated). *Source: `docker/docker-compose.full.yml`.* First-run setup claims the single cluster-owner identity either interactively at `/setup` or unattended via `IDENTITY_BOOTSTRAP_*` env vars. *Source: `QUICKSTART.md`.*

Next stops in the docs: the MemQL language reference (`docs/core/memql.md`), the engine architecture deep-dive (`docs/core/arch.md`), authoring rules and gotchas (`docs/core/memql-authoring-rules.md`), the event system (`docs/core/events.md`), and the distributed node system (`component/node/CLAUDE.md`).
