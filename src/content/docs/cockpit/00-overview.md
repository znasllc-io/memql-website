# memQL Cockpit — Overview

memQL Cockpit is the terminal-native IDE and operations console for memQL clusters. It is a single Go binary that renders a multi-tab TUI (built on [tcell](https://github.com/gdamore/tcell)), talks to memQL clusters over gRPC, and embeds no engine of its own. Engineers and operators use it to connect to one or more clusters, browse concept rows, watch planner activity, manage computer-use worker consent, review command-safety classifications, and adjust settings — all from one terminal session. This document explains what the Cockpit is, how it launches, the list-and-detail layout paradigm every tab follows, and how it establishes a connection (genesis envelope, `--endpoint`/`--cluster` flags, and auth). It corrects one common misconception up front: **the Cockpit is not a live-event-stream dashboard. It is a list-and-detail IDE** whose tabs poll typed query primitives or maintain narrow subscriptions, and render rows you select into a detail pane.

> Documentation snapshot. This page describes the Cockpit as of the public `memql-cockpit` repository at commit `de74faf` (the Command Safety tab landing, PR #135). That tree is roughly 15 commits behind the internal mainline; it is a near-latest snapshot, and small details — tab additions, key bindings — may have moved forward since. Where this page cites code, the file path is given so you can re-verify against the source you have.

---

## What it is

From the package doc at the top of `cli/app.go`:

```go
// Package cli implements the memQL Cockpit -- a terminal-native IDE
// and operations console for memQL clusters.
package cli
```

The README states the architecture constraint plainly:

> It communicates with memQL clusters over gRPC (`MemqlService.Stream` and `NodeService.Stream`) and does not embed the memQL engine.

*Source: `README.md`*

That single sentence is the load-bearing fact about the Cockpit. It is a **client**. It holds no database connection, runs no DSL engine, and stores no graph state. Every read it shows and every mutation it issues travels over a gRPC stream to a memQL node, through the memQL Go SDK (`github.com/znasllc-io/memql/sdk/go`). The Cockpit imports the SDK's `client`, `sense`, and `voice` packages rather than reimplementing the wire layer — a rule enforced repo-wide (see `cli/CLAUDE.md`, "SDK-only rule"): no direct `grpc.NewClient` dials and no raw DSL strings anywhere under `cli/**`.

The binary is `memql-cockpit`, built from `cmd/memql-cockpit/`. Its display name in the header chrome and Settings is "memQL Cockpit". Two build variants exist:

```bash
make cockpit          # headless variant (default, ships everywhere)
make cockpit-gui      # GUI variant with screenshot/mouse/keyboard
                      # (requires CGO + RobotGo deps -- see Makefile)
```

*Source: `README.md`*

The headless variant is the operations console. The GUI variant adds screenshot/mouse/keyboard capabilities used only by the computer-use worker run-mode (RobotGo, behind a CGO build tag); it is not needed to run the IDE.

> Status: Alpha / pre-1.0. The README marks the project "not production-ready … The TUI, worker contract, and configuration are still evolving; expect breaking changes between commits." Treat this as early-design software that tracks memQL core.

### What it is *not*

The mental model to discard is "real-time dashboard streaming a firehose of cluster events." That is not how the Cockpit works. Concretely:

- The **Concepts** tab fetches the concept registry once on connect (`q.ListConcepts(ctx)` in `App.refreshConcepts`, `cli/app.go`) and then browses rows you pick. It is a list-list-detail browser, not a tail.
- The **Planner**, **Skills**, **Chat**, and **Safety** tabs each run a *polling* refresh loop on a fixed cadence (3s, 30s, 3s, and 5s respectively — see the `wire*` functions in `cli/app.go`), not a push subscription. The wiring comments are explicit, e.g. `wirePlanner`: "polls `queryAllPlans` + `queryTasksForPlan` periodically so Plan / Task state appears live without subscriptions."
- The only genuine subscription the Cockpit holds is a narrow one, per connected cluster: it subscribes to `node.created.v1:cluster:node` so the **Clusters** tab's topology diagram reflects nodes joining/leaving (`connEntry.dialOnce` in `cli/pool.go`). That feeds the topology grid, nothing else.

So the live element is scoped to cluster topology. Everything else is a periodic read of typed query primitives rendered into list-and-detail panes.

---

## The tabs

Tabs are registered in `NewApp` (`cli/app.go`) as an ordered list passed to `ui.NewTabBar`:

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

*Source: `cli/app.go` (`NewApp`)*

`F1`..`F8` switch tabs in that order. The ordering is deliberate — the inline comment notes Clusters comes first because "it's the starting context for the session," and Chat sits at F2 "because the daily-space conversation is the primary surface users open after connecting."

| Key | Tab | What it shows | Gated on a connected cluster? |
|-----|-----|----------------|-------------------------------|
| F1 | **Clusters** | Cluster manager (left) + live topology / architecture navigator (right) | No (it *is* the connection surface) |
| F2 | **Chat** | Single-chat-per-space utterance viewer; today's daily space pinned and auto-selected | Yes |
| F3 | **Concepts** | Generic browser for every registered concept: picker + row list + detail | Yes |
| F4 | **Planner** | Read-only `v1:planner:plan` + child `v1:planner:task` rows; `R:Run` flips a queued plan to running | Yes |
| F5 | **Skills** | Read-only catalog of `v1:agents:skill` rows, grouped by category + tier | Yes |
| F6 | **Workers** | Computer-use consent dashboard + live audit tail over `~/.memql/worker.sock` | **No** (local Unix socket, not cluster gRPC) |
| F7 | **Safety** | Command Safety: paginated `v1:safety:classification` decision list + filters + drill-down | Yes |
| F8 | **Settings** | Credentials, theme, version, "My Access" block | No |

*Sources: `cli/app.go` (`NewApp`, the `wire*` functions) and `cli/CLAUDE.md` ("Tab Order").*

Two notes worth internalizing:

- **Most tabs are gated on a connected, selected cluster.** Concepts, Planner, Skills, Chat, and Safety render a placeholder until you press `Enter` on a connected cluster row in the Clusters tab. The selection drives which cluster's dispatcher those tabs target (`App.activeDispatcher` in `cli/app.go`).
- **Workers is the exception.** It speaks to a per-user worker daemon over a local Unix socket (`~/.memql/worker.sock`), not to the cluster's gRPC plane, so it works even with no cluster connected. The wiring comment in `wireWorkers` (`cli/app.go`) spells this out.

The Agents and Explorer tabs that older material references no longer exist; per `cli/CLAUDE.md` they were folded into the unified Concepts tab (2026-05-16 and 2026-05-21), which now renders agent rows by consuming `@displayCard` hints memql core publishes on `ConceptInfo.display_card`.

---

## The launch flow

`App.Run` (`cli/app.go`) documents and implements a three-stage launch sequence. The IDE does not mount until the user has passed through it.

```go
// Launch sequence:
//  1. Pre-flight wizard -- if ~/.memql/genesis.znas is missing,
//     the first-launch wizard runs and seals an envelope. User
//     can cancel out, in which case Run returns without entering
//     the IDE.
//  2. Launch splash -- numbered options to pick the entry mode.
//     '1' = operating console (multi-tab IDE), '2' = run-local
//     placeholder, 'Q' = quit.
//  3. Operating console -- the multi-tab IDE. Connection
//     goroutines start here, not before, so the wizard / splash
//     run on a quiet screen.
```

*Source: `cli/app.go` (`Run` doc comment)*

### Stage 1 — genesis wizard (first launch only)

If `~/.memql/genesis.znas` is absent, the first-launch genesis wizard runs. `App.shouldRunGenesisWizard` (`cli/app.go`) treats *absence* of the envelope as the trigger; presence — even of an outdated envelope — means "operator already set up, don't re-prompt." The path is resolved by `genesisFilePath` (`cli/app.go`): `$MEMQL_GENESIS_PATH` wins, otherwise `~/.memql/genesis.znas`.

The wizard itself lives in `cli/wizard/genesis/genesis.go`. Its package doc:

```go
// Package genesis hosts the first-launch wizard that creates the
// operator's ~/.memql/genesis.znas envelope from a .env file. Wraps
// memql/component/genesis.Seal in a tcell single-panel TUI.
```

It walks the operator through picking a `.env` file, validating it, generating the master key, and sealing the envelope (`Result` is `ResultCanceled`, `ResultSealed`, or `ResultError`). If the user cancels, `Run` returns without entering the IDE.

### Stage 2 — launch splash

After any genesis wizard, the splash screen renders. It is launch-only — once you pick, the main TUI takes over for the session with no "return to splash" binding (`cli/splash/splash.go` package doc). The splash presents three numbered options:

```go
options := []string{
    "  1   Take the controls",
    "  2   Set up local cluster",
    "  Q   Quit",
}
```

*Source: `cli/splash/splash.go` (`draw`)*

The choices map to:

```go
const (
    ChoiceQuit             Choice = iota // Ctrl+Q / Ctrl+C / 'q'
    ChoiceOperatingConsole               // '1' -- open the multi-tab IDE
    ChoiceRunLocalCluster                // '2' -- placeholder wizard for now
)
```

*Source: `cli/splash/splash.go`*

- **`1` — Take the controls** enters the operating console (the multi-tab IDE).
- **`2` — Set up local cluster** opens the run-local wizard (`cli/wizard/runlocal/runlocal.go`). That wizard probes whether a local memQL cluster is already running: if so, it shows the service inventory and status; if not, it runs a dependency check (docker, mkcert, free ports) and surfaces remediation hints. The wizard's `Esc` returns to the splash (`ChoiceBack`), so the splash is a hub you can dip into and come back from — the `Run` loop in `cli/app.go` re-shows the splash until the user picks the operating console.
- **`Q` — Quit** exits.

The `App.Run` loop wires this up:

```go
enterOperatingConsole := false
for !enterOperatingConsole {
    switch splash.Run(a.screen, a.theme) {
    case splash.ChoiceQuit:
        return nil
    case splash.ChoiceRunLocalCluster:
        switch runlocal.Run(a.screen, a.theme) {
        case runlocal.ChoiceQuit:
            return nil
        case runlocal.ChoiceBack:
            // loop back to splash
        }
    case splash.ChoiceOperatingConsole:
        enterOperatingConsole = true
    }
}
```

*Source: `cli/app.go` (`Run`)*

### Stage 3 — operating console

On entering the console, the Cockpit auto-seeds the local cluster from the genesis envelope (`autoSeedLocalFromGenesis`, covered below), refreshes the cluster list, draws once, and then starts the background connection goroutines:

```go
go a.connect()
go a.backoffRedrawLoop()
```

*Source: `cli/app.go` (`Run`)*

Note the ordering the comment calls out: connection goroutines start *here*, after the splash/wizard, "so the wizard / splash run on a quiet screen." From this point the event loop polls tcell events, dispatches them to the active tab, and redraws.

---

## The list-and-detail layout paradigm

Every interactive surface in the Cockpit follows one of two layout patterns, and the rule is non-negotiable (`cli/CLAUDE.md`, "Canonical-TUI rule"): every interactive flow uses the `cli/ui/` (tcell) and `cli/canvas/` (pixel framebuffer) primitives. The two patterns are:

1. **Multi-tab IDE** — the operations console (`cli.App`), with the full F1..F8 tab bar. This is the default `memql-cockpit` invocation.
2. **Single-panel wizard** — focused, time-bounded flows like `memql-cockpit-gui worker setup`, the genesis wizard, and the run-local wizard. Same header chrome, but the tab bar is replaced with a context-specific hint footer and the content area renders one bordered panel centered in the available space.

Within the multi-tab IDE, tabs share a **list-and-detail** structure. The Clusters tab is the reference implementation, and `cli/CLAUDE.md` documents its layout:

```
┌──────────────────────────┬───────────────────────────────────┐
│ CLUSTERS                 │ TOPOLOGY                          │
│  CLUSTER MANAGER         │                                   │
│   ▸ ● local       *      │   [bff] -- [cognition]            │
│     ○ acme               │       \                           │
│   ─────                  │        [agent]                    │
│   Endpoint  ...          │                                   │
│   Status    connected    │                                   │
│  A:Add E:Edit Enter:Sel  │                                   │
└──────────────────────────┴───────────────────────────────────┘
```

*Source: `cli/CLAUDE.md` ("Clusters Tab Layout")*

The Concepts tab generalizes the pattern to three panes (`cli/CLAUDE.md`, "Concepts tab layout"): a concept picker, a row list with search, and a generic detail renderer. The detail pane is deliberately concept-agnostic — "no concept-specific rendering, just a recursive walk of the row's payload + provenance + intrinsics," so a newly declared concept browses correctly the day it ships with no renderer update.

Two layout conventions are worth knowing as a user:

- **Highlight vs. selection are two distinct axes** (`cli/CLAUDE.md`, "List-pane conventions"). The *highlight* is the cursor — it moves with arrow keys and never persists. The *selection* (or "active") is the chosen item — marked with `*`, persisted in config, and it drives downstream behavior. In the Clusters tab the highlight (arrow keys) changes which cluster the topology pane renders (`App.setViewed` in `cli/app.go`), while `Enter` promotes the highlighted cluster to your "working cluster" (`App.setSelected`), which is what the data tabs target. The two are tracked separately in `App` as `a.viewed` and `a.selected`.
- **Pane chrome is pinned.** Pane titles, action-hint chips (`Key:Label` joined by two spaces), optional detail blocks, and search prompts all live in fixed bands; only the row list scrolls inside what's left (`cli/CLAUDE.md`, "Panel chrome contract"). Search is invoked by `:` (colon), not `/`, and renders inline in the bottom chrome band.

### Global key bindings

| Key | Action |
|-----|--------|
| `F1`..`F8` | Switch tab |
| `Ctrl+Q` / `Ctrl+C` | Quit |
| `Ctrl+?` | Toggle the help overlay |
| `Ctrl+K` | Dismiss the current header notification |
| `Ctrl+Y` | Copy the current notification's message to the clipboard |
| `Ctrl+E` | Computer-use kill switch — revoke worker consent from any tab |

*Sources verified in `cli/app.go` (`dispatchEvent`). `Ctrl+T:Cycle theme` is listed in `cli/CLAUDE.md`'s global table but its handler is not in `dispatchEvent`; [VERIFY: theme-cycle key binding — likely handled inside the Settings view rather than the global dispatcher].*

`Ctrl+E` is notable: it's a global kill switch that calls `workersView.Revoke()` over the consent socket from any tab, available even while a modal is open, so an operator can cut computer-use access in one keystroke (`App.handleKillSwitch` in `cli/app.go`).

The event loop is also crash-isolated. Each per-tab `Draw` / `HandleEvent` and the main loop iteration run under `crash.Catch`; a panic in one tab is logged, surfaced as a notification, and replaced by an inline error placeholder for that tab, rather than killing the whole process (`App.Run` and `App.dispatchEvent`, `cli/app.go`). Switching away from and back to a broken tab clears its sticky crash state and retries it.

---

## How it connects

There are three ways the Cockpit decides what to dial, resolved at startup by `resolveCluster` (`cmd/memql-cockpit/main.go`), and a connection pool that manages the lifecycle of each cluster.

### Connection inputs: `--endpoint`, `--cluster`, and the genesis-seeded local row

`resolveCluster` applies this precedence:

```go
func resolveCluster(clusterName, endpoint string) (config.ClusterConfig, error) {
    if endpoint != "" {
        return config.ClusterConfig{
            Name:     "direct",
            Endpoint: strings.TrimSpace(endpoint),
        }, nil
    }

    if clusterName != "" {
        clusters, err := config.LoadClusters()
        // ... look up clusterName in ~/.memql/clusters.yaml
    }

    // No --cluster, no --endpoint: fall back to clusters.yaml's "local".
    // ...
    return config.ClusterConfig{Name: "local"}, nil
}
```

*Source: `cmd/memql-cockpit/main.go`*

So:

1. **`--endpoint https://bff.<domain>`** wins outright. It builds an anonymous cluster named `direct` with just that endpoint — no issuer, no client id — useful for pointing at a known node directly.
2. **`--cluster <name>`** looks the name up in `~/.memql/clusters.yaml`. If it isn't there, you get a pointed error: launch the TUI and press `A` to add it, or `L` on the row to authorize it.
3. **Neither flag** falls back to the `local` entry in `clusters.yaml`, or an empty `{Name: "local"}` default if the file has nothing — which the TUI then surfaces as a "needs-auth" state rather than dialing thin air.

The cluster registry lives at `~/.memql/clusters.yaml`. A `ClusterConfig` carries (`cli/config/clusters.go`):

| Field | Purpose |
|-------|---------|
| `Name` | Slot key for lookups (e.g. `local`, `staging`) |
| `DisplayName` | Human-friendly label shown in the row list; falls back to `Name` |
| `Endpoint` | gRPC address |
| `Issuer` | OIDC issuer URL |
| `ClientId` | OAuth2 client id |
| `PAT` | Optional Personal Access Token (`mql_pat_<...>`), sent as `Authorization: Bearer <pat>`; short-circuits the OIDC browser flow |

A cluster is "configured" only when it has an endpoint **and** either a PAT or an OIDC `Issuer`+`ClientId` pair; `ClusterConfig.NeedsAuth` (`cli/config/clusters.go`) returns true otherwise, which drives the "needs-auth" row state and short-circuits the dial lifecycle (no point retrying for 90s against a server you have no bearer for).

### The genesis envelope → local cluster bridge

The built-in `local` cluster ships as a *name slot with no baked-in endpoint* (`defaultLocalClusterConfig` in `cli/cluster/clusters_view.go` is literally `{Name: "local"}`). The endpoint is filled in from the sealed genesis envelope on console entry by `autoSeedLocalFromGenesis` (`cli/app.go`). It decrypts `genesis.znas` (requires `MEMQL_MASTER_KEY` in the environment), reads `IDENTITY_BOOTSTRAP_DOMAIN`, and writes a fully-configured local row to `clusters.yaml`:

```
DisplayName = <domain>                  (e.g. local.znas.io)
Endpoint    = https://bff.<domain>      (NGINX LB entry)
Issuer      = https://identity.<domain> (OIDC issuer)
ClientId    = cockpit                   (registered cockpit client)
```

*Source: `cli/app.go` (`autoSeedLocalFromGenesis` doc comment)*

It is idempotent (re-running with the same domain writes nothing) and silent on failure (no master key, bad envelope) — the operator can always authorize a cluster by hand from inside the TUI. The `Name` slot stays `local`; only `DisplayName` carries the human label.

### The connection pool and lifecycle

Once in the console, `App.connect` (`cli/app.go`) loads the saved clusters, restores the sticky "working cluster" from `clusters.yaml`'s `SelectedCluster`, wires the tab callbacks, and opens a pool entry for **every** cluster in the list — local plus all user-added — each dialing in parallel. Switching clusters in the UI is a pool lookup, not a reconnect.

Each entry is a `connEntry` (`cli/pool.go`) that runs an independent lifecycle goroutine driving a small state machine:

```go
const (
    stateIdle        entryState = iota // brand-new entry, goroutine hasn't started
    stateConnecting                    // dial in flight
    stateConnected                     // live stream, subscriber + monitor running
    stateBackoff                       // waiting between failed attempts
    stateFailed                        // all retries exhausted, awaiting manual retry
    stateNeedsConfig                   // missing endpoint/auth; waiting for L:Authorize
    stateNeedsToken                    // configured but no cached token; waiting for L:Login
)
```

*Source: `cli/pool.go`*

The retry policy is **bounded**: at most 3 attempts per cycle with linear backoff (15s → 30s → 45s, from `backoffFor` in `cli/pool.go`), after which the entry sits in `stateFailed` until the user presses `R` to retry — no infinite reconnect storms. On an *unexpected* stream loss after a successful connect (`Dispatcher.Unexpected()`), the entry re-enters the cycle automatically; an intentional shutdown (`Dispatcher.Done()`) does not.

Two states short-circuit dialing before any network attempt (`App.openEntry`, `cli/app.go`):

- `stateNeedsConfig` — the row has no endpoint, or no PAT and no issuer+client-id pair. The row picks up an `L:Authorize` hint.
- `stateNeedsToken` — the row is fully configured but has no cached OAuth token. Rather than popping a browser the instant the Cockpit launches, the row gets an `L:Login` hint and the user explicitly initiates the magic-link flow. PAT-authenticated rows skip this check (the PAT is itself the credential).

### The actual dial and auth

`connEntry.dialOnce` (`cli/pool.go`) performs one connect cycle:

```go
token, err := auth.EnsureValidTokenWithLogger(ctx, e.Config, e.app.logger)
// ...
conn, err := client.Connect(ctx, client.ConnectConfig{
    Endpoint: e.Config.Endpoint,
    Token:    token,
    Logger:   e.app.logger,
})
// ...
sm := client.NewSubscriptionManager(conn.Dispatcher())
subId, events, err := sm.Subscribe(subCtx,
    client.SubscriptionKindGraphEvents,
    "node.created.v1:cluster:node",
)
```

*Source: `cli/pool.go` (`dialOnce`)*

The sequence is: mint/refresh a bearer via the SDK auth helper, open the gRPC connection through the SDK `client.Connect`, subscribe to `v1:cluster:node` creation events for the topology pane, and seed the initial node list via typed queries (`QueryClusterNodes`, `QueryClusterSpawnEvents`, `QueryClusterNodeTypes`). For the `local` cluster only, `initialLoad` additionally probes Docker for infrastructure containers (LB, DB, identity, Redis, LiveKit, voice-agent) that aren't registered as memQL nodes (`mergeInfraFromDocker`, `cli/pool.go`) — skipped for remote clusters, since local Docker has no relationship to a remote topology.

Authentication supports three credential shapes:

- **OAuth / magic-link (OIDC):** when a row has `Issuer`+`ClientId`, pressing `L:Login` runs the browser auth-code flow (`App.runLoginFlow`, `cli/app.go`), and the minted access+refresh pair is cached on disk. A background **token refresher** (`connEntry.runTokenRefresher`, `cli/pool.go`) rolls the cached token forward ~90s before expiry so a reconnect never falls through to the browser, and it asks the server to rotate the in-stream bearer (`Dispatcher.RotateAuth`) so admin-side revocation / role changes propagate to the live session in seconds rather than waiting for a reconnect.
- **PAT:** a `mql_pat_<...>` token in `clusters.yaml` is sent as a bearer on every request; no browser dance, and the refresher exits immediately for PAT clusters.
- **Discovery URL (`L:Authorize`):** for a brand-new cluster, pressing `L` and pasting a discovery URL fetches the cluster's `clusterName` / gRPC endpoint / identity URL / client id, persists a row, and runs the login flow (`App.runAuthorizeFlow`, `cli/app.go`).

If the server rejects credentials mid-cycle (gRPC `Unauthenticated` / `PermissionDenied`, or well-known reject strings — see `looksLikeAuthRejection` in `cli/pool.go`), the entry deletes the stale token and transitions straight to `stateNeedsToken` so the user gets a fixable "re-login" affordance instead of 90s of silent retrying.

### Credential storage

OAuth access/refresh tokens are stored via a pluggable `CredentialStore` (`README.md`, "Credential storage"). The preferred backend is the OS keyring (Keychain on macOS, Secret Service on Linux, Credential Manager on Windows; service name `com.znasllc.memql-cockpit`), auto-selected when the host exposes a working keyring. The fallback is a file at `~/.memql/credentials/<cluster>.json`, mode 0600 — used on CI runners and headless hosts. Override with `MEMQL_COCKPIT_CRED_STORE=file` or `=keyring`. The cluster registry itself (`~/.memql/clusters.yaml`) always lives on disk, since it carries the endpoint/issuer/PAT needed before any keyring access; its 0600 mode is enforced on load (`VerifyCredentialFileMode`, `cli/config/clusters.go`).

---

## Non-TUI subcommands

The same binary exposes a few non-interactive subcommands, dispatched before flag parsing in `main` (`cmd/memql-cockpit/main.go`). These print plainly and pipe well (per `cli/CLAUDE.md`, "When NOT to use the TUI"):

| Invocation | Purpose |
|-----------|---------|
| `memql-cockpit cluster list` / `remove <name>` | Inspect or prune `clusters.yaml` |
| `memql-cockpit login <cluster>` / `logout <cluster>` | Re-authenticate / clear cached credentials |
| `memql-cockpit worker <subcommand>` | Run as a per-user computer-use worker (`run`, `setup`, `consent`, …) |
| `memql-cockpit creds <subcommand>` | Inspect / migrate the credential store (`status`, `migrate-to-keyring`) |
| `memql-cockpit lint [path]` | Validate a `.memql` file or DSL tree |
| `memql-cockpit --version` | Print version (`0.1.0` in this snapshot) |

The legacy `genesis` and `authorize` subcommands were removed; invoking them prints a one-line pointer that both flows now live in the TUI (the first-launch genesis wizard, and `L:Authorize` on a cluster row). The version string reported by `--version` is the package constant `0.1.0` (`cmd/memql-cockpit/main.go`); the repo's `VERSION` file additionally carries a build-stamped suffix (`0.1.0-1778798225`).

---

## Where to go next

- Cluster management, topology, and the architecture navigator: `cli/CLAUDE.md` ("Clusters Tab Layout", "Architecture navigator").
- The computer-use worker consent model, strict mode, and region exemption: `README.md` ("Computer-use consent gate") and `cli/CLAUDE.md` (Workers tab, F6).
- The SDK contract every wire call rides on: `cli/CLAUDE.md` ("SDK-only rule") and `memql/sdk/go/CLAUDE.md`.
