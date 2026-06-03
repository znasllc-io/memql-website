"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────────
   Synapse-bloom page transition.

   On a site ↔ docs navigation, a neuron "fires" from the exact click
   point: a radial emerald flare blooms outward with short dendrite lines
   radiating from the origin, briefly covering the page swap, then
   dissolves to reveal the destination. Reduced-motion → instant nav.
   Static-export safe (pure client-side; no View Transitions dependency).
   ───────────────────────────────────────────────────────────────────── */

const COVER_MS = 210;
const REVEAL_MS = 320;

type Line = { x2: number; y2: number };
type Phase = "enter" | "covering" | "revealing";
type Burst = { x: number; y: number; d: number; lines: Line[]; phase: Phase };

type NavFn = (href: string, x?: number, y?: number) => void;

const TransitionCtx = createContext<NavFn>(() => {});
export function useNeuronTransition(): NavFn {
  return useContext(TransitionCtx);
}

function buildLines(x: number, y: number, r: number): Line[] {
  const N = 14;
  const lines: Line[] = [];
  for (let i = 0; i < N; i++) {
    const jitter = ((i * 73) % 17) / 17 - 0.5; // deterministic-ish spread
    const angle = (i / N) * Math.PI * 2 + jitter * 0.32;
    const len = r * (0.16 + (((i * 53) % 29) / 29) * 0.26);
    lines.push({ x2: x + Math.cos(angle) * len, y2: y + Math.sin(angle) * len });
  }
  return lines;
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [burst, setBurst] = useState<Burst | null>(null);
  const pendingRef = useRef(false);
  const reduceRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = mq.matches;
    const onChange = () => (reduceRef.current = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const navigate = useCallback<NavFn>(
    (href, x, y) => {
      // Keyboard / programmatic activation with no coordinates → center.
      const px = typeof x === "number" && x > 0 ? x : window.innerWidth / 2;
      const py = typeof y === "number" && y > 0 ? y : window.innerHeight / 2;

      if (reduceRef.current) {
        router.push(href);
        return;
      }

      const corners = [
        [0, 0],
        [window.innerWidth, 0],
        [0, window.innerHeight],
        [window.innerWidth, window.innerHeight],
      ];
      const r = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - px, cy - py)));
      const d = Math.ceil(r * 2) + 6;

      pendingRef.current = true;
      setBurst({ x: px, y: py, d, lines: buildLines(px, py, r), phase: "enter" });

      // two frames so the initial (enter) state paints before we flip to
      // "covering" — otherwise the CSS transition won't run.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setBurst((b) => (b ? { ...b, phase: "covering" } : b))
        )
      );

      window.setTimeout(() => router.push(href), COVER_MS);
    },
    [router]
  );

  // When the route actually commits, reveal (dissolve the flare).
  useEffect(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    setBurst((b) => (b ? { ...b, phase: "revealing" } : b));
    const id = window.setTimeout(() => setBurst(null), REVEAL_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <TransitionCtx.Provider value={navigate}>
      {children}
      {burst && (
        <div className="neuron-overlay" data-phase={burst.phase} aria-hidden="true">
          <span
            className="neuron-bloom"
            style={{
              left: burst.x,
              top: burst.y,
              width: burst.d,
              height: burst.d,
            }}
          />
          <svg className="neuron-dendrites" width="100%" height="100%">
            <g
              className="neuron-dendrites-g"
              style={{ transformOrigin: `${burst.x}px ${burst.y}px` }}
            >
              {burst.lines.map((l, i) => (
                <g key={i}>
                  <line
                    x1={burst.x}
                    y1={burst.y}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="var(--c-accent)"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                  />
                  <circle cx={l.x2} cy={l.y2} r={2.2} fill="var(--c-accent)" />
                </g>
              ))}
            </g>
          </svg>
        </div>
      )}
    </TransitionCtx.Provider>
  );
}

/* A link that fires the synapse bloom on click, then client-navigates. */
export function NeuronLink({
  href,
  children,
  className,
  ...rest
}: { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useNeuronTransition();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href, e.clientX, e.clientY);
  };
  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  );
}
