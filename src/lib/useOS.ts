"use client";

import { useEffect, useState } from "react";

export type OS = "mac" | "windows" | "linux";

// Coarse client-side OS detection. Prefers the modern userAgentData.platform
// (Chromium), falls back to navigator.platform / userAgent. iPad/iOS → mac,
// Android → linux (good enough for window-chrome styling).
export function detectOS(): OS {
  if (typeof navigator === "undefined") return "mac";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData;
  const plat = String(uaData?.platform ?? navigator.platform ?? "").toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (plat.includes("win") || ua.includes("windows")) return "windows";
  if (plat.includes("mac") || ua.includes("mac os") || ua.includes("iphone") || ua.includes("ipad")) return "mac";
  if (plat.includes("linux") || ua.includes("linux") || ua.includes("android") || ua.includes("x11")) return "linux";
  return "mac";
}

// SSR-safe: renders `mac` on the server + first client paint (no hydration
// mismatch), then swaps to the detected OS on mount.
export function useOS(): OS {
  const [os, setOS] = useState<OS>("mac");
  useEffect(() => {
    setOS(detectOS());
  }, []);
  return os;
}
