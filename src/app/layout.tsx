import type { Metadata, Viewport } from "next";
import { Source_Serif_4, JetBrains_Mono, Squada_One, Inter } from "next/font/google";
import "./globals.css";
import { TransitionProvider } from "@/components/Transition";

// Workhorse grotesk — body + UI text (the category default). Headlines and
// the closing quote stay serif; serif is now our one "personality face."
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Brand display face — used only for the MemQL wordmark / lockup,
// per the brand foundation. Body + headlines stay editorial serif.
const display = Squada_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-squada",
  display: "swap",
});

const SITE_URL = "https://memql.io";
// Search-facing title: always qualified (never bare "MemQL") so Google stops
// folding us into MemSQL/Emacs `memql` results. Uses "AI" (what people search)
// not "SI". Leads with the Tier-2 phrase "agent memory database".
const TITLE = "MemQL — Agent Memory Database & AI Harness";
const DESCRIPTION =
  "MemQL is an open-source, time-series memory graph for AI agents — a persistent, queryable, time-aware memory layer for agent harnesses. One DSL, written in Go.";

// Repos that live on this site — used as sameAs entity signals so search
// engines learn MemQL's identity (and that it is not MemSQL/SingleStore).
const GH_CORE = "https://github.com/znasllc-io/MemQL";
const GH_COCKPIT = "https://github.com/znasllc-io/memql-cockpit";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Child pages set their own full, qualified <title>; no template (docs pages
  // already include "— MemQL docs", so a template would double-suffix).
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "MemQL",
  authors: [{ name: "ZNAS", url: "https://znas.io" }],
  creator: "ZNAS",
  publisher: "ZNAS",
  keywords: [
    "MemQL",
    "agent memory",
    "agent memory database",
    "memory layer for AI agents",
    "AI harness",
    "AI agent memory",
    "temporal memory for AI agents",
    "time-series graph database",
    "agentic memory layer",
    "agent harness",
    "Go agent memory",
    "memory database for AI agents",
    "AI agents",
    "memory graph",
    "open source",
    "PostgreSQL",
    "TimescaleDB",
    "MCP",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "MemQL",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// JSON-LD entity graph — the single highest-leverage disambiguation move:
// teaches search engines that MemQL is a distinct SoftwareApplication
// published by ZNAS, linked to its real repos (sameAs).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "MemQL",
      alternateName: ["MemQL Database", "MemQL agent memory"],
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      description:
        "Open-source, time-series memory graph that serves as the memory layer for AI agents and agent harnesses — persistent, queryable, time-aware agent memory, declared in a single DSL. Written in Go.",
      url: SITE_URL,
      programmingLanguage: "Go",
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      isAccessibleForFree: true,
      sameAs: [GH_CORE, GH_COCKPIT],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "ZNAS",
      url: "https://znas.io",
      sameAs: [GH_CORE, GH_COCKPIT],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "MemQL",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090a" },
    { media: "(prefers-color-scheme: light)", color: "#f2f4ef" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint to set the theme class — no flash of wrong theme.
// Saved choice wins; otherwise follow the OS preference (dark by default).
const THEME_INIT = `(function(){try{var t=localStorage.getItem('memql-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(t);d.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable} ${display.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <TransitionProvider>{children}</TransitionProvider>
      </body>
    </html>
  );
}
