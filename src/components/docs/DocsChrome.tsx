import DocsHeader from "@/components/docs/DocsHeader";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { getNav, getRegistry, publishedVersions, resolveVersion } from "@/lib/docs";

/**
 * Server-rendered docs shell: the version-aware header (with the version
 * dropdown) + the manifest-driven sidebar + the content container. Pages pass
 * their version label so the nav and chrome reflect the right snapshot — the
 * route layout can't read the [version] param, so the shell lives here.
 */
export default function DocsChrome({
  version,
  children,
}: {
  version: string;
  children: React.ReactNode;
}) {
  const sections = getNav(version);
  const registry = getRegistry();
  // Only what this build rendered. The registry lists every release ever, and
  // the picker must not offer a version that has no pages behind it.
  const published = new Set(publishedVersions());
  const offered = registry.versions.filter((v) => published.has(v.version));

  return (
    <>
      <DocsHeader
        versionLabel={version}
        resolvedVersion={resolveVersion(version)}
        versions={registry.versions}
        latest={registry.latest}
      />
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-24 sm:px-7">
        <div className="flex gap-8 lg:gap-10">
          <DocsSidebar sections={sections} versionLabel={version} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
