import type { Metadata } from "next";
import MarketingShell from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "Privacy Policy — MemQL",
  description: "How memql.io handles data. Draft pending legal review.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[12px] text-amber-600 dark:text-amber-400">
      {children}
    </span>
  );
}
function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-12 font-serif text-[22px] leading-[1.25] tracking-tight text-fg">
      <span className="mr-2 font-mono text-[15px] text-dim">{n}.</span>
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15.5px] leading-[1.7] text-fg-dim">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">// privacy</div>
      <h1 className="mt-5 font-serif text-[36px] leading-[1.1] tracking-tight text-fg sm:text-[42px]">
        Privacy Policy
      </h1>

      {/* draft banner — required until counsel reviews */}
      <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-[14px] leading-[1.55] text-fg-dim">
        <strong className="font-semibold text-fg">Draft &mdash; pending legal review.</strong>{" "}
        This is a starting draft, not lawyer-reviewed. Items in <Mark>[CONFIRM]</Mark> need final answers
        before publication.
      </div>

      <H2 n={1}>Who we are</H2>
      <P>
        memql.io (&ldquo;the site&rdquo;) is operated by <strong className="font-semibold text-fg">ZNAS LLC</strong>.
        For any privacy question or request, email{" "}
        <a href="mailto:privacy@znas.io" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">privacy@znas.io</a>.
      </P>

      <H2 n={2}>What we collect</H2>
      <P>
        memql.io is a static marketing and documentation site. It has{" "}
        <strong className="font-semibold text-fg">no user accounts, no contact forms, no advertising, and no
        analytics or tracking pixels</strong>. The only data involved is:
      </P>
      <ul className="mt-3 space-y-2 pl-5 text-[15.5px] leading-[1.7] text-fg-dim [&>li]:list-disc">
        <li>
          <strong className="font-semibold text-fg">Standard server logs.</strong> Our hosting provider may log
          routine request data (IP address, user-agent, timestamp, requested URL) to serve and secure the
          site. <Mark>[CONFIRM: retention period]</Mark>
        </li>
        <li>
          <strong className="font-semibold text-fg">GitHub star count.</strong> The homepage fetches MemQL&rsquo;s
          public star count directly from GitHub&rsquo;s API from your browser. That request goes to GitHub, so
          GitHub &mdash; not us &mdash; receives your IP and user-agent for it, under{" "}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">GitHub&rsquo;s privacy policy</a>.
        </li>
        <li>
          <strong className="font-semibold text-fg">Your theme preference.</strong> Your light/dark choice is
          stored locally in your browser (<code className="rounded border border-border bg-bg-panel px-1 font-mono text-[0.85em]">localStorage</code>).
          It never leaves your device and is not sent to us.
        </li>
      </ul>

      <H2 n={3}>Why we process it</H2>
      <P>
        Only to operate, secure, and improve the site, and to respond if you email us. We do not sell or
        share personal data, and we do not build advertising or behavioral profiles.
      </P>

      <H2 n={4}>Cookies &amp; tracking</H2>
      <P>
        We do not use tracking or advertising cookies. We use a single piece of browser local storage to
        remember your theme preference, which is not used to track you. Because there are no non-essential
        cookies, there is no consent banner.
      </P>

      <H2 n={5}>Third parties</H2>
      <P>
        We rely on a small number of providers: our hosting platform (<Mark>[CONFIRM: e.g. Google Cloud / Cloud Run]</Mark>),
        and GitHub (for the star-count request above and when you follow links to our repositories). Fonts are
        self-hosted, so no font CDN is contacted at runtime.
      </P>

      <H2 n={6}>Your rights</H2>
      <P>
        Depending on where you live (e.g. the EU/EEA under GDPR or California under CCPA), you may have the
        right to access, correct, or delete personal data we hold about you. Because the site collects
        essentially no personal data beyond transient server logs, there is usually little to act on &mdash;
        but you can exercise these rights any time by emailing{" "}
        <a href="mailto:privacy@znas.io" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">privacy@znas.io</a>.
      </P>

      <H2 n={7}>Data retention</H2>
      <P>
        Server logs are retained only as long as needed to operate and secure the site, then deleted.{" "}
        <Mark>[CONFIRM: exact retention period]</Mark>
      </P>

      <H2 n={8}>Changes</H2>
      <P>
        We may update this policy as the site or the project evolves; material changes will be reflected here
        with a new effective date. <strong className="font-semibold text-fg">Effective date:</strong>{" "}
        <Mark>[CONFIRM: set at publication]</Mark>
      </P>

      <p className="mt-12 text-[13.5px] text-dim">
        The MemQL and MemQL Cockpit software is governed by the{" "}
        <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-border underline-offset-2 hover:text-fg">Apache 2.0 license</a>,
        not this policy.
      </p>
    </MarketingShell>
  );
}
