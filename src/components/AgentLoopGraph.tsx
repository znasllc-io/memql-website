"use client";

import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────
   AgentLoopGraph — the AGENT-LOOP section's argument, made physical.

   A choreography of the MemQL harness running a task, true to the code in
   dsl/harness/. It plays once on scroll-in, then SETTLES into a calm lit
   scene with gentle recall() pulses — no hard reset. Each act reports up
   via onPhase so the prose columns (harness → memory → inspectable,
   matching the headline) light in sync:

     1 harness     — plan fires; a real dependency DAG of steps runs
                     (pending → running → done), s1 ∥ s2 in parallel.
                     s2 FAILS and RETRIES (attempt 2) — the step state
                     machine, on screen.
     2 memory      — each finished step drops an observation into memory;
                     recall() pulses into memory and feeds the NEXT step.
     3 inspectable — a replay sweep re-lights the whole run, then the plan
                     CONVERGES to done. The settled frame reads as a loop.

   tick → route → converge. Honors prefers-reduced-motion (jumps to the
   settled/converged state). Theme-aware via memql:themechange.
   ──────────────────────────────────────────────────────────────────── */

const PALETTE = {
  dark:  { node: "92, 205, 167", edge: "73, 148, 113", packet: "152, 255, 224", label: "156, 163, 149", fail: "224, 122, 95" },
  light: { node: "2, 104, 66",   edge: "4, 125, 90",   packet: "0, 157, 113",   label: "88, 97, 89",    fail: "183, 65, 41" },
};
function pickPalette() {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) return PALETTE.light;
  return PALETTE.dark;
}

// intro timeline (ms from scroll-in) — continuous, no modulo
const T_PLAN = 440;
// step run windows [start, end]; s2 is special (fails then retries)
const RUN_START = [560, 1020, 1020, 2140, 3340];
const RUN_END   = [980, 1440, 2040, 2540, 3760];
const S2_A1_END = 1440;   // s2 first attempt fails here
const S2_RETRY  = 1620;   // s2 retry (attempt 2) starts
const OBS_TRAVEL = 400;

const T_RECALL = 2640;        // recall() out from s3 …
const T_RECALL_MID = 2940;    // … reaches memory …
const T_RECALL_END = 3240;    // … and feeds s4 (the next step)
const T_CONVERGE = 3860;      // s4 done → pulse to plan
const T_CONVERGE_END = 4220;  // plan resolves to "done"
const T_TRACE = 4320;
const T_TRACE_END = 5040;
const T_SETTLE = 5040;

const IDLE_FIRST = 1000, IDLE_PERIOD = 1950, RECALL_DUR = 1180;

const NODE_ORDER = [0, 1, 1, 2, 3];
const STEP_MEM = [0, 1, 2, 3, 4];
const RECALL_HITS = [0, 1, 3];

type P = { x: number; y: number };

const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function AgentLoopGraph({ onPhase }: { onPhase?: (phase: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0, height = 0;
    let plan: P = { x: 0, y: 0 };
    let steps: P[] = [];
    let mem: P[] = [];
    let memC: P = { x: 0, y: 0 };
    const dag: [number, number][] = [[-1, 0], [0, 1], [0, 2], [1, 3], [2, 3], [3, 4]];
    const EDGE_ORDER = [0, 1, 1, 2, 2, 3];
    let C = pickPalette();
    let rafId = 0, running = false, animT = 0, lastTs = 0;

    let qStart = -1, nextQAt = T_SETTLE + IDLE_FIRST, qStep = 0;

    const setPhase = (p: number) => {
      if (p > phaseRef.current) { phaseRef.current = p; onPhase?.(p); }
    };

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = width, H = height;
      plan = { x: W * 0.085, y: H * 0.5 };
      steps = [
        { x: W * 0.30, y: H * 0.5 },
        { x: W * 0.45, y: H * 0.27 },
        { x: W * 0.45, y: H * 0.73 },
        { x: W * 0.60, y: H * 0.5 },
        { x: W * 0.72, y: H * 0.5 },
      ];
      const cx = W * 0.90, cy = H * 0.5, rad = Math.min(W * 0.07, H * 0.34);
      mem = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.6;
        const rr = rad * (0.45 + ((i * 7) % 5) / 5 * 0.55);
        return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.9 };
      });
      memC = { x: mem.reduce((s, p) => s + p.x, 0) / mem.length, y: cy };
    }

    const ptOf = (i: number): P => (i < 0 ? plan : steps[i]);
    const stepStart = (i: number) => RUN_START[i];
    const stepDoneAt = (i: number) => RUN_END[i];
    const lerp = (a: P, b: P, f: number): P => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

    type SState = { state: "pending" | "running" | "failed" | "done"; prog: number; attempt: number };
    function stepState(i: number, t: number, settled: boolean): SState {
      if (settled || t >= RUN_END[i]) return { state: "done", prog: 1, attempt: i === 2 ? 2 : 1 };
      if (i === 2) {
        if (t < 1020) return { state: "pending", prog: 0, attempt: 1 };
        if (t < S2_A1_END) return { state: "running", prog: (t - 1020) / (S2_A1_END - 1020), attempt: 1 };
        if (t < S2_RETRY) return { state: "failed", prog: (t - S2_A1_END) / (S2_RETRY - S2_A1_END), attempt: 1 };
        return { state: "running", prog: (t - S2_RETRY) / (RUN_END[2] - S2_RETRY), attempt: 2 };
      }
      if (t < RUN_START[i]) return { state: "pending", prog: 0, attempt: 1 };
      return { state: "running", prog: (t - RUN_START[i]) / (RUN_END[i] - RUN_START[i]), attempt: 1 };
    }

    function dot(p: P, r: number, color: string) {
      ctx!.beginPath(); ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx!.fillStyle = color; ctx!.fill();
    }
    function glow(p: P, r: number, rgb: string, a: number) {
      if (a <= 0) return;
      const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath(); ctx!.arc(p.x, p.y, r, 0, Math.PI * 2); ctx!.fill();
    }
    function label(text: string, x: number, y: number, a: number, rgb = C.label) {
      ctx!.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx!.textAlign = "center";
      ctx!.fillStyle = `rgba(${rgb}, ${a})`;
      ctx!.fillText(text, x, y);
    }

    function traceAmt(t: number, order: number): number {
      if (t < T_TRACE) return 0;
      if (t >= T_TRACE_END) return 1;
      const sg = easeInOut(clamp01((t - T_TRACE) / (T_TRACE_END - T_TRACE))) * 4;
      return clamp01(sg - order);
    }

    // recall pulse: packet from→memory (0..0.5), memory→to (0.5..1); relevant
    // dots pulse through the middle. eased + faded. (from≠to lets recall feed
    // the NEXT step.)
    function drawRecall(from: P, to: P, f: number) {
      const seg = f < 0.5 ? lerp(from, memC, easeInOut(f / 0.5)) : lerp(memC, to, easeInOut((f - 0.5) / 0.5));
      const half = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
      glow(seg, 8, C.packet, 0.95 * Math.sin(Math.PI * half));
      const pulse = Math.sin(Math.PI * clamp01((f - 0.22) / 0.56));
      if (pulse > 0) for (const m of RECALL_HITS) glow(mem[m], 11, C.packet, 0.6 * pulse);
      label("recall()", (from.x + memC.x) / 2, height * 0.5 - 26, 0.55 * Math.sin(Math.PI * f));
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, width, height);
      const settled = t >= T_SETTLE;

      // ── persistent return-arc (settled frame reads as a loop) ───
      const arcA = settled ? 0.14 : traceAmt(t, 3) * 0.12;
      if (arcA > 0) {
        ctx!.strokeStyle = `rgba(${C.edge}, ${arcA})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(memC.x, memC.y);
        ctx!.quadraticCurveTo(width * 0.5, height * 0.08, steps[0].x, steps[0].y);
        ctx!.stroke();
        // a faint mote drifting along the arc keeps the cycle alive
        if (settled) {
          const f = (t % 3200) / 3200;
          const mx = (1 - f) * (1 - f) * memC.x + 2 * (1 - f) * f * width * 0.5 + f * f * steps[0].x;
          const my = (1 - f) * (1 - f) * memC.y + 2 * (1 - f) * f * height * 0.08 + f * f * steps[0].y;
          glow({ x: mx, y: my }, 5, C.packet, 0.35 * Math.sin(Math.PI * f));
        }
      }

      // ── edges (DAG) + trace overlay ─────────────────────────────
      let traceMul = 0.82;
      if (t >= T_TRACE_END) traceMul = 0.82 + (0.42 - 0.82) * clamp01((t - T_TRACE_END) / 500);
      for (let e = 0; e < dag.length; e++) {
        const [a, b] = dag[e];
        const pa = ptOf(a), pb = ptOf(b);
        const active = settled || (b >= 0 && t >= stepStart(b));
        ctx!.strokeStyle = `rgba(${C.edge}, ${active ? 0.24 : 0.10})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.moveTo(pa.x, pa.y); ctx!.lineTo(pb.x, pb.y); ctx!.stroke();
        const tl = traceAmt(t, EDGE_ORDER[e]);
        if (tl > 0) {
          ctx!.strokeStyle = `rgba(${C.packet}, ${traceMul * tl})`;
          ctx!.lineWidth = 1.7;
          ctx!.beginPath(); ctx!.moveTo(pa.x, pa.y); ctx!.lineTo(pb.x, pb.y); ctx!.stroke();
        }
      }

      // ── plan node (open/running → done) ─────────────────────────
      const planDone = settled || t >= T_CONVERGE_END;
      const planPulse = t < T_PLAN ? easeOut(1 - t / T_PLAN) : 0;
      glow(plan, 16, C.packet, planPulse * 0.5);
      glow(plan, 12, C.packet, planDone ? 0.4 : traceAmt(t, 0) * 0.45 * traceMul);
      // stop pulse at the moment the plan converges (budget/stopping nod)
      if (planDone && t < T_CONVERGE_END + 420 && !settled) {
        const k = (t - T_CONVERGE_END) / 420;
        ctx!.beginPath(); ctx!.arc(plan.x, plan.y, 9 + 14 * easeOut(k), 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${C.packet}, ${0.5 * (1 - k)})`; ctx!.lineWidth = 1.3; ctx!.stroke();
      }
      dot(plan, planDone ? 6 : 5, `rgba(${C.node}, ${planDone ? 0.92 : 0.72})`);
      ctx!.beginPath(); ctx!.arc(plan.x, plan.y, 8.5, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${C.node}, ${planDone ? 0.4 : 0.28})`; ctx!.lineWidth = 1; ctx!.stroke();
      label("plan", plan.x, plan.y - 16, 0.5);
      if (planDone) label("done", plan.x, plan.y + 24, 0.7, C.packet);

      // ── step nodes ──────────────────────────────────────────────
      for (let i = 0; i < steps.length; i++) {
        const st = stepState(i, t, settled);
        if (st.state === "pending") {
          dot(steps[i], 2.6, `rgba(${C.node}, 0.28)`);
        } else if (st.state === "failed") {
          const fl = 0.55 + 0.45 * Math.abs(Math.sin(t / 70)); // red flicker
          glow(steps[i], 12, C.fail, 0.55 * fl);
          dot(steps[i], 3.4, `rgba(${C.fail}, ${0.9})`);
          ctx!.beginPath(); ctx!.arc(steps[i].x, steps[i].y, 7, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${C.fail}, ${0.5 * fl})`; ctx!.lineWidth = 1.2; ctx!.stroke();
          label("failed", steps[i].x, steps[i].y + 20, 0.8, C.fail);
        } else if (st.state === "running") {
          const e = easeOut(st.prog), gl = Math.sin(Math.PI * st.prog);
          dot(steps[i], 2.6 + 0.9 * e, `rgba(${C.node}, ${0.28 + 0.44 * e})`);
          glow(steps[i], 12, C.packet, 0.5 * gl);
          ctx!.beginPath(); ctx!.arc(steps[i].x, steps[i].y, 6 + 4 * st.prog, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${C.packet}, ${0.5 * (1 - st.prog)})`; ctx!.lineWidth = 1.2; ctx!.stroke();
          if (i === 2 && st.attempt === 2) label("attempt 2", steps[i].x, steps[i].y + 20, 0.7);
        } else {
          dot(steps[i], 3.5, `rgba(${C.node}, 0.7)`);
        }
        glow(steps[i], 11, C.packet, traceAmt(t, NODE_ORDER[i]) * 0.4 * traceMul);
      }
      label("steps", (steps[1].x + steps[2].x) / 2, Math.max(steps[1].y - 16, 12), 0.5);

      // ── memory store (observations accumulate) ──────────────────
      let firstLitX = -1, firstLitY = -1;
      for (let m = 0; m < mem.length; m++) {
        const src = STEP_MEM.indexOf(m);
        const li = src < 0 ? 0 : clamp01((t - (stepDoneAt(src) + OBS_TRAVEL)) / 320);
        const r = 2.2 + 0.6 * li;
        const rgb = li > 0.5 ? C.packet : C.node;
        const a = li > 0.5 ? 0.85 : 0.24 + 0.6 * li;
        dot(mem[m], r, `rgba(${rgb}, ${a})`);
        if (m === 0 && li > 0.4 && firstLitX < 0) { firstLitX = mem[m].x; firstLitY = mem[m].y; }
      }
      label("memory", memC.x, height - 10, 0.5);
      // P3 — name the dots: the first observation a step drops
      if (firstLitX >= 0) label("observation", firstLitX, firstLitY - 12, 0.5);

      // ── observation packets (step → memory) ─────────────────────
      for (let i = 0; i < steps.length; i++) {
        const t0 = stepDoneAt(i);
        if (t >= t0 && t < t0 + OBS_TRAVEL) {
          const f = (t - t0) / OBS_TRAVEL;
          glow(lerp(steps[i], mem[STEP_MEM[i]], easeInOut(f)), 6, C.packet, 0.9 * Math.sin(Math.PI * f));
        }
      }

      // ── recall(): intro pulse feeds s4, then idle cycling ───────
      if (t >= T_RECALL && t < T_RECALL_END) {
        drawRecall(steps[3], steps[4], (t - T_RECALL) / (T_RECALL_END - T_RECALL));
      }
      // ── convergence: s4 done → pulse to plan ────────────────────
      if (t >= T_CONVERGE && t < T_CONVERGE_END) {
        const f = easeInOut((t - T_CONVERGE) / (T_CONVERGE_END - T_CONVERGE));
        glow(lerp(steps[4], plan, f), 7, C.packet, 0.95 * Math.sin(Math.PI * ((t - T_CONVERGE) / (T_CONVERGE_END - T_CONVERGE))));
      }
      if (settled) {
        if (qStart < 0 && t >= nextQAt) { qStart = t; qStep = (qStep + 1) % steps.length; }
        if (qStart >= 0) {
          const e = t - qStart;
          if (e < RECALL_DUR) drawRecall(steps[qStep], steps[qStep], e / RECALL_DUR);
          else { qStart = -1; nextQAt = t + IDLE_PERIOD; }
        }
      }

      // ── phases (latched) ────────────────────────────────────────
      if (t >= T_TRACE) setPhase(3);
      else if (t >= T_RECALL) setPhase(2);
      else if (t >= RUN_START[0]) setPhase(1);
    }

    function frame(ts: number) {
      if (!running) return;
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      animT += dt;
      render(animT);
      rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduced) return;
      running = true; lastTs = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }
    function renderReducedFinal() {
      render(T_SETTLE + IDLE_FIRST - 1);
      setPhase(3);
    }

    build();
    render(0);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { if (reduced) renderReducedFinal(); else start(); }
        else stop();
      },
      { threshold: 0.3 }
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) renderReducedFinal();
      else render(animT);
    });
    ro.observe(canvas);

    const onVis = () => {
      if (document.hidden) stop();
      else if (!reduced && phaseRef.current > 0) start();
    };
    document.addEventListener("visibilitychange", onVis);

    const onTheme = () => { C = pickPalette(); if (!running) render(animT); };
    window.addEventListener("memql:themechange", onTheme);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("memql:themechange", onTheme);
    };
  }, [onPhase]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block h-[300px] w-full sm:h-[340px]"
    />
  );
}
