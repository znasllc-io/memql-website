import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocsChrome from "@/components/docs/DocsChrome";
import DocsIndex from "@/components/docs/DocsIndex";
import { versionLabels } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return versionLabels().map((version) => ({ version }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  const title = `Documentation (${version}) — memQL`;
  return {
    title,
    description: `memQL documentation, version ${version} — generated from the engine repository.`,
    alternates: { canonical: `/docs/${version}` },
  };
}

export default async function VersionDocsHome({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  if (!versionLabels().includes(version)) notFound();
  return (
    <DocsChrome version={version}>
      <DocsIndex version={version} />
    </DocsChrome>
  );
}
