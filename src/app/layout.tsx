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
const TITLE = "MemQL — an AI-native memory graph with a single DSL";
const DESCRIPTION =
  "AI-native time-series memory graph with a single DSL — unifies concepts, queries, agent workflows, and voice into deployable primitives.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "MemQL",
  authors: [{ name: "ZNAS LLC" }],
  keywords: [
    "memql",
    "ai-native",
    "memory graph",
    "time-series",
    "dsl",
    "ai agents",
    "agent orchestration",
    "vector database",
    "graph database",
    "postgresql",
    "timescaledb",
    "mcp",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "MemQL",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/icon.png",
        width: 256,
        height: 256,
        alt: "MemQL crystal mark",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon.png"],
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
        <TransitionProvider>{children}</TransitionProvider>
      </body>
    </html>
  );
}
