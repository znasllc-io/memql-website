<h1 align="center">MemQL — website</h1>

<p align="center">
  <strong>Source for the MemQL marketing site.</strong><br>
  AI-native time-series memory graph with a single DSL.
</p>

<p align="center"><sub><em>Designed and built with Claude as co-author.</em></sub></p>

> **Status: Alpha.** Tracks the [MemQL](https://github.com/znasllc-io/MemQL) and [MemQL Cockpit](https://github.com/znasllc-io/memql-cockpit) repos. Content + structure still evolving.

---

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4**
- **TypeScript**
- **Source Serif 4** + **JetBrains Mono** via `next/font/google`

No build step beyond `next build`. No CMS, no DB, no auth. Static-friendly.

## Develop

```bash
npm install
npm run dev   # → http://localhost:3000
```

## Build

```bash
npm run build          # emits a static export to ./out
npx serve out          # serve the static export locally on :3000
```

`next start` does **not** work here — this is a static export
(`output: 'export'` in `next.config.ts`), served by nginx in production.

## Deploy

Pushed to `main` → GitHub Actions builds the Docker image, pushes to
Artifact Registry, and deploys to Cloud Run.
See [`.github/workflows/deploy-cloud-run.yml`](.github/workflows/deploy-cloud-run.yml),
[`Dockerfile`](Dockerfile), and [`nginx.conf`](nginx.conf).

## Structure

```
src/app/
├── layout.tsx       # fonts, metadata, html shell
├── page.tsx         # the whole site (single-page scroll)
└── globals.css      # theme tokens + Tailwind @theme
public/
├── icon.png         # crystal favicon (256×256)
├── favicon.png      # 48×48
└── memql-logo.png   # full lockup
```

The site is one continuous scroll with these sections:

1. **Hero** — headline + DSL block (`autoJoinSI` automation)
2. **Built on / In the box** — stack + capabilities strip
3. **What** — three-column manifesto (`time-series · event-driven · multi-tenant`)
4. **How** — three layers + five node binaries
5. **The pitch** — duct-taped Python vs nine lines of MemQL (draggable comparison, auto-demo on scroll-in)
6. **The language** — eight tabs, one per DSL construct
7. **Cockpit** — TUI mock + tab grid + computer-use callout
8. **Who it's for** — three reader framings
9. **The project** — Apache 2.0, alpha, Claude co-author
10. **Footer**

## License

Apache License 2.0 — see [LICENSE](LICENSE).
