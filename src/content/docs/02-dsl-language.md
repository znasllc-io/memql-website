# memQL — The MemQL DSL Language

MemQL is the declarative language that defines everything memQL stores, reads, writes, decides, and exposes to language models. A running memQL cluster is, in large part, a tree of `.memql` files loaded at startup: concepts define the schema for memory-graph rows, queries and mutations read and write them, specs and traits express reusable predicates, shapes project fields, automations react to events, prompts and providers wrap the SI layer, tools expose a model-callable surface, and policies make cross-cutting decisions. This document is the complete language reference: every construct kind, its syntax, its annotations, and a real example copied from the source tree, plus the two cross-cutting models you must understand to author anything — argument resolution and the dependency tree.

> This describes memQL as of the current `main` branch and is a snapshot. The canonical, engine-verified syntax templates live under `dsl/_reference/` (`_concept.memql`, `_shape.memql`, `_spec.memql`, `_trait.memql`). Those files are skipped by the loader (the leading underscore) and exist precisely to be the source of truth for syntax. Where this doc and the older `docs/core/memql-functions.md` disagree, the `_reference/` files and `docs/core/memql-reserved.md` win — several legacy forms documented there (`func (Shape)`, `@input`, `@template`, `@useConcept`, `caller.X`) have been retired.

---

## 1. The mental model

### 1.1 Concepts are the only thing that introduces data

Every `.memql` construct either reads rows, writes rows, projects rows, predicates over rows, decides based on rows + caller context, or exposes a surface that does one of those. The rows themselves are defined by exactly one construct: the **concept**. A concept is a schema for a class of memory-graph rows, analogous to a table.

memQL is **append-only and immutable**. Records are never updated in place; "updating" a record means inserting a new version under the same id. Queries return the latest version per id by default. (See `docs/core/memql.md` "Mutations" and authoring rule #5.)

### 1.2 Canonical concept ids

The engine assembles a concept's canonical id from its annotations and declaration name:

```
v<MAJOR>:<namespace>:<conceptName>
```

Authors stamp `@version("MAJOR.MINOR.PATCH")` and `@namespace("...")`; the name comes from the declaration header. Only the MAJOR segment flows into the id prefix. A row's storage id is then `{partition}:{concept}:{contentHash-or-explicit-id}`.

*Source: `dsl/_reference/_concept.memql` lines 16–22.*

### 1.3 The two cross-cutting models

Two things apply to nearly every construct and are covered once, in depth, below:

- **Argument resolution** (§3): how a body reaches caller-passed args (`args.X`), the auth envelope (`actor.X`), and engine-provided values (`now`, `partition`, `config.X`).
- **The dependency tree** (§4): which construct layers may depend on which. Cycles and upward dependencies are rejected at load time.

### 1.4 Struct form vs procedural form

Almost every construct today is authored in **struct form** — a declarative block, no receiver function, no `ctx` parameter. A repo-wide keyword count confirms this: `mutation`, `query`, `seed`, `concept`, `shape`, `builtin`, `provider`, `logic`, `trait`, `automation`, `tool`, `prompt`, `spec`, and `policy` declarations number in the hundreds, while legacy `func (Receiver)` declarations have dwindled to a handful (`func (Spec)` ×2, `func (Shape)` ×2, `func (Policy)` ×1 across the entire tree).

The legacy procedural form — `func (Query|Mutation|Spec|Shape|Prompt|Provider|Builtin|Tool) NAME(ctx any) (any, error) { ... }` — is **retired and rejected at parse time** for most kinds. It survives as the underlying runtime contract that the struct-form rewriter emits, and as the author surface only for **logic** blocks and **decision policies** that need imperative branching. You should never hand-author the `func` shape for the struct-form kinds; the parser will reject it with a migration hint.

---

## 2. The construct kinds at a glance

| Keyword | Kind | What it is | Author form |
|---|---|---|---|
| `concept` | Concept | Row schema. The only data-introducing construct. | struct |
| `shape` | Shape | Reusable field projection (row and/or actor envelope). | struct |
| `spec` | Spec | Atomic boolean predicate, optionally shape-bound. | struct |
| `trait` | Trait | Concept-agnostic atomic predicate. | struct |
| `query` | Query | Read function: concept + filter + shape + args. | struct (procedural for multi-step) |
| `mutation` | Mutation | Write function: exactly one `insert` or `update`. | struct |
| `logic` | Logic | Imperative orchestration block (loops, branching, multi-step). | struct + `body { ... }` |
| `automation` | Automation | Event- or schedule-triggered workflow; dispatches logic. | struct |
| `builtin` | Builtin | Declarative wrapper over a Go integration handler. | struct |
| `prompt` | Prompt | SI prompt template with a typed input schema. | struct |
| `provider` | Provider | SI vendor + model + auth configuration. | struct |
| `tool` | Tool | SI-callable surface bound to a query/mutation/function handler. | struct |
| `policy` | Policy | Cross-cutting decision OR SI-router routing config. | struct (router) / `func (Policy)` (decision) |
| `seed` | Seed | Declarative row template materialized at startup. | struct |

All construct keywords are reserved identifiers (see `docs/core/memql-reserved.md` §5).

---

## 3. Argument resolution (read this before authoring anything)

Every construct shares one model for declaring inputs and one namespace for reading them. `ctx` is gone from the author surface entirely.

### 3.1 Where args are declared

| Construct | Where the `args` go |
|---|---|
| Struct query / mutation | `args { ... }` sub-block inside the body |
| Logic / automation / decision policy | `args { ... }` block (logic: above/inside the body) |
| Builtin / tool / prompt | Body fields directly — the body *is* the schema, no `args` wrapper |

`args` field syntax:

```
<name> <type> [@required] [@enum("a","b",...)] [@default(<expr>)] [@description("...")]
```

Omitting `@required` makes the field optional.

### 3.2 How args are read inside a body

| Name pattern | Source | Available in |
|---|---|---|
| `args.X` | A caller-passed arg declared in `args { ... }` | every body |
| `actor.X` | Resolved auth context | every body |
| `now` | RFC3339 timestamp captured at eval start | every body |
| `partition` | Active partition for this call | every body |
| `config.X` | Allow-listed config (`component/config/policy_exposable.go`) | every body |
| `trace` | Policy-trace handle (`trace.persist`, `trace.note`) | policies + logic invoked from policies |
| `payload.X`, `id`, `concept`, `type`, `createdAt`, `createdBy`, `schema`, `partition`, `provenance` | Row fields / intrinsics | query `filter`+`shape` (SQL push-down), specs, traits |

The `actor` envelope is a **closed set** of fields — anything else under `actor.` (including a typo like `actor.userid`) is a hard error:

| Path | What |
|---|---|
| `actor.userId` | acting user's id |
| `actor.role` | cluster role: `owner` / `admin` / `writer` / `reader` |
| `actor.identityId` | the credential row (token, magic-link, PAT) |
| `actor.isClusterOwner` | bool; bypasses the per-partition ACL |
| `actor.now` | RFC3339 timestamp at eval start |
| `actor.config.<key>` | allow-listed config |

*Source: `docs/core/memql-reserved.md` §1–3; `dsl/_reference/_spec.memql` lines 138–148.*

### 3.3 Reserved engine names

`now`, `actor`, `partition`, `config`, `trace` are reserved top-level identifiers. An `args` field colliding with one of these does not shadow the engine value — the reserved name always wins (at policy-eval time the colliding arg key is dropped before mirroring; see `isReservedCtxKey` in `component/memql/policy_evaluator.go`). The reserved index in `docs/core/memql-reserved.md` §1 attributes this to `component/memql/keyword_slices.go`, but that file is only a per-kind declaration-slice extractor and carries no reserved-name logic — treat the file citation there as stale.

> **`caller.X` / `@caller` are retired** (memQL #221). The canonical spelling is `actor.X` / `@actor`. The parser rejects the old forms with a migration hint. The project-root `CLAUDE.md` still references `caller`/`@caller` in places — that text is stale relative to the code.

### 3.4 Why `args.X` and not bare names

Inside a mutation `insert` block, the keys are bare payload field names. Writing `spaceId: args.spaceId` keeps the LHS (concept payload key) and RHS (caller arg) visually distinct. Same in query filters: `payload.spaceId == args.spaceId` reads unambiguously. (Authoring rule #21.)

---

## 4. The dependency tree

Constructs form layers. Each layer may depend only *downward* on the layers above it; cycles are rejected at load time. Cross-file dependencies are declared with file-top `use <module>.{ ... }` imports (see §5); concept bindings live in the construct signature, not in annotations.

```
  Concepts                  schemas + reserved intrinsics — the base of everything
     │
     ├──► Shapes            @row / @actor field projections (+ trait shapes)
     │      │
     │      └──► Specs / Traits   atomic predicates bound to shapes
     │               │
     ├──► Mutations    │    one insert/update per body
     ├──► Builtins     │    Go-backed executors
     ├──► Providers ───┼──► Prompts   SI vendor+model / templates
     │                 ▼
     │            ┌─ Queries        concept + filter(specs) + shape + args
     │            │
     ▼            ▼
  Logic ◄──── Automations / Tools
     │         (event→effect)   (SI-callable surface)
     ▼
  Policies            top-of-stack cross-cutting decisions
```

How to read it:

- **Concepts** are pure schema; every other construct references one or more concept ids.
- **Shapes** project a concept's payload + intrinsics (`@row`), the auth envelope (`@actor`), or both. Trait shapes are `@row` shapes without a bound concept — concept-agnostic scaffolds.
- **Specs** are atomic booleans; the body's field references classify them as row-specs (compile to SQL `WHERE`) or context-specs (evaluate in-process). **Traits** are the concept-agnostic flavor.
- **Mutations** write rows — exactly one `insert` or `update` per body.
- **Builtins** wrap Go integrations behind a declarative schema.
- **Providers** are SI vendor/model/auth records; **prompts** pin a provider and render a template.
- **Queries** stitch concept + filter + projection + args into a typed read.
- **Logic** blocks are the imperative escape hatch (loops, branching, multi-step).
- **Automations** are event/schedule-triggered; they dispatch logic and consume everything above.
- **Tools** are the SI-facing surface over queries / mutations / functions.
- **Policies** sit on top: caller-based decisions for authorization, vendor selection, feature gating.

*Source: project `CLAUDE.md` "DSL dependency tree"; `dsl/_reference/_spec.memql` lines 198–227.*

---

## 5. The import model (`use`)

Cross-file dependencies are pulled into local scope with a file-top `use` statement naming the module path and the symbols to import:

```memql
use cognition.concepts.{ participant }
use common.traits.{ traitIsActiveRecord }
use identity.mutations.{ mutationGrantPartitionAccess }
use cognition.queries.{ queryParticipantByAgentSpace, queryParticipantSession }
```

The module path mirrors the DSL tree: `<namespace>.<kind>s.{ <symbols> }`. The most common imports across the tree are `*.concepts.{ ... }`, `*.queries.{ ... }`, `*.mutations.{ ... }`, `*.traits.{ ... }`, and `*.logic.{ ... }`.

The legacy per-construct annotation family — `@useConcept`, `@useShape`, `@useQuery`, `@useMutation`, `@useLogic`, `@useBuiltin`, `@useSpec`, `@useTrait`, `@useTool`, `@usePrompt`, `@useProvider`, `@useAutomation` — was retired in the import-model pivot (memQL PRs #47–#49, 2026-05-19) and is rejected at parse time. Concept binding for queries / mutations / shapes / seeds lives in the **signature** (`query <Concept> <name>`), not in an annotation.

*Source: `docs/core/memql-reserved.md` §6; `dsl/_reference/_shape.memql` lines 30–34.*

---

## 6. Construct reference

### 6.1 Concept

A concept defines the schema for a class of rows. Annotations go above the `concept` keyword; the full concept-level annotation surface is four annotations and nothing else (`@description`, `@version`, `@namespace`, `@type`) — unknown annotations are rejected with `unknown concept annotation @<name>`. (The repo also recognizes `@cache(ttl=N)`, `@skipDeleted`, `@enforceRequired`, `@defaultFilter`, `@scope`, and the display-card annotation in the live parser; the `_reference` file documents the minimal canonical surface.)

**Field types:** scalars `string`, `bool`, `int`, `float`, `datetime`; composites `[]<type>`, `enum("a","b",...)`, `object` (with a nested body), `map(string, T)`; the escape hatch `any`.

**Field annotations:** `@required`, `@default("value")`, `@description("...")`, `@unique`, `@pattern("regex")`, `@minLength(N)`, `@maxLength(N)`, `@minimum(N)`, `@maximum(N)`, `@immutable`, `@secret`, `@variant(discriminator="field")`.

**Reserved intrinsics — never declare these in a concept body:** `id`, `createdAt`, `createdBy`, `partition`, `concept`, `payload`, `schema`, `type`, `provenance`. The engine auto-stamps them; redeclaring one is a hard load-time error that bricks the entire concept loader (authoring rule #19).

Real example — the `guide` concept (trimmed; descriptions shortened):

```memql
@version("1.0.0")
@namespace("guide")
@description("A persisted, re-runnable Guide: an ordered sequence of Scenes the General Assistant narrates ...")
@displayCard(primary="name", secondary="kind", tertiary="description", status="active")
concept guide {
  slug         string  @required  @description("Stable machine-readable identifier ...")
  name         string  @required  @description("Human-readable title shown to the user ...")
  description  string              @description("Short summary of what the Guide covers ...")
  kind         enum("demo", "teach", "walkthrough")  @required  @default("walkthrough")
  avatarEnabled  bool   @default("false")
  ownerUserId    string
  spaceId        string
  sceneCount     int    @default("0")
  requiredScopes []string
  locales        []string
  version        int    @required  @default("1")
  active         bool   @default("true")
}
```

*Source: `dsl/guide/concepts.memql` lines 38–70.*

A child concept declares a relationship in the body. The `scene` concept that hangs off a guide:

```memql
concept scene {
  guideId          string  @required  @description("ID of the v1:guide:guide this Scene belongs to.")
  slug             string  @required
  order            int     @required
  narrationIntent  string  @required
  canvasActions    string
  interruptible    bool    @default("true")
  allowsQuestions  bool    @default("true")

  @relationship(type="parent", field="guideId", target="v1:guide:guide", direction="outgoing")
}
```

*Source: `dsl/guide/concepts.memql` lines 75–97.*

**Relationship types** (body-level `@relationship` decorator): `parent`, `contains`, `alias`, `equals`, `references`. `@type("collection")` requires a `contains` relationship; `@type("reference")` requires an `alias`/`equals` relationship. The decision rule for `@type("reference")`: use it *only* when a product-specific row needs extra payload fields the canonical concept shouldn't carry; otherwise point consumers at the canonical row directly.

**Variant fields** (discriminated unions):

```memql
concept variantExample {
  kind  enum("text", "image", "embed") @required
  body  @variant(discriminator="kind") {
    text  { content string @required; wordCount int @default("0") }
    image { url string @required; width int @required; height int @required }
    embed { url string @required; provider enum("youtube","vimeo","twitter") @required }
  }
}
```

*Source: `dsl/_reference/_concept.memql` lines 290–312.*

#### Scope

Concepts default to **partition-scoped**: rows stamp the request envelope's `partition` and reads auto-filter on it. Infrastructure concepts that every tenant must see identically use `@scope("global")` — their rows live in the reserved `_system` partition and ignore the envelope. (The `_reference` file notes `@scope` was retired in #56 for *concepts*; authoring rule #3 and the live globals — `v1:cluster:*`, `v1:platform:partition` — show it is still recognized. Treat the partition model as in flux and consult the engine when authoring a new infrastructure concept.)

---

### 6.2 Shape

A shape is a reusable field-projection template. It has **no inputs and no outputs** — the body is a list of field paths plus optional `include` statements. Every shape must carry at least one kind marker: `@row` (project row payload + intrinsics) or `@actor` (project the auth envelope); both is allowed.

Body path translation:

- `row.X` → row intrinsic (`id`, `createdAt`, `createdBy`, `concept`, `partition`, `type`, `schema`), rendered under key `X`.
- `payload.X` → payload field, rendered under key `X`. This is the only legal way to reference a payload field.
- `actor.X` → auth-envelope field; requires `@actor`.
- `include <otherShape>` → splice in every field from another shape (transitive; cycles + collisions are errors).

Concept binding lives in the **signature**: `shape <Concept> <name>` for a concept-bound row shape. A trait shape (`@row` without a concept in the signature) is concept-agnostic.

Real concept-bound row shape:

```memql
@row
@description("Full Guide projection: every definition field the client Guide runtime + the replay/authoring surfaces need.")
shape guide guideFull {
  row.id
  payload.slug
  payload.name
  payload.description
  payload.kind
  payload.avatarEnabled
  payload.ownerUserId
  payload.spaceId
  payload.sceneCount
  payload.generatedFromIntake
  payload.intakeSummary
  payload.requiredScopes
  payload.locales
  payload.version
  payload.active
  row.createdAt
}
```

*Source: `dsl/guide/shapes.memql` lines 6–25.*

Actor (auth-envelope) shape, used by context-specs:

```memql
@actor
@description("Caller envelope projection: authenticated actor, role, and now.")
shape actorEnvelope {
  actor.userId
  actor.role
  actor.identityId
  actor.isClusterOwner
  actor.now
}
```

*Source: `dsl/_reference/_shape.memql` lines 101–109.*

Trait shapes (concept-agnostic `@row` scaffolds) ship under `dsl/common/`: `activeRowTrait`, `statusRowTrait`, `deletedRowTrait`, `archivedRowTrait`, `savedRowTrait`, `validationRowTrait`.

> The `func (Shape) ... { @template({...}) }` form and `@concepts(...)` annotation documented in `docs/core/memql-functions.md` are **retired**; the struct `shape <Concept> <name> { ... }` form is the only accepted shape syntax.

---

### 6.3 Spec

A spec is an atomic boolean predicate. The body is a single boolean expression. The engine classifies the spec by walking its field references — no annotation declares the kind:

- **Row-spec** — references `payload.*` and/or intrinsics (`id`, `concept`, `type`, `createdAt`, `createdBy`, `schema`). Compiles to a SQL `WHERE` fragment and pushes down to the database. Composable in a query `filter` clause (list it after `;`).
- **Context-spec** — references `actor.*` only. Evaluates in-process against the auth envelope. Called from policy bodies via `spec("name")`, or from Go via `engine.EvaluateSpec`.

**Mixed bodies (both row and caller refs) are rejected at load time** — split into a row-spec + a context-spec and compose via a policy.

Spec annotations are narrow: `@description` and an optional `@shape("name")` binding (so the post-load `ValidateSpecBindings` pass verifies the body references a subset of the shape's fields). The `_reference` template treats specs as engine-lifecycle-owned, but the parser evidently accepts `@enabled` on specs and the shipped catalog uses it — e.g. `dsl/agents/specs.memql` carries `@enabled` on `specAgentKindAssistant` / `specAgentKindSpecialist` / `specAgentKindSystem`. Don't rely on a lifecycle annotation being rejected on a spec.

Real row-specs:

```memql
use cognition.concepts.{ participant }

@description("Matches participants with human participantType")
spec specIsHumanParticipant {
  payload.participantType == "human"
}

@description("Matches participants with SI participantType")
spec specIsSIParticipant {
  payload.participantType=="si"
}
```

*Source: `dsl/cognition/specs.memql` lines 6–27.*

Context-spec:

```memql
@description("Caller must hold an admin or owner role.")
spec requiresAdmin {
  actor.role == "admin" || actor.role == "owner"
}
```

*Source: `dsl/_reference/_spec.memql` lines 68–71.*

**Operator vocabulary** inside a spec body: comparison `== != > >= < <=`; logical `&& || !`; set membership `in (X, Y, Z)`; null checks `field == null` / `field != null`; parentheses for grouping.

---

### 6.4 Trait

A trait is a concept-agnostic atomic predicate — same shape and classification as a spec, but it binds to no concept or shape. Use it for properties many concepts share ("active record", "not deleted", "status is active"). Annotations: `@description`, `@enabled`, `@disabled`. Mixed-reference bodies are rejected, same as specs.

```memql
@enabled
@description("Matches records with active==true field.")
trait traitIsActiveRecord {
  payload.active == true
}

@enabled
@description("Matches records that are not soft-deleted (deleted!=true).")
trait traitIsNotDeleted {
  payload.deleted != true
}

@enabled
@description("Matches records whose status sits in the live set.")
trait traitIsLive {
  payload.status == "active" || payload.status == "saved"
}
```

*Source: `dsl/_reference/_trait.memql` lines 54–76.*

Traits are referenced by name exactly like specs — in a query filter (after `;`) or from a policy via `spec("traitName")`.

---

### 6.5 Query

A query stitches a concept + filter (predicates) + projection (shape) + args into a typed read. The concept is bound in the **signature** (`query <Concept> <name>`). The body is three optional clauses:

- `args { ... }` — caller inputs (omit entirely for self-scoped queries).
- `filter <expr>; <specOrTrait>; ...` — predicates joined by `;` (AND). Reference `payload.X`, intrinsics, `args.X`, `actor.X`, and named specs/traits.
- `shape <shapeName>` — the projection applied to each matched row.

A query with **no `shape` clause** returns the raw graph bundle: the matched nodes (with full payloads), edges, and rootIds land in `result.bundle`, and `result.data` is omitted entirely. Adding a shape inverts this — `result.data` carries one shaped element per root and the bundle is dropped (use the raw `shapeWithBundle()` directive when you need both). *(Source: `component/memql/result.go` line 124; `docs/core/memql.md` "Result Shaping".)*

Real queries — note the self-scoped variant with no `args` block (filters on `actor.userId`):

```memql
use guide.concepts.{ guide, scene }

@enabled
@description("Get a single Guide by node id with its full definition.")
query guide queryGuideById {
  args {
    guideId  string  @required
  }
  filter  id==args.guideId
  shape   guideFull
}

@enabled
@description("Resolve a Guide by its stable slug. Returns active Guides only.")
query guide queryGuideBySlug {
  args {
    slug  string  @required
  }
  filter  payload.slug==args.slug; traitIsActiveRecord
  shape   guideFull
}

@enabled
@description("List every active Guide owned by the authenticated caller, across spaces. Self-scoped via actor.userId (no args).")
query guide queryGuidesForUser {
  filter  payload.ownerUserId==actor.userId; traitIsActiveRecord
  shape   guideFull
}
```

*Source: `dsl/guide/queries.memql` lines 7–34.*

**Query-level directives** (`sort()`, `paginate()`, `asOf()`, `select()`, `withDepth()`, `shape()` as a wrapper) are **not valid inside a query body** — they are top-level wrappers applied to a raw query string sent over the wire. Putting a directive in a function body fails engine init with `function "<name>" references unknown function "sort"` and bricks the cluster (authoring rule #1). Sort/paginate on the client, or send the directive in a raw query string through `MemqlService.Stream`.

The procedural `func (Query) NAME(ctx any) (any, error)` form remains available only for queries that genuinely need branching or multi-step composition.

---

### 6.6 Mutation

A mutation writes rows. **Rule #1, the contract of the mutation surface: exactly one `insert` block or one `update` block per body.** Two writes is a parse-time error. Mutations cannot read, cannot call other mutations, and cannot loop — this keeps the read path side-effect-free and audit/event emission one-per-row. Multi-write flows compose via an automation that fires on the first row landing.

The concept is bound in the signature. Inside an `insert`/`update` block the keys are bare payload field names. Two shorthands keep payloads terse:

- `args.name` on its own line is shorthand for `name: args.name` (single-segment paths only).
- `update` blocks carry the row `id:` plus the changed fields.

`coalesce(args.x, default)` supplies defaults; `now` and `actor.userId` are the canonical createdAt/createdBy sources.

Real `insert` mutation (note the `args.slug` / `args.name` shorthand mixed with explicit `coalesce`):

```memql
use guide.concepts.{ guide, scene }

@enabled
@description("Create a persisted Guide (the parent row).")
mutation guide mutationCreateGuide {
  args {
    guideId      string
    slug         string  @required
    name         string  @required
    description  string
    kind         string
    avatarEnabled  bool
    ownerUserId    string
    spaceId        string
    sceneCount     int
    version        int
    active         bool
  }
  insert guide {
    id: args.guideId
    args.slug
    args.name
    args.description
    kind: coalesce(args.kind, "walkthrough")
    args.avatarEnabled
    args.ownerUserId
    args.spaceId
    args.sceneCount
    version: coalesce(args.version, 1)
    active: coalesce(args.active, true)
  }
}
```

*Source: `dsl/guide/mutations.memql` lines 8–47.*

Real partial-update mutation — the caller passes only the fields to change in `payload`:

```memql
@enabled
@description("Partial update of a v1:guide:guide row. Only the fields passed in `payload` change; everything else inherits from the prior row.")
mutation guide mutationUpdateGuide {
  args {
    guideId  string  @required
    payload  object  @required
  }
  update guide {
    id: args.guideId
    args.payload
  }
}
```

*Source: `dsl/guide/mutations.memql` lines 49–60.*

Mutation calls cannot be wrapped with directives (`shape()`, `paginate()`, etc.) — they return a single inserted node, not a result set (authoring rule #4). For deterministic foreign-key ids, route args through `canonicalId(value, "<conceptType>")` before hashing so logically-equal references hash to the same id (authoring rule #20).

---

### 6.7 Logic

A logic block is the imperative escape hatch — loops, conditionals, multi-step orchestration, calling queries and mutations in sequence. Automations dispatch logic; logic is where the real work happens. The struct form carries an `args { ... }` block and a `body { ... }` block. Inside the body:

- `name := <expr>` assigns a step result.
- `for item := range coll.Nodes() { ... }` iterates query results.
- `if <cond> { <step> }` is a statement-position conditional (use `cond(p, a, b)` for value-position conditionals — see authoring rule #11b).
- Result accessors: `.Nodes()`, `.First()`, `.Len()`, `.Empty()`, `.Count()`.
- `return <expr>` ends the body.

The author surface is `ctx`-free: reach inputs via `args.X`, never write `ctx.output = ...`.

Real logic block (a cron sweep that ages out pending access requests):

```memql
use identity.mutations.{ mutationExpireAccessRequest }
use identity.queries.{ queryExpiredPendingAccessRequests }
use platform.queries.{ queryGlobalVariable }

@description("Daily 04:00 UTC sweep that ages out pending access requests older than IDENTITY_ACCESS_REQUEST_EXPIRY_DAYS (default 30) by stamping status='expired'.")
logic logicAccessRequestExpirySweep {
  args {
    event object @required
  }
  body {
    pending := queryExpiredPendingAccessRequests({})
    expiryDays := queryGlobalVariable({ name: "IDENTITY_ACCESS_REQUEST_EXPIRY_DAYS" })

    for item := range pending.Nodes() {
      expireStep := if addDuration(item.createdAt, concat("P", coalesce(expiryDays.First().payload.value, "30"), "D")) < timestamp() {
        mutationExpireAccessRequest({
          requestId: item.id
        })
      }
    }

    return pending.Len()
  }
}
```

*Source: `dsl/identity/logic.memql` lines 36–66.*

Step references inside conditions and args are validated and topologically sorted at compile time — typos surface as `references unknown step "..."`, forward references are reordered automatically, and cycles produce a clear compile-time error (authoring rule #13).

---

### 6.8 Automation

An automation is an event- or schedule-triggered workflow. **Automations are disabled by default** — they need `@enabled`. The body is a sequence of named `step` blocks, each typically dispatching a logic block with the triggering event bound as `event`.

Trigger annotations:

| Annotation | Args | Purpose |
|---|---|---|
| `@enabled` / `@disabled` | none | Lifecycle (default disabled) |
| `@trigger` | `event="..."`, `concept="..."`, `partition="..."` | Event-based trigger |
| `@trigger` | `schedule="<cron>"` | Cron schedule |
| `@filter` | `<expr>` | Predicate on the triggering event |
| `@description` | `"..."` | Human-readable description |

For automations, the triggering event payload is reachable as `args.topic`, `args.kind`, `args.payload.<field>` inside dispatched logic. Event topics are five segments: `graph.node.{created|updated|deleted}.{partition}.{concept}`; subscriptions use `*` for single-segment wildcards (authoring rule #10).

Real event-triggered automation:

```memql
use cognition.logic.{ logicAutoJoinSI, logicBootstrapSession, logicGenerateResponse }

@enabled
@trigger(event="node.created", concept="v1:cognition:space", partition="*")
@filter(payload.active==true)
@description("On space creation, joins the creator's assistant plus any specialist agents picked at creation time.")
automation autoJoinSI {
  step run {
    logic autoJoinSI { event: event }
  }
}
```

Real scheduled automation:

```memql
@enabled
@trigger(schedule="0 0 2 * * *")
@description("Daily sweep to hard-delete archived spaces past their expiresAt deadline.")
automation purgeExpiredArchivedSpaces {
  step run {
    logic purgeExpiredArchivedSpaces { event: event }
  }
}
```

*Source: `dsl/cognition/automations.memql` lines 6–43, 67–70.*

---

### 6.9 Builtin

A builtin wraps a Go integration handler behind a declarative schema, so it is callable from DSL like any other named function. The body field list *is* the input schema (no `args` wrapper). The `@executor("integration.X.Y")` annotation names the Go handler; `@args(profile="...")` declares the parser-level argument profile.

```memql
@enabled
@executor("integration.chat.recentChat")
@args(profile="object")
@description("Read recent utterances + space context. Five operations: readRecent / readByKeyword / readByTime / getSpaceContext / listParticipants.")
builtin recentChat {
  spaceId    string  @required
  agentId    string
  operation  string  @required
  count      int
  keyword    string
  fromTime   string
  toTime     string
}
```

*Source: `dsl/cognition/builtins.memql` lines 14–23.*

Observed `@args` profiles across the tree: `profile="object"` (most common), `profile="object", additionalProperties="true"`, and string-or-object profiles like `profile="stringOrObject", stringKey="name"`. The legacy `func (Builtin)` form is retired.

---

### 6.10 Prompt

A prompt is an SI prompt template with a typed input schema. The body is a field list (the input schema); annotations pin the template file and default provider:

- `@templateFile("...")` — the Go `text/template` file rendered for the prompt.
- `@defaultProvider("...")` — the provider used when no per-call override is given.
- `@description("...")`.

```memql
@defaultProvider("chat54Mini")
@templateFile("prompts/cognitionPlanTriage.tmpl")
@description("Per Q10: classify whether the latest chat message warrants spawning a Plan (background work) or can be answered inline.")
prompt cognitionPlanTriage {
  utterance      string    @required @description("The latest message to triage.")
  speakerName    string    @required
  intent         string              @description("Classified intent of the utterance.")
  transcript     []object            @description("Recent conversation context (oldest first, up to 5 entries).")
  agents         []object  @required @description("Available agents with id, name, role, domains.")
  attachmentRefs []object            @description("Recent attachment ids ...")
  activeDocs     []object            @description("Validated knowledge documents available for retrieval ...")
}
```

*Source: `dsl/cognition/prompts.memql` lines 22–33 (annotations from 22, `prompt` body 25–33).*

Prompts are invoked from a shape projection via `si(templateId, variables, provider?, cacheTTL?)`. `si()` is allowed **only inside projections** (`shape()` / `select()` / projected spec outputs) — using it in filters, joins, sorts, or grouping raises an error. Cache TTL is clamped to ≤ 300 seconds. The legacy `func (Prompt) ... { @input { ... } }` form is retired; the body-is-schema struct form is canonical.

---

### 6.11 Provider

A provider is an SI vendor + model + auth configuration. A `@base` provider declares vendor-level auth and type; concrete providers `@extends` a base and pin a model + params.

Base provider (vendor auth):

```memql
@base
@type("Anthropic")
provider anthropic {
  auth {
    apiKey  env("MEMQL_SI_ANTHROPIC_API_KEY")
  }
}
```

Concrete provider extending a base:

```memql
@extends("openai")
@model("gpt-5.4")
@description("OpenAI GPT-5.4 - flagship standard-tier chat (non-streaming)")
provider chat54 {
  params {
    contextWindow              128000
    maxCompletionTokens        4096
    inputCostPerMillion        2.50
    outputCostPerMillion       10.00
    cachedInputCostPerMillion  1.25
  }
}
```

*Source: `dsl/providers/providers.memql` lines 6–12 (anthropic base), 62–73 (chat54).*

Annotations: `@base`, `@type` (`OpenAI`, `OpenAIStream`, `OpenAITTS`, `OpenAIAudio`, `Anthropic`, …), `@model`, `@extends`, `@modality`, `@default` (marks the fallback provider), `@description`. `auth` uses `env("VAR")` for credential references; an `env()` placeholder whose variable is unset fails registration, so optional credentials (e.g. OpenAI project id) are read directly in Go rather than declared here. The legacy `func (Provider)` form is retired.

---

### 6.12 Tool

A tool is the SI-callable surface over a query, mutation, or Go function. The body field list is the tool's argument schema (with `@required`, `@enum`, `@default`, `@description`, and `@autoInjected` for server-stamped fields the LLM must not supply). The `@handler` annotation binds the implementation:

- `@handler(type="query", query="<memql statement>")` — runs any MemQL statement, including a mutation call. Args interpolate as `$args.X`.
- `@handler(type="function", name="<builtinName>")` — dispatches to a registered function/builtin.

Tool with a function handler and auto-injected, server-stamped fields:

```memql
@enabled
@handler(type="function", name="recentChat")
@requires("recent-chat")
@executionTime("fast")
@description("Read recent space-chat content + space context. Read-only.")
tool recentChat {
  spaceId    string  @required @autoInjected @description("v1:cognition:space.id of the active space. Server-stamped; the validator drops any LLM-supplied value before dispatch.")
  agentId    string  @autoInjected @description("Calling agent id. Server-stamped.")
  operation  string  @required @enum("readRecent", "readByKeyword", "readByTime", "getSpaceContext", "listParticipants")
  count      int     @description("readRecent: how many recent utterances (default 20, max 100).")
  keyword    string
  fromTime   string
  toTime     string
}
```

*Source: `dsl/cognition/tools/recentChat.memql` lines 28–43.*

Tool whose handler runs a named query (and one whose `query=` actually calls a mutation):

```memql
@enabled
@handler(type="query", query="queryUpcomingEvents({\"windowStart\": \"$args.windowStart\", \"windowEnd\": \"$args.windowEnd\"})")
@executionTime("fast")
@description("List the caller's upcoming calendar events whose start falls in [windowStart, windowEnd].")
tool calendarList {
  windowStart  string  @required @description("Inclusive RFC3339 lower bound on event start.")
  windowEnd    string  @required @description("Inclusive RFC3339 upper bound on event start.")
}
```

*Source: `dsl/calendar/tools.memql` lines 21–30.*

A memQL tool binds to exactly one handler; a capability with several actions (calendar list/create/update/delete/find) becomes several narrow tools, bundled into a skill. The legacy `func (Tool)` form is retired.

---

### 6.13 Policy

"Policy" covers two distinct constructs that share the keyword:

**(a) SI-router routing policies** — the dominant form in the current tree. A routing policy names a primary provider, ordered fallbacks, latency ceilings, and preferred roles. The body is empty (`{ }`); everything is annotations. Seeds reference these by name in `providerConfig.llm.policyName`.

```memql
@primary("streamClaudeSonnet")
@fallback("stream54Pro")
@fallback("streamGeminiPro")
@maxLatencyMs(60000)
@preferredRole("assistant")
@preferredRole("specialist")
@description("Default chat policy for non-operator agents. Claude Sonnet primary, GPT-5.4 Pro cross-vendor fallback, Gemini Pro tertiary.")
policy balancedChat { }

@primary("streamGroqLlama70B")
@fallback("streamGeminiFlash")
@fallback("stream54Mini")
@maxTimeToFirstTokenMs(800)
@maxLatencyMs(10000)
@description("Low latency voice -- turn-taking in multi-party voice conversations.")
policy lowLatencyVoice { }
```

*Source: `dsl/policies/policies.memql` lines 6–13, 35–41.*

**(b) Cross-cutting decision policies** — caller-based decisions for authorization, vendor selection, feature flagging, UI gating. These are the one place the procedural `func (Policy) NAME(_ any) <return-type> { ... }` form remains the author surface, because they branch and compose. They carry tier + visibility + persistence annotations (`@tier("core"|"bff")`, `@frontend_visible`, `@cacheable`, `@audited`, `@traces_persisted`) and call sub-checks via `spec("name")` (pure caller booleans) or `policy("name")` (composite decisions). `core` policies are platform invariants; `bff` policies are product decisions and may call `core`, but `core` must not call `bff` (enforced at registration). A decision policy whose body is a pure caller-only boolean with no policy-only annotations is rejected at load time with a nudge to move it to a `spec`.

> In the public tree, the decision-policy form is sparse (one `func (Policy)` across all `.memql` files); the routing-policy form populates `dsl/policies/`. The decision-policy mechanics above are documented in the project `CLAUDE.md` "Policies" section and the reserved-names index; the live evaluation entry points are `engine.EvaluatePolicy` (Go), `policy("name", { ... })` (DSL), and `client.evaluatePolicy(...)` (frontend).

---

### 6.14 Seed

A seed is a declarative row template materialized into real rows at engine startup (and on relevant create events) by the `SeedMaterializer`. It replaces the retired `agent X { ... }` primitive — platform agents, avatar personas, and similar bootstrap rows are now seeds targeting a concept. The concept is bound in the signature (`seed <Concept> <name>`); the body is a payload literal.

`@scope` controls materialization:

- `@scope("perUser")` — one row per user (id computed as `<name>-<userId>`; perUser seeds **may not declare an id**).
- `@scope("global")` — one global row.

Real perUser seed (the per-user general-assistant baseline, trimmed). Its display name was changed from `"Assistant"` to `"Sofia"` in #773 (which also retired the old one-shot "Ava"):

```memql
use agents.concepts.{ agent }

@scope("perUser")
@templateFile("templates/assistant.tmpl")
@description("Per-user Assistant baseline. Designated fallback when no specialist fits; owns operator-facing UI-driving tools.")
seed agent assistant {
  name:        "Sofia"
  description: "Designated fallback when no specialist fits."
  personality: "Friendly, capable, proactive."
  kind:        "assistant"
  role:        "assistant"
  roleSlug:    "assistant"
  gender:      "female"

  providerConfig {
    llm {
      policyName:  "balancedChat"
      temperature: 0.7
      maxTokens:   4000
    }
  }

  capabilities {
    avatar:       true
    lipSync:      true
    vision:       true
    voiceToVoice: true
    claw:         false
  }
}
```

*Source: `dsl/agents/assistant.memql` lines 20–60.*

Real catalog seed (one row per declaration, materialized globally):

```memql
use agents.concepts.{ avatarPersona }

@description("Avatar persona Ava (female) -- Anam.")
seed avatarPersona ava {
  vendor:     "anam"
  personaId:  "c69f82e9-aa11-428b-946f-a1b8c30a5eda"
  name:       "Ava"
  gender:     "female"
  imageRef:   "avatars/female_0.png"
  previewRef: "avatars/female_0.png"
}
```

*Source: `dsl/agents/avatarPersonas.memql` lines 11–21.*

The materializer uses create-only (insert-if-missing by deterministic id) semantics, so user edits to a materialized row survive restarts. Source: `component/memql/seed_materializer.go`, `seed_parser.go`.

---

## 7. Raw query language (the wire surface)

Queries authored as struct-form `query` constructs compile down to memQL's raw filter-and-directive language, which is also what clients send over `MemqlService.Stream` and the `/memql/ws` WebSocket bridge. The raw surface is worth knowing because directives only work here, not inside function bodies.

**Filters** are comparison expressions joined by `;`/`&&` (AND) or `,` (OR), over fields `concept`, `id`, `type`, `createdAt`, `createdBy`, `payload.<path>`:

```
concept==v1:cognition:space;payload.status=="active"
```

**Operators:** `== != > >= < <= in "not in" has ==nil !=nil`.

**Directives** wrap the whole expression and must form the outermost stack: `asOf(expr, "ts")`, `shape(expr, "shapeName"|{...})`, `select(expr, "f1", "f2")`, `sort(expr, "field", "desc")`, `paginate(expr, limit, offset?)`, plus traversal `parentOf()` / `childOf()` / `withDepth()`.

**Shaping** in raw queries uses inline templates with `node("path")`, `children(template)`, `contains(template)`, `si(templateId, vars)`, `json(value)`, and `match(case(...), default(...))`. `shape()` returns `result.data` only; `shapeWithBundle()` returns both the shaped data and the graph bundle.

**Mutations** in raw form: `insert("concept", id="id", payload={...})`. Omitting `id` derives a content-addressed SHA-256 id from concept + payload, which makes re-inserting an identical payload a new *version* of the same row rather than a new row (authoring rule #9; `docs/core/memql.md` "Content-Addressed IDs").

*Source: `docs/core/memql.md` "Query Structure", "Result Shaping", "Mutations".*

---

## 8. Authoring rules that bite (quick index)

The full running list is `docs/core/memql-authoring-rules.md`. The ones most likely to break a build:

1. **One write per mutation body** — two `insert`/`update` blocks is a parse error; compose multi-write flows via an automation.
2. **No directives in function bodies** — `sort`/`paginate`/`shape`/etc. inside a query body bricks engine init.
3. **`@scope("global")` for system data** — partition-scoped concepts vanish when the user switches partition.
4. **Don't redeclare intrinsics** — declaring `id`/`createdBy`/`createdAt`/`partition`/`concept`/`payload`/`schema`/`type` in a concept body fails the loader and bricks the cluster (rule #19).
5. **`partition` is reserved** — use `partitionName` for a payload field (rule #12).
6. **DNS-label-shape names** for anything that becomes an id (lowercase, inner dashes, ≤50 chars) (rule #6).
7. **`cond(p, a, b)`, not `if`, for value-position conditionals** — `if` is statement-only (rule #11b).
8. **Role enum is `owner`/`admin`/`writer`/`reader`** only (rule #11).
9. **`canonicalId()` before hashing foreign keys** for stable deterministic ids (rule #20).
10. **Object-literal keys are unquoted identifiers** unless the key isn't a valid identifier (rule #18).

---

## 9. Where the source of truth lives

| Topic | Canonical source |
|---|---|
| Concept / shape / spec / trait syntax | `dsl/_reference/_concept.memql`, `_shape.memql`, `_spec.memql`, `_trait.memql` |
| Reserved names (top-level, intrinsics, actor, keywords, annotations) | `docs/core/memql-reserved.md` |
| Authoring gotchas | `docs/core/memql-authoring-rules.md` |
| Raw query language, directives, `si()`, mutations | `docs/core/memql.md` |
| Argument resolution + dependency tree (overview) | project `CLAUDE.md` |
| Canonical teaching examples | `dsl/guide/*.memql` |
| Seed materialization | `component/memql/seed_materializer.go`, `seed_parser.go` |

> Caveat for readers cross-checking against `docs/core/memql-functions.md`: that file is dated and still documents retired forms (`func (Shape)`, `@input`, `@template`, `func (Prompt)`, `func (Provider)`, `@concepts`). Trust the `dsl/_reference/` templates and `docs/core/memql-reserved.md` over it.
