"use client";

import { useEffect, useState } from "react";

/**
 * Types a headline out character-by-character on mount — the docs landing's
 * attention hook, timed to begin just as the synapse-bloom transition clears.
 *
 * - A hidden full-text spacer reserves the final layout so nothing reflows as
 *   characters land (no line-wrap jump).
 * - The complete text is exposed to assistive tech via aria-label; the
 *   animated glyphs are aria-hidden.
 * - prefers-reduced-motion → the full headline renders instantly, no caret.
 */
export default function Typewriter({
  text,
  className = "",
  startDelay = 360,
  speed = 42,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  speed?: number;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [hideCaret, setHideCaret] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      setDone(true);
      setHideCaret(true);
      return;
    }

    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    let caretTimer: ReturnType<typeof setTimeout>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
          // let the caret blink a moment, then retire it
          caretTimer = setTimeout(() => setHideCaret(true), 1100);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
      clearTimeout(caretTimer);
    };
  }, [text, startDelay, speed]);

  return (
    <h1 className={`relative ${className}`} aria-label={text}>
      {/* invisible spacer holds the final size so nothing reflows while typing */}
      <span aria-hidden="true" className="invisible">
        {text}
      </span>
      <span aria-hidden="true" className="absolute inset-0">
        {text.slice(0, count)}
        {!hideCaret && <span className={`tw-caret ${done ? "tw-caret-done" : ""}`} />}
      </span>
    </h1>
  );
}
