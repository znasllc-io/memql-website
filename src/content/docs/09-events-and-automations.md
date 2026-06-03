# memQL — Events & Automations

memQL is a reactive database. Every write to the graph fans out as an in-process event, and a declarative automation layer subscribes to those events (or to a cron schedule) and runs side-effecting work in response. This is the machinery behind features like "when a space is created, auto-join the owner's assistant," "every night at 02:00 UTC, hard-delete archived spaces past their retention window," and "when the second human joins a space, migrate voice to the group thread." This document covers the event bus, how automations subscribe via `@trigger`, the logic-runner that executes their bodies, scheduled (cron) automations and the cluster-wide leader that keeps them firing once, and the cross-replica guard that makes event-triggered automations exactly-once. It closes with worked examples copied from the live DSL tree.

---

## 1. The event bus

The event bus is a pure-Go, in-memory pub/sub implementation. There is no Redis, NATS, or external broker — all routing happens inside the memQL process.

Key properties (from `docs/core/events.md` and `component/events/`):

- **Thread-safe** — a `sync.RWMutex` guards the subscriber registry.
- **Non-blocking fan-out** — `Publish` spawns a fresh goroutine per matching subscriber (`go b.deliverEvent(sub, event.Clone())`); there are no per-subscriber channels, so the publisher never blocks on a slow handler.
- **Panic recovery** — a handler panic is caught and logged, not propagated.
- **Glob pattern routing** — subscriptions match topics with `*` and `#` wildcards.
- **Per-delivery event clone** — each subscriber's goroutine gets its own `event.Clone()`, so concurrent handlers never share the same payload map.
- **Auto-cleanup** — subscriptions are torn down when a gRPC session ends, and on bus shutdown.

### Topics

Events are hierarchical dot-delimited strings. The base topics for graph mutations are defined in `component/events/event.go`:

```go
TopicGraphNodeCreated = "graph.node.created"
TopicGraphNodeDeleted = "graph.node.deleted"
TopicGraphNodeUpdated = "graph.node.updated"
```

When the engine writes a row it appends the concept id to the base topic. The actual publish site, in `component/memql/executor_mutation.go`, builds the topic with `BuildTopicWithConcept`:

```go
e.publishEvent(
    events.BuildTopicWithConcept(events.TopicGraphNodeCreated, conceptMeta.Name),
    events.KindNodeCreated,
    eventPayload,
)
```

`BuildTopicWithConcept` (in `component/events/pattern.go`) simply concatenates:

```go
// BuildTopicWithConcept creates a topic string with an optional concept suffix.
// Format: baseTopic.{concept}
// Example: "graph.node.created.v1:cognition:participant"
func BuildTopicWithConcept(baseTopic, concept string) string {
    concept = strings.TrimSpace(concept)
    if concept == "" {
        return baseTopic
    }
    return baseTopic + "." + concept
}
```

So a row of concept `v1:cognition:space` created in any partition fires the topic:

```
graph.node.created.v1:cognition:space
```

> **Partition segment — important discrepancy.** `docs/core/events.md` documents the topic form as `graph.node.created.{partition}.{concept}` and shows examples like `graph.node.created.acme.v1:cognition:participant`. **On the current `main` snapshot the emitted topic does NOT contain a partition segment** — `BuildTopicWithConcept` produces `graph.node.{action}.{concept}` only. The partition is carried *inside the event payload* as the `partition` field, not in the topic string. Trigger patterns in the live DSL accept a `partition="*"` argument (see §3), but `ast.BuildTriggerTopic` ignores it when assembling the subscription pattern — only `event` and `concept` contribute to the topic. Treat the partition-in-topic form in `events.md` as aspirational/stale documentation for this build, not as the wire reality. [VERIFY: whether a future build reintroduces the partition segment — the docstrings reference it but no code path emits it here.]

### Node-event payload

The payload carried on a graph node event is assembled in `executor_mutation.go`. It contains the row intrinsics plus the **flattened** node payload (so filter expressions can reach `payload.X` fields directly), and a nested `payload` key holding the full object:

```go
eventPayload := map[string]any{
    "id":        result.ID,
    "nodeId":    result.ID, // alias for backward compatibility
    "concept":   conceptMeta.Name,
    "actor":     actor,
    "nodeType":  result.Type,
    "createdAt": result.CreatedAt.Format(time.RFC3339),
}
// flatten payload fields for direct filter access
maps.Copy(eventPayload, payloadMap)
// keep full payload for nested access
eventPayload["payload"] = payloadMap
```

The documented JSON shape (from `events.md`):

```json
{
  "partition": "acme",
  "nodeId": "acme:v1:common:agent:abc123",
  "concept": "v1:common:agent",
  "actor": "user@example.com",
  "nodeType": "object",
  "createdAt": "2026-03-24T10:30:00Z"
}
```

### Updates also fire on the update path

A partial `update { ... }` mutation publishes `graph.node.updated` so subscribers that gate on a status flip don't have to also watch the create topic. From `executor_mutation.go`:

> Most subscribers historically only watched `graph.node.created`, which forced them to gate via a status field. Solution: also publish `graph.node.updated` on the `update()` path.

### Other event families

Beyond graph events, the bus carries query, SI, session, and automation lifecycle events (all from `events.md`):

| Family | Topics |
|--------|--------|
| Query | `query.executed` |
| SI completion | `si.completion.started`, `si.completion.finished`, `si.completion.error` |
| Session | `session.opened`, `session.closed` |
| Automation lifecycle | `automation.started`, `automation.completed`, `automation.failed`, `automation.step.started`, `automation.step.completed`, `automation.step.failed` |

Automations themselves emit custom topics via `publishEvent` inside their bodies — e.g. `si.auto-joined`, `session.created` (see §6).

### Global-scoped concepts and `_system`

Concepts annotated `@scope("global")` (cluster topology, the partition registry, identity) store rows in the reserved `_system` partition regardless of the request envelope. Their payloads carry `partition: "_system"`. Subscribers using a wildcard on the partition position match them transparently. The underscore prefix on `_system` is reserved and cannot be a user-chosen partition name.

### Pattern matching

The matcher in `component/events/pattern.go` supports two wildcards:

- `*` — matches **exactly one** segment.
- `#` — matches **zero or more** segments.

| Pattern | Matches | Doesn't match |
|---------|---------|---------------|
| `graph.node.*` | `graph.node.created`, `graph.node.deleted` | `graph.node.created.Skills` |
| `graph.node.created.*` | `graph.node.created.Skills` | `graph.node.created` |
| `graph.#` | all graph events | `si.completion.started` |
| `graph.node.created.v1:cognition:*` | `graph.node.created.v1:cognition:utterance` | — |

### Subscribing over the wire

External clients subscribe via a `SubscribeMsg` on the gRPC bidirectional stream (or the WebSocket bridge). The `SubscriptionKind` enum picks a default topic prefix, and the `filter` field refines it:

| Kind | Value | Default pattern |
|------|-------|-----------------|
| `SUBSCRIPTION_KIND_TELEMETRY` | 100 | `telemetry.#` |
| `SUBSCRIPTION_KIND_MESSAGE` | 200 | `message.#` |
| `SUBSCRIPTION_KIND_QUERY_SPEC` | 300 | `query.#` |
| `SUBSCRIPTION_KIND_AI_STREAM` | 400 | `ai.#` |
| `SUBSCRIPTION_KIND_GRAPH_EVENTS` | 500 | `graph.#` |
| `SUBSCRIPTION_KIND_DOMAIN_EVENTS` | 550 | `filter` used directly (no prefix) |
| `SUBSCRIPTION_KIND_AUTOMATION_EVENTS` | 600 | `automation.#` |
| `SUBSCRIPTION_KIND_ALL` | 700 | `#` |

Events are delivered back as `EventNotification` messages keyed by `subscription_id`, with an `EventKind` enum and a `Struct` payload. See `docs/core/events.md` for the full proto and JavaScript examples.

---

## 2. Anatomy of an automation

An automation is a DSL construct that binds a **trigger** (an event pattern or a cron schedule) to a **body of steps**. In the current `main` layout, all automations for a domain live in one file, `dsl/<domain>/automations.memql`, and their executable bodies live in the companion `dsl/<domain>/logic.memql`.

The smallest possible automation is a trigger plus one step that delegates to a named logic function:

```memql
use cognition.logic.{ logicAutoJoinSI, logicBootstrapSession, ... }

@enabled
@trigger(event="node.created", concept="v1:cognition:space", partition="*")
@filter(payload.active==true)
@description("On space creation, joins the creator's assistant ...")
automation autoJoinSI {
  step run {
    logic autoJoinSI { event: event }
  }
}
```
*Source: `dsl/cognition/automations.memql`*

The annotations:

- `@enabled` — the automation is loaded and registered at startup. Disabled automations are skipped by the scheduler (`if !automation.IsEnabled() { continue }`).
- `@trigger(...)` — what fires it (§3).
- `@filter(...)` — an optional boolean predicate evaluated against the event before the body runs (§4).
- `@description("...")` — human-readable documentation.

The body is a sequence of named `step` blocks. The `logic NAME { ... }` step is the dominant pattern: it invokes a multi-step **logic function** declared in `logic.memql`, passing the triggering event in as an argument. The bare identifier `event` resolves to the event envelope (see §5).

---

## 3. Triggers

### Event triggers — structured form

The canonical trigger form names an event action and a concept:

```memql
@trigger(event="node.created", concept="v1:cognition:participant", partition="*")
```

The loader (`component/automations/loader.go`) recognizes the structured form when the `event=` value is **not** already a fully-qualified `graph.*` topic and a `concept=` field is present. It validates that the concept is a fully-qualified id (`strings.Contains(conceptId, ":")`), then calls `ast.BuildTriggerTopic` to assemble the subscription pattern and **deletes** the now-consumed `concept` and `partition` args:

```go
topic, err := ast.BuildTriggerTopic(eventStr, conceptId)
...
delete(attr.Args, "concept")
delete(attr.Args, "partition")
autoBody.Trigger.Event = topic
```

`BuildTriggerTopic` (`component/language/ast/trigger.go`) produces `graph.{event-action}.{concept}`:

```go
func BuildTriggerTopic(eventKind, conceptId string) (string, error) {
    ...
    topic := "graph." + eventKind
    if conceptId != "" {
        topic += "." + conceptId
    }
    return topic, nil
}
```

So `event="node.created", concept="v1:cognition:participant"` compiles to the subscription pattern:

```
graph.node.created.v1:cognition:participant
```

This matches the topic the engine emits on insert. The `partition="*"` argument is accepted and discarded — because the emitted topic carries no partition segment (see §1), an automation matches writes in **every** partition. Per-partition gating, when needed, is done inside the body or via `@filter`, not the trigger.

The allowed event actions are validated by `EventKindAllowed`; the standard set is `node.created`, `node.updated`, `node.deleted`.

### Event triggers — raw topic form

A trigger can also subscribe to an arbitrary topic directly, with no concept resolution:

```memql
@trigger(event="cognition.response.requested")
```
*Source: `dsl/cognition/automations.memql` — the `generateResponse` automation*

This subscribes to a custom topic that another component (here, the cognition Go integration) publishes via `publishEvent`. Any `graph.*` topic or custom topic works; glob wildcards (`*`, `#`) are valid in the pattern.

### Schedule (cron) triggers

A scheduled automation carries a `schedule=` argument instead of `event=`:

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
*Source: `dsl/cognition/automations.memql`*

The schedule is a **six-field cron expression with seconds support** — the scheduler builds its cron with `cron.New(cron.WithSeconds())` (using `robfig/cron/v3`). The fields are: `second minute hour day-of-month month day-of-week`. Examples found across the DSL tree:

| Expression | Meaning | Automation |
|------------|---------|------------|
| `0 0 2 * * *` | daily 02:00:00 UTC | `purgeExpiredArchivedSpaces` |
| `0 30 2 * * *` | daily 02:30 UTC | `purgeExpiredPolicyTraces`, knowledge/worker sweeps |
| `0 35 2 * * *`, `0 40 2 * * *`, `0 45 2 * * *` | staggered nightly | safety / harness sweeps |
| `0 0 * * * *` | hourly at minute 0 | `rolloverDailySpace` |
| `0 */5 * * * *` | every 5 minutes | `expireDelegations` (identity) |

Staggering the nightly sweeps by 5-minute offsets (02:30, 02:35, 02:40, 02:45) is a deliberate convention so the crons don't contend on the same DB window.

---

## 4. The `@filter` predicate

`@filter` is an optional boolean expression evaluated **before** the body runs. It is checked inside the event subscription callback, in `Scheduler.subscribeToEventTrigger`:

```go
if a.Trigger.Filter != "" {
    evaluator := NewEvaluator()
    eventMap := map[string]any{
        "topic":   event.Topic,
        "kind":    event.Kind.String(),
        "payload": event.Payload,
    }
    evaluator.SetCustom("event", eventMap)
    ...
    shouldRun, err := evaluator.EvaluateCondition(a.Trigger.Filter)
    if err != nil { /* log + return, don't run */ }
    if !shouldRun { /* log + return */ }
}
```
*Source: `component/automations/scheduler.go`*

The filter references the flattened event payload. Two examples from the DSL:

```memql
@filter(payload.active==true)          // autoJoinSI: only act on active spaces
@filter(payload.activeSpaceId!="")     // voiceMigrationOnSecondHuman: only users with a set pointer
```

**Filters do not traverse nested paths reliably.** The `provisionDailySpaceOnUserCreate` automation documents this explicitly — the `dailySpaceEnabled` opt-out lives at `payload.preferences.dailySpaceEnabled`, a nested path, so the check is done inside the Go capability rather than in `@filter`:

> dailySpaceEnabled OPT-OUT: Honored inside the Go capability rather than the @filter, since the preference is nested at payload.preferences.dailySpaceEnabled and the filter parser doesn't traverse nested paths reliably.

Filter evaluation failures are logged and treated as "do not run" — the automation does not fire on a malformed or erroring filter.

The loader also warns (at load time) when a `@filter` contains a `concept==` check that contradicts or is redundant with the concept already baked into the trigger topic (`loader.go` — `extractConceptFromTopic` / `extractConceptFromFilter`).

---

## 5. The logic-runner: how a body executes

The `logic NAME { event: event }` step calls a **logic function** — a multi-step DSL function declared in `dsl/<domain>/logic.memql`. The shape of a logic function:

```memql
logic logicBootstrapSession {
  args {
    event object @required
  }
  body {
    checkExistingSession := queryParticipantSession({ participantId: args.event.payload.id })
    createSession := if checkExistingSession.Empty() {
      mutationCreateSessionForParticipant({ participantId: args.event.payload.id, spaceId: args.event.payload.spaceId })
    }
    emitSessionCreated := if checkExistingSession.Empty() {
      publishEvent({ topic: "session.created", payload: { ... } })
    }
    return coalesce(createSession, checkExistingSession.First())
  }
}
```
*Source: `dsl/cognition/logic.memql`*

The body is a sequence of `name := <call>` assignment steps plus a `return`. Each step is a query, mutation, builtin, `publishEvent`, or a conditional (`if <cond> { <call> }`). Later steps reference earlier steps' results by bare identifier (e.g. `checkExistingSession.Empty()`, `getGA.First().id`).

### Dispatch path

When the engine encounters a top-level call to a function whose kind is `logic`, it hoists it to `plan.LogicCall` and dispatches through `executeLogicFunctionCall` (`component/memql/engine.go`), which delegates to the wired `LogicRunner`. The runner is wired at app bootstrap:

```go
a.engine.SetLogicRunner(automations.NewLogicRunner(a.engine, a.stepRegistry, a.Logger))
```
*Source: `app/engine.go`*

If no runner is wired (a stripped binary that omits the `automations` package), the engine surfaces an actionable error and the single-step logic dispatch path stays unchanged.

### What `RunLogic` does

`LogicRunner.RunLogic` (`component/automations/logic_runner.go`) compiles the logic body into an internal `*AutomationDef`, builds an evaluator with the caller's args, then walks the steps in dependency order:

```go
// Walk intermediate steps in order. The compiler already
// topologically sorts them by dependency, so a forward pass
// guarantees a step's references are bound before we hit it.
```

The runner deliberately **bypasses the heavy automation machinery**. Per its own docstring:

> A Logic call should not fire automation lifecycle events, burn a concurrency slot, persist an execution row, or participate in storm detection / dedup. Those are properties of automations, not of the function-call dispatch path.

It reuses the same `StepRegistry` the automation scheduler uses (so query / mutation / builtin / forEach / parallel / switch steps get the same integration plug-ins, SI providers, and caching), and it wires the engine's event bus into the step context so `publishEvent` steps inside a logic body can publish. Wiring the bus matters: without it, an `emit` step fails with "event bus not configured," and because the compiler topologically orders independent steps arbitrarily, that failure could land **before** a load-bearing mutation step, so the side effect would never run at all (memql#572).

### The event envelope

When an automation fires, the executor (`component/automations/executor.go`) builds an event envelope and exposes it to the body under two names that share the same backing map:

```go
eventEnvelope := buildEventEnvelope(triggeringEvent, triggeredBy, trigger)
evaluator.SetCustom("event", eventEnvelope)
evaluator.SetCustom("ctx", map[string]any{
    "input":  eventEnvelope,
    "output": nil,
    "error":  "",
})
```

So inside a body you reach event data via `event.payload.X` (legacy) or `ctx.input.payload.X` (canonical going forward). When the body is delegated to a logic function via `logic NAME { event: event }`, the event lands as `args.event`, so the logic body reads `args.event.payload.id`, `args.event.payload.ownerUserId`, etc. — exactly the form seen in `logicAutoJoinSI`.

The executor also stamps a **system actor** and **provenance** onto the context before running, so the body's mutations are authenticated as the automation itself (e.g. `system:automation:autoJoinSI`) and every row it writes records which automation+trigger produced it:

```go
ctx = contextWithSystemActor(ctx, automation.Name)
ctx = provenance.ContextWithProvenance(ctx, provenance.Automation(automation.Name, trigger))
```

The `trigger` recorded is the firing event's topic, or `"cron"`/`"manual"` when there is no event.

---

## 6. Idempotency, dedup, storms, and the cluster

Automations run side effects, so memQL invests heavily in not running them twice. There are four overlapping layers, two per-process and two cluster-wide.

### Two executors with different policies

The scheduler builds **two** executors (`component/automations/scheduler.go`):

- **`eventExecutor`** — used for event-triggered firings. Dedup **enabled** (idempotency), cluster guard attached, concurrency limited to **10** concurrent executions.
- **`scheduleExecutor`** — used for cron and manual firings. Dedup **disabled** (a scheduled run with the same config should always execute), concurrency limited to **5**.

Concurrency is enforced by a semaphore so an event storm can't exhaust the DB connection pool.

### Per-process dedup (event-triggered only)

Each event-triggered firing computes an `InitialChainHead` — a deterministic fingerprint of the triggering event (`ComputeInitialChainHead` in the executor; fingerprinting logic in `component/automations/fingerprint.go`). Before running, the executor checks an in-memory dedup table keyed by `(automationName, initialChainHead)`:

```go
if e.dedupEnabled && e.dedup != nil && e.dedup.isDuplicate(automation.Name, exec.InitialChainHead) {
    // skip: this event already produced an execution within the TTL window
}
```

The dedup table (`component/automations/dedup.go`) has a TTL (default **10 minutes**) and a background cleanup loop running at half-TTL intervals. This collapses duplicate deliveries of the same event **within one process**.

### Storm detection

A rolling execution tracker counts firings per automation per 1-minute window. Above **20 executions/minute** for one automation, the executor logs `automation storm detected` at WARN. This is observability only — it does not throttle (the concurrency semaphore does the back-pressure):

```go
if executionCount > 20 && e.logger != nil {
    e.logger.Warn("automation storm detected", ..., "window", "1m")
}
```
*Source: `component/automations/executor.go`*

### Cross-replica exactly-once for events: the cluster guard

The per-process dedup is per-process. When a node-type runs ≥2 replicas, the same event can reach more than one replica. The `ClusterExecutionGuard` (`component/automations/cluster_guard.go`) makes event-triggered automations exactly-once across replicas by claiming each `(automation, dedupKey)` in Postgres, where `dedupKey` is the `InitialChainHead`:

```go
res, err := db.DB.ExecContext(ctx,
    `INSERT INTO automation_execution_claims (automation_name, dedup_key, claimed_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (automation_name, dedup_key) DO NOTHING`,
    automationName, dedupKey, g.nodeId)
...
n, _ := res.RowsAffected()
if n == 0 {
    // another replica already owns this -> prevented duplicate
    g.prevented.Add(1)
    return false
}
return true
```

The primary key on `(automation_name, dedup_key)` lets exactly one replica win the insert; the others get `RowsAffected == 0` and skip. The guard is:

- **Fail-open** — if the DB is unreachable or the claim errors, the node executes *unguarded* (better to risk a double-fire than drop legitimate work), logging + counting the event so the window is never silent.
- **Observable** — every prevented duplicate is WARN-logged and counted (`DuplicatesPrevented`); a periodic summary logs running counts of claimed / prevented / errors. A rising prevented count proves multi-replica delivery is live and being correctly collapsed.
- **Self-pruning** — a background loop deletes claim rows older than the retention window (default **1 hour**) every 10 minutes, so the table stays small.

The guard is wired in `app/engine.go` and passed to the scheduler as `ClusterGuard`. The executor calls it after the per-process dedup check:

```go
if e.clusterGuard != nil && exec.InitialChainHead != "" {
    if !e.clusterGuard.Claim(ctx, automation.Name, exec.InitialChainHead) {
        // prevented cross-replica duplicate
    }
}
```

### Cron leader: one cluster-wide owner of scheduled automations

Cron firings are different. Every memQL node runs the scheduler, so a cron entry fires independently on **each** node — meaning the nightly purges and the `*/5min` sweeps would run once per node-type, and once per replica as node-types scale. Event-triggered automations are unaffected (the mesh routes each event to one pod), so only the schedule path needs gating.

The `CronLeader` (`component/automations/cron_leader.go`) elects a single cluster-wide owner using a **Postgres session-level advisory lock**:

```go
cronLeaderLockKey int64 = 7756010113207010561  // arbitrary fixed advisory-lock id

// each node holds one dedicated DB connection and calls:
conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", cronLeaderLockKey).Scan(&acquired)
```

Mechanics:

- Each node holds one dedicated DB connection and polls every **10 seconds**.
- Exactly one node acquires the lock and becomes leader; the rest are non-leaders.
- The lock is **session-scoped** — if the leader pod dies, its connection drops and Postgres releases the lock automatically, so another node's next poll takes over (automatic failover).
- On clean shutdown the leader does a best-effort `pg_advisory_unlock` so a co-located node takes over faster.
- **Fail-closed** — when no DB is reachable the node is simply not leader. Better to skip a maintenance cron than double-run a non-idempotent one.

The scheduler gates each cron firing through `scheduleLeaderOK`:

```go
func (s *Scheduler) scheduleLeaderOK() bool {
    return s.leaderGate == nil || s.leaderGate()
}
```

A `nil` gate means ungated — the single-node / dev default, where every node runs crons. In a cluster the gate is `CronLeader.IsLeader`, wired in `app/engine.go`:

```go
LeaderGate: cronLeader.IsLeader,
```

Inside `scheduleAutomation`, the cron callback checks the gate and bails early if this node isn't the leader:

```go
entryId, err := s.cron.AddFunc(automation.Schedule, func() {
    if !s.scheduleLeaderOK() {
        s.logDebug("skipping scheduled automation -- not the cron leader", ...)
        return
    }
    s.executeAutomation(a, "schedule", nil)
})
```

The cron leader is started as a dependency **before** the scheduler, so the lock is already held by the time the first cron can fire.

### Summary of the four layers

| Layer | Scope | Applies to | Mechanism |
|-------|-------|-----------|-----------|
| In-memory dedup | Per-process | Event-triggered | `(automation, chainHead)` table, 10-min TTL |
| Storm detection | Per-process | All | WARN log at >20 exec/min (observability only) |
| Cluster guard | Cross-replica | Event-triggered | Postgres `automation_execution_claims` PK + `ON CONFLICT DO NOTHING`, fail-open |
| Cron leader | Cluster-wide | Scheduled | `pg_try_advisory_lock`, fail-closed, auto-failover |

DSL bodies add a fifth layer: **content-addressed ids**. Many mutations derive a deterministic row id from their semantic inputs so a re-fire collapses via the engine's `ON CONFLICT` insert path. `voiceMigrationOnSecondHuman` documents this — its public canvas-state id is content-addressed on `(space, "voice-migrated")` and the per-user cards on `(space, "voice-migrated", userId)`, so re-firing lands the same id and is a no-op.

---

## 7. Other ways automations get triggered

The scheduler exposes several manual / programmatic trigger paths (`component/automations/scheduler.go`), useful for HTTP handlers and parent→child automation composition:

- `TriggerAutomation(ctx, name)` — manual fire by name, uses `scheduleExecutor` (no dedup).
- `TriggerAutomationWithEvent(ctx, name, event)` — fire an event-triggered automation with a synthetic event, identical in shape to a real bus event; uses `eventExecutor` (with dedup). Used to let HTTP endpoints invoke event automations like `bootstrapUser`.
- `TriggerAutomationWithArgs(ctx, name, args)` — fire a sub-automation with a synthetic event whose payload is the supplied args, topic-prefixed `automation.invocation.<name>` so observers can distinguish procedural calls from real bus events. This backs the automation-within-automation step kind (`step welcome { automation seedX { ... } }`).
- `ResumeAutomation(ctx, executionId, fromStep)` — load a persisted checkpoint and resume a failed automation from a given step (see `component/automations/checkpoint.go` and `resume.go`).

---

## 8. Worked examples

### autoJoinSI — react to a graph create

The flagship event automation. When a space is created with `active==true`, the owner's currently-active assistant is auto-joined as a participant.

```memql
@enabled
@trigger(event="node.created", concept="v1:cognition:space", partition="*")
@filter(payload.active==true)
@description("On space creation, joins the creator's assistant ... Joiners' GAs are never auto-joined.")
automation autoJoinSI {
  step run {
    logic autoJoinSI { event: event }
  }
}
```
*Source: `dsl/cognition/automations.memql`*

The body (`dsl/cognition/logic.memql`, `logicAutoJoinSI`) resolves the owner's active assistant — honoring `User.preferences.activeAssistantId` with a fallback to the legacy role-keyed query — checks for an existing participant (idempotency), inserts the participant if missing, and emits an observability event:

```memql
getUser := queryUserById({ userId: args.event.payload.ownerUserId })
activeAssistantId := coalesce(getUser.First().payload.preferences.activeAssistantId, "")

getActiveGA := if activeAssistantId != "" {
  queryAgentById({ agentId: activeAssistantId })
}
getFallbackGA := if activeAssistantId == "" {
  queryAssistantAgentForUser({ ownerUserId: args.event.payload.ownerUserId })
}
getGA := coalesce(getActiveGA, getFallbackGA)

checkExistingGA := if !getGA.Empty() {
  queryParticipantByAgentSpace({ spaceId: args.event.payload.id, agentId: coalesce(getGA.First().id, "") })
}

insertGA := if !getGA.Empty() && checkExistingGA.Empty() {
  mutationJoinSpaceAsSI({
    spaceId: args.event.payload.id,
    agentId: coalesce(getGA.First().id, ""),
    displayName: coalesce(getGA.First().payload.name, "Assistant"),
    forUserId: args.event.payload.ownerUserId,
    isGroupGA: true
  })
}

emitAutoJoinComplete := publishEvent({
  topic: "si.auto-joined",
  payload: { spaceId: args.event.payload.id, ownerUserId: args.event.payload.ownerUserId, timestamp: timestamp() }
})
return emitAutoJoinComplete
```

Note the three idempotency mechanisms stacked here: the executor's per-process dedup, the `checkExistingGA.Empty()` guard inside the body, and the content-addressed participant id written by `mutationJoinSpaceAsSI` (so even if the existence check misses, the engine's `ON CONFLICT` collapses the duplicate). The body's docstring is explicit that the participant id must be derived from the resolved agent id — deriving it from a per-caller hash (an earlier bug, memql#273) produced a different id per fire and defeated dedup entirely.

The expression evaluator that runs these bodies was refactored against a **conformance matrix** (#593), which nailed down two behaviors visible above: within a `coalesce(...)` argument, a **method call resolves before field access** (so `getGA.First().payload.name` evaluates the `First()` leaf, then the field), and a logic block has a **single logic-time leaf entry** — the evaluation order of the `:=` bindings is well-defined rather than incidental. Bodies that relied on the older, looser ordering should re-verify against the matrix.

### bootstrapSession — chained reaction

`autoJoinSI` creates a `v1:cognition:participant`, which fires `graph.node.created.v1:cognition:participant`, which triggers `bootstrapSession`, which creates a session. This is an event chain — one automation's write is another's trigger:

```memql
@enabled
@trigger(event="node.created", concept="v1:cognition:participant", partition="*")
@description("Auto-creates a session when a participant joins a space")
automation bootstrapSession {
  step run {
    logic bootstrapSession { event: event }
  }
}
```
*Source: `dsl/cognition/automations.memql`*

### purgeExpiredArchivedSpaces — a nightly cron

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
*Source: `dsl/cognition/automations.memql`*

The deadline (`payload.expiresAt`) is pre-computed at archive time (the frontend stamps `archivedAt + retentionDays`), so the body's query is a plain `expiresAt < now` comparison and the cron loop just calls `deleteSpaceNow` per row. The automation's own comment spells out its defensive triple-guard: it only acts on rows where `status == "archived"` **and** `active == true` **and** `expiresAt < now`. Cadence is intentionally loose (daily) because retention is measured in days — missing the boundary by a few hours is caught on the next run.

### rolloverDailySpace — hourly safety net

```memql
@enabled
@trigger(schedule="0 0 * * * *")
@description("Hourly safety-net: ensure every active user has today's daily space. Idempotent per user.")
automation rolloverDailySpace {
  step run {
    logic rolloverDailySpace { event: event }
  }
}
```
*Source: `dsl/cognition/automations.memql`*

This is the hourly catch for the long-lived-session case. The daily-space singleton is normally provisioned on user-create (`provisionDailySpaceOnUserCreate`) and on every login (`ensureDailySpaceOnAuthSession`), but a user who stays logged in past local midnight fires neither trigger — so the hourly cron sweeps every active user with `dailySpaceEnabled`. Hourly is "the smallest unit that respects per-user IANA timezones without over-firing."

### A row-removal caveat worth knowing

Several "purge" crons (`purgeExpiredPolicyTraces` in `dsl/platform/automations.memql`, `magicLinkExpirySweep` in `dsl/identity/automations.memql`) are **observation-only or tombstone-only** today, because *MemQL has no row-removal mutation* — only Insert and Update. From `purgeExpiredPolicyTraces`:

> MemQL has no row-removal mutation today, so this cron emits a "would-expire N rows" publishEvent each tick. Flip to a per-row delete once the engine grows a delete() mutation.

`purgeExpiredArchivedSpaces`, by contrast, calls `deleteSpaceNow` — [VERIFY: whether `deleteSpaceNow` performs a true hard delete or a tombstone; the cron describes it as "hard-delete" but the platform/identity crons assert no row-removal mutation exists. These may be reconciled by `deleteSpaceNow` being a special engine path or by the space "delete" being a status flip.]

---

## 9. Quick reference

**Where things live:**

| Concern | File |
|---------|------|
| Event bus | `component/events/` (`event.go`, `pattern.go`, `bus.go`) |
| Topic emission on write | `component/memql/executor_mutation.go` |
| Trigger topic assembly | `component/language/ast/trigger.go` (`BuildTriggerTopic`) |
| Automation loader | `component/automations/loader.go` |
| Scheduler (cron + event subscribe) | `component/automations/scheduler.go` |
| Executor (dedup, storm, claim) | `component/automations/executor.go` |
| Logic-runner | `component/automations/logic_runner.go` |
| Per-process dedup | `component/automations/dedup.go` |
| Cluster guard (event exactly-once) | `component/automations/cluster_guard.go` |
| Cron leader (schedule once-cluster-wide) | `component/automations/cron_leader.go` |
| Bootstrap wiring | `app/engine.go` |
| Automation DSL (per domain) | `dsl/<domain>/automations.memql` |
| Logic bodies (per domain) | `dsl/<domain>/logic.memql` |

**Key constants:** event-executor concurrency 10, schedule-executor concurrency 5, per-process dedup TTL 10 min, storm threshold 20 exec/min, cron-leader poll 10 s, cron-leader lock key `7756010113207010561`, cluster-guard claim retention 1 h (prune every 10 min).

**Authoring checklist for a new automation:**

1. Add the trigger + step block to `dsl/<domain>/automations.memql` with `@enabled`, `@trigger`, optional `@filter`, `@description`.
2. Add the `use <domain>.logic.{ logicYourFn }` import and reference it in a `logic yourFn { event: event }` step.
3. Write the body as a `logic logicYourFn { args { event object @required } body { ... } }` function in `dsl/<domain>/logic.memql`.
4. Read event data via `args.event.payload.X`.
5. Make it idempotent: existence check inside the body and/or a content-addressed id on the mutation. Event automations also get per-process dedup and the cluster guard for free; cron automations get neither, so idempotency in the body is mandatory for them.
