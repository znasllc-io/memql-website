import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — `next build` emits a self-contained `out/` directory
  // of plain HTML/CSS/JS that nginx can serve. No Node runtime needed.
  output: "export",

  // `next/image` needs a server to optimize. With static export there's
  // no server, so we disable optimization and serve images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
