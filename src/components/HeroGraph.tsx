"use client";

import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────
   HeroGraph — the living node-network behind the hero.

   The brand mark is a graph; this brings it to life. Nodes drift,
   proximity edges breathe, the cursor acts as a QUERY PROBE (lines
   reach from the pointer to the nearest nodes), and a "memory-in-action"
   packet periodically travels edge-to-edge and exits the system.

   Engineered, not dreamy: slow drift, tight easing, low contrast so
   the headline stays readable. Pauses when off-screen or tab hidden.
   Honors prefers-reduced-motion (renders one static frame, no loop).
   ──────────────────────────────────────────────────────────────────── */

type Node = { x: number; y: number; vx: number; vy: number; r: number };

type Packet = {
  from: number;
  to: number;
  t: number;        // 0..1 progress along current edge
  speed: number;
  hopsLeft: number;
  life: number;     // 1 → 0 fade-out after hops exhausted
};

// brand emerald — light theme uses darker greens so the graph stays
// visible on the near-white canvas.
const PALETTE = {
  dark:  { node: "92, 205, 167", edge: "73, 148, 113", packet: "152, 255, 224" },
  light: { node: "2, 104, 66",   edge: "4, 125, 90",   packet: "0, 157, 113" },
};
function pickPalette() {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) return PALETTE.light;
  return PALETTE.dark;
}

const EDGE_DIST = 150;   // px: connect nodes closer than this
const PROBE_DIST = 180;  // px: cursor reaches nodes within this
const PROBE_MAX = 5;     // max simultaneous cursor links

export default function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let packet: Packet | null = null;
    let nextPacketAt = 1200;
    let rafId = 0;
    let running = false;
    let elapsed = 0;
    let lastTs = 0;

    const mouse = { x: -9999, y: -9999, active: false };
    let C = pickPalette();

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(28, Math.min(80, Math.round((width * height) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 1.6 + Math.random() * 2.2,
      }));
    }

    // nearest neighbor to node i within EDGE_DIST, excluding `skip`
    function nearest(i: number, skip: number): number {
      let best = -1;
      let bestD = EDGE_DIST * EDGE_DIST;
      const a = nodes[i];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i || j === skip) continue;
        const dx = nodes[j].x - a.x;
        const dy = nodes[j].y - a.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return best;
    }

    function spawnPacket() {
      if (nodes.length < 2) return;
      const from = Math.floor(Math.random() * nodes.length);
      const to = nearest(from, -1);
      if (to === -1) return;
      packet = { from, to, t: 0, speed: 0.5 + Math.random() * 0.35, hopsLeft: 3 + Math.floor(Math.random() * 3), life: 1 };
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, width, height);
      drawEdges();
      drawNodes(1);
    }

    function drawEdges() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.hypot(dx, dy);
          if (dist > EDGE_DIST) continue;
          const a = (1 - dist / EDGE_DIST) * 0.16;
          ctx!.strokeStyle = `rgba(${C.edge}, ${a})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.stroke();
        }
      }
    }

    function drawNodes(globalMul: number) {
      for (const n of nodes) {
        // brighten near cursor (the "query probe" highlight)
        let glow = 0;
        if (mouse.active) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d < PROBE_DIST) glow = (1 - d / PROBE_DIST);
        }
        const alpha = (0.30 + glow * 0.55) * globalMul;
        const r = n.r + glow * 1.6;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${C.node}, ${alpha})`;
        ctx!.fill();
        if (glow > 0.15) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${C.node}, ${glow * 0.10})`;
          ctx!.fill();
        }
      }
    }

    // cursor → nearest nodes: "you are querying the graph"
    function drawProbe() {
      if (!mouse.active) return;
      const cand: { i: number; d: number }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - mouse.x, nodes[i].y - mouse.y);
        if (d < PROBE_DIST) cand.push({ i, d });
      }
      cand.sort((p, q) => p.d - q.d);
      for (let k = 0; k < Math.min(PROBE_MAX, cand.length); k++) {
        const n = nodes[cand[k].i];
        const a = (1 - cand[k].d / PROBE_DIST) * 0.5;
        ctx!.strokeStyle = `rgba(${C.packet}, ${a})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(mouse.x, mouse.y);
        ctx!.lineTo(n.x, n.y);
        ctx!.stroke();
      }
    }

    function drawPacket() {
      if (!packet) return;
      const a = nodes[packet.from];
      const b = nodes[packet.to];
      if (!a || !b) { packet = null; return; }
      const x = a.x + (b.x - a.x) * packet.t;
      const y = a.y + (b.y - a.y) * packet.t;
      const fade = packet.hopsLeft <= 0 ? packet.life : 1;
      // glow
      const g = ctx!.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, `rgba(${C.packet}, ${0.9 * fade})`);
      g.addColorStop(1, `rgba(${C.packet}, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, 9, 0, Math.PI * 2);
      ctx!.fill();
      // core
      ctx!.fillStyle = `rgba(${C.packet}, ${fade})`;
      ctx!.beginPath();
      ctx!.arc(x, y, 2, 0, Math.PI * 2);
      ctx!.fill();
    }

    function step(dt: number) {
      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        n.x = Math.max(0, Math.min(width, n.x));
        n.y = Math.max(0, Math.min(height, n.y));
      }

      // packet progression
      if (!packet && elapsed > nextPacketAt) {
        spawnPacket();
        nextPacketAt = elapsed + 3200 + Math.random() * 2600;
      }
      if (packet) {
        if (packet.hopsLeft > 0) {
          packet.t += packet.speed * (dt / 60);
          if (packet.t >= 1) {
            packet.hopsLeft -= 1;
            const next = nearest(packet.to, packet.from);
            if (next === -1 || packet.hopsLeft <= 0) {
              packet.hopsLeft = 0;
              packet.t = 1;
            } else {
              packet.from = packet.to;
              packet.to = next;
              packet.t = 0;
            }
          }
        } else {
          packet.life -= dt / 60 / 0.6;
          if (packet.life <= 0) packet = null;
        }
      }
    }

    function frame(ts: number) {
      if (!running) return;
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      elapsed += dt;

      ctx!.clearRect(0, 0, width, height);
      drawEdges();
      drawProbe();
      step(dt / 16.67);
      drawNodes(1);
      drawPacket();

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

    // input
    const onMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouse.active = x >= 0 && y >= 0 && x <= width && y <= height;
      mouse.x = x;
      mouse.y = y;
    };
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };
    // `mouseleave` on document fires only when the pointer exits the
    // viewport — unlike `mouseout`, which bubbles between every element.

    // lifecycle
    build();
    if (reduced) {
      drawStatic();
    } else {
      drawStatic();
      window.addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseleave", onLeave, { passive: true });
    }

    const ro = new ResizeObserver(() => {
      build();
      if (reduced || !running) drawStatic();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) start();
        else stop();
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) stop();
      else if (!reduced) start();
    };
    document.addEventListener("visibilitychange", onVis);

    // re-read the palette when the theme flips; redraw the static frame
    // immediately so a paused/reduced-motion graph recolors too.
    const onTheme = () => { C = pickPalette(); if (reduced || !running) drawStatic(); };
    window.addEventListener("memql:themechange", onTheme);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("memql:themechange", onTheme);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
