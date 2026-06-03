# memQL Cockpit — Tabs & Features

The memQL Cockpit is a terminal-native IDE and operations console for memQL clusters. It is a [tcell](https://github.com/gdamore/tcell)-based TUI whose top-level surface is a fixed set of eight tabs laid out along a bottom tab bar. This document is a tour of every tab — what each one shows, what you do there, and the keys that drive it — plus the supporting packages (`editor`, `auth`, `config`) that are machinery rather than tabs. Everything below is grounded in the `cli/` source on the current `main` branch.

---

## The tab set

Tabs are registered once, in order, in `cli/app.go`. The registration list is the single source of truth for which tabs exist and where they sit on the bottom bar:

```go
tabBar := ui.NewTabBar(theme,
    ui.Tab{Name: "Clusters", Content: clustersView},
    ui.Tab{Name: "Chat", Content: chatView},
    ui.Tab{Name: "Concepts", Content: conceptsView},
    ui.Tab{Name: "Planner", Content: plannerView},
    ui.Tab{Name: "Skills", Content: skillsView},
    ui.Tab{Name: "Workers", Content: workersView},
    ui.Tab{Name: "Safety", Content: safetyView},
    ui.Tab{Name: "Settings", Content: settingsView},
)
tabBar.SetActive(0)
```
*Source: `cli/app.go`*

That yields the eight real tabs, numbered 1–8 on the bottom bar:

| # | Tab | Cluster-gated? | One-line role |
|---|-----|----------------|---------------|
| 1 | **Clusters** | no (it *is* the connection surface) | Manage cluster connections; live + architectural topology |
| 2 | **Chat** | yes | Read-only viewer over a space's utterance stream (+ push-to-talk) |
| 3 | **Concepts** | yes | Generic concept/row/detail browser with version history |
| 4 | **Planner** | yes | Observe `v1:planner:plan` / `task` rows; run a queued plan |
| 5 | **Skills** | yes | Read-only `v1:agents:skill` catalog browser |
| 6 | **Workers** | no (talks to a local daemon over a Unix socket) | Computer-use consent dashboard + live audit tail |
| 7 | **Safety** | yes | Observe `v1:safety:classification` rows from the command classifier |
| 8 | **Settings** | no | Version info, "My Access", keyboard-shortcut reference |

### How tab switching works

Tab switching is handled centrally in the app event loop, which delegates to `TabBar.HandleKey`. Two routes are recognized:

```go
// Alt + digit. Map '1' -> index 0, '2' -> 1, ... up to '9' -> 8.
if ev.Modifiers()&tcell.ModAlt != 0 {
    r := ev.Rune()
    if r >= '1' && r <= '9' {
        idx := int(r - '1')
        if idx < tabCount {
            return idx
        }
    }
}
// F-keys. KeyF1 -> index 0, KeyF2 -> 1, ..., KeyF12 -> 11.
k := ev.Key()
if k >= tcell.KeyF1 && k <= tcell.KeyF12 {
    idx := int(k - tcell.KeyF1)
    if idx < tabCount {
        return idx
    }
}
```
*Source: `cli/ui/tabs.go`*

So **F1**/`Alt+1` → Clusters, **F2**/`Alt+2` → Chat, **F3**/`Alt+3` → Concepts, and so on through **F8**/`Alt+8` → Settings. `Alt+0` is deliberately skipped because some terminal emulators consume it for window/profile switching (commented in `cli/ui/tabs.go`).

> **Doc-vs-code note.** The Settings tab's own on-screen "GLOBAL" shortcut list states `F2 / Alt+2 → Concepts tab` and `F3 / Alt+3 → Settings tab`. That text predates the Chat tab being inserted at index 1 and is now stale — the live tab order above (driven by the registration list and the F-key→index mapping) is authoritative. [VERIFY: this is a discrepancy in `cli/settings/view.go`'s `drawKeyBindings`, not a behavioral bug.]

### Per-tab crash isolation

Each tab's `Draw` and `HandleEvent` runs inside `crash.Catch`. If a tab panics, its `crash.Report` is stored keyed by tab name; subsequent frames render an inline error placeholder instead of re-panicking. Switching away and back to the tab clears the sticky crash state, giving you a one-keystroke "retry this pane" gesture:

```go
if newTab := a.tabBar.HandleKey(ev); newTab >= 0 {
    a.tabBar.SetActive(newTab)
    if t := a.tabBar.ActiveTab(); t != nil {
        delete(a.tabCrashes, t.Name)   // fresh try on re-entry
    }
    a.draw()
    return false
}
```
*Source: `cli/app.go`*

### Cluster gating

The four read-only operations tabs that depend on a live cluster connection — Concepts, Planner, Skills, Safety — share a single gating mechanism. `updateTabGating` runs from `draw()` and sets a `GatedMessage` on each view based on whether the selected cluster has reached the connected state:

```go
func (a *App) updateTabGating() {
    setGated := func(msg string) {
        a.conceptsView.GatedMessage = msg
        if a.plannerView != nil { a.plannerView.GatedMessage = msg }
        if a.skillsView != nil  { a.skillsView.GatedMessage = msg }
        if a.safetyView != nil  { a.safetyView.GatedMessage = msg }
    }
    name := a.selectedName()
    if name == "" {
        setGated("No cluster selected. Switch to the Clusters tab (F1) and press Enter on a cluster.")
        return
    }
    // ... if the pool entry is connecting/unreachable, message says so ...
    if state == stateConnected {
        setGated("")   // clears the gate
        return
    }
}
```
*Source: `cli/app.go`*

When a `GatedMessage` is set, the view renders that message as a placeholder instead of its normal panes. Chat is *not* in this list — it renders its own "connect to a cluster" placeholder inline (see below) — and Workers is intentionally ungated because it talks to a *local* worker daemon over a Unix socket, not over the cluster gRPC.

### Shared widget vocabulary

Almost every tab is built from the same `cli/ui` composable widgets (the "epic #81" refactor): `ui.ListPane` for scrollable lists (most use `RowsPerItem=2` so each item is a bold primary line plus a dimmed subtitle), `ui.DetailPane` / `ui.Viewer` for the right-hand detail surface, and `ui.HintBar` (a row of `ui.HintChip{Key, Label, Disabled}`) for the context-aware action hints at the bottom of each pane. `Tab` cycles keyboard focus between panes within a tab; the focused pane's title is highlighted. Knowing this vocabulary once explains the look-and-feel of seven of the eight tabs.

---

## 1. Clusters (F1)

**Package:** `cli/cluster` — `clusters_view.go`, `topology.go`, `architecture.go`

The Clusters tab is the starting context for every session: it is where you register, edit, authenticate against, and connect to clusters, and where you inspect both the *live* node topology and the *architectural* model of the codebase. It is a two-pane view: a management list on the left, a topology pane on the right.

```go
// ClustersView is the top-level Clusters tab: left = management, right = topology.
type ClustersView struct {
    ui.BaseView
    Focus    FocusPane
    Topology *View // node topology diagram (right pane)
    Clusters []ClusterStatus
    Selected int // index of the currently-highlighted row (arrow keys)
    // ...
    SelectedCluster string  // the "working cluster" chosen via Enter, marked ★
}
```
*Source: `cli/cluster/clusters_view.go`*

### Left pane — cluster management

The left pane lists every cluster known from `~/.memql/clusters.yaml`, each row decorated with its connection status (`connected` / `connecting` / `unreachable` / `unknown`) and a `★` glyph on the one you've picked as your **working cluster**. Connection lifecycle state lives outside the view, in the app's connection pool (`cli/pool.go`); the view only renders snapshots.

There are two distinct selection concepts, and the distinction matters:

- **`Selected`** — the list-row index the arrow keys move (highlight only).
- **`SelectedCluster`** — the cluster you committed to with **Enter**. This is the *working cluster* that drives the Concepts / Planner / Skills / Safety tabs.

Moving the highlight fires `OnHighlight` so the topology pane follows the highlighted row; pressing **Enter** fires `OnEnter` to commit a working cluster (and, if it's in a failed state, kicks a reconnect). The callbacks the app wires into the view spell out the full action surface:

```go
OnAdd       func(c config.ClusterConfig) // Add a new cluster
OnSave      func(c config.ClusterConfig) // Save edits to an existing cluster
OnDelete    func(clusterName string)     // Delete a cluster
OnEnter     func(clusterName string)     // Enter on a row -- pick working cluster
OnHighlight func(clusterName string)     // Arrow keys moved highlight -- topology follows
OnCancel    func(clusterName string)     // Esc on a row -- cancel its retry cycle
OnRetry     func(clusterName string)     // R on a row -- manually retry after failure
OnAuthorize func(discoveryURL, existingName string) // discovery + OAuth + save
OnLogin     func(clusterName string)     // re-run OAuth/magic-link on a configured cluster
```
*Source: `cli/cluster/clusters_view.go`*

The add/edit form has six fields, ordered so a paste-the-URL flow lands the cursor on Discovery first:

```go
const (
    formFieldDiscovery = iota
    formFieldName
    formFieldHost
    formFieldPort
    formFieldIssuer
    formFieldClientId
)
```
*Source: `cli/cluster/clusters_view.go`*

Filling Discovery is optional — a manually-filled Host/Port/Issuer/ClientId is an equally valid path. Pressing **Enter** with Discovery filled runs the well-known fetch + OAuth + save sequence in the background; otherwise the form just saves the manual config. The management-pane hints are context-aware (`Enter:Select` only surfaces when the row is selectable and isn't already the working cluster), following the codebase's "hints that lie rot trust" rule.

### Right pane — topology and architecture navigator

The right pane has two modes that share the same chrome (title + status bar), so toggling between them doesn't shift the surrounding layout.

**Live topology** (default) renders the cluster's running nodes as a box-drawing diagram. Each `NodeInfo` carries an ID, name, free-form `Type` (`bff` / `voice` / `cognition` / `agent` / `planner` — no hard-coded whitelist; whatever the server reports gets rendered), address, version, and a `Health` enum from `component/node/node.proto`:

```go
type NodeInfo struct {
    ID      string
    Name    string
    Type    string
    Address string
    Version string
    Health  nodev1.NodeHealthStatus
    Labels  map[string]string
}
```
*Source: `cli/cluster/topology.go`*

Node-type display order is seeded from the `v1:cluster:nodeType` concept (fetched once on connect), with unknown types appended. Live updates arrive on a per-cluster subscriber goroutine and are applied through `ApplyNodeUpdate` under a mutex (the topology view owns its own lock, separate from the management pane's). You pan the diagram with **W/A/S/D** and reset the pan with **R**.

**Architecture navigator** is toggled with **X**. Where the live topology shows *who is running right now*, the navigator shows *what exists in the code* — a C4-style drill-down (cluster → service → package → type → method) driven from an embedded `topology.model.json` shipped by `memql/component/architecture/embedded`:

```
// pressing 'X' on the cluster topology toggles into the architecture navigator;
// Backspace zooms out one C4 level, Esc returns to the live topology, Enter
// zooms into the highlighted node.
```
*Source: `cli/cluster/architecture.go`*

The navigator can overlay per-node observability metrics (`MetricSummary`: call count, p95 duration, error rate) keyed by model node ID via `RefreshMetrics`.

---

## 2. Chat (F2)

**Package:** `cli/chat` — `view.go`

The Chat tab is a **read-only viewer** over the single-chat-per-space utterance stream, with one notable write affordance: push-to-talk voice capture. It is deliberately read-only for text because sending utterances requires a participant row owned by the BFF-side join flow — and the cockpit's scope is an operations console.

```go
// One pane per axis: left lists active spaces (v1:cognition:space rows),
// right shows the most-recent utterances for the selected space
// (v1:cognition:utterance rows, ordered oldest -> newest).
//
// This is a viewer only; sending utterances requires a participant row...
// The cockpit is an operations console -- read-only chat is the right scope.
```
*Source: `cli/chat/view.go`*

### Layout and behavior

The left pane lists active `v1:cognition:space` rows; the right pane shows up to `maxUtterances = 200` of the most recent utterances for the selected space, oldest → newest, with humans rendered in a subtle style and agents/SI in an accent style. When no cluster is connected, the view draws its own inline placeholder ("Chat: connect to a cluster from the Clusters tab to view spaces.") rather than going through the shared `GatedMessage` path.

A background refresher (`StartRefreshLoop`) re-polls spaces and utterances. There is a daily-space affinity: until you manually pick a space this session (`userPickedSpace`), the refresher auto-snaps the highlight to today's daily space on every refresh, so a freshly-provisioned daily lands selected even if it arrives a tick after first paint. The view also calls `ensureDailySpaceForCaller` once per session (`ensureRan`).

### Push-to-talk (PTT)

The one interactive capability is voice capture, toggled with **Ctrl+Space**. It drives the memql-sdk-go `voice.PushToTalk` helper through the active cluster's stream dispatcher:

```go
final, err := voice.PushToTalk(ctx, dispatcher, reader, voice.Options{ ... })
```
*Source: `cli/chat/view.go`*

The PTT state (`listening` / `transcribing` / `done` / `error`) surfaces in the chat pane's title strip. A silence watchdog auto-stops capture after `pttSilenceWindow = 4s` without a new partial transcript (re-checked every `pttWatchdogTick = 500ms`), so a forgotten Ctrl+Space doesn't leave the mic open indefinitely. The pane hints reflect this:

```go
bar := ui.HintBar{Chips: []ui.HintChip{
    {Key: "↑/↓", Label: "Scroll"},
    {Key: "Ctrl+Space", Label: "Talk"},
    {Key: "Tab", Label: "Cycle"},
    // ...
}}
```
*Source: `cli/chat/view.go`*

**Tab** cycles focus between the spaces list and the utterance scroll.

---

## 3. Concepts (F3)

**Package:** `cli/concepts` — `view.go`, `render.go`

The Concepts tab is the unified concept browser that replaced the older Explorer + Agents tabs. It is a three-pane view — concept picker (left), row list with search (middle), generic detail renderer (right) — backed by `ListConcepts` + `ExecuteQuery`. There is deliberately *no* per-concept renderer: it walks each row's payload and metadata generically, so a newly-declared concept works the day it is declared.

```go
const (
    FocusConcepts FocusPane = 0
    FocusRows     FocusPane = 1
    FocusDetail   FocusPane = 2
)
```
*Source: `cli/concepts/view.go`*

This file is the canonical reference for the TUI composable-widget refactor; every other view migration follows its shape (embed `ui.BaseView`, use `ui.ListPane`/`ui.DetailPane`/`ui.Viewer`, compose hints with `ui.HintBar`).

### The three panes

- **Concepts (left):** the concept registry, sorted `domain:entity` alphabetical so cognition/agents/etc. stay grouped. **Enter** drills into a concept, loading its rows.
- **Rows (middle):** rows for the selected concept. Press **`:`** to open a vim-style search band — the hint shows `:search <text>_` — that filters rows in memory (`rowFilter` → `rowMatches`). **Esc** clears the active search.
- **Detail (right):** a pseudo-MemQL render of the highlighted row, syntax-highlighted via the Sense client and laid out by `ui.Viewer` (line numbers, hard-wrap, block tinting). The Sense call is a gRPC round-trip, so detail is re-tokenized only when the highlighted row changes (`detailCacheRowId`), not on every redraw. The viewer degrades gracefully (no spans, but still wraps/numbers/tints) when no Sense client is available.

### Version history

Pressing **`v`** on a selected row toggles a **version-history overlay**: the detail pane swaps from the current snapshot to the time-series of all versions of that row, fetched via the query client and sorted newest-first by `createdAt`:

```go
if keyEv.Key() == tcell.KeyRune && (keyEv.Rune() == 'v' || keyEv.Rune() == 'V') {
    if v.versionsOpen {
        v.versionsOpen = false
        // ...
    }
}
// ...
v.versionRows = res.RawNodes()  // RawNodes preserves createdBy + provenance
sort.Slice(v.versionRows, func(i, j int) bool {
    return getString(v.versionRows[i], "createdAt") > getString(v.versionRows[j], "createdAt")
})
```
*Source: `cli/concepts/view.go`*

`RawNodes()` is used (not the projected rows) so each version retains its `createdBy` and provenance. **Esc** closes the overlay. The row-pane hint bar therefore reads: `↑/↓ Move · Enter Detail · Search · V Versions · Tab Cycle · Esc ClearSearch`.

---

## 4. Planner (F4)

**Package:** `cli/planner` — `view.go`

The Planner tab is a **read-only operator surface** for watching the planner work: it observes `v1:planner:plan` and `v1:planner:task` rows in the connected cluster. Goal *submission* lives in the Chat tab (you talk to the assistant, which decides whether to escalate to the planner); this tab is for watching, not driving. The one write it performs is advancing a plan that is awaiting confirmation.

```go
// The one mutation that remains is mutationStartPlan: when a plan sits
// in status="queued" awaiting user confirmation, pressing R on the
// Plans pane flips it to running.
```
*Source: `cli/planner/view.go`*

### Three panes

- **Plans (left):** all plans from `queryAllPlans`.
- **Tasks (middle):** the tasks for the selected plan (`queryTasksForPlan`).
- **Task Detail (right):** input/output/metadata of the selected task, in a `ui.DetailPane`.

Focus cycles `Plans → Tasks → TaskDetail` with **Tab** (`focusPaneCount = 3`). A background refresher re-pulls plans and the selected plan's tasks every interval.

### Running a queued plan

When the highlighted plan is in `status="queued"` (planning is complete, awaiting your go-ahead), the Plans-pane hint shows an enabled **R:Run** chip; on any non-queued row R is a no-op and the chip is disabled:

```go
canRun := ... && getString(v.plans[v.planList.Selected], "status") == "queued"
bar := ui.HintBar{Chips: []ui.HintChip{
    {Key: "↑/↓", Label: "Move"},
    {Key: "Enter", Label: "Tasks"},
    {Key: "R", Label: "Run", Disabled: !canRun},
    {Key: "Tab", Label: "Cycle"},
}}
```
*Source: `cli/planner/view.go`*

R calls `mutationStartPlan` to flip the plan to running:

```go
if _, err := qc.MutationStartPlan(ctx, client.MutationStartPlanArgs{PlanId: planID}); err != nil { ... }
```
*Source: `cli/planner/view.go`*

The Task Detail pane also surfaces `v1:agents:skillChangeEvent` rows for the selected plan's `ownerAgentId` (newest first), so an operator can correlate planner `mintSkill` / `extendSpecialist` actions with the underlying skill-attach events.

### DSL-missing gate

If the cluster's BFF returns "function not found" for a Planner query, the view *latches* `dslMissing`: the refresher stops re-issuing the failing call (no point burning an RTT every 3s) and Draw renders an explanatory screen. Pressing **R** clears the latch, so re-deploying a BFF that loads the Planner DSL recovers without restarting the cockpit. This same self-healing pattern is reused by the Safety tab.

---

## 5. Skills (F5)

**Package:** `cli/skills` — `view.go`

The Skills tab is a **read-only catalog browser** for the `v1:agents:skill` rows the connected cluster has loaded. Creation/editing is out of scope: the catalog is seeded from `dsl/agents/skills/*.memql` on every startup, and runtime mints arrive via the Planner Agent's `mintSkill` flow. This view is the operator's window into what shipped versus what the planner added.

It is a standard two-pane list+detail layout (`FocusList` / `FocusDetail`, **Tab** to cycle). Data comes from `QueryActiveSkillsFull`, which returns each row with its full bundle composition. Rows are sorted **predefined first** (catalog-anchored), then by category, tier, and name — stable, so re-renders don't shuffle rows under the cursor:

```go
sort.SliceStable(rows, func(i, j int) bool {
    pi := boolFrom(rows[i], "predefined")
    pj := boolFrom(rows[j], "predefined")
    // ... then category, tier, name
})
```
*Source: `cli/skills/view.go`*

Each list item shows a `*` marker for predefined rows, the skill name, and `[tier X]`, with the category as the subtitle. The detail pane lays out the full bundle composition:

```go
lines = append(lines, kv("category", getString(s, "category")))
lines = append(lines, kv("tier", getString(s, "tier")))
lines = append(lines, kv("predefined", boolLabel(boolFrom(s, "predefined"))))
// ...
lines = append(lines, section("knowledge domains"))
addList(&lines, stringSliceFrom(s, "domainIds"), "(no domains bundled)")
lines = append(lines, section("tools / integrations"))
addList(&lines, stringSliceFrom(s, "toolSlugs"), "(no tools bundled)")
lines = append(lines, section("live knowledge sources"))
addList(&lines, stringSliceFrom(s, "liveSourceIds"), "(no live sources bundled)")
lines = append(lines, section("lineage"))
```
*Source: `cli/skills/view.go`*

So for a selected skill you see: category, tier, predefined flag, bundled knowledge domains, bundled tools/integrations, bundled live knowledge sources, and lineage (predefined vs minted). **R** refreshes the catalog on demand in addition to the background poll.

---

## 6. Workers (F6)

**Package:** `cli/workers` — `view.go`

The Workers tab is the cockpit's window into the **local worker daemon's computer-use consent state**. Unlike the cluster-data tabs, it does not talk over cluster gRPC; it is a long-running client of a Unix-socket consent server at `~/.memql/worker.sock` that exposes grant / revoke / status / approve / deny / watch operations. The tab renders the current consent window (state, expiry, strict flag) plus a live tail of every worker tool dispatch (allowed and denied).

```go
type Client interface {
    Status() (consent.Response, error)
    Grant(window time.Duration, strict bool, region *consent.Region) (consent.Response, error)
    Revoke() (consent.Response, error)
    Approve(id string) (consent.Response, error)
    Deny(id string) (consent.Response, error)
    Watch(ctx context.Context, onEvent func([]byte)) error
}
```
*Source: `cli/workers/view.go`*

It is single-pane (no internal focus switching). The `Client` is an interface so tests can inject a fake without standing up a real socket; `nil` means "use the default Unix socket." The Watch loop reconnects with a `reconnectBackoff = 2s` delay so the pane wakes up quickly once the worker starts but doesn't busy-loop when it's down. An offline daemon surfaces `lastErr` in the status block so you can tell a down daemon from a different problem.

### Granting a window

Pressing **G** opens the **Grant modal**, a duration picker whose presets are ordered with the safest default at the top so a blind Enter picks the most conservative window:

```go
var grantPresets = []grantPreset{
    {Label: "5 minutes",            Duration: 5 * time.Minute},
    {Label: "1 hour",               Duration: 1 * time.Hour},
    {Label: "Rest of session (8 h)", Duration: 8 * time.Hour},
}
```
*Source: `cli/workers/view.go`*

The modal is two-stage. A non-strict grant submits straight from the duration stage; toggling **strict** (the **S** key) advances to a **region stage** where the operator can optionally draw an in-region exemption rectangle:

```go
const (
    grantStageDuration grantStage = iota
    grantStageRegion
)
```
*Source: `cli/workers/view.go`*

The region picker works in a fixed 1920×1080 reference space (the worker has no window-bounds API yet); the x/y/w/h you set are absolute screen pixels. The region-stage hints are `↑/↓/←/→ Move · Shift+Arrows Resize · Enter Grant · N NoRegion · Esc Back`.

### Revoke, kill switch, and strict-mode approvals

The main-pane hints are context-aware — `G:Grant` is disabled while a window is open, `R:Revoke` and `Ctrl+E:KillSwitch` are disabled while none is:

```go
chips := []ui.HintChip{
    {Key: "G", Label: "Grant",      Disabled: v.status.Granted},
    {Key: "R", Label: "Revoke",     Disabled: !v.status.Granted},
    {Key: "Ctrl+E", Label: "KillSwitch", Disabled: !v.status.Granted},
    {Key: "↑/↓", Label: "Scroll",   Disabled: len(v.events) == 0},
}
```
*Source: `cli/workers/view.go`*

**Ctrl+E is a *global* kill switch** wired in `cli/app.go` — it revokes from *any* tab without switching here first, and works even while a modal is open in the Workers tab, so an operator can always cut access in one keystroke:

```go
if ev.Key() == tcell.KeyCtrlE {
    a.handleKillSwitch()
    return false
}
```
*Source: `cli/app.go`*

When strict mode is enabled, individual high-risk actions (typed text, non-region-confined mouse clicks) arrive as **per-action approval requests** over the Watch stream. They queue FIFO (`approvalQueue`); the head of the queue is the modal you see, resolved with **A** (Allow) / **D** (Deny). Entries are added on `EventApprovalRequested` and removed by id on `EventApprovalResolved`, which covers the timeout / revoke / foreign-resolver paths even when your local Allow/Deny RPC didn't fire.

### Audit tail

The audit pane is a bounded ring buffer (`maxAuditEvents = 256`) rendered newest-first via a `ui.ListPane` — a live tail, not a durable log (a persistent record lives on the worker side and ships separately). Granted/revoked transitions are reflected immediately from the Watch stream's `EventGranted` / `EventRevoked` events.

---

## 7. Safety (F7)

**Package:** `cli/safety` — `view.go`, `filter.go`

The Safety tab is a **read-only operator surface** for the `v1:safety:classification` rows emitted by the memQL command-classifier. Its purpose is concrete: the classifier rollout needs operators to see what *shadow mode* would have done so they can flip `MEMQL_COMMAND_CLASSIFIER_MODE` per surface using false-positive/false-negative data instead of by gut feel.

```go
// Data plane: queryAllSafetyClassifications. Layered, surface-specific
// queries land on the memQL side when the row count justifies them;
// the view filters in memory until then...
```
*Source: `cli/safety/view.go`*

It is a two-pane list+detail (`FocusDecisions` / `FocusDetail`, **Tab** to cycle). The decisions list is newest-first; the detail pane is a generic field list of the selected classification. It reuses the Planner tab's `dslMissing` self-healing gate (latch on "function not found", clear on **R**) and a 6s per-refresh timeout.

### In-memory filtering

The distinguishing feature is its filter strip. The view holds a `Filter` and applies it in memory to produce `rowMatches`:

```go
type Filter struct {
    Surface  string
    Decision string
    // Source, Tier, Mode, Search ...
}
```
*Source: `cli/safety/filter.go`*

Dedicated single-key cycles advance each fixed-enum filter through its values (with `""` = "any", rendered as `*`):

```go
var (
    decisionCycle = []string{"", "allow", "ask", "deny"}
    sourceCycle   = []string{"", "rule", "model", "cache", "noop", "disabled"}
    tierCycle     = []string{"", "none", "low", "medium", "high", "critical"}
    modeCycle     = []string{"", "off", "shadow", "enforce"}
)
```
*Source: `cli/safety/filter.go`*

The key bindings, from `HandleEvent`:

- **D** → cycle Decision (allow / ask / deny)
- **S** → cycle Source (rule / model / cache / noop / disabled)
- **T** → cycle Tier (none / low / medium / high / critical)
- **U** → cycle Surface (dynamic — built from the distinct `surface` values present in the loaded rows)
- **M** → cycle Mode (off / shadow / enforce)
- **`:`** → free-text case-insensitive substring search
- **Esc** → clear all active filters (the hint's `ClearFilters` chip is disabled when no filter is active)
- **R** → refresh

```go
case 'd', 'D':
    v.filter.Decision = cycleNext(decisionCycle, v.filter.Decision)
    v.recomputeMatchesLocked()
// ... s/S, t/T, u/U (cycleSurface), m/M similarly
```
*Source: `cli/safety/view.go`*

Below the row list, an aggregate strip (`Summarise`) shows totals and per-Decision / per-Source / per-Tier / per-Mode breakdowns across the active filter, followed by the filter-chip strip and the hint row.

---

## 8. Settings (F8)

**Package:** `cli/settings` — `view.go`

The Settings tab is informational and has **no interactive panes** — its `HandleEvent` returns `false` unconditionally. It is a two-column layout: an "ABOUT" / "MY ACCESS" / "QUICK START" column on the left and a keyboard-shortcut reference on the right.

```go
func (v *View) HandleEvent(ev tcell.Event) bool {
    return false
}
```
*Source: `cli/settings/view.go`*

**ABOUT** shows the product name and the CLI version passed in at construction. **MY ACCESS** renders the resolved access record for the currently-selected cluster — User ID, primary email, and cluster role (owner / admin / writer / reader) — or a "Connect to a cluster to see your access" placeholder when none is set. The record is pushed in from the app's `refreshMyAccess` goroutine via `SetMyAccess`/`ClearMyAccess` (guarded by the view's own mutex):

```go
func (v *View) SetMyAccess(clusterName string, access *client.AccessSummary) { ... }
func (v *View) ClearMyAccess() { ... }
```
*Source: `cli/settings/view.go`*

**QUICK START** is a five-step "add and connect a cluster" walkthrough. The right column is a static, sectioned keyboard-shortcut reference (GLOBAL, CLUSTERS, TOPOLOGY, CONCEPTS). As noted earlier, the GLOBAL section's `F2 → Concepts` / `F3 → Settings` lines are stale relative to the current eight-tab order.

---

## Supporting packages (machinery, not tabs)

Several `cli/` subpackages are infrastructure that the tabs lean on but that are not themselves tabs.

### `cli/editor` — MemQL text-editor component

`cli/editor` is a full text-editor component with syntax highlighting, diagnostics, completion, and hover, built on the Sense gRPC surface:

```go
type Editor struct {
    Buffer      *Buffer
    Theme       ui.Theme
    CursorLine  int
    CursorCol   int
    Tokens      []sense.Token
    Diagnostics []sense.Diagnostic
    // highlights, diagnosticMap, ErrorCount, WarningCount ...
}
```
*Source: `cli/editor/editor.go`*

It is a reusable widget (line-number gutter, diagnostic icons, async Sense updates), not wired into any of the eight registered tabs on the current branch — no non-test file under `cli/` imports `cli/editor`. Treat it as available machinery (e.g. for a future authoring surface) rather than a live feature. [VERIFY: no current tab mounts the editor; grep for `cli/editor` importers returns only the package's own test files.]

### `cli/auth` — identity-service authentication

`cli/auth` implements the cockpit's login against memQL's in-house identity service. The flow is an RFC 6749 Authorization Code grant, but identity replaces the standard `/authorize` page with an email-driven `/login` + magic-link completion (it is *not* an OIDC provider — there is no `/.well-known/openid-configuration`):

```
// 1. Cockpit opens a loopback HTTP listener on a random port.
// 2. Cockpit opens the browser at <issuer>/login?return_to=http://127.0.0.1:<port>/cockpit/callback
// 3. User enters email; identity issues a magic link.
// 4. Magic link -> /auth/complete -> 302 to the loopback callback with ?code=...
// 5. Cockpit swaps the code for an access+refresh pair at <issuer>/oauth/token.
```
*Source: `cli/auth/oauth.go`*

`EnsureValidToken` (in `cli/auth/token.go`) is the entry point the connection layer calls. Its resolution priority: a configured PAT (`mql_pat_…`, sent as `Authorization: Bearer`) short-circuits everything; otherwise a cached+fresh access token is returned as-is; an expired token triggers a silent `/auth/refresh`; and only a missing/`invalid_grant` case opens the browser for a fresh login. There is deliberately **no no-auth shortcut** — every path goes through identity, including in dev.

This is what backs the Clusters tab's `OnAuthorize` / `OnLogin` callbacks; the tab triggers the flow, `cli/auth` runs it.

### `cli/config` — cluster registry and credential storage

`cli/config` owns persistence. Cluster definitions live in `~/.memql/clusters.yaml`:

```go
type ClusterConfig struct {
    Name        string `yaml:"name"`
    DisplayName string `yaml:"display_name,omitempty"`
    Endpoint    string `yaml:"endpoint"`     // gRPC address (host:port)
    Issuer      string `yaml:"issuer,omitempty"`
    ClientId    string `yaml:"client_id,omitempty"`
    PAT         string `yaml:"pat,omitempty"`
}
```
*Source: `cli/config/clusters.go`*

Credentials (the OAuth token pairs minted by `cli/auth`) are persisted through a `CredentialStore` interface with two backends:

```go
//   - FileStore    -- ~/.memql/credentials/<cluster>.json at mode 0600 (fallback)
//   - KeyringStore -- OS keyring (Keychain / Secret Service / Credential Manager), preferred
// Resolve() builds the active store: MEMQL_COCKPIT_CRED_STORE forces a backend,
// otherwise keyring is tried first and the file store is the fallback.
```
*Source: `cli/config/credstore.go`*

The keyring backend was added to eliminate the plaintext-on-disk surface; the chosen backend is logged at INFO on startup so an operator can see which one won. The Clusters tab is the only surface that mutates this registry (via its `OnAdd` / `OnSave` / `OnDelete` callbacks); every tab that reads cluster data resolves a token through `cli/auth` + `cli/config` under the hood.

---

## Summary

The Cockpit is eight tabs over one tab bar: **Clusters** is the connection and topology hub; **Chat**, **Concepts**, **Planner**, **Skills**, and **Safety** are cluster-gated read surfaces (with two surgical writes — Chat's push-to-talk and Planner's run-a-queued-plan); **Workers** is an ungated local consent dashboard backed by a Unix socket; and **Settings** is static reference. They share one widget vocabulary (`ListPane` / `DetailPane` / `HintBar`, `Tab`-cycled focus), one crash-isolation wrapper, and one gating mechanism. The `editor`, `auth`, and `config` packages are the machinery beneath them — a reusable MemQL editor component, the identity-service login flow, and the cluster/credential persistence layer respectively.
