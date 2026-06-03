# memQL — Memory & the Agent Harness

memQL's differentiator is not that it stores agent state, but *where* and *how*: every piece of an agent's working memory and execution state is a first-class time-series graph node living in the same `MemoryNodes` hypertable as everything else. This collapses what a bolt-on agent stack assembles from a vector store, a recency log, a task queue, an audit log, and a job scheduler into one substrate. Two consequences follow directly. First, **human-shaped memory**: a time-ordered episodic log (plans, steps, observations) that a scheduled pass distills into durable semantic beliefs, recalled by a single hybrid recency-×-relevance query. Second, **a graph-native agent harness**: an event-sourced reconciler that drives a plan's step DAG, hardened inner loops with budgets/retries/stopping, an outer-loop planner that routes work to agents, and a trace/replay/eval observability spine that is a *read over the event stream* rather than a parallel logging system.

This document grounds each of those claims in the actual code as of the current `main` branch. The harness landed across epic #590 (issues #582–#589). Some pieces are fully wired into the running binaries; others are pure, unit-tested decision cores whose production dispatch loop is documented but not yet mounted. Those gaps are called out explicitly.

---

## 1. The memory model: episodic vs. semantic

The harness models memory in two tiers, both as MemoryNode concepts under the `v1:harness:*` namespace. The split is deliberate and the concept-file header (`dsl/harness/concepts.memql`) states it outright:

> The three concepts above are EPISODIC memory: a time-ordered log of what happened (plans, steps, observations). Consolidation is the scheduled pass that distills that raw episodic stream into durable SEMANTIC memory — stable facts, preferences, and learned outcomes [...]. It is what makes the harness feel cognitive rather than merely durable, analogous to memory consolidation during sleep.

### 1.1 Episodic memory: plan / step / observation

Three concepts form the episodic spine. All three are partition-scoped MemoryNodes, so they inherit time-ordered history (the hypertable), automatic provenance (`createdBy` stamped from the actor on every insert), event emission on insert, and per-workspace partition isolation — with no separate task table, state store, or audit log.

- **`v1:harness:plan`** — the desired state, a unit of work. Carries `goal`, a `status` lifecycle enum (`open → running → done/failed/cancelled`), `ownerUserId` (the per-row authorization key, stamped from `actor.userId` at create time), `rootStepId`, `input`/`result`, and `provenanceMutation` (which mutation produced this version).
- **`v1:harness:step`** — one DAG node inside a plan. Carries `planId`, `dependsOn []string` (the DAG in-edges), `status` (`pending → ready → running → done/failed/blocked`, with `blocked → ready` and `failed → ready` retry edges), `assignedAgent`, `attempt`, and a **required `idempotencyKey`** that "dedupes re-runs of the same logical step [and] makes step execution safe to retry / replay in the event-sourced loop."
- **`v1:harness:observation`** — what actually happened: one row per meaningful event, `kind ∈ {tool_result, error, note, decision}`. The `content` field is the embedding source; the `data` field carries structured per-kind data (named `data`, not `payload`, because `payload` is a reserved row intrinsic).

The `observation.content` field is the linchpin that makes episodic memory *recallable*. From the concept description:

```
content  string  @required  @description("The text rendering of this observation -- the
  embedding source, so observations are recall-able. The harness embedding loop stores this
  into node_vectors keyed by the observation id (integration.embedding.store,
  vectorField='content') so the observation is semantically recall-able (#585): the agent
  can search its own history. Mirrors the v1:common:documentChunk content-as-embedding
  pattern -- the vector lives in node_vectors keyed by node id, not inline on the row.")
```
*Source: `dsl/harness/concepts.memql`*

Note the `embedding []float` field exists on the concept but is populated lazily; until then recall reads `node_vectors` directly.

Steps cannot express a state machine in the append-only DSL alone, so an engine pre-insert guard enforces it. `stepTransitionAllowed(from, to)` is a pure, unit-tested function consulted by `validateHarnessStepTransition`, which runs on every step insert *and* every `update()`:

```go
func stepTransitionAllowed(from, to string) bool {
	if !validStepStatus(to) {
		return false
	}
	if from == "" {
		return true // brand-new step; the insert path enforces it lands in pending
	}
	if !validStepStatus(from) {
		return false
	}
	if from == to {
		return true
	}
	return stepTransitions[from][to]
}
```
*Source: `component/memql/harness_step_validation.go`*

An invalid transition (e.g. `done → running`) is rejected by the engine regardless of whether it arrives via a mutation, a raw insert, or an automation. There is a companion `retryBumpsAttempt` guard that requires a `failed → ready` retry to actually increment `attempt`, so replays don't silently loop at the same attempt number.

### 1.2 The episodic write paths (mutations)

The mutations are deliberately thin and declarative (`dsl/harness/mutations.memql`). Each stamps `ownerUserId: actor.userId` on create (the server-side ownership key — the caller cannot land a plan owned by someone else) and records its own name in `provenanceMutation` so the audit trail names the *transition*, not just the actor:

- `mutationCreateHarnessPlan` — creates a plan in `status="open"`.
- `mutationAddHarnessStep` — adds a `pending` step, `attempt=0`. The insert emits `graph.node.created.*.v1:harness:step`.
- `mutationStartHarnessStep` (`ready → running`), `mutationCompleteHarnessStep` (`running → done`), `mutationFailHarnessStep` (`running → failed`) — the step transition writes, each guarded by the engine state machine.
- `mutationRecordHarnessObservation` — appends an observation.

### 1.3 Semantic memory: distilled, durable beliefs

Consolidation produces **`v1:harness:semanticMemory`** — "a durable, distilled belief consolidated from episodic memory [...] a stable fact, preference, or learned outcome the agent should keep across plans." Its fields encode a small belief lifecycle:

- `kind ∈ {fact, preference, outcome}` — drives how recall weights and presents the belief.
- `content` — the natural-language statement; again the embedding source, so semantic memories are themselves `similarTo`-recallable (used both by `recall()` and by consolidation's own dedup step).
- `sourceEpisodes []string` (required) — **provenance: the episodic node ids this belief was distilled from.** The concept header calls this "the killer feature of doing consolidation in-graph" — every belief traces back to its evidence.
- `confidence float` (default 0.5) — rises on reinforcement, decays when unreinforced.
- `reinforceCount int` (default 1), `lastReinforced datetime` (the decay clock).
- `status ∈ {active, pruned}` — soft-delete, because the append-only model has no row-removal mutation; recall and dedup filter `status=="active"`.

A second concept, **`v1:harness:consolidationCursor`**, is the per-owner watermark: one row per owner holding the `createdAt` boundary of the most recent episodic batch already consolidated. It is what makes consolidation *incremental* — each run reads only episodes with `createdAt > watermark`, so cost is bounded by the new-episode delta, not total history.

Both `formedFrom` (semanticMemory → observation) and `dependsOn` (step → step) are custom relationship types that the engine had to register before these concepts would load (commits `d45efaa` and `42aeff3` respectively).

---

## 2. Consolidation: episodic → semantic

Consolidation is a scheduled DSL automation that reads and writes the same graph. The trigger (`dsl/harness/automations.memql`):

```memql
@enabled
@trigger(schedule="0 45 2 * * *")
@description("Daily 02:45 UTC memory consolidation (#586). Per owner: reads episodic nodes
  [...] created since that owner's v1:harness:consolidationCursor watermark, groups them by
  similarity, LLM-distills stable facts / preferences / outcomes, dedups each candidate via
  similarTo against existing v1:harness:semanticMemory rows (reinforce on match [...] write
  a new belief with sourceEpisodes provenance on no match), decays + prunes stale
  unreinforced beliefs, then advances the watermark [...].")
automation consolidateMemory {
  step run {
    logic consolidateMemory { event: event }
  }
}
```

The daily 02:45 UTC schedule is offset past the safety crons (02:35/02:40) and the knowledge/platform crons (02:30) to avoid contending on the same nightly DB window. The cadence "matches the 'consolidation during sleep' framing."

### 2.1 The DSL-entry / Go-loop split

This is important and explicitly documented: the **DSL body is only the scheduled entry point.** The heavy loop runs in Go. The `logicConsolidateMemory` body returns a sentinel:

```memql
logic logicConsolidateMemory {
  args { event object @required }
  body {
    // Phase scaffolding: the per-owner consolidation loop [...] is owned
    // by the Go harness consolidation handler. [...]
    return args.event.topic
  }
}
```
*Source: `dsl/harness/logic.memql`*

The reason given in the file header: consolidation needs per-owner iteration, similarity *clustering*, a blocking LLM distill per cluster, `similarTo` dedup plus confidence-bump/decay *arithmetic*, and `max(createdAt)` over the batch — "the MemQL parser has no arithmetic on number/datetime fields and no in-DSL clustering primitive," so the math and iteration run in Go.

The full Go-handler contract is specified in the file header as a six-step per-owner loop: read cursor → read since-watermark batch (capped at `MEMQL_HARNESS_CONSOLIDATION_BATCH_MAX`) → cluster by embedding similarity → per cluster, `si("consolidateMemory", ...)` then `similarTo` dedup (reinforce on match ≥ threshold, else create) → decay sweep + prune → advance watermark.

**Status — partially built.** The pure decision helpers ship and are unit-tested; the scheduled Go handler that strings them together is **not yet registered.** A grep for a consolidation handler registration finds only the helper file and the SDK stub — no production wiring that calls `si("consolidateMemory")` and the mutations. So today the automation fires and the logic returns its sentinel; the distillation does not yet happen end-to-end. [VERIFY: no registered handler invoking the consolidation loop exists on `main` — confirmed by absence in grep across `--include="*.go"`, but a build-tag-gated file could in principle exist; none was found.]

### 2.2 The pure consolidation decisions

What *is* built and tested is `component/memql/harness_consolidation.go`, which isolates every decision the DSL can't express. The tuning defaults:

```go
const (
	ConsolidationDefaultDedupThreshold   = 0.86 // cosine floor: reinforce vs. new belief
	ConsolidationDefaultDecayDays        = 30   // unreinforced grace window
	ConsolidationDefaultDecayPerInterval = 0.1  // confidence lost per elapsed window
	ConsolidationDefaultPruneConfidence  = 0.15 // retire below this
	ConsolidationDefaultReinforceBump    = 0.15 // confidence gained per reinforcement
)
```

The reinforce-vs-create branch, the linear-in-windows decay, the prune cutoff, the provenance union, and the watermark advance are all pure functions. For example, decay:

```go
func ConsolidationDecayedConfidence(prior float64, lastReinforced, now time.Time, decayDays int, decayPerInterval float64) float64 {
	if decayDays <= 0 { return clampConsolidationConfidence(prior) }
	age := now.Sub(lastReinforced)
	if age <= 0 { return clampConsolidationConfidence(prior) }
	window := time.Duration(decayDays) * 24 * time.Hour
	intervals := int(age / window)
	if intervals <= 0 { return clampConsolidationConfidence(prior) }
	return clampConsolidationConfidence(prior - float64(intervals)*decayPerInterval)
}
```
*Source: `component/memql/harness_consolidation.go`*

The reinforce path is what makes re-running over the same episodes idempotent at the belief level: `mutationReinforceHarnessSemanticMemory` bumps confidence + `reinforceCount`, resets `lastReinforced` to `now()`, and **replaces `sourceEpisodes` with the merged/deduped provenance** (`ConsolidationMergeProvenance`) rather than writing a duplicate row. The arithmetic gotcha is handled the same way as the planner's retired token-budget automation: the Go loop computes the new values and passes them in as args; the mutation stays declarative.

### 2.3 The distill prompt

`dsl/harness/prompts.memql` defines `consolidateMemory` (structured-output, default provider `chat54Mini`): given a similarity-grouped cluster of episodic nodes, "extract at most one stable, durable belief." It returns `{distilled, kind, content, confidence}`, with `distilled=false` "when the cluster holds nothing stable enough to keep." The description is explicit about being conservative by design — "it is better to NOT distill than to mint a low-value belief, because every belief costs recall budget and must be decayed back out later." The template lives at `dsl/harness/prompts/consolidateMemory.tmpl`.

---

## 3. `recall()` — hybrid recency × relevance

`recall()` is the headline read path and the strongest demonstration of why the time-series + pgvector substrate matters. It is a Go-backed `@sdk` builtin (`dsl/harness/queries.memql`), not a struct-form query, because a struct query is "filter + shape over one concept; it cannot express pgvector cosine similarity, an exponential time-decay over createdAt, or a weighted-sum ORDER BY" — recall needs all three in a single statement.

The DSL surface:

```memql
@enabled
@sdk
@executor("integration.harnessRecall.recall")
@args(profile="object", additionalProperties="true")
builtin recall {
  text      string  @required
  concept   string
  k         int
  provider  string
}
```

The scoring formula (the SQL implements it exactly):

```
score = wSem * cosine(embedding, queryEmbedding)
      + wRec * exp(-ln2 * ageSeconds / halfLife)
```

Defaults (`integrations/harnessrecall/recall.go`): `concept = v1:harness:observation`, `provider = embedding3Small`, `k = 10`, `halfLife = 3600s`, `wSem = 0.7`, `wRec = 0.3`, `window = 0` (no time filter — recall across all history). Tunable weights let a debugging agent raise `wRec`/lower `halfLife` ("what just happened") and a research agent raise `wSem` and widen the window ("everything relevant ever").

### 3.1 The single SQL statement

The architectural payoff: because embeddings (`node_vectors`, keyed by node id) and `createdAt` (the hypertable partition key) live on the same table family, recall scores recency × relevance in **one round-trip** — no app-side merge of a vector store and a recency store.

```sql
WITH latest AS (
    SELECT DISTINCT ON (id) id, "createdAt", payload
    FROM "MemoryNodes"
    WHERE concept = $2
      AND ($3 = '' OR (payload->>'ownerUserId') = $3)
      AND ($4 <= 0 OR "createdAt" >= now() - make_interval(secs => $4))
    ORDER BY id, "createdAt" DESC
)
SELECT latest.id, latest."createdAt", latest.payload,
       (1 - (nv.embedding <=> $1::vector))                                  AS similarity,
       exp(-0.6931471805599453 * GREATEST(extract(epoch FROM (now() - latest."createdAt")), 0) / $5) AS recency,
       $6 * (1 - (nv.embedding <=> $1::vector))
         + $7 * exp(-0.6931471805599453 * GREATEST(extract(epoch FROM (now() - latest."createdAt")), 0) / $5) AS score
FROM latest
JOIN node_vectors nv ON nv.id = latest.id
WHERE nv.vector_field = 'content'
ORDER BY score DESC
LIMIT $8
```
*Source: `integrations/harnessrecall/recall.go`*

Three things to note. The `latest` CTE picks the newest version per id (memQL is append-only). The owner and window predicates live *inside* the CTE so TimescaleDB prunes hypertable chunks outside the window before the vector join. The recall handler also stamps the computed `_similarity`, `_recency`, and `_score` onto each returned payload, so the scoring is auditable and usable for citation ranking downstream.

### 3.2 Authorization

Recall is owner-scoped *inside the SQL*: `resolveParams` reads `actor.UserId` from the auth context and binds it as `$3`, so an agent only ever recalls its own workspace's memory (partition isolation). An empty owner (dev mode / no auth) falls back to an unscoped read so local dev works; production always has an access context. The scoring function itself (`recallScore`) is mirrored in pure Go so a unit test can prove that changing `halfLife` reorders results.

The capability is registered as a self-registering plug-in (`integrations/harnessrecall/plugin.go`) with `PreserveOrder: true`, which stamps monotonic `CreatedAt` so the engine's default sort-by-createdAt-desc reproduces the score order.

---

## 4. The harness state model and execution loops

The harness has two control loops over the plan/step DAG: an **outer loop** (the planner: goal → plan + step DAG, then route each step to an agent) and an **inner loop** (per-step tool execution). Between them sits the **reconciler** — the event-sourced controller that drives steps from `ready` to `done`.

### 4.1 The reconciler: an event-sourced controller

`component/harness/reconciler.go` drives plan execution as a Kubernetes-style reconcile loop, *not* an imperative while-loop. Each tick it observes a plan's steps, claims a runnable one, dispatches it to the inner loop, records an observation, and completes/fails the step. The written observation re-fires `graph.node.created.v1:harness:observation`, which triggers the next reconcile — **the agent reacts to its own writes.**

Crash recovery is free, by design: "the controller holds NO authoritative plan state between ticks; the graph is the source of truth. On restart it just reconciles again from current step statuses." Claim-before-run plus the step's `idempotencyKey` make a re-dispatch safe.

The pure/impure split is the same discipline as the rest of the harness. `reconcile_logic.go` holds the decision core — free of DB, bus, and engine — so it is unit-testable in isolation: `SelectRunnable` (status==ready), `PromotablePending` (pending/blocked whose deps are all done → ready), `dependenciesSatisfied`, `dependencyDeadEnd`, and `ComputePlanTerminal`. The terminal computation is careful: all-done → plan done; nothing in flight and something failed/permanently-blocked → plan failed; otherwise still running. A blocked step whose blocker *just* completed counts as in-flight (promotable next tick) so a plan isn't declared failed in the same tick its blocker completes.

One reconcile tick (`Reconcile`):

```go
func (r *Reconciler) Reconcile(ctx context.Context, planID string) error {
	// ... per-plan lock; system actor on ctx ...
	planStatus, err := r.reader.PlanStatus(ctx, planID)
	if isTerminalPlanStatus(planStatus) { return nil } // already settled

	steps, partition, err := r.reader.StepsForPlan(ctx, planID)

	// (2) Promote pending/blocked steps whose dependencies are satisfied.
	for _, s := range PromotablePending(steps) { r.writer.MarkStepReady(ctx, s) }
	steps, partition, err = r.reader.StepsForPlan(ctx, planID) // re-read

	// (3) Budget check. Usage is DERIVED from the graph, never trusted from memory.
	usage := r.budgetUsage(ctx, planID, steps)
	if v := BudgetTripped(r.cfg.Budget, usage); v.Tripped {
		plan, _, _ := r.reader.PlanView(ctx, planID)
		return r.haltOnBudget(ctx, plan, planID, v, usage)
	}

	// (4) Dispatch runnable steps with bounded per-partition concurrency.
	runnable := SelectRunnable(steps)
	r.dispatchRunnable(ctx, planID, partition, runnable)

	// (5) Terminal-state promotion (re-read so the verdict reflects this tick).
	steps, _, err = r.reader.StepsForPlan(ctx, planID)
	if v := ComputePlanTerminal(steps); v.Status != "" {
		// ... SetPlanStatus(done/failed) ...
	}
	return nil
}
```
*Source: `component/harness/reconciler.go`*

**Claim-before-run** is the double-execution guard. `runStep` calls `claimer.ClaimStep`, an atomic conditional update that flips `ready → running` only when the current status is still `ready` and the observed `attempt` matches; exactly one concurrent claim wins (`rows-affected == 1`), losers skip without side effects. Dispatch then runs under a per-partition semaphore (`defaultMaxConcurrentPerPartition = 4`) for backpressure.

The reconciler subscribes to two topics and also runs a 30s safety-net tick:

```go
func Subscriptions() []string {
	return []string{
		"graph.node.created." + memorynodes.ConceptHarnessPlan,
		"graph.node.created." + memorynodes.ConceptHarnessObservation,
	}
}
```

The periodic tick "catches stuck/blocked steps that no event would otherwise re-trigger (e.g. a blocker that completed on another node before this controller subscribed)."

**Status — wired.** Unlike consolidation and the outer-loop planner, the reconciler *is* mounted in production. `app/integrations_harness_init.go` constructs it with a bun-backed `StepReader`, an engine-backed `Writer`/`StepClaimer`, a `FuncDispatcher` over the hardened inner loop, and a `BusSubscriber`, and `setupHarnessReconciler()` is called from both the agent node (`app/integrations_agent.go`) and the planner node (`app/integrations_planner.go`).

### 4.2 Inner-loop hardening: budgets, retries, stopping, structured errors

`component/memql/inner_loop.go` (#584) hardens the per-turn tool loop. Everything is pure and table-testable; the harness observation type is consumed behind an interface so the file builds standalone. Five mechanisms:

**Structured tool errors.** `ClassifyToolError` maps a raw dispatch error into a typed `StructuredToolError{type, message, retryable, userFixable, attempts, details}` fed back to the model as compact JSON instead of a raw string. If the engine already produced a `StructuredError`, its code maps directly; otherwise classification is substring-based against the message. The split that matters is **user-fixable** (`validation`, `not_found` — the model can recover by changing its args/tool) vs. **system** (`timeout`, `unavailable`, `internal` — mechanically retryable but not by changing the call shape). Permission errors are neither.

```go
var userFixableTypes = map[ToolErrorType]bool{
	ToolErrorValidation: true,
	ToolErrorNotFound:   true,
}
func isRetryableToolErrorType(t ToolErrorType) bool {
	switch t {
	case ToolErrorTimeout, ToolErrorUnavailable, ToolErrorInternal:
		return true
	default:
		return false
	}
}
```
*Source: `component/memql/inner_loop.go`*

**Deterministic stopping.** A named `StopReason` (`respondToUser`, `text_only`, `budget_exhausted`, `loop_detected`, `hard_error`, `max_iterations`) means a stalled turn is never a silent mystery. The `LoopDetector` trips on repeated identical tool calls. A call signature is `toolName + canonicalized-args` (args parsed and re-marshalled with sorted keys, so semantically identical calls compare equal regardless of key order). It trips when the same signature recurs **3 times consecutively** (`defaultLoopRepeatThreshold` — giving the model two chances to self-correct after a validation error names the fix) or **5 times across the turn** (`defaultLoopTotalThreshold` — catching A/B/A/B thrashing the consecutive counter misses).

**Per-tool timeout + retry with backoff.** `ToolRetryPolicy.ExecuteWithRetry` wraps each attempt in a per-call deadline, backs off transient failures exponentially, and surfaces the attempt count on the structured error. Defaults: 30s per-call timeout, up to 3 attempts, 250ms base backoff capped at 4s. Crucially, only mechanically-retryable system errors retry; a user-fixable error returns immediately because "retrying the identical call is pointless."

**Context-budget management.** `ContextBudget` tracks an approximate token budget (≈4 chars/token, no tokenizer dependency). When the window exceeds the ceiling, `PlanContextTrim` drops the oldest non-pinned turns — always preserving the first `pinnedHead` messages (system prompt + pinned context) and the last `keepTail` (the live thread) — and emits a summary note recorded as a `kind=note` observation when a sink is wired.

**Idempotency + tool scoping.** `IdempotencyKeyFor(stepKey, toolName, rawArgs)` derives a stable sha256-based key so a re-dispatched step reuses the first result instead of repeating a side effect; the loop-local default is a per-turn map, with cross-turn persistence behind the `IdempotencyStore` interface. `ScopeToolNames` filters the tool set to a role-derived allow-list (the #588 hook).

All of this is consumed via `ToolLoopOptions`, passed to `engine.InvokeSIChatWithFilteredToolsOpts`. The production wiring closes the observation-sink TODO: `harnessObservationSink` in `app/integrations_harness_init.go` writes each loop note/stop/error as a `v1:harness:observation` row (mapping `stop` → `note` so the kind enum validates), making the inner loop's reasoning durable and recallable.

### 4.3 The outer-loop planner: goal → plan + agent routing

`component/harness/planner.go` (#587) is the outer loop: decompose a goal into a step DAG (#582), then per step decide **route / upgrade / provision** against the existing agent roster, with dedup/merge to prevent agent sprawl. Like the reconciler, it is the impure half over a pure decision core (`planner_logic.go`) and four narrow interfaces (`Decomposer`, `AgentRoster`, `PlanWriter`, `AgentFactory`).

The per-step decision (`DecideRoute`) is a pure threshold comparison of the best agent fitScore (cosine similarity between the step's capability text and each agent's capability embedding — the cognition fitScore generalized):

```go
const (
	DefaultRouteThreshold   = 0.82 // clear specialist match -> route unchanged
	DefaultUpgradeThreshold = 0.60 // same-domain, tool-gap -> attach missing tools
	DefaultDedupThreshold   = 0.90 // near-identical roles collapse (anti-sprawl)
)
```

- `best.Score >= 0.82` → **route** to the existing agent.
- `0.60 <= best.Score < 0.82` → **upgrade** (attach the role's missing knowledge domains/tools via `ComputeUpgradeGap` + `MergeCapabilities`, then assign).
- otherwise, or empty roster → **provision** a new specialist from a seed role.

Provisioning runs `DecideDedup` first: the composed agent's capability text is similarity-checked against the roster, and a match `>= 0.90` merges into that near-duplicate (and upgrades it with anything the new role adds) instead of creating sprawl. The seed-role catalog is three coarse roles — researcher / builder / operator — each granting a *deliberately scoped* tool set, because "piling every tool onto one agent degrades model performance" (ties to #588). Every route/upgrade/provision is recorded as a `decision` observation for auditability. On any decompose failure (LLM error or malformed output), `SingleStepFallback` ensures the goal still runs as a single step. The decompose prompt is `decomposeGoal` (`dsl/harness/prompts.memql`), structured-output, with `ValidateDecompose` checking the DAG is acyclic with unique keys and no dangling edges.

**Status — partially built.** The planner's decision core and the `Planner.Plan` orchestration are complete and unit-tested, but `harness.NewPlanner` is instantiated **only in tests** — no production code constructs the outer-loop planner. The reconciler (which executes whatever steps exist) is wired; the planner that *creates and routes* those steps from a goal is not yet mounted into a node's startup. The separate `integrations/planner/` package (the CoPresent-facing Plan/Task system described in the root CLAUDE.md) is a distinct, older subsystem; `responsibility_intake.go` there references the same DSL-entry / Go-loop pattern but is not the harness outer-loop planner.

---

## 5. Observability: trace, replay, eval

Because all harness state is event-sourced in the graph, observability is a **read over the existing node stream**, not a parallel logging system. The numbers always match what actually happened.

### 5.1 Trace

`component/harness/trace.go` reconstructs, for a single plan, the full ordered timeline: every version-transition of the plan and its steps (each append-only version is one event, named by `provenanceMutation`) plus every observation. "Provenance IS the trace: `createdAt` orders it, `createdBy` attributes it, and `provenanceMutation` names the transition." `AssembleTrace` is pure — it sorts events (ascending `createdAt`, tiebroken by kind so plan < step < observation, then NodeID, then Mutation for deterministic ordering on timestamp collisions) and rolls them up per step. The bun-backed reader that feeds it lives in `trace_reader.go` (the same pure/impure split).

`Trace.Render()` (`trace_render.go`) produces a plain-text timeline — a header (plan id / goal / status), a metrics line, then each event in `createdAt` order with actor + mutation + content. It is pure formatting so any surface (CLI, logs, a future BFF endpoint) can reuse it. `ComputeMetrics` (`metrics.go`) derives the per-plan rollup — success, step counts, tool calls, token cost (summed from observation data), wall clock (first to last event), observation/error counts — entirely from the trace.

The trace is exposed over the wire as the `harnessTrace` `@sdk` builtin (`dsl/harness/queries.memql`, dispatching `integrations/harnesstrace`), returning a single synthetic node carrying `{planId, timeline, complete, stepCount}` — "the history-over-gRPC contract for the cockpit `harness trace` CLI" (memql-cockpit#142). Like recall, it is owner-scoped to the caller's own plan.

### 5.2 Replay

`component/harness/replay.go` re-runs a recorded plan to reproduce its step dispatch sequence — a second read over the event stream. `ReplaySpecFromTrace` reconstructs the recipe (goal + steps' titles, dependsOn DAG, inputs) and `Replay` re-drives the *same* reconciler decision core over a fresh in-memory graph with a deterministic no-op dispatcher, then compares dispatch order.

The determinism caveat is handled honestly: the reconciler's selection is pure and deterministic given the DAG, so a plan with pure tools reproduces exactly. But when two or more steps become ready in the same dependency wave, their relative order is not DAG-implied. `classifyDeterminism` detects this and *flags* the replay as non-deterministic rather than asserting equality — in that case the comparison falls back to the DAG-stable (sorted) canonicalization and the verdict is advisory. This mirrors the issue's "deterministic where tools are pure; flag where not" requirement.

### 5.3 Eval

`component/harness/eval.go` is a CI regression gate: a fixed set of `TaskFixture`s (each a plan DAG plus scripted per-step `StepOutcome`s) run through the *same* reconciler decision core over an in-memory graph — no Postgres, no LLM, so it runs fast. The shipped fixtures model the DAG shapes the harness must get right: `single-step`, `linear-chain`, `fan-out-fan-in`, `failing-step`, `dead-end-blocked`, `mixed-success` (`eval_fixtures.go`).

Each fixture asserts expected plan success and (optionally) the step-dispatch count; the suite rolls up into an `EvalReport` (pass rate, success rate, total tool calls, total tokens). `CheckThreshold` gates on configurable floors/caps and names *every* violated dimension so CI logs say exactly what regressed:

```go
type EvalThreshold struct {
	MinSuccessRate    float64 // fraction of fixtures whose plan succeeded
	MinPassRate       float64 // fraction matching expectation (success AND step-count)
	MaxTotalToolCalls int     // a chattier harness trips this
	MaxTotalTokens    int
}
```
*Source: `component/harness/eval.go`*

The value: harness changes (reconciler, inner loop, planner) all flow through the same `SelectRunnable` / `PromotablePending` / `ComputePlanTerminal` core the eval drives, so a change that dispatches out of dependency order or mis-fails a plan shows up immediately as a fixture-score drop. The runner is exposed as `cmd/harness-eval/main.go`, and there is a CI smoke test for engine-bootstrap + DSL load (`dc5add7`).

---

## 6. What is built vs. what is scaffolded

A precise summary, since the harness landed incrementally:

| Capability | Status |
|---|---|
| Episodic concepts (plan/step/observation) + mutations | **Shipped** — load, validate (engine step-transition guard), emit events. |
| Semantic memory + cursor concepts + mutations + distill prompt | **Shipped** as schema + mutations + pure decision helpers + prompt. |
| Consolidation Go handler (the scheduled loop that ties them together) | **Scaffolded** — DSL automation fires but the logic returns a sentinel; no registered Go handler runs the distill/dedup/decay loop. |
| `recall()` hybrid query | **Shipped** — registered plug-in, single-SQL implementation, owner-scoped. |
| `harnessTrace` over gRPC | **Shipped** — `@sdk` builtin + integration. |
| Reconciler (event-sourced controller) | **Shipped + wired** into agent and planner nodes. |
| Inner-loop hardening (errors/budgets/retries/stopping/idempotency) | **Shipped + wired** via `ToolLoopOptions` + the production observation sink. |
| Outer-loop planner (goal → DAG → route/upgrade/provision) | **Built + tested**, but `NewPlanner` is instantiated only in tests — no production node mounts it yet. |
| Trace / replay / eval | **Shipped** — pure cores, bun reader, CLI runner, CI gate. |

The consistent engineering pattern across all of it: every loop is split into a **pure, table-testable decision core** (no DB/LLM/bus) and an **impure half** behind narrow interfaces, and the durable state is *always* graph nodes — which is what lets trace/replay/eval be reads over the same event stream the agent writes, and what gives the reconciler free crash recovery. That graph-as-substrate choice is the throughline that distinguishes memQL's harness from a bolt-on agent framework.
