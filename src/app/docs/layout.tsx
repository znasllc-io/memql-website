import type { Metadata } from "next";
import DocsHeader from "@/components/docs/DocsHeader";
import DocsSidebar from "@/components/docs/DocsSidebar";

export const metadata: Metadata = {
  title: "Docs — MemQL",
  description:
    "Complete documentation for MemQL: the data model, the DSL, memory & the agent harness, providers & policies, the gRPC API & SDK, cluster deployment, and the Cockpit.",
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsHeader />
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-24 sm:px-7">
        <div className="flex gap-8 lg:gap-10">
          <DocsSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
