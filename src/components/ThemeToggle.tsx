"use client";

import { useEffect, useState } from "react";

/* Theme toggle. The pre-hydration script in layout.tsx has already set the
   `dark`/`light` class on <html>; this just reads it, lets the user flip it,
   and persists the choice to localStorage. Mono sun/moon glyph, in the nav. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    const d = document.documentElement;
    d.classList.remove("light", "dark");
    d.classList.add(next);
    d.style.colorScheme = next;
    try { localStorage.setItem("memql-theme", next); } catch {}
    // let theme-aware canvases (HeroGraph, ConceptGraph) re-read their palette
    window.dispatchEvent(new CustomEvent("memql:themechange", { detail: next }));
    setTheme(next);
  };

  // before hydration we don't know the theme; render a stable placeholder
  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  const glyph = theme === "light" ? "☾" : "☀";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-bg/70 text-[19px] leading-none text-fg-dim outline-none backdrop-blur-md transition-colors hover:border-accent-deep hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span aria-hidden="true">{theme === null ? "" : glyph}</span>
    </button>
  );
}
