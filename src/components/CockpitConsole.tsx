"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   CockpitConsole — a faithful reproduction of memQL Cockpit, shown in a
   CONNECTED, working session.

   Built from the real source: tab registration (cli/app.go), theme
   (cli/ui/theme.go → violet #BD93F9), and the view models in cli/cluster
   (topology: real node types + health enum), cli/concepts (concept ids +
   row serialization), cli/workers (consent/audit), cli/skills (tier +
   category), cli/chat (spaces + utterances).

   Source-grounded: node types (bff/voice/cognition/agent/planner),
   concept ids, policy names, provider names, DSL names. Row-level values
   (space names, audit lines, timestamps) are illustrative — disclosed in
   the caption. Rendered in Cockpit's real theme; click the tabs.
   No personal paths, no fabricated views.
   ──────────────────────────────────────────────────────────────────── */

const CP = {
  bg: "#18181c",
  bar: "#1f1f25",
  fg: "#d4d4d8",
  accent: "#bd93f9",
  subtle: "#5a5a64",
  warn: "#e5c07b",
  success: "#50c864", // rgb(80,200,100) — healthy nodes
  info: "#61afef",
  error: "#f44747",
  sel: "rgba(189,147,249,0.12)",
};

const TABS = ["Clusters", "Chat", "Concepts", "Planner", "Skills", "Workers", "Safety", "Settings"];

export default function CockpitConsole() {
  const [tab, setTab] = useState(0);
  const [blink, setBlink] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = true;
    const start = () => { if (!timer) timer = setInterval(() => setBlink((b) => !b), 560); };
    const stop = () => { if (timer) { clearInterval(timer); timer = undefined; } };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0.15 });
    if (rootRef.current) io.observe(rootRef.current);
    const onVis = () => { if (document.hidden) stop(); else if (visible) start(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const cursor = <span style={{ color: CP.accent, opacity: blink ? 1 : 0 }}>▊</span>;

  return (
    <div ref={rootRef}>
      <div
        role="group"
        aria-label="memQL Cockpit — connected session reproduction in the tool's real theme"
        className="overflow-hidden rounded-lg border text-[12.5px] leading-[1.6] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.45)]"
        style={{ background: CP.bg, borderColor: "#2a2a32", fontFamily: "var(--font-mono)" }}
      >
        {/* terminal chrome */}
        <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ background: CP.bar, borderColor: "#2a2a32" }}>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3" style={{ color: CP.subtle }}>memql-cockpit — localhost:50050</span>
        </div>

        {/* header status line (connected) */}
        <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "#2a2a32" }}>
          <span style={{ color: CP.fg }} className="font-semibold">memQL Cockpit</span>
          <span style={{ color: CP.success }}>●</span>
          <span style={{ color: CP.fg }} className="hidden truncate sm:inline">connected — local · localhost:50050</span>
          <span style={{ color: CP.subtle }} className="ml-2 hidden lg:inline">Ctrl+Y:Copy  Ctrl+K:Dismiss</span>
          <span style={{ color: CP.subtle }} className="ml-auto hidden sm:inline">Tab:Switch Panes</span>
        </div>

        {/* active view — fixed height so switching tabs never shifts the
            page; taller views (Settings) scroll internally. The inner
            flex-col + [&>*]:flex-1 stretches whichever view is active to
            fill the fixed height so short views don't leave a gap. */}
        <div className="h-[420px] overflow-y-auto px-4 py-3" style={{ scrollbarGutter: "stable" }}>
          <div className="flex min-h-full flex-col [&>*]:flex-1">
            {tab === 0 && <ClustersView cursor={cursor} />}
            {tab === 1 && <ChatView cursor={cursor} />}
            {tab === 2 && <ConceptsView cursor={cursor} />}
            {tab === 3 && <PlannerView />}
            {tab === 4 && <SkillsView cursor={cursor} />}
            {tab === 5 && <WorkersView />}
            {tab === 6 && <SafetyView />}
            {tab === 7 && <SettingsView />}
          </div>
        </div>

        {/* tab bar */}
        <div role="tablist" aria-label="Cockpit tabs" className="flex flex-wrap items-center gap-x-1 border-t px-3 py-2" style={{ borderColor: "#2a2a32", background: CP.bar }}>
          {TABS.map((t, i) => {
            const active = i === tab;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") { e.preventDefault(); setTab((i + 1) % TABS.length); }
                  if (e.key === "ArrowLeft") { e.preventDefault(); setTab((i - 1 + TABS.length) % TABS.length); }
                }}
                className="rounded px-2 py-0.5 outline-none transition-colors focus-visible:ring-1"
                style={active ? { background: CP.accent, color: CP.bg } : { color: CP.subtle }}
              >
                {i + 1}:{t}
              </button>
            );
          })}
          <span className="ml-auto hidden md:inline" style={{ color: CP.subtle }}>F1..F8 / Option+1..8:Tabs  Ctrl+Q:Quit</span>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11.5px] leading-[1.5]" style={{ color: "var(--color-dim)" }}>
        ↑ memQL Cockpit in its real theme, a representative connected session. Node types, concept ids, policies, and providers are from the source; row-level values are illustrative.
        Source: <a href="https://github.com/znasllc-io/memql-cockpit" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">znasllc-io/memql-cockpit</a>.
      </p>
    </div>
  );
}

/* ── Clusters: list ▏ live topology ────────────────────────────────── */
function ClustersView({ cursor }: { cursor: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-px md:grid-cols-2" style={{ background: "#2a2a32" }}>
      <div className="flex h-full flex-col px-1" style={{ background: CP.bg }}>
        <Head>CLUSTERS</Head>
        <div className="px-2">
          <div className="flex items-center justify-between rounded px-2 py-1" style={{ background: CP.sel }}>
            <span style={{ color: CP.fg }} className="font-semibold"><span style={{ color: CP.success }}>●</span> local {cursor}</span>
            <span style={{ color: CP.accent }}>*</span>
          </div>
          <div className="px-2" style={{ color: CP.subtle }}>localhost:50050 · connected</div>
        </div>
        <div className="mt-auto px-2 pt-6">
          <div className="mb-1 border-t" style={{ borderColor: "#2a2a32", maxWidth: 220 }} />
          <Row k="Endpoint" v="localhost:50050" />
          <Row k="Auth" v="authorized" tone={CP.success} />
          <Row k="Nodes" v="5 · all healthy" tone={CP.success} />
        </div>
        <Hints keys={[["A", "Add"], ["E", "Edit"], ["D", "Delete"]]} />
      </div>

      <div className="flex h-full flex-col px-3" style={{ background: CP.bg }}>
        <div className="flex items-center justify-between">
          <Head>TOPOLOGY</Head>
          <span style={{ color: CP.subtle }}>Nodes: 5  <span style={{ color: CP.success }}>Online: 5</span></span>
        </div>
        <Topology />
        <Hints keys={[["WASD", "Pan"], ["R", "Reset View"], ["X", "Architecture"]]} align="right" />
      </div>
    </div>
  );
}

// real node types from the cluster build tags; cognition is the conductor
function Topology() {
  const nodes = [
    { id: "cognition", x: 50, y: 50 },
    { id: "bff", x: 18, y: 22 },
    { id: "voice", x: 82, y: 22 },
    { id: "agent", x: 20, y: 80 },
    { id: "planner", x: 82, y: 80 },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges: [string, string][] = [
    ["cognition", "bff"], ["cognition", "voice"], ["cognition", "agent"],
    ["cognition", "planner"], ["agent", "planner"],
  ];
  return (
    <div className="my-2 flex-1">
      <svg viewBox="0 0 100 100" className="h-[200px] w-full" preserveAspectRatio="xMidYMid meet">
        {edges.map(([a, b], i) => (
          <line key={i} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y}
            stroke="rgba(189,147,249,0.35)" strokeWidth={0.5} />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.id === "cognition" ? 3 : 2.4} fill={CP.success} />
            <circle cx={n.x} cy={n.y} r={n.id === "cognition" ? 5 : 4} fill="none" stroke={CP.success} strokeOpacity={0.25} strokeWidth={0.4} />
            <text x={n.x} y={n.y + (n.y > 50 ? 9 : -6)} textAnchor="middle" fill={CP.fg} fontSize={4} fontFamily="var(--font-mono)">{n.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Chat: spaces ▏ utterances ─────────────────────────────────────── */
function ChatView({ cursor }: { cursor: React.ReactNode }) {
  const spaces = [
    ["general", "4 participants · 2m ago", true],
    ["voice-room", "2 participants · 11m ago", false],
    ["planning", "3 participants · 1h ago", false],
  ] as const;
  const lines: [string, string][] = [
    ["sofia", "routing this to the team thread — looks like a Group message."],
    ["claude-sonnet-4.6", "joined #general · general_assistant"],
    ["jesus", "can you summarize what changed in the planner spec?"],
    ["sofia", "pulling the last 12 utterances via queryActiveHumanParticipants…"],
  ];
  return (
    <div className="grid grid-cols-1 gap-px md:grid-cols-[200px_minmax(0,1fr)]" style={{ background: "#2a2a32" }}>
      <div className="h-full px-1" style={{ background: CP.bg }}>
        <Head>SPACES</Head>
        {spaces.map(([name, sub, sel]) => (
          <div key={name} className="rounded px-2 py-1" style={sel ? { background: CP.sel } : undefined}>
            <div style={{ color: CP.fg }} className={sel ? "font-semibold" : ""}># {name} {sel && cursor}</div>
            <div style={{ color: CP.subtle }}>{sub}</div>
          </div>
        ))}
      </div>
      <div className="h-full px-3" style={{ background: CP.bg }}>
        <Head># general</Head>
        <div className="mt-1 space-y-1">
          {lines.map(([who, msg], i) => (
            <div key={i}>
              <span style={{ color: who === "sofia" ? CP.accent : CP.info }}>{who}</span>
              <span style={{ color: CP.subtle }}> · </span>
              <span style={{ color: CP.fg }}>{msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Concepts: list ▏ rows ▏ rendered detail ───────────────────────── */
function ConceptsView({ cursor }: { cursor: React.ReactNode }) {
  const concepts = [
    "v1:cognition:utterance", "v1:cognition:chunk", "v1:cognition:space",
    "v1:copresent:agent", "v1:agents:skill", "v1:cluster:node",
  ];
  return (
    <div className="grid grid-cols-1 gap-px md:grid-cols-[220px_minmax(0,1fr)]" style={{ background: "#2a2a32" }}>
      <div className="h-full px-1" style={{ background: CP.bg }}>
        <Head>CONCEPTS</Head>
        {concepts.map((c, i) => (
          <div key={c} className="rounded px-2 py-0.5" style={i === 0 ? { background: CP.sel } : undefined}>
            <span style={{ color: i === 0 ? CP.fg : CP.subtle }}>{i === 0 ? "▸ " : "  "}{c}</span>
          </div>
        ))}
        <div className="mt-3 px-2" style={{ color: CP.subtle }}>
          <span style={{ color: CP.accent }}>:</span> search · <span style={{ color: CP.accent }}>V</span> version history · <span style={{ color: CP.accent }}>Enter</span> drill in
        </div>
      </div>
      <div className="h-full px-3" style={{ background: CP.bg }}>
        <Head>ROW {cursor}</Head>
        <pre className="mt-1 whitespace-pre-wrap" style={{ color: CP.fg }}>
{`concept `}<span style={{ color: CP.accent }}>v1:cognition:utterance</span>{` {
  spaceId        `}<span style={{ color: CP.success }}>&quot;#general&quot;</span>{`
  participantId  `}<span style={{ color: CP.success }}>&quot;si-sofia&quot;</span>{`
  text           `}<span style={{ color: CP.success }}>&quot;routing this to the team thread&quot;</span>{`
  createdAt      `}<span style={{ color: CP.warn }}>2026-05-29T12:04:01Z</span>{`
  id             `}<span style={{ color: CP.subtle }}>&quot;utt_3f9a…&quot;</span>{`
}`}
        </pre>
      </div>
    </div>
  );
}

/* ── Planner ───────────────────────────────────────────────────────── */
function PlannerView() {
  const steps = [
    ["ensureSI", "done", CP.success],
    ["joinSpecialists", "done", CP.success],
    ["loadContext", "running", CP.warn],
    ["notify", "pending", CP.subtle],
  ] as const;
  return (
    <div className="h-full">
      <Head>PLANNER</Head>
      <div className="mt-1" style={{ color: CP.fg }}>plan <span style={{ color: CP.accent }}>onboardSpace</span> · run 0c1f… · partition #general</div>
      <div className="mt-3 space-y-1">
        {steps.map(([name, state, tone], i) => (
          <div key={name} className="grid grid-cols-[24px_180px_minmax(0,1fr)]">
            <span style={{ color: CP.subtle }}>{i + 1}.</span>
            <span style={{ color: CP.fg }}>step {name}</span>
            <span style={{ color: tone }}>{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Skills (tier + category, from renderSkillRow) ─────────────────── */
function SkillsView({ cursor }: { cursor: React.ReactNode }) {
  const skills = [
    ["webSearch", "1", "retrieval", true],
    ["canvasPublish", "1", "surface", false],
    ["fileRead", "2", "filesystem", false],
    ["shellExec", "3", "computer-use", false],
    ["scheduleTask", "2", "orchestration", false],
  ] as const;
  return (
    <div className="h-full">
      <Head>SKILLS</Head>
      <div className="mt-1 space-y-0.5">
        {skills.map(([name, tier, cat, sel]) => (
          <div key={name} className="rounded px-2 py-0.5" style={sel ? { background: CP.sel } : undefined}>
            <span style={{ color: CP.accent }}>◆</span>{" "}
            <span style={{ color: CP.fg }}>{name}</span>{" "}
            <span style={{ color: CP.subtle }}>[tier {tier}]</span>{" "}
            <span style={{ color: CP.subtle }}>· {cat}</span>
            {sel && <> {cursor}</>}
          </div>
        ))}
      </div>
      <div className="mt-3" style={{ color: CP.subtle }}>read-only catalog · v1:agents:skill</div>
    </div>
  );
}

/* ── Workers (connected + audit) ───────────────────────────────────── */
function WorkersView() {
  const audit: [string, string, string][] = [
    ["12:01:55", "granted", "window=1h · strict=false"],
    ["12:02:10", "exec.shell", "git status"],
    ["12:02:48", "exec.fs", "read src/app/page.tsx"],
    ["12:03:30", "exec.computer", "screenshot → cognition"],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <Head>WORKERS</Head>
        <span style={{ color: CP.success }}>● worker online</span>
      </div>
      <div className="mt-1">
        <Row k="Socket" v="~/.memql/worker.sock" />
        <Row k="State" v="ONLINE · idle" tone={CP.success} />
        <Row k="Window" v="1h" />
        <Row k="Expires" v="12:55:10" />
        <Row k="Strict" v="false" />
      </div>
      <Head className="mt-4">AUDIT TAIL</Head>
      <div className="mt-1 space-y-0.5">
        {audit.map(([ts, ev, detail], i) => (
          <div key={i} className="grid grid-cols-[64px_120px_minmax(0,1fr)] gap-x-2">
            <span style={{ color: CP.subtle }}>{ts}</span>
            <span style={{ color: ev === "granted" ? CP.accent : CP.info }}>{ev}</span>
            <span style={{ color: CP.fg }} className="truncate">{detail}</span>
          </div>
        ))}
      </div>
      <Hints keys={[["G", "Grant"]]} />
    </div>
  );
}

/* ── Safety (real policy names from the DSL) ───────────────────────── */
function SafetyView() {
  const policies: [string, string, string][] = [
    ["balancedChat", "streamClaudeSonnet", "→ stream54Pro → streamGeminiPro"],
    ["lowLatencyVoice", "streamGroqLlama70B", "TTFT ≤ 800ms"],
    ["cheapestCapable", "streamGeminiFlash", "cost-first · ≤ 15s"],
  ];
  return (
    <div className="h-full">
      <Head>SAFETY · POLICIES</Head>
      <div className="mt-2 space-y-2">
        {policies.map(([name, primary, note]) => (
          <div key={name}>
            <span style={{ color: CP.fg }} className="font-semibold">policy <span style={{ color: CP.accent }}>{name}</span></span>
            <div className="pl-4" style={{ color: CP.subtle }}>
              primary <span style={{ color: CP.success }}>{primary}</span> {note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Settings (real ABOUT + shortcuts) ─────────────────────────────── */
function SettingsView() {
  const shortcuts: [string, [string, string][]][] = [
    ["GLOBAL", [["F1 / Option+1", "Clusters tab"], ["F2 / Option+2", "Concepts tab"], ["F3 / Option+3", "Settings tab"], ["Tab", "Switch focus between panes"], ["Ctrl+Y", "Copy header notification"], ["Ctrl+K", "Dismiss header notification"], ["Ctrl+Q", "Quit"]]],
    ["CLUSTERS (F1)", [["Up / Down", "Navigate cluster list"], ["Enter", "Connect to selected cluster"], ["A", "Add new cluster"], ["E", "Edit selected cluster"], ["D", "Delete selected cluster"]]],
    ["TOPOLOGY", [["W / A / S / D", "Pan viewport"], ["R", "Reset pan"], ["X", "Toggle architecture navigator"]]],
    ["CONCEPTS (F2)", [["Up / Down", "Navigate list"], ["Enter", "Open / drill into selection"], [":", "Search rows (bottom band)"], ["V", "Toggle version history"], ["Esc", "Back / clear active filter"]]],
  ];
  return (
    <div className="grid h-full grid-cols-1 gap-x-12 md:grid-cols-2">
      <div>
        <Head>SETTINGS</Head>
        <div className="mt-1" style={{ color: CP.fg }}>ABOUT</div>
        <Row k="" v="memQL Cockpit" />
        <Row k="Version" v="0.1.0" />
        <div className="mt-4" style={{ color: CP.subtle }}>MY ACCESS</div>
        <Row k="local" v="member · authorized" tone={CP.success} />
      </div>
      <div className="mt-6 md:mt-0">
        <div style={{ color: CP.fg }}>KEYBOARD SHORTCUTS</div>
        {shortcuts.map(([group, rows]) => (
          <div key={group} className="mt-3">
            <div style={{ color: CP.subtle }}>{group}</div>
            <div className="mt-1">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-2">
                  <span style={{ color: CP.accent }}>{k}</span>
                  <span style={{ color: CP.fg }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── primitives ────────────────────────────────────────────────────── */
function Head({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`} style={{ color: CP.accent }}>
      {children}
    </div>
  );
}
function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-2">
      <span style={{ color: CP.subtle }}>{k}</span>
      <span style={{ color: tone ?? CP.fg }}>{v}</span>
    </div>
  );
}
function Hints({ keys, align = "left" }: { keys: [string, string][]; align?: "left" | "right" }) {
  return (
    <div className={`mt-3 pt-2 ${align === "right" ? "text-right" : ""}`} style={{ color: CP.subtle }}>
      {keys.map(([k, label], i) => (
        <span key={k}>{i > 0 && "  "}<span style={{ color: CP.accent }}>{k}</span>:{label}</span>
      ))}
    </div>
  );
}
