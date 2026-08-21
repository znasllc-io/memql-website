// Regenerates public/og-image.png (1200x630), the social-share card for memql.io.
//
//   npm run og-image            # writes public/og-image.png
//   node scripts/og-image.mjs [out.png]
//
// Rendered with satori (JSX-like layout -> SVG) + @resvg/resvg-js (SVG -> PNG)
// from the static Inter WOFF files that @fontsource/inter ships; no browser
// involved, so the output is reproducible from `npm ci`.
//
// Design tokens were sampled from the previous card (memql#4199 replaced its
// "Agent memory database" headline): same canvas, same left margin, same
// type sizes and colours, same top-centre glow. Keep the copy here in step
// with TITLE / DESCRIPTION in src/app/layout.tsx -- and never say "database".

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.resolve(here, "..", "public", "og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;

// Copy. The harness is one module of the platform and stays out of the headline.
const EYEBROW = ["MEMQL", ".IO"];
const HEADLINE = ["The AI platform for agents,", "automations & voice."];
const SUBTITLE = [
  "Open source, built on a time-series memory graph. Declare",
  "behavior in one DSL; a mesh of Go nodes runs it and remembers it.",
];
const FOOTER = ["Apache 2.0", "written in Go", "self-hostable"];

// Colours sampled from the previous card.
const BG = "#07090a"; // site dark theme colour
const GLOW = "#0b2c20"; // peak of the top-centre glow, fades linearly into BG
const INK = "#e8e6dd"; // headline line 1
const ACCENT = "#5ccda7"; // headline line 2, ".IO", footer dots
const EYEBROW_INK = "#9ca395";
const SUBTITLE_INK = "#c7c2b3";
const FOOTER_INK = "#6c726a";

const LEFT = 90; // text origin; glyph side-bearings put the first ink at ~x=92

// Each block: position + type. `lineHeight` is in px; `letterSpacing` in px.
const eyebrow = { top: 90, fontSize: 39, lineHeight: 47, letterSpacing: 1.6 };
const headline = { top: 168, fontSize: 80, lineHeight: 86, letterSpacing: -1.5 };
const subtitle = { top: 375, fontSize: 32, lineHeight: 45, letterSpacing: -0.5 };
const footer = { top: 508, fontSize: 25.5, lineHeight: 30, letterSpacing: 0 };

const interDir = path.join(path.dirname(require.resolve("@fontsource/inter/package.json")), "files");
const fonts = [
  { name: "Inter", weight: 400, style: "normal", data: fs.readFileSync(path.join(interDir, "inter-latin-400-normal.woff")) },
];

const el = (type, style, children) => ({ type, props: { style, children } });
const span = (text, color) => el("span", { color }, text);
const row = (children) => el("div", { display: "flex", flexDirection: "row" }, children);

function block({ top, fontSize, lineHeight, letterSpacing }, color, lines) {
  return el(
    "div",
    {
      position: "absolute",
      left: LEFT,
      top,
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter",
      fontWeight: 400,
      fontSize,
      lineHeight: `${lineHeight}px`,
      letterSpacing,
      whiteSpace: "pre",
      color,
    },
    lines,
  );
}

const dot = () => span("  ·  ", ACCENT);

const card = el(
  "div",
  {
    width: WIDTH,
    height: HEIGHT,
    display: "flex",
    position: "relative",
    backgroundColor: BG,
    backgroundImage: `radial-gradient(650px 245px at 600px 0px, ${GLOW} 0%, ${BG} 100%)`,
  },
  [
    block(eyebrow, EYEBROW_INK, [row([span(EYEBROW[0], EYEBROW_INK), span(EYEBROW[1], ACCENT)])]),
    block(headline, INK, [row([span(HEADLINE[0], INK)]), row([span(HEADLINE[1], ACCENT)])]),
    block(subtitle, SUBTITLE_INK, SUBTITLE.map((line) => row([span(line, SUBTITLE_INK)]))),
    block(footer, FOOTER_INK, [
      row([span(FOOTER[0], FOOTER_INK), dot(), span(FOOTER[1], FOOTER_INK), dot(), span(FOOTER[2], FOOTER_INK)]),
    ]),
  ],
);

const svg = await satori(card, { width: WIDTH, height: HEIGHT, fonts });
const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();

// Sanity-check the IHDR before writing: the OG tags in layout.tsx promise 1200x630.
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
if (w !== WIDTH || h !== HEIGHT) throw new Error(`rendered ${w}x${h}, expected ${WIDTH}x${HEIGHT}`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${path.relative(process.cwd(), out)} (${w}x${h}, ${png.length} bytes)`);
