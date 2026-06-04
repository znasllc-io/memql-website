import type { MetadataRoute } from "next";

// Emitted as a static /robots.txt by `next build` (output: "export").
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://memql.io/sitemap.xml",
    host: "https://memql.io",
  };
}
