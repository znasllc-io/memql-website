"use client";

import type { OS } from "@/lib/useOS";

/* OS-appropriate window controls for the terminal/code-window chrome.
   macOS → traffic-light dots (left); Windows → flat min/max/close glyphs
   (right); Linux → GNOME-ish min/max/close in small circles (right).
   `color` themes the Windows/Linux glyphs to the surrounding chrome. */
export default function WindowControls({ os, color = "currentColor" }: { os: OS; color?: string }) {
  if (os === "windows") {
    return (
      <div className="flex items-center gap-4" style={{ color }} aria-hidden="true">
        <span className="text-[12px] leading-none opacity-70">&#x2013;</span>
        <span className="text-[10px] leading-none opacity-70">&#x25A1;</span>
        <span className="text-[12px] leading-none opacity-80">&#x2715;</span>
      </div>
    );
  }
  if (os === "linux") {
    return (
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {["–", "□", "✕"].map((g, i) => (
          <span
            key={i}
            className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[8px] leading-none"
            style={{ color, border: `1px solid ${color}`, opacity: 0.6 }}
          >
            {g}
          </span>
        ))}
      </div>
    );
  }
  // macOS
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}
