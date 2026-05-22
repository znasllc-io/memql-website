import type { Metadata, Viewport } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  themeColor: "#07090a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
