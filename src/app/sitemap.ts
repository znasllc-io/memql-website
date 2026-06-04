import type { MetadataRoute } from "next";
import { DOC_LIST } from "@/lib/docs-nav";

// Emitted as a static /sitemap.xml by `next build` (output: "export").
export const dynamic = "force-static";

const BASE = "https://memql.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const top: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/ai-harness`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/memql-vs-vector-memory`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const docs: MetadataRoute.Sitemap = DOC_LIST.map((d) => ({
    url: `${BASE}/docs/${d.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...top, ...docs];
}
