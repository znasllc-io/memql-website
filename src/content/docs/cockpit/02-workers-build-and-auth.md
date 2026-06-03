# memQL Cockpit — Worker Modes, Build Variants & Auth

memQL Cockpit (`memql-cockpit`) is a single binary that wears two hats. Most of the time it is a terminal-native IDE and operations console — a multi-tab TUI you launch with no arguments. But run it as `memql-cockpit worker ...` and it becomes a **per-user worker**: it dials a memQL cluster over gRPC, registers the local machine, and serves dispatched tool calls (shell exec, filesystem, HTTP, and — on the GUI build — mouse, keyboard, and screenshots). This document covers the operational surface of that worker side: the two run modes, the headless vs. GUI build variants, the first-launch genesis wizard, the auth chain (PAT for the console, worker tokens for the worker, pairing-code redemption), and the auto-start service install (LaunchAgent / systemd). It is the document for an operator who needs to actually run and pair a Cockpit worker.

Everything below is grounded in the `memql-cockpit-public` source tree on the current main branch. Code excerpts are lightly trimmed; the file path is cited under each.

---

## 1. The two faces of the binary

`main.go` checks `os.Args[1]` before parsing any flags. A handful of subcommands short-circuit the TUI:

```go
if len(os.Args) > 1 {
    switch os.Args[1] {
    case "cluster":
        handleClusterCmd(os.Args[2:])
    case "login":
        handleLoginCmd(os.Args[2:])
    case "logout":
        handleLogoutCmd(os.Args[2:])
    case "worker":
        worker.HandleCommand(os.Args[2:])
    case "creds":
        handleCredsCmd(os.Args[2:])
    case "lint":
        os.Exit(lint.HandleCommand(os.Args[2:]))
    // genesis / authorize: removed, print a one-line pointer into the TUI
    }
}
// TUI mode — parse flags and launch the IDE.
```
*Source: `cmd/memql-cockpit/main.go`*

With no recognized subcommand the binary falls through to the TUI path: it parses `--cluster`, `--endpoint`, `--version`, resolves a cluster from `~/.memql/clusters.yaml`, installs a credential store, and launches the multi-tab console.

Two legacy subcommands (`genesis`, `authorize`) were intentionally removed and now print a one-line pointer telling the user the flow moved into the TUI — guarding against muscle memory and stale install scripts.

The rest of this document is about `memql-cockpit worker ...` and the genesis wizard that fires on first TUI launch.

---

## 2. Worker run modes: `computer_use_headless` vs. `computer_use_embodied`

A worker advertises a **capability set** to the cluster at register time. There are exactly two capabilities:

| Capability | Meaning | Surface |
|---|---|---|
| `HEADLESS` | Shell exec, filesystem read/write/list/stat, HTTP fetch. | `workerHost.*` tools |
| `GUI` | Mouse move/click/drag/scroll, keyboard type/combo, screenshot, display/cursor info. | `workerComputer.*` tools |

These two map to the run-mode names the platform uses — `computer_use_headless` and `computer_use_embodied` (the README and the safety filter / Linux systemd unit refer to the GUI build as `computer_use_embodied`). The capability a worker can advertise is fixed by **which binary you built**, not by a runtime flag: the headless binary can only ever advertise `HEADLESS`; the GUI binary advertises both.

`HEADLESS` is mandatory. The config validator rejects any worker whose capability list omits it:

```go
hasHeadless := false
for _, cap := range c.Capabilities {
    if cap == "HEADLESS" {
        hasHeadless = true
        break
    }
}
if !hasHeadless {
    return errors.New("worker config: HEADLESS capability is mandatory")
}
```
*Source: `cmd/memql-cockpit/internal/worker/config.go`*

The default capability set is `HEADLESS` only; the GUI build's init layer overrides it. See §3.

### Per-capability concurrency

The worker advertises a concurrency budget per capability. Defaults:

```go
Concurrency: map[string]uint32{
    "HEADLESS": 8,
    "GUI":      1,
},
```
*Source: `cmd/memql-cockpit/internal/worker/config.go`* (`Defaults()`)

`HEADLESS: 8` lets eight shell/fs/http calls run concurrently; `GUI: 1` serializes desktop input — there is one mouse and one keyboard, so concurrent GUI actions would collide. These land in `worker.yaml` and are sent verbatim in the `Register` message.

### How a tool call gets routed

The runner receives a `ToolDispatch` on the gRPC stream and hands it to the dispatcher, which switches on the tool name:

```go
switch tool {
case "workerHost":
    success, failure = d.dispatchHost(ctx, action, args)
case "workerComputer":
    success, failure = d.dispatchComputer(ctx, action, args)
default:
    failure = &memqlv1.Failure{ErrorCode: "unknown_tool", ...}
}
```
*Source: `cmd/memql-cockpit/internal/worker/tools/dispatcher.go`*

`dispatchHost` resolves `exec`, `fs_read`, `fs_write`, `fs_list`, `fs_stat`, `http_fetch`. `dispatchComputer` resolves `screenshot`, `cursor_position`, `mouse_move`, `mouse_click`, `mouse_drag`, `mouse_scroll`, `key_type`, `key_combo`, `display_info`, `window_list`, `window_focus` — but **only on the GUI build**. On the headless build, `dispatchComputer` is a stub that fails every action:

```go
//go:build !gui
func (d *Dispatcher) dispatchComputer(_ context.Context, action string, _ map[string]any) (*memqlv1.Success, *memqlv1.Failure) {
    return nil, &memqlv1.Failure{
        ErrorCode:    "gui_unavailable",
        ErrorMessage: "this cockpit binary was built without the GUI tag; install memql-cockpit-gui to enable workerComputer.* actions",
    }
}
```
*Source: `cmd/memql-cockpit/internal/worker/tools/computer.go`*

---

## 3. Build variants: headless (default) vs. GUI (CGO + RobotGo)

The GUI surface lives behind the `gui` Go build tag, and the tag requires CGO because the desktop-input implementation is backed by [RobotGo](https://github.com/go-vgo/robotgo).

### Build matrix

```make
## Default target -- headless, CGO-free, ships everywhere
cockpit:
	$(GO) build $(GOFLAGS) -o $(BIN_DIR)/memql-cockpit ./cmd/memql-cockpit

## GUI variant (CGO + RobotGo). Enables workerComputer.* actions.
cockpit-gui:
	CGO_ENABLED=1 $(GO) build $(GOFLAGS) -tags gui -o $(BIN_DIR)/memql-cockpit-gui ./cmd/memql-cockpit
```
*Source: `Makefile`*

Top-level `CGO_ENABLED := 0` makes the default headless build statically linkable and trivially cross-compilable to all four targets (`darwin/arm64`, `darwin/amd64`, `linux/amd64`, `linux/arm64`) with no native toolchain. The GUI targets flip `CGO_ENABLED=1` and add `-tags gui`. Per the Makefile comment, the GUI build needs platform-native build tooling:

- **macOS:** Xcode Command Line Tools.
- **Linux:** `gcc` + `libxtst-dev` / `libxinerama-dev` / `libxkbcommon-dev` / `libpng-dev`.

There is also a `cockpit-voice` target (`-tags voice`, CGO via malgo/miniaudio) for push-to-talk microphone capture — out of scope here, but it shows the same opt-in-CGO pattern.

### What the tag changes at compile time

The capability set is selected by build-tagged sibling files:

```go
//go:build !gui
func capabilitiesForBuildTagImpl() []string { return []string{"HEADLESS"} }
func BuildHasGUI() bool { return false }
```
*Source: `cmd/memql-cockpit/internal/worker/capabilities_default.go`*

```go
//go:build gui
func capabilitiesForBuildTagImpl() []string { return []string{"HEADLESS", "GUI"} }
func BuildHasGUI() bool { return true }
```
*Source: `cmd/memql-cockpit/internal/worker/capabilities_gui.go`*

The GUI build also stamps a build-tag marker that rides the `Register` handshake. `cockpitBuildTag()` returns `"nogui"` by default; an `init()` in the gui-tagged file flips it to `"gui"`:

```go
//go:build gui
func init() { buildTagOverride = "gui" }
```
*Source: `cmd/memql-cockpit/internal/worker/gui_tag.go`*

```go
func cockpitBuildTag() string {
    if buildTagOverride != "" {
        return buildTagOverride
    }
    return "nogui"
}
```
*Source: `cmd/memql-cockpit/internal/worker/connect.go`*

So the cluster sees `build_tag: "gui"` or `"nogui"` per worker, independent of the advertised capabilities.

### The GUI tool implementations (RobotGo)

On the GUI build, `computer_gui.go` wires each action to RobotGo. Highlights:

```go
func guiScreenshot(args map[string]any) (*memqlv1.Success, *memqlv1.Failure) {
    if ScreenCapturePreflightHook != nil && !ScreenCapturePreflightHook() {
        return nil, failure("permission_denied",
            "Screen Recording permission is not granted for this binary. ...")
    }
    // robotgo.SaveCapture(...) -> read temp file -> optional JPEG transcode
    width, height := robotgo.GetScreenSize()
    // returns base64 image bytes + dimensions
}
```
*Source: `cmd/memql-cockpit/internal/worker/tools/computer_gui.go`*

Two implementation details worth knowing as an operator:

- **`key_type` redacts the typed text.** The agent often types credentials into password fields; the success payload and audit preview record only a character count, never the text:

  ```go
  robotgo.TypeStr(text)
  // ... deliberately omit the typed text from result payload + preview ...
  return successComputerJSON(
      map[string]any{"chars": len(text), "text_redacted": true},
      fmt.Sprintf("typed %d chars (text redacted)", len(text)),
      len(text),
  ), nil
  ```
  *Source: `cmd/memql-cockpit/internal/worker/tools/computer_gui.go`*

- **`window_list` / `window_focus` are stubs** that return `unsupported_on_platform` today; the dispatcher slots exist so future window-API work doesn't touch the dispatcher.

---

## 4. macOS TCC / Linux X11 permissions and the setup wizard

The GUI build can compile and register `GUI`, but it can only *deliver* desktop input if the OS grants it. On macOS that means TCC (Accessibility for input, Screen Recording for screenshots); on Linux it means a reachable X11 `DISPLAY`. `memql-cockpit-gui worker setup` is the pre-flight wizard.

On the headless build, `worker setup` is a no-op-with-print that explains there's nothing to set up and points at `make cockpit-gui` (*source: `cmd/memql-cockpit/internal/worker/setup_nogui.go`*).

On the GUI build the wizard runs as a single-panel TUI on an interactive terminal, or a printf fallback on non-TTY callers (CI, install scripts, piped output) — same probe logic either way:

```go
func runSetupWizard() error {
    if isInteractiveTTY() && (runtime.GOOS == "darwin" || runtime.GOOS == "linux") {
        if err := runTUIWizard(); err != nil {
            // fall back to printf wizard
            return runSetupPrintf()
        }
        return nil
    }
    return runSetupPrintf()
}
```
*Source: `cmd/memql-cockpit/internal/worker/setup_gui.go`*

### macOS: the per-binary TCC trap

The wizard probes the *actual gated operations*, not just reads:

- **Accessibility** — issues a real `robotgo.MoveRelative(2,0)` and checks the cursor actually moved (a pure `Location()` read doesn't require Accessibility, so it wouldn't be a meaningful probe). Wrapped in a 5-second timeout because the CGO call can hang on TCC-state mismatch.
- **Screen Recording** — calls `CGPreflightScreenCaptureAccess` (synchronous, microsecond-fast; the older `SaveCapture`-based probe hung under certain TCC states).

The critical operator-facing gotcha is **per-binary granting**. macOS attaches TCC grants to a signed-binary identity, and a command-line binary launched from Terminal *inherits Terminal's grants*. So the wizard can report "OK" when run from your shell, yet the same binary launched detached as a LaunchAgent at login is a different TCC entry and gets denied. The wizard surfaces both: the active probe result *and* the per-binary `tccutil check` result, so you can tell the two cases apart:

```go
accessOK, accessDetail := probeAccessibility()
fmt.Printf("  active probe: %s\n", accessDetail)
bundleHasAccess := tccCheck("Accessibility", binPath)
fmt.Printf("  per-binary grant: %s\n", bundleHasAccess)
```
*Source: `cmd/memql-cockpit/internal/worker/setup_gui.go`* (`runSetupMacOS`)

`tccCheck` shells out to `/usr/bin/tccutil check <service> <binary>`. The `check` subcommand was added in macOS Sonoma 14.4; older OSes report `"unknown"`.

When the LaunchAgent runs `cockpit-gui` for the first time, macOS prompts separately for that binary — the operator must approve *that* prompt for auto-start to actually work. The wizard's closing notes spell this out.

### Self-exec to pick up a fresh TCC grant

macOS won't reload TCC state for a running process. If a post-grant re-probe still shows denied, the pairing wizard can spill its state to `~/.memql/wizard-state.json` and `syscall.Exec` itself with the same args; the fresh process re-evaluates TCC and resumes at the same step — same shell, no Terminal restart:

```go
func SelfExecForTCCReload(state WizardState) error {
    if err := SaveWizardState(state); err != nil {
        return err
    }
    exe, _ := os.Executable()
    return syscall.Exec(exe, os.Args, os.Environ())
}
```
*Source: `cmd/memql-cockpit/internal/worker/pair.go`*

The state file is `0600`, carries nothing the worker.yaml doesn't already hold, and is rejected on resume if older than 5 minutes (*source: `cmd/memql-cockpit/internal/worker/persistence.go`*).

### Per-call screen-recording preflight (revocation safety)

A grant approved at setup can be revoked later from System Settings. To avoid silently returning a black/empty screenshot, the darwin+gui build wires a preflight hook that fires before every `screenshot` dispatch:

```go
//go:build darwin && gui
func init() {
    tools.ScreenCapturePreflightHook = preflightScreenCaptureAccess
}
```
*Source: `cmd/memql-cockpit/internal/worker/tcc_hook_darwin.go`*

On revocation the next screenshot returns a clean `permission_denied` failure (see the `guiScreenshot` excerpt in §3).

### Linux

`runSetupLinux` checks `DISPLAY` / `WAYLAND_DISPLAY`. RobotGo's open-source build targets X11 only, so a Wayland-only session is steered to register `HEADLESS`-only (and `install-linux.sh` detects Wayland and does this automatically). With X11 present, the wizard probes a cursor move + a 16×16 screenshot to confirm XTEST + display auth work (*source: `cmd/memql-cockpit/internal/worker/setup_gui.go`*).

---

## 5. The first-launch genesis wizard

This wizard is separate from the worker flow — it fires when you launch the **TUI** on a machine that has never been set up. Its job is to seal the operator's secrets into `~/.memql/genesis.znas`.

### Trigger

```go
func (a *App) shouldRunGenesisWizard() bool {
    path := genesisFilePath()
    if path == "" {
        return false
    }
    _, err := os.Stat(path)
    return os.IsNotExist(err)
}
```
*Source: `cli/app.go`*

The envelope path is `$MEMQL_GENESIS_PATH` if set, else `~/.memql/genesis.znas`. Absence is the trigger; presence (even outdated) is treated as "already set up — don't re-prompt." The wizard runs before the launch splash; cancelling returns the user to the shell.

### What it does

The wizard (`cli/wizard/genesis/genesis.go`) is a single-panel tcell flow with four steps: intro → env path → confirm master key → done. It wraps `component/genesis.Seal` from memQL core. The steps:

1. **Pick a `.env`.** Auto-detects `./.env.local` then `./.env`.
2. **Seal.** Parses the env file, loads the manifest, and calls `Seal(...)` which generates a master key and writes the encrypted envelope. `SyncShellRCs: true` appends the key to your shell rc files so future shells decrypt without re-typing.
3. **Confirm the master key.** Seal calls back synchronously with the freshly generated `MEMQL_MASTER_KEY`; the wizard pauses, shows it once, and requires Y to proceed:

   ```go
   ConfirmMasterKey: func(masterKeyHex string) (bool, error) {
       w.pendingKey = masterKeyHex
       w.step = stepConfirmKey
       w.pendingFn = func(ok bool) { confirmCh <- ok }
       w.screen.PostEvent(tcell.NewEventInterrupt(nil))
       return <-confirmCh, nil
   },
   ```
   *Source: `cli/wizard/genesis/genesis.go`*

   The panel warns: *"It will not be shown again. Losing it makes genesis.znas unrecoverable."*

4. **Done.** Reports whether the envelope was new or updated and whether it reused a key already in the environment.

### Bridge to the console: auto-seeding the local cluster

After the wizard, on operating-console entry, the app decrypts `genesis.znas` (needs `MEMQL_MASTER_KEY` in the environment), reads `IDENTITY_BOOTSTRAP_DOMAIN`, and writes a fully configured `local` row to `clusters.yaml`:

```
DisplayName = <domain>                  (e.g. local.znas.io)
Endpoint    = https://bff.<domain>      (NGINX LB entry)
Issuer      = https://identity.<domain> (OIDC issuer)
ClientId    = cockpit                   (registered cockpit client)
```
*Source: `cli/app.go`* (`autoSeedLocalFromGenesis` doc comment)

This is best-effort: if it can't seed (no master key, bad envelope), the `local` row stays in its needs-auth state and the operator authorizes by hand (press `L` on the row in the TUI).

---

## 6. Auth model: three credential types

The Cockpit deals with three distinct credentials. Don't confuse them.

| Credential | Prefix | Who holds it | Used for |
|---|---|---|---|
| **OIDC token / PAT** | `mql_pat_…` (PAT) | The console user | The TUI / `login` / `logout` — authenticating *you* to the cluster |
| **Worker token** | `mql_wkr_…` | The worker process | `WorkerService.Stream` — authenticating the *machine* as a worker |
| **Pairing code** | `XXXX-XXXX` | One-time, from CoPresent | Redeeming a worker token without copy-pasting a long secret |

### Console auth (PAT / OIDC) and the credential store

Cluster config lives in `~/.memql/clusters.yaml`. Per-cluster the auth label is derived:

```go
func clusterAuthLabel(c config.ClusterConfig) string {
    switch {
    case c.PAT != "":
        return "PAT"
    case c.Issuer != "" && c.ClientId != "":
        return "OIDC"
    default:
        return "not configured"
    }
}
```
*Source: `cmd/memql-cockpit/main.go`*

OIDC tokens are cached via a pluggable credential store. The TUI picks the active store at startup, preferring the OS keyring; `MEMQL_COCKPIT_CRED_STORE` can force `"file"` or `"keyring"`:

```go
credStore, credErr := config.Resolve(config.ResolveOptions{Logger: logger})
// ...
config.SetActiveStore(credStore)
```
*Source: `cmd/memql-cockpit/main.go`*

`memql-cockpit login <cluster>` opens a browser, runs OIDC, and caches the token (file store path: `~/.memql/credentials/<cluster>.json`). `logout` deletes it. `memql-cockpit creds status` shows the active backend + cached cluster names; `creds migrate-to-keyring` moves file-store credentials into the OS keyring idempotently (*source: `cmd/memql-cockpit/creds.go`*).

### Worker token

The worker authenticates to the cluster with a `mql_wkr_…` token. The config validator enforces the prefix:

```go
if !strings.HasPrefix(strings.TrimSpace(c.Token), "mql_wkr_") {
    return errors.New("worker config: token must start with mql_wkr_")
}
```
*Source: `cmd/memql-cockpit/internal/worker/config.go`*

The token is sent on dial; the SDK's `worker.Dial` carries it, and the worker then sends `Register` and waits for `RegisterAck` (which returns a registration id + owner user id):

```go
sdkConn, err := sdkworker.Dial(ctx, sdkworker.DialConfig{
    Endpoint: endpoint, UseTLS: useTLS, Token: cfg.Token, Logger: logger,
})
// ...
c.register(ctx, cfg)  // sends Register{Name, Capabilities, Labels, Concurrency, Platform, Version, BuildTag}
```
*Source: `cmd/memql-cockpit/internal/worker/connect.go`*

#### Token handling: never on argv

The worker resolves the token from four sources, in override order, all designed to keep it off the process command line:

1. `~/.memql/worker.yaml` (`token:` field).
2. `MEMQL_WORKER_TOKEN` env var (in-process memory, not argv).
3. `--token-file <path>` (read once, `0600` enforced via `VerifyCredentialFileMode`).
4. `--token <literal>` — **deprecated**, logs a loud WARN every use because it leaks into `ps` and shell history.

```go
tokenInline := fs.String("token", "", "DEPRECATED: worker token literal. Use --token-file or MEMQL_WORKER_TOKEN ...")
// ...
if *tokenInline != "" {
    fmt.Fprintln(os.Stderr, "WARNING: --token <literal> leaks the token to `ps` and shell history.")
    cfg.Token = *tokenInline
}
```
*Source: `cmd/memql-cockpit/internal/worker/cli.go`*

`worker.yaml` itself must be `0600` — `LoadFile` calls `VerifyCredentialFileMode` and refuses to load a group- or world-readable file, so a permission drift surfaces loudly instead of silently exposing the token (*source: `cmd/memql-cockpit/internal/worker/config.go`*). `worker config` prints the effective config with the token masked (`mql_wkr_abcd...wxyz`).

### Pairing code → worker token

The primary enrollment path. An operator copies an `XXXX-XXXX` pairing code from CoPresent's **Settings → Computer Use** card and runs one command. The code uses a restricted alphabet (8 chars from A-Z + 2-9, no `I/O/0/1` to avoid ambiguity) and is single-use.

`worker pair` redeems the code against the **identity service** over HTTP:

```go
req, _ := http.NewRequestWithContext(reqCtx, http.MethodPost, endpoint+"/pair/redeem", bytes.NewReader(buf))
req.Header.Set("Authorization", "Pair "+canonical)
// response: { success, plainToken, identityId, ownerUserId, clusterUrl }
```
*Source: `cmd/memql-cockpit/internal/worker/redeem.go`*

Two things the cockpit does *not* decide on its own:

- **The identity URL** comes from the active cluster's `Issuer` in `clusters.yaml` (captured at authorize time), not from a flag — unless you supply `--identity` as an escape hatch:

  ```go
  resolved, err := resolveActiveClusterIdentityURL(*clusterName)
  // reads clusters.yaml SelectedCluster (or the sole cluster) and returns its Issuer
  ```
  *Source: `cmd/memql-cockpit/internal/worker/cli.go`*

- **The gRPC dial address** (`ClusterURL`) comes back *in the redeem response*, not from local config. The redeem reply tells the worker where `WorkerService.Stream` lives.

The `pair` wizard then runs the whole enrollment in one command: redeem → write `worker.yaml` → TCC pre-flight (GUI builds, interactive TTY only) → start the worker loop → on Ctrl+C/Ctrl+Q, offer to install the auto-start service. The plain token is returned in the redeem reply once and written into `worker.yaml`; the cockpit never re-fetches it.

Advanced/scripted callers can skip redemption with `--identity <url> --token mql_wkr_…`.

---

## 7. Running the worker

```
memql-cockpit worker pair <code>   Redeem a code, write worker.yaml, run. The primary path.
memql-cockpit worker               Same flow with an interactive paste prompt.
memql-cockpit worker run           Run an already-configured worker (used by the service unit).
memql-cockpit worker setup         Re-run the TCC / X11 permissions wizard (GUI builds).
memql-cockpit worker config        Print the effective config.
memql-cockpit worker consent <op>  Manage the per-call consent gate.
```
*Source: `cmd/memql-cockpit/internal/worker/cli.go`* (`printUsage`)

`worker run` flags: `--config` (default `~/.memql/worker.yaml`), `--cluster`, `--token-file`, `--token` (deprecated), `--name`, `--log-level`, `--metrics-port` (default `9100`; `0` disables).

### The run loop

`Runner.Run` is a reconnect-with-backoff loop: exponential 1s → 60s with jitter on every disconnect, reset to 1s on a successful connect. Per connection it runs a heartbeat ticker (default 15s), receives inbound messages, and dispatches tool calls on their own goroutines bounded by a `WaitGroup`:

```go
case *memqlv1.WorkerServerMessage_ToolDispatch:
    r.active.Add(1)
    go func() {
        defer r.active.Done()
        r.runToolDispatch(ctx, conn, payload.ToolDispatch)
    }()
case *memqlv1.WorkerServerMessage_Drain:
    r.active.Wait()                       // finish in-flight, then exit
    return fmt.Errorf("server requested drain")
```
*Source: `cmd/memql-cockpit/internal/worker/loop.go`*

Each dispatch gets a per-call timeout from the dispatch message (default 5 minutes if unset). The dispatcher recovers panics (RobotGo can panic on permission corner cases) and turns them into a structured `tool_panic` failure so a panic never tears down the gRPC stream.

### Signals

`worker run` traps `SIGINT` / `SIGTERM` (graceful cancel) and `SIGHUP` (hot-reload `policy.yaml` without a restart). On a TTY it also enables `Ctrl+Q` as a quit hotkey alongside `Ctrl+C` (*source: `cmd/memql-cockpit/internal/worker/cli.go`*).

### Metrics

A loopback-only Prometheus text endpoint at `127.0.0.1:9100/metrics` (no auth — binding to loopback is the gate). Hand-rolled to keep the headless build CGO-free and small. Tracks call totals by outcome, a duration histogram, and reconnect count (*source: `cmd/memql-cockpit/internal/worker/metrics.go`*).

### The consent gate (default-deny)

Every `workerHost` / `workerComputer` dispatch passes through a per-host consent gate before it runs. **Default-deny**: with no active operator-granted window, the call short-circuits with `consent_required`. The worker opens a Unix control socket (`~/.memql/worker.sock`, mode `0600`); a second terminal drives it:

```
memql-cockpit worker consent grant --window=1h [--strict]   Open a window
memql-cockpit worker consent revoke                         Close immediately
memql-cockpit worker consent status                         Show state
memql-cockpit worker consent watch                          Live tail of events
```
*Source: `cmd/memql-cockpit/internal/worker/consent_cmd.go`*

`--strict` adds per-call approval for the high-risk subset (`key_type`, `mouse_click`); a pre-authorized screen region can exempt in-region clicks (`Region`, memql-cockpit#131). The socket path is overridable via `MEMQL_WORKER_CONSENT_SOCKET`. Tool args are redacted (`token`/`password`/`secret`/`api_key`/`authorization` keys → `[REDACTED]`) in every audit log line.

---

## 8. Auto-start service install

Two enrollment paths produce interchangeable configs — the wizard's `WriteWorkerYAML` is documented to emit YAML identical to what the install scripts drop (*source: `cmd/memql-cockpit/internal/worker/persistence.go`*).

### macOS LaunchAgent

A per-user LaunchAgent at `~/Library/LaunchAgents/com.znasllc.memql-cockpit-worker.plist`, `RunAtLoad` + `KeepAlive`, running `<binary> worker run`. Per-user (not a LaunchDaemon) is **mandatory**: macOS only delivers TCC grants to processes in a logged-in user's session, and LaunchAgents run after login:

```go
const launchAgentLabel = "com.znasllc.memql-cockpit-worker"
// ProgramArguments: [<binaryPath>, "worker", "run"]
// RunAtLoad: true, KeepAlive: true, logs -> ~/.memql/state/worker.log
_ = exec.Command("launchctl", "unload", plistPath).Run()  // idempotent
exec.Command("launchctl", "load", plistPath).Run()
```
*Source: `cmd/memql-cockpit/internal/worker/launchagent_darwin.go`*

The `pair` wizard offers to install this on exit; `scripts/install/install-mac.sh` writes the same plist. Reminder: the LaunchAgent process is a *separate TCC entry* from your Terminal — approve the cockpit-gui prompt that appears at the next login.

### Linux user-systemd

`scripts/install/install-linux.sh` writes a **user** systemd unit at `~/.config/systemd/user/memql-cockpit-worker.service`, `Type=simple`, `ExecStart=<binary> worker run`, `Restart=on-failure`, logs appended to `~/.memql/state/worker.log`. The token comes from an `EnvironmentFile=-${HOME}/.memql/worker.env` (chmod `0600`, leading `-` so a missing file is ignored) — deliberately *not* an inline `Environment=`, so the token isn't visible in `systemctl show`. The headless install ships a hardened unit:

```ini
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${HOME}/.memql
NoNewPrivileges=yes
PrivateTmp=yes
RestrictSUIDSGID=yes
MemoryDenyWriteExecute=yes
# ... and more
```
*Source: `scripts/install/install-linux.sh`*

The unit comment notes the GUI build (`computer_use_embodied`) needs a more permissive `ProtectHome` to drive the user's desktop; the headless path is the hardened default. Wayland sessions are detected and registered `HEADLESS`-only.

### Install-script flags

Both scripts take `--token mql_wkr_…` (required, prefix-validated), `--cluster <url>` (required), `--name`, `--gui` (install the GUI variant), `--download-base`, `--force`, `--no-service`, and `--user-local` to install under `$HOME/.memql/bin` instead of sudo-gated `/usr/local/bin` (weaker isolation; documented as such). The `--gui` flag writes a `worker.yaml` advertising both `HEADLESS` and `GUI` capabilities (*sources: `scripts/install/install-mac.sh`, `scripts/install/install-linux.sh`*).

---

## 9. Operator quick reference

```bash
# Build
make cockpit            # headless, CGO-free, ships everywhere (computer_use_headless)
make cockpit-gui        # GUI variant, CGO + RobotGo            (computer_use_embodied)

# First TUI launch on a fresh box -> genesis wizard fires automatically
memql-cockpit           # seal ~/.memql/genesis.znas, then enter the console

# Authorize the console (in the TUI: press A to add, L on a row to authorize)
memql-cockpit login staging
memql-cockpit creds status

# Enroll a worker (primary path: one command from a pairing code)
memql-cockpit worker pair ABCD-EFGH

# GUI permissions pre-flight (macOS TCC / Linux X11)
memql-cockpit-gui worker setup

# Run an already-configured worker (what the service unit calls)
memql-cockpit worker run --metrics-port 9100
memql-cockpit worker config            # print effective config (token masked)

# Open / close the consent gate from a second terminal
memql-cockpit worker consent grant --window=1h
memql-cockpit worker consent revoke

# Unattended install (drops binary + service + worker.yaml)
./scripts/install/install-mac.sh   --token mql_wkr_... --cluster https://app.copresent.ai [--gui]
./scripts/install/install-linux.sh --token mql_wkr_... --cluster https://app.copresent.ai [--gui]
```

### Files the worker touches

| Path | Purpose | Mode |
|---|---|---|
| `~/.memql/clusters.yaml` | Cluster config (console) | — |
| `~/.memql/credentials/*.json` | Cached OIDC tokens (file store) | — |
| `~/.memql/genesis.znas` | Sealed operator secrets envelope | — |
| `~/.memql/worker.yaml` | Worker config incl. `mql_wkr_…` token | `0600` (enforced) |
| `~/.memql/policy.yaml` | Headless tool allow/deny policy | — |
| `~/.memql/worker.sock` | Consent control socket | `0600` |
| `~/.memql/wizard-state.json` | TCC self-exec resume spill (transient) | `0600` |
| `~/.memql/state/worker.log` | Service stdout/stderr | — |
| `~/.memql/worker.env` | Linux systemd token env file | `0600` |
| `~/Library/LaunchAgents/com.znasllc.memql-cockpit-worker.plist` | macOS auto-start | `0644` |
| `~/.config/systemd/user/memql-cockpit-worker.service` | Linux auto-start | — |
