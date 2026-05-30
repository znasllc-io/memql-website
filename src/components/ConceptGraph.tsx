"use client";

import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────
   ConceptGraph — the WHAT section's argument, made physical.

   On scroll-in it plays one choreographed sequence that performs the
   three brand properties in order, reporting each phase up via onPhase
   so the prose columns light in sync:

     drift        — scattered nodes wander (the unstructured "before")
     1 permanent  — nodes freeze + crystallize (lock, brighten, facet ring)
     2 organized  — nodes glide into a clean lattice; edges resolve to a grid
     3 retrievable— a query packet fires and traces the MINIMUM PATH across
                    the lattice to a far node, lighting the route

   Same edge set throughout (grid adjacency), so chaos→order is shown with
   the same lines snapping into structure. Honors prefers-reduced-motion
   (jumps to the final lit-lattice state, reports phase 3 immediately).
   ──────────────────────────────────────────────────────────────────── */

// light theme uses darker greens so the lattice stays visible on near-white
const PALETTE = {
  dark:  { node: "92, 205, 167", edge: "73, 148, 113", packet: "152, 255, 224" },
  light: { node: "2, 104, 66",   edge: "4, 125, 90",   packet: "0, 157, 113" },
};
function pickPalette() {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) return PALETTE.light;
  return PALETTE.dark;
}

// timeline (ms from scroll-in trigger)
const T_CRYST = 550;     // drift → crystallize
const T_LATTICE = 1450;  // crystallize → glide to lattice (easeInOutSine)
const T_QUERY = 2500;    // lattice settled → fire FIRST query packet
const HOP_MS = 150;      // packet ms per edge
const SETTLE_MS = 600;   // after arrival: head fades, route held lit
const DIM_MS = 850;      // route dims back to the calm lattice
const PAUSE_MS = 950;    // rest before the next query fires (twice as often)

type N = {
  gx: number; gy: number;        // grid coords
  tx: number; ty: number;        // target lattice px
  x: number; y: number;          // current px
  vx: number; vy: number;        // drift velocity
  fx?: number; fy?: number;      // frozen pos snapshot (set at crystallize)
};

export default function ConceptGraph({
  onPhase,
}: {
  onPhase?: (phase: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let nodes: N[] = [];
    let edges: [number, number][] = [];
    let cornerPath: number[] = [];   // the dramatic first query, corner→corner
    let C = pickPalette();
    let rafId = 0;
    let running = false;
    let animT = 0;                   // animation clock — only advances while visible
    let lastTs = 0;
    // continuous query cycling (after the intro sequence)
    let qPath: number[] = [];
    let qStart = -1;                 // animT when current query began; -1 = idle
    let nextQAt = T_QUERY;           // animT of next query
    let firstQuery = true;
    const padX = 36;
    const padY = 30;

    // easeInOutSine — softer than cubic; starts/ends at zero velocity so
    // nodes ease out of the freeze and settle into the lattice gently.
    // ("Cubic feels engineered. Sine feels biological.")
    const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
    const setPhase = (p: number) => {
      if (p !== phaseRef.current) {
        phaseRef.current = p;
        onPhase?.(p);
      }
    };

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(6, Math.min(11, Math.round(width / 130)));
      rows = Math.max(3, Math.min(5, Math.round(height / 70)));

      const cellW = (width - padX * 2) / (cols - 1);
      const cellH = (height - padY * 2) / (rows - 1);

      nodes = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          nodes.push({
            gx, gy,
            tx: padX + gx * cellW,
            ty: padY + gy * cellH,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
          });
        }
      }

      // grid adjacency (right + down)
      edges = [];
      const idx = (gx: number, gy: number) => gy * cols + gx;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (gx + 1 < cols) edges.push([idx(gx, gy), idx(gx + 1, gy)]);
          if (gy + 1 < rows) edges.push([idx(gx, gy), idx(gx, gy + 1)]);
        }
      }

      // minimum path corner→corner via BFS (Manhattan on the grid)
      cornerPath = bfs(idx(0, rows - 1), idx(cols - 1, 0), cols, rows);
    }

    // a fresh random query — biased toward farther endpoints so trails
    // run longer on average. Pick a source, then sample several candidate
    // targets and keep the most distant (Manhattan on the grid).
    function randomQuery(): number[] {
      if (nodes.length < 2) return cornerPath;
      const a = Math.floor(Math.random() * nodes.length);
      const ax = a % cols, ay = Math.floor(a / cols);
      let best = -1, bestD = -1;
      for (let s = 0; s < 6; s++) {
        const c = Math.floor(Math.random() * nodes.length);
        if (c === a) continue;
        const d = Math.abs((c % cols) - ax) + Math.abs(Math.floor(c / cols) - ay);
        if (d > bestD) { bestD = d; best = c; }
      }
      if (best < 0) return cornerPath;
      const p = bfs(a, best, cols, rows);
      return p.length > 1 ? p : cornerPath;
    }

    function bfs(src: number, dst: number, c: number, r: number): number[] {
      const adj = (n: number) => {
        const gx = n % c, gy = Math.floor(n / c);
        const out: number[] = [];
        if (gx + 1 < c) out.push(gy * c + gx + 1);
        if (gx - 1 >= 0) out.push(gy * c + gx - 1);
        if (gy + 1 < r) out.push((gy + 1) * c + gx);
        if (gy - 1 >= 0) out.push((gy - 1) * c + gx);
        return out;
      };
      const prev = new Map<number, number>();
      const seen = new Set([src]);
      const q = [src];
      while (q.length) {
        const cur = q.shift()!;
        if (cur === dst) break;
        for (const nx of adj(cur)) {
          if (!seen.has(nx)) { seen.add(nx); prev.set(nx, cur); q.push(nx); }
        }
      }
      const out: number[] = [];
      let c2: number | undefined = dst;
      while (c2 !== undefined) { out.unshift(c2); c2 = prev.get(c2); }
      return out;
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, width, height);

      // phase factors
      const crystF = clamp01((t - 0) / T_CRYST);                    // 0..1 brighten/lock
      const latF = ease(clamp01((t - T_CRYST) / (T_LATTICE - T_CRYST))); // 0..1 glide to grid
      const settled = t >= T_LATTICE;

      // advance positions
      for (const n of nodes) {
        if (t < T_CRYST) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
          n.x = clamp(n.x, 0, width);
          n.y = clamp(n.y, 0, height);
          n.fx = n.x; n.fy = n.y; // freeze snapshot
        } else if (!settled) {
          // glide frozen pos → lattice target
          n.x = n.fx! + (n.tx - n.fx!) * latF;
          n.y = n.fy! + (n.ty - n.fy!) * latF;
        } else {
          n.x = n.tx; n.y = n.ty;
        }
      }

      // ── query lifecycle ──────────────────────────────────────────
      // After the intro, fire a query, hold the lit route, dim it back
      // to the calm lattice, pause, then fire a fresh one. Continuous.
      if (t >= T_QUERY && qStart < 0 && t >= nextQAt) {
        qPath = firstQuery ? cornerPath : randomQuery();
        firstQuery = false;
        qStart = t;
      }
      let packIdx = -1;
      let packT = 0;
      let headFade = 0;
      let routeAlpha = 0;           // brightness of the lit route, 1→0 on dim
      const litEdges = new Set<string>();
      const litNodes = new Set<number>();
      if (qStart >= 0 && qPath.length > 1) {
        const e = t - qStart;
        const hops = qPath.length - 1;
        const travelMs = hops * HOP_MS;
        if (e < travelMs) {
          // travelling
          packIdx = Math.min(Math.floor(e / HOP_MS), hops - 1);
          packT = (e % HOP_MS) / HOP_MS;
          headFade = 1;
          routeAlpha = 1;
          for (let k = 0; k <= packIdx; k++) {
            litNodes.add(qPath[k]);
            litEdges.add(edgeKey(qPath[k], qPath[k + 1]));
          }
          litNodes.add(qPath[packIdx + 1]);
        } else if (e < travelMs + SETTLE_MS) {
          // arrived — head fades, full route lit
          packIdx = hops - 1; packT = 1;
          headFade = clamp01(1 - (e - travelMs) / SETTLE_MS);
          routeAlpha = 1;
          for (let k = 0; k < qPath.length; k++) litNodes.add(qPath[k]);
          for (let k = 0; k < hops; k++) litEdges.add(edgeKey(qPath[k], qPath[k + 1]));
        } else if (e < travelMs + SETTLE_MS + DIM_MS) {
          // route dims back to the calm lattice
          headFade = 0;
          routeAlpha = clamp01(1 - (e - travelMs - SETTLE_MS) / DIM_MS);
          for (let k = 0; k < qPath.length; k++) litNodes.add(qPath[k]);
          for (let k = 0; k < hops; k++) litEdges.add(edgeKey(qPath[k], qPath[k + 1]));
        } else {
          // done — schedule the next
          qStart = -1;
          nextQAt = t + PAUSE_MS;
        }
      }

      // edges — base lattice + lit route overlay (fades with routeAlpha)
      const edgeBase = 0.05 + crystF * 0.12 + latF * 0.06;
      for (const [a, b] of edges) {
        ctx!.strokeStyle = `rgba(${C.edge}, ${edgeBase})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(nodes[a].x, nodes[a].y);
        ctx!.lineTo(nodes[b].x, nodes[b].y);
        ctx!.stroke();
        if (routeAlpha > 0 && litEdges.has(edgeKey(a, b))) {
          ctx!.strokeStyle = `rgba(${C.packet}, ${0.85 * routeAlpha})`;
          ctx!.lineWidth = 1.6;
          ctx!.beginPath();
          ctx!.moveTo(nodes[a].x, nodes[a].y);
          ctx!.lineTo(nodes[b].x, nodes[b].y);
          ctx!.stroke();
        }
      }

      // nodes — base + lit overlay
      const baseA = 0.28 + crystF * 0.30;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const lit = routeAlpha > 0 && litNodes.has(i);
        const r = 2 + crystF * 1.2 + (lit ? 1.6 * routeAlpha : 0);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${C.node}, ${baseA})`;
        ctx!.fill();
        if (lit) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${C.packet}, ${0.95 * routeAlpha})`;
          ctx!.fill();
        }
        // facet ring once crystallized
        if (crystF > 0.4 && !lit) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${C.node}, ${(crystF - 0.4) * 0.18})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
      }

      // packet head
      if (packIdx >= 0 && qPath.length > 1 && headFade > 0.01) {
        const a = nodes[qPath[packIdx]];
        const b = nodes[qPath[packIdx + 1]];
        const x = a.x + (b.x - a.x) * packT;
        const y = a.y + (b.y - a.y) * packT;
        const g = ctx!.createRadialGradient(x, y, 0, x, y, 10);
        g.addColorStop(0, `rgba(${C.packet}, ${headFade})`);
        g.addColorStop(1, `rgba(${C.packet}, 0)`);
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(x, y, 10, 0, Math.PI * 2);
        ctx!.fill();
      }

      // phase reporting
      if (t >= T_QUERY) setPhase(3);
      else if (t >= T_CRYST) setPhase(2);
      else setPhase(1);
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
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    function renderReducedFinal() {
      // reduced-motion: settled lattice, corner route lit, head gone
      for (const n of nodes) { n.x = n.tx; n.y = n.ty; }
      qPath = cornerPath;
      qStart = 0;
      animT = T_QUERY + (cornerPath.length - 1) * HOP_MS + 1; // arrived, head faded
      render(animT);
      setPhase(3);
    }

    build();
    render(0); // faint static frame before trigger

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (reduced) renderReducedFinal();
          else start();
        } else {
          stop();
        }
      },
      { threshold: 0.35 }
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

    // recolor on theme flip; repaint the current frame if the loop is idle
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
      className="block h-[260px] w-full sm:h-[300px]"
    />
  );
}

/* helpers */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function edgeKey(a: number, b: number) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
