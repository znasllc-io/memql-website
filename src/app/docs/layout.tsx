import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — memQL",
  description:
    "Versioned documentation for memQL, generated from the engine repository: the harness, the language, the AI layer, operations, and the Cockpit.",
  alternates: { canonical: "/docs" },
};

// The version-aware chrome (header + sidebar) lives in <DocsChrome>, rendered
// per page, because this layout sits above the [version] segment and can't read
// that param. This layout just carries shared metadata.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
