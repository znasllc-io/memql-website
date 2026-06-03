# memQL — Data Model: Concepts, Nodes, Partitions, Events

memQL stores everything as **memory nodes**: immutable, append-only, time-stamped records in a single PostgreSQL table (`MemoryNodes`), optionally backed by the TimescaleDB hypertable extension. Each node belongs to a **concept** (its schema), carries a JSON payload validated against that schema, and is addressed by a stable id of the form `{concept}:{shortId}`. Writes never mutate rows in place — a logical record is a *series* of versions ordered by `createdAt`, and "the current value" is just the most-recent version. Every insert emits a typed graph event (`graph.node.created.{concept}`) onto an in-process pub/sub bus, which is what makes the system reactive: automations and live subscriptions are downstream of the same write path. This document is the reference for those four primitives — concepts, nodes, the id format, partitions, and the event model — grounded in the current `main` branch.

> **A note on a migration in flight.** This codebase removed the partition dimension from node storage and node ids in change set **#56** ("partition removal"). The primary key is now `(id, createdAt)` — there is no `partition` column — and ids are `{concept}:{shortId}` with no partition prefix. Some surrounding docs, code comments, and the older `docs/core/events.md` still describe the previous `{partition}:{concept}:{shortId}` id format and a partition segment in event topics; those are **stale**. This document describes what the code on `main` actually does and flags the discrepancies inline. Where partition still exists as a live concept (the gRPC envelope, event metadata, log fields, and seed scoping), that is called out explicitly.

---

## 1. The storage primitive: the memory node

### 1.1 The row

Every stored entity in memQL — an agent, a space, an utterance, a user, a cluster node, a secret — is a row in the `MemoryNodes` table. The Go model:

```go
type MemoryNode struct {
    bun.BaseModel `bun:"table:MemoryNodes,alias:mn"`
    ID            string          `bun:",pk" json:"id"`
    CreatedAt     time.Time       `bun:"\"createdAt\",pk,type:TIMESTAMPTZ" json:"createdAt"`
    CreatedBy     string          `bun:"\"createdBy\",notnull" json:"createdBy"`
    Concept       string          `bun:",notnull" json:"concept"`
    Type          string          `bun:"type,notnull" json:"type"`
    Schema        json.RawMessage `bun:"type:JSONB,notnull" json:"schema"`
    Payload       json.RawMessage `bun:"type:JSONB,notnull" json:"payload"`
    Metadata      json.RawMessage `bun:"type:JSONB,notnull,default:'{}'" json:"metadata,omitempty"`
    Provenance    json.RawMessage `bun:"type:JSONB,notnull" json:"provenance"`
}
```
*Source: `component/database/memory-nodes/models.go`*

A second table, `SecretMemoryNodes`, has the identical shape and is used for secret-bearing rows (e.g. encrypted credentials). Both share the same id rules, PK, and event semantics described below.

| Column | Type | Meaning |
|---|---|---|
| `id` | `TEXT` | Canonical node id, `{concept}:{shortId}` (see §3). Part of the PK. |
| `createdAt` | `TIMESTAMPTZ` | Version timestamp. Part of the PK. The time-series axis. |
| `createdBy` | `TEXT` (NOT NULL) | The acting identity (the "actor"). Engine-stamped, never author-supplied. |
| `concept` | `TEXT` (NOT NULL) | The concept id this row instantiates. |
| `type` | `TEXT` (NOT NULL, default `object`) | Node type — `object`, `collection`, or `reference`. |
| `schema` | `JSONB` (NOT NULL) | The JSON-Schema variant the payload was validated against (carries `$id`). |
| `payload` | `JSONB` (NOT NULL) | The concept-defined fields for this row. |
| `metadata` | `JSONB` (NOT NULL, default `{}`) | Caller-supplied side metadata. GIN-indexed. |
| `provenance` | `JSONB` (NOT NULL) | Engine-stamped attribution: who/what wrote this version. GIN-indexed. |

### 1.2 The DDL and the time-series substrate

```sql
CREATE TABLE IF NOT EXISTS "MemoryNodes" (
    id TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT NOT NULL,
    schema JSONB NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    "type" TEXT NOT NULL DEFAULT 'object',
    concept TEXT NOT NULL,
    PRIMARY KEY (id, "createdAt")
);
-- ... then, if the extension is available:
PERFORM create_hypertable('MemoryNodes', 'createdAt', if_not_exists => TRUE);
```
*Source: `component/database/memory-nodes/migrations/20260324000000_initial_setup.up.sql`*

The same migration file explicitly documents the post-#56 state in a comment:

> `-- Memory nodes (no partition column post-#56 phase 3; isolation now enforced at the DSL layer via caller-scope checks on every user-scoped read/write ...)`

When TimescaleDB is present, `MemoryNodes` becomes a **hypertable** partitioned on `createdAt`, giving time-based chunking, retention, and compaction for the append-only history. When TimescaleDB is absent the table degrades gracefully to a plain PostgreSQL table — the migration guards every `create_hypertable` call with an extension-availability check and a `RAISE NOTICE` fallback, so memQL runs on stock PostgreSQL.

Indexes created alongside the table:

- `memory_nodes_id_created_at_desc_idx ON (id, "createdAt" DESC)` — the workhorse for "latest version of id X."
- `memory_nodes_concept_idx ON (concept)` — concept scans.
- `memory_nodes_metadata_gin_idx ON metadata` — JSONB containment on metadata.
- `idx_memorynodes_provenance ON provenance USING GIN` — provenance containment, e.g. `provenance @> '{"kind":"seed"}'` (added in `20260516000000_provenance_intrinsic.up.sql`).

### 1.3 Append-only history: the `(id, createdAt)` primary key

The defining property of the data model is the composite primary key **`(id, createdAt)`**. A logical record (one `id`) is not a single row — it is the ordered set of all rows sharing that `id`, one per write. There is no `UPDATE`; an "update" is a fresh insert of a new version at a later `createdAt`. "Read the current value" means *select the row with the maximum `createdAt` for that id*:

```go
err := bunDB.NewSelect().Model(&node).
    Where("id = ?", trimmedId).
    OrderExpr(`"createdAt" DESC`).
    Limit(1).
    Scan(ctx)
```
*Source: `component/database/memory-nodes/repository.go` (`LoadMemoryNode`)*

Inserts use `ON CONFLICT (id, "createdAt") DO NOTHING` to make same-instant duplicate writes idempotent without masking other unique-constraint violations:

```go
_, err := bunDB.NewInsert().
    Model(node).
    On("CONFLICT (id, \"createdAt\") DO NOTHING").
    Exec(ctx)
```
*Source: `component/database/memory-nodes/repository.go` (`CreateMemoryNode`)*

This is why memQL is a "time-series memory graph": the database keeps the full history of every node for free, and consumers choose between *latest* (the default read) and *as-of* / *full-history* by varying the `createdAt` predicate and ordering.

### 1.4 Deletion is a tombstone, not a delete

Deletes follow the same append-only discipline. `Concept.Delete` inserts a new version whose payload is `{ "id": ..., "deleted": true, "reason": ... }` validated against the concept's *deletion* schema variant, rather than removing rows:

```go
payload := map[string]any{
    "id":      c.storageId(nodeId),
    "deleted": true,
}
// ... validated against the "delete" schema variant, then inserted as a new version.
```
*Source: `component/database/memory-nodes/concept.go` (`Delete`)*

Reads filter tombstones out by default. `Concept.Query` walks the result set newest-first, and for each id the first (most-recent) version wins; if that version's schema `$id` matches the concept's deletion schema, the id is treated as deleted and omitted unless the caller passes `IncludeDeleted`:

```go
schemaId := extractSchemaId(runtimeNode.Schema)
if schemaId == deletionSchemaId {
    seen[id] = struct{}{}
    if params.IncludeDeleted {
        result = append(result, runtimeNode)
    }
    continue
}
```
*Source: `component/database/memory-nodes/concept.go` (`Query`)*

A later re-insert of the same id with a normal (non-deletion) payload "undeletes" it, because the newest version is what reads see. Deletion is therefore reversible and fully audited — the tombstone carries its own `createdBy` and `provenance`.

### 1.5 Reserved intrinsics

Several field names are reserved by the engine and may **not** appear in a concept's payload schema or be supplied by an author at write time. They are stamped by the engine:

```go
var reservedPayloadFields = []string{
    "id",
    "createdAt",
    "createdBy",
    "concept",
    "partition",
    "payload",
    "schema",
    "type",
}
```
*Source: `component/database/memory-nodes/constants.go`*

On every insert, `Concept.Create` strips these from the supplied payload (`StripReservedPayloadFields`) before validation and re-stamps them from the request context — `createdBy` from the actor, `createdAt` from the clock, `id` from the supplied short id (or derived), `concept`/`schema`/`type` from the concept definition. Authors declare only their own domain fields. (`partition` remains on the reserved list even though storage no longer carries it, to keep authors from re-introducing it into payloads.)

### 1.6 Provenance: mandatory attribution

`provenance` is a NOT-NULL JSONB column stamped from the Go request context — it answers "who or what created this version." It is not optional: `Concept.Create` rejects any write whose context carries no provenance value.

```go
provBytes, provErr := provenanceJSONFromContext(ctx)
if provErr != nil {
    return Node{}, fmt.Errorf("concept %q: %w", c.Name, provErr)
}
node.Provenance = provBytes
```
*Source: `component/database/memory-nodes/concept.go` (`Create`)*

The shape is `{ kind, name, ... }`, with constructors for each write path (`provenance.Seed(name)`, `provenance.Mutation(name)`, `provenance.Automation(name, trigger)`, `provenance.System(name)`, `provenance.Migration(tool)`) — see `component/provenance/provenance.go`. Because it is GIN-indexed, queries like "every row written by automation X" or "every seeded row" push down to the index. The one escape hatch is a migration-time sentinel default (`{"kind":"system","name":"migration-bootstrap"}`) that only catches rows racing the provenance-column migration during cluster bootstrap; the Go-side validator enforces real provenance on every application write.

---

## 2. Concepts: the schema layer

### 2.1 What a concept is

A **concept** is the schema for a class of nodes — the memQL analogue of a table definition. It declares the payload field set, types, requiredness, defaults, and relationships. Concepts are authored in `.memql` files and compiled into a runtime `Concept` carrying the concept id, a set of JSON-Schema variants (a `definition` variant for inserts and a `delete` variant for tombstones), the node type, and relationship metadata:

```go
type Concept struct {
    Name          string                     `json:"concept"`
    SchemaId      string                     `json:"schemaId"`
    Schemas       map[string]json.RawMessage `json:"schemas"`
    NodeType      string                     `json:"type"`
    Description   string                     `json:"description,omitempty"`
    Relationships []RelationshipDefinition   `json:"relationships,omitempty"`
    Version       string                     `json:"version,omitempty"`
    DisplayCard   *DisplayCard               `json:"displayCard,omitempty"`
    // ...
}
```
*Source: `component/database/memory-nodes/concept.go`*

### 2.2 Authoring syntax

A concept declaration is a `concept` block with annotations and a typed field list. Real example (lightly trimmed):

```memql
@version("1.0.0")
@namespace("cognition")
@description("Per-(spaceId, agentId) audio control override. ...")
concept audioOverride {
  spaceId  string  @required @description("v1:cognition:space.id this override is scoped to.")
  agentId  string  @required @description("v1:agents:agent.id this override targets.")
  setBy    string  @description("v1:identity:user.id of the actor who flipped the override ...")
  mode     enum("always_on", "always_off", "mirror_user")  @required @description("Effective publication state. ...")
  active   bool  @default("true") @description("Soft-revoke flag. ...")

  @relationship(type="parent", field="spaceId", target="v1:cognition:space", direction="outgoing")
  @relationship(type="interactsWith", field="agentId", target="v1:agents:agent", direction="outgoing")
}
```
*Source: `dsl/cognition/concepts.memql`*

Field types seen across the tree include `string`, `bool`, `int`, `float`, `datetime`, `enum(...)`, `[]string`, and `object`. Field annotations: `@required`, `@default("...")`, `@description("...")`, `enum(...)`. Concept-level annotations include `@version`, `@namespace`, `@description`, `@displayCard(...)`, and `@relationship(...)`.

### 2.3 How the concept id is assembled

A concept's id is `{version}:{domain}:{entity}` — exactly three colon-delimited segments. It is composed from the `@version` and `@namespace` annotations plus the entity name:

- `@version("MAJOR.MINOR.PATCH")` is strict semver, but **only the major segment** flows into the id prefix (`v<major>`); minor/patch document additive schema evolution within a major version.

```go
case "version":
    v, err := languageAst.ParseSemver(s)
    // ...
    c.version = fmt.Sprintf("v%d", v.Major)
```
*Source: `component/database/memory-nodes/concept_parser.go`*

- `@namespace("cognition")` (or a colon-separated nesting like `@namespace("cognition:text")`) supplies the domain segment(s).

So `@version("1.0.0") @namespace("cognition") concept audioOverride { ... }` is the concept `v1:cognition:audioOverride`. This mirrors the on-disk layout the concept-id constants document: `concepts/v1/{domain}/{entity}/`, segments joined with colons. Compile-time-safe constants for the common concepts live in `component/database/memory-nodes/concept_ids.go` (e.g. `ConceptCognitionUtterance = "v1:cognition:utterance"`, `ConceptClusterNode = "v1:cluster:node"`).

### 2.4 `@displayCard`: concept-agnostic rendering

A concept may declare `@displayCard(primary="name", secondary="role", tertiary="ownerUserId", status="active")`. This is a set of slot→field hints so concept-agnostic clients (the cockpit's Concepts browser, future generic UIs) can render any row without per-concept rendering code. The slots are `primary` (mandatory — the field that names the row), `secondary`, `tertiary`, and `status`; all but `primary` are optional. When absent, clients fall back to a generic id+intrinsics rendering. See the `DisplayCard` struct in `component/database/memory-nodes/concept.go`.

### 2.5 Relationships

`@relationship(type=..., field=..., target=..., direction=...)` declares a typed edge from a payload field to another concept. Outgoing relationships (`direction="outgoing"`) are foreign keys the row holds. The engine uses these at insert time to **canonicalize** foreign-key values: any outgoing-relationship field is normalized to the canonical id form of its target concept, so two callers storing the same logical reference under different shapes (`"user-abc"` vs the fully-qualified id) collapse to one stored string and `id==` queries match consistently.

```go
canon, err := e.canonicalizeIdValue(ctx, v, target)
if err != nil {
    return fmt.Errorf("canonicalize %s.%s: %w", conceptName, field, err)
}
if canon != v {
    payload[field] = canon
}
```
*Source: `component/memql/partition_context.go` (`canonicalizeRelationshipFields`)*

---

## 3. The node id format

### 3.1 Canonical shape

Every stored node has a fully-qualified id of the shape:

```
{concept}:{shortId}
```

| Full id | concept | shortId |
|---|---|---|
| `v1:cognition:utterance:474e57df-...` | `v1:cognition:utterance` | `474e57df-...` |
| `v1:cluster:node:bff-local` | `v1:cluster:node` | `bff-local` |
| `v1:agents:agent:a9f3b7c2...` | `v1:agents:agent` | `a9f3b7c2...` |

The **concept** is the three-segment `{version}:{domain}:{entity}` prefix. The **shortId** is the per-instance identifier — a UUID, a deterministic content hash, or a human-readable slug. There is no partition prefix.

> **Stale-doc flag.** `docs/core/identifiers.md` documents this format and notes in its "History" section: *"the format used to carry a leading `{partition}:` segment. That dimension was removed in #56 phase 6; every id is now a plain `{concept}:{shortId}`."* The project root `CLAUDE.md` (in some checkouts) still shows the older `{partition}:{concept}:{contentHash}` example — that is the pre-#56 form and does not match the code.

### 3.2 Compose / parse helpers

There is exactly one way to compose and one way to split an id, in `core/id`:

```go
// BuildNodeId assembles a node ID from its concept and short id.
// Returns: {concept}:{shortId}
func BuildNodeId(concept, shortId string) string {
    concept = strings.TrimSpace(concept)
    shortId = strings.TrimSpace(shortId)
    if concept == "" { return shortId }
    if shortId == "" { return concept }
    return concept + ":" + shortId
}
```
*Source: `core/id/partition.go`*

`ParseNodeId` is the inverse. Notably, it does not blindly split on `:` — it scans for the first **version segment** (`v` followed by digits) and treats the version plus the next two segments as the concept, with everything after as the shortId. This tolerates shortIds that themselves contain colons:

```go
func ParseNodeId(fullId string) (concept, shortId string, err error) {
    // ... scan parts for the first isVersionSegment ...
    conceptEnd := versionIdx + 3            // version:domain:entity
    concept = strings.Join(parts[versionIdx:conceptEnd], ":")
    if conceptEnd < len(parts) {
        shortId = strings.Join(parts[conceptEnd:], ":")
    }
    return concept, shortId, nil
}
```
*Source: `core/id/partition.go`*

If no version segment is found, the whole string is treated as a bare/opaque shortId.

### 3.3 Who composes the id, and when

There are two writer paths:

1. **The mutation runtime (default).** Most callers pass a *bare shortId* to `insert(...)`. The engine composes the full id at write time. `Concept.storageId` prepends the concept unless the value is already concept-qualified:

   ```go
   func (c *Concept) storageId(nodeId string) string {
       trimmed := strings.TrimSpace(nodeId)
       if trimmed == "" { return "" }
       if strings.HasPrefix(trimmed, c.Name+":") { return trimmed }   // already qualified
       return id.BuildNodeId(c.Name, trimmed)                          // bare slug -> qualify
   }
   ```
   *Source: `component/database/memory-nodes/concept.go`*

   If no id is supplied at all, `Create` derives a deterministic content-addressed id from the payload via `DeriveContentId` (`id.New().MustFromMap({concept, payload[, salt]})`), so structurally identical inserts collapse onto one id.

2. **The dispatch-site composer.** When an id must be known *before* the row is inserted — because other emitted nodes reference it earlier on the wire — the producer composes it up front with `id.BuildNodeId(concept, shortId)`. The canonical example is the streaming-reply flow: cognition mints a `replyId`, stamps it on every `text:chunk`, and finally inserts the `utterance` using that same id, so streaming chunks and the committed utterance address the same logical record (see `composeReplyId` in `integrations/cognition/cognition_handler.go`).

### 3.4 The shortId contract (and its guard rail)

`Concept.Create` rejects malformed ids via `validateShortId`. Exactly two shapes are legal: a **bare slug with no colons** (the engine qualifies it), or a value **already prefixed with this concept** (the dispatch-site form). Anything else — most commonly a colon-bearing compound built by gluing another row's canonical id into a shortId — fails loudly at insert time:

```go
func (c *Concept) validateShortId(nodeId string) error {
    trimmed := strings.TrimSpace(nodeId)
    if trimmed == "" { return nil }
    if !strings.ContainsRune(trimmed, ':') { return nil }          // bare slug -> ok
    if strings.HasPrefix(trimmed, c.Name+":") { return nil }       // concept-qualified -> ok
    return fmt.Errorf("shortId %q must be a bare slug/UUID (no colons) or the concept-prefixed form (%q); got something else",
        trimmed, c.Name+":<short>")
}
```
*Source: `component/database/memory-nodes/concept.go`*

**ShortId minting helpers** (in `core/id`):

| Need | Helper |
|---|---|
| Opaque per-instance id | `id.NewShortId()` |
| Deterministic id from a stable factor set (repeat calls collapse on the PK) | `id.New().MustFromMap(map[string]any{...})` |
| Kebab-case slug from a human name | `id.Slugify(name)` |
| Compose a full id at dispatch time | `id.BuildNodeId(concept, shortId)` |
| Split a full id | `id.ParseNodeId(id)` |

The shortId must be the bare unique part only — do **not** prefix it with the concept name, a kind discriminator, or another row's canonical id (these are documented anti-patterns in `docs/core/identifiers.md`, each backed by a real landed bug). Variant/kind information belongs in a payload field the consumer can filter on, not baked into the id.

---

## 4. Partitions

### 4.1 What a partition is — and where it lives now

A **partition** is memQL's data-isolation boundary (a tenant/workspace). Historically the partition was the leading segment of every node id and a column in the PK, and reads were auto-scoped to it. **Change set #56 removed partition from storage.** As of `main`:

- `MemoryNodes` has **no partition column**; the PK is `(id, createdAt)`.
- Node ids are `{concept}:{shortId}` with **no** partition prefix.
- Tenant isolation is enforced at the **DSL layer** via caller-scope checks on user-scoped reads and writes (the initial-setup migration comment points at `docs/auth/per-row-authz-audit.md` for the enforcement story).

Partition has **not** disappeared as a concept — it survives in these live surfaces:

1. **The gRPC request envelope** (`MemqlClientMessage.partition`) still carries a partition, and the engine still threads it onto the request context. But the storage layer no longer derives scoping from it:

   ```go
   // ContextWithPartition ... Carried on the wire by the gRPC envelope;
   // the engine no longer derives storage scoping from it. Kept on the
   // request ctx so legacy log fields keep populating until
   // envelope.partition is dropped in #56 phase 8.
   func ContextWithPartition(ctx context.Context, partition string) context.Context { ... }
   ```
   *Source: `component/memql/partition_context.go`*

2. **Event metadata** — the `events.Event` struct carries a `Partition` field (set via `WithPartition`), even though the event *topic* no longer includes a partition segment (§5).

3. **Log fields** — `resolvePartition` / `partitionForConcept` survive solely as event-topic and log-field producers; both comments state explicitly that storage scoping no longer uses them.

4. **Seed scoping** — see §4.3.

> **Stale-doc flag.** `docs/core/events.md` (last updated before #56) and parts of `CLAUDE.md` still describe partition-scoped vs `@scope("global")` *concepts*, a `_system` reserved partition for global rows, and a partition segment in event topics. On `main`, `@scope` on a **concept** is rejected at parse time (see §4.2), and event topics carry no partition segment (§5). The `_system` partition and `@scope` survive only for **seeds**, not concepts.

### 4.2 `@scope` on a concept is retired

The concept parser explicitly rejects `@scope`, with an error that documents the migration:

```go
case "scope":
    // `@scope` was retired in #56 (partition removal). Every concept
    // lives in one partition; the per-concept scope distinction is gone.
    return fmt.Errorf("`@scope` is retired -- remove the annotation; every concept lives in the default partition post-#56")
```
*Source: `component/database/memory-nodes/concept_parser.go`*

So a concept can no longer declare itself global vs partition-scoped. Note that the platform secret/variable concept *descriptions* in `dsl/platform/concepts.memql` still narrate "lives in the reserved `_system` partition (via `@scope("global")`)" — that prose is stale; the concepts themselves no longer carry the annotation.

### 4.3 Where `_system` and `@scope` still apply: seeds

Seeds (declarative bootstrap rows) keep a `@scope` annotation, and it is validated to be exactly `"global"` or `"perUser"`:

```go
return fmt.Errorf("@scope must be \"global\" or \"perUser\", got %q", val)
```
*Source: `component/memql/seed_parser.go`*

- `@scope("global")` seeds materialize **one** row, using the seed body's declared `id` field directly:

  ```go
  func (m *SeedMaterializer) materializeGlobal(ctx context.Context, def *SeedDefinition) error {
      idVal, ok := def.Body.fields["id"]
      if !ok || idVal.kind != seedString {
          return fmt.Errorf("global seed %q must declare a string `id` field", def.Name)
      }
      args := buildArgsFromBody(def.Body, def.UseConcept, idVal.str, "")
      ctx = provenance.ContextWithProvenance(ctx, provenance.Seed(def.Name))
      return m.invokeCreateMutation(ctx, def.UseConcept, args)
  }
  ```
  *Source: `component/memql/seed_materializer.go`*

- `@scope("perUser")` seeds materialize **one row per `v1:identity:user`**, deduping on `(concept, payload.ownerUserId, provenance.name)` and reusing the existing row's id on subsequent sweeps so re-runs append a new version of the same logical row rather than forking.

The string `_system` still appears in seed-related comments and in the `canonicalId`/`canonicalizeIdValue` documentation as the "global partition prefix." **In the current code path, `canonicalizeIdValue` does not emit a `_system:` prefix** — it produces the plain `{concept}:{shortId}` canonical form (bare slug → `BuildNodeId(concept, slug)`; already-qualified → as-is; wrong concept tag → error). The `_system:...` examples in those doc comments describe the pre-#56 behavior and are stale; the function body is the authority:

```go
// Bare slug (no colons): compose `concept:slug`.
if !strings.ContainsRune(value, ':') {
    return id.BuildNodeId(conceptType, value), nil
}
// Already concept-qualified.
if strings.HasPrefix(value, conceptType+":") {
    return value, nil
}
```
*Source: `component/memql/partition_context.go` (`canonicalizeIdValue`)*

### 4.4 Practical implication

For a senior engineer building on `main`: treat node storage as **single-partition / flat**. Ids are concept-addressed, not tenant-addressed. Multi-tenant isolation is a *policy/authz* concern enforced on reads and writes, not a storage-key concern. If you are reading older memQL material that describes partition-prefixed ids, `@scope("global")` concepts, or a `_system` storage partition, mentally translate it to the post-#56 model: flat storage, DSL-layer caller-scope checks, partition surviving only on the wire envelope, event metadata, logs, and seed scoping.

---

## 5. The event model

### 5.1 Every write emits a typed event

memQL is reactive: the same write path that inserts a node publishes a typed event to an in-process pub/sub bus. Automations, live gRPC/WebSocket subscriptions, and cross-node bridging are all consumers of this bus — there is no separate change-data-capture pipeline.

The mutation executor publishes a node-created event immediately after the insert:

```go
eventPayload := map[string]any{
    "id":        result.ID,
    "nodeId":    result.ID, // Alias for backward compatibility
    "concept":   conceptMeta.Name,
    "actor":     actor,
    "nodeType":  result.Type,
    "createdAt": result.CreatedAt.Format(time.RFC3339),
}
// payload fields are flattened into the event for direct filter access,
// and the full payload is also attached under "payload":
maps.Copy(eventPayload, payloadMap)
eventPayload["payload"] = payloadMap

e.publishEvent(
    events.BuildTopicWithConcept(events.TopicGraphNodeCreated, conceptMeta.Name),
    events.KindNodeCreated,
    eventPayload,
)
```
*Source: `component/memql/executor_mutation.go`*

Note the **field flattening**: each payload field is copied to the top level of the event payload *and* the full payload is preserved under `payload`. This lets automation/subscription filters write `participantType == "human"` directly instead of `payload.participantType == "human"`, while nested access still works.

### 5.2 Topic structure

Graph node events use a dot-delimited hierarchical topic with the **concept** as the trailing segment — **no partition segment**:

```
graph.node.created.{concept}
graph.node.updated.{concept}
graph.node.deleted.{concept}
```

The builders:

```go
const (
    TopicGraphNodeCreated = "graph.node.created"
    TopicGraphNodeUpdated = "graph.node.updated"
    TopicGraphNodeDeleted = "graph.node.deleted"
)

func BuildTopicWithConcept(baseTopic, concept string) string {
    concept = strings.TrimSpace(concept)
    if concept == "" { return baseTopic }
    return baseTopic + "." + concept
}

func TopicNodeCreated(conceptId string) string {
    return BuildTopicWithConcept(TopicGraphNodeCreated, conceptId)
}
```
*Source: `component/events/event.go`, `component/events/pattern.go`*

So creating a `v1:cognition:utterance` fires on `graph.node.created.v1:cognition:utterance`.

> **Stale-doc flag.** `docs/core/events.md` documents `graph.node.created.{partition}.{concept}` (e.g. `graph.node.created.acme.v1:cognition:participant`) and a `_system` partition segment for global concepts. The current code in `component/events/pattern.go` emits **no** partition segment — the topic is `graph.node.created.{concept}`. Partition rides as a separate field on the `Event` struct, not in the topic. (This is corroborated by the test fixtures, which use topics like `graph.node.created.v1:cognition:utterance` and `graph.node.created.v1:cluster:node`.)

### 5.3 The Event struct and event kinds

```go
type Event struct {
    Topic        string             // e.g. "graph.node.created.v1:cognition:utterance"
    Kind         Kind               // typed enum
    Timestamp    time.Time
    Payload      map[string]any
    Metadata     map[string]string  // e.g. actor
    OriginNodeId string             // set by the distributed bridge for peer-forwarded events
    Partition    string             // isolation boundary; carried here, NOT in the topic
}
```
*Source: `component/events/event.go`*

`Kind` is an enum covering far more than graph mutations — `KindNodeCreated`/`KindNodeUpdated`/`KindNodeDeleted`, plus query, SI completion, session, automation (+ step), MCP tool, cluster node lifecycle, spawn, and system startup/shutdown kinds (full list in `component/events/event.go`). Beyond graph events the bus also carries:

- `query.executed` (`KindQueryExecuted`) — emitted after a query completes, with `durationMs`, `resultCount`, `cached`.
- `ai.completion.{started,finished,error}` — SI request lifecycle.
- `session.{opened,closed}` — gRPC streaming session lifecycle.
- `automation.{started,completed,failed}` and `automation.step.{started,completed,failed}` — automation execution.
- `cluster.node.{registered,deregistered,health_changed}`, `cluster.spawn.{requested,completed,failed}`, `system.{startup,shutdown}`.

### 5.4 Topic matching: `*` and `#`

Subscribers select topics with glob patterns matched by `events.Match`:

- `*` matches **exactly one** segment.
- `#` matches **zero or more** segments.
- Intra-segment globbing is supported, so `v1:cognition:*` matches the concept `v1:cognition:utterance` within a single dot-segment.

| Pattern | Matches | Does not match |
|---|---|---|
| `graph.node.*` | `graph.node.created` | `graph.node.created.v1:cognition:space` |
| `graph.node.created.*` | `graph.node.created.v1:cognition:space` | `graph.node.created` |
| `graph.#` | all graph events | `si.completion.started` |
| `graph.node.created.v1:cognition:*` | `graph.node.created.v1:cognition:utterance` | `graph.node.created.v1:agents:agent` |
| `#` | everything | — |

*Source / contract: `component/events/pattern.go` (`Match`, `matchParts`)*

This is the matcher both automation triggers and live subscriptions use. An automation that should fire on every utterance insert subscribes to `graph.node.created.v1:cognition:utterance`; one that wants every cluster-node event of any kind uses `graph.node.*.v1:cluster:node`.

### 5.5 Bus mechanics

The event bus is a pure-Go in-memory pub/sub — no Redis, no NATS:

- Subscriber registry guarded by `sync.RWMutex`; on `Publish`, the bus snapshots the matching subscriptions and fans out **one goroutine per delivery** (`go b.deliverEvent(sub, event.Clone())`), so a slow consumer can't block the publisher or the other subscribers. There are **no per-subscriber channels** — delivery invokes the subscriber's `Handler` callback directly inside that goroutine.
- Each goroutine receives its own `event.Clone()`, preventing cross-subscriber mutation of the shared payload.
- Delivery is fire-and-forget: there is no bounded buffer and therefore **no drop-on-full path** — every matching subscriber's handler is always invoked. (`PublishSync` is the same fan-out but waits on a `sync.WaitGroup` for all handlers to return; used in tests and where delivery order matters.)
- Handler panics are recovered and logged (`deliverEvent` wraps the callback in a `recover()`), so one panicking subscriber never takes down the publisher or its peers.
- Subscriptions are cleaned up automatically when a session ends (the unsubscribe closure returned by `Subscribe`).

This is distinct from the **component bus** (`component/bus/channel.go`), a separate channel-based mechanism for inter-component request/response traffic. That bus *does* use buffered channels with a non-blocking `default:` send that drops on a full channel and fires an `OnDrop` hook — but it is not the event bus described here.

In cluster mode, the distributed `EventBridge` forwards events between nodes and stamps `OriginNodeId` so locally-published vs peer-forwarded events are distinguishable (`Event.IsRemote()`), with dedup and TTL to prevent loops.

### 5.6 Subscribing over the wire

Browser and service clients subscribe via a `SubscribeMsg` on the bidirectional gRPC stream (tunneled over WebSocket for browsers). The relevant subscription kinds and their default topic patterns:

| `SubscriptionKind` | Value | Default pattern |
|---|---|---|
| `SUBSCRIPTION_KIND_GRAPH_EVENTS` | 500 | `graph.#` |
| `SUBSCRIPTION_KIND_AUTOMATION_EVENTS` | 600 | `automation.#` |
| `SUBSCRIPTION_KIND_QUERY_SPEC` | 300 | `query.#` |
| `SUBSCRIPTION_KIND_AI_STREAM` | 400 | `ai.#` |
| `SUBSCRIPTION_KIND_ALL` | 700 | `#` |

A `filter` string refines the default pattern. Delivered events arrive as `EventNotification` messages carrying the matching `EventKind`, a timestamp, and the event payload. (The wire-level enum values and message shapes are documented in `docs/core/events.md`; note that document's *topic examples* predate #56, but the subscription-kind and matching semantics still hold.)

---

## 6. Putting it together: the lifecycle of a write

1. A mutation runs (`insert`), supplying a bare shortId (or none) and a payload of concept-defined fields.
2. The engine strips reserved intrinsics from the payload, canonicalizes any outgoing-relationship foreign keys, and validates the payload against the concept's `definition` JSON-Schema variant.
3. It composes the canonical id (`{concept}:{shortId}` — qualifying a bare slug, or deriving a content id if none was supplied), validates the shortId shape, stamps `createdBy` from the actor, `createdAt` from the clock, and `provenance` from the request context.
4. It inserts the row into `MemoryNodes` with `ON CONFLICT (id, "createdAt") DO NOTHING`. The row is a new *version*; prior versions of the same id remain.
5. It publishes `graph.node.created.{concept}` to the event bus, with payload fields flattened for direct filter access.
6. Automations whose trigger pattern matches fire; live subscribers receive an `EventNotification`; in cluster mode the bridge forwards the event to peer nodes.
7. A subsequent read of that id returns the just-written version because it has the maximum `createdAt`. A delete appends a tombstone version; an undelete appends a normal version on top of it.

That single, uniform write path — append-only row + typed event — is the foundation every higher-level memQL construct (queries, specs, shapes, automations, tools, policies) is built on.

---

## Appendix: source map

| Topic | Authoritative source |
|---|---|
| Row model + secret table | `component/database/memory-nodes/models.go` |
| Table DDL + hypertable + indexes | `component/database/memory-nodes/migrations/20260324000000_initial_setup.up.sql` |
| Provenance column migration | `component/database/memory-nodes/migrations/20260516000000_provenance_intrinsic.up.sql` |
| Create / Delete / Query / storageId / validateShortId | `component/database/memory-nodes/concept.go` |
| Insert (ON CONFLICT), latest-version reads | `component/database/memory-nodes/repository.go` |
| Reserved intrinsics | `component/database/memory-nodes/constants.go` |
| Concept-id constants | `component/database/memory-nodes/concept_ids.go` |
| Concept parsing (`@version`, `@scope` retirement, `@displayCard`) | `component/database/memory-nodes/concept_parser.go` |
| Id compose / parse | `core/id/partition.go` |
| ShortId / deterministic / slug helpers | `core/id/short.go`, `core/id/id.go`, `core/id/slug.go` |
| Partition context, `canonicalizeIdValue`, relationship canon | `component/memql/partition_context.go` |
| Mutation event emission | `component/memql/executor_mutation.go` |
| Event struct, kinds, topic constants | `component/events/event.go` |
| Topic matching + builders | `component/events/pattern.go` |
| Seed scope (`global`/`perUser`), materialization | `component/memql/seed_parser.go`, `component/memql/seed_materializer.go` |
| Provenance shape + constructors | `component/provenance/provenance.go` |
| Id conventions (note: pre-#56 history section) | `docs/core/identifiers.md` |
| Event system (note: pre-#56 topic examples) | `docs/core/events.md` |
