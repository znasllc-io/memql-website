import type { Metadata } from "next";
import DocsChrome from "@/components/docs/DocsChrome";
import DocsIndex from "@/components/docs/DocsIndex";

export const metadata: Metadata = {
  title: "Documentation — memQL",
  description:
    "Complete documentation for memQL and the Cockpit, generated from the engine repository and versioned per release — the harness, the language, memory, the AI layer, operations, and the Cockpit.",
  alternates: { canonical: "/docs" },
};

// Base /docs serves the latest snapshot's index.
export default function DocsHome() {
  return (
    <DocsChrome version="latest">
      <DocsIndex version="latest" />
    </DocsChrome>
  );
}
