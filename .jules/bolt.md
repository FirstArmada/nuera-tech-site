# Bolt's Journal — Critical Learnings

Codebase: nuera-tech-site. Build-less static site (no package.json shipped).

## Architecture (post-rehaul)
- `index.html` — shell with inlined critical CSS + static, price-free JSON-LD.
- `assets/js/app.js` — ES module (`<script type="module">`). Fetches
  `pricing-data.json` at runtime, groups 435 lines into ~153 device cards,
  renders the finder/spotlight/modal, builds WhatsApp deep links, and injects
  price-bearing structured data. All prices live here, never in HTML (Rule 1).
- `assets/fonts/inter-var-latin.woff2` — self-hosted (no Google Fonts request).
- `assets/icons/*` — PWA icons / favicons / OG image (generated neon "N" mark).
- `sw.js` — PWA service worker. App shell precache + network-first navigations +
  stale-while-revalidate for `/pricing-data.json` and `/assets/*`.
- `vercel.json` — modern static config: cache-control per path + strict CSP
  (`script-src 'self'`; inline executable JS is therefore *not allowed* — keep all
  JS in app.js; JSON-LD data blocks and `style` attrs are fine).

## Hard rules
1. `pricing-data.json` is fetched at runtime; no prices in any static HTML.
2. WhatsApp = `+1 226 978 4666` → `wa.me/12269784666` (const `WA` in app.js).

## Deploy / production topology
- Canonical host is **Vercel** (push to `main` → static deploy, no build command).
  `.github/workflows/deploy.yml` mirrors the full site to a self-hosted
  1Panel/OpenResty box. There is **no GitHub Pages** target — that workflow only
  ever failed and was removed.
- Live request path: `nuera.talha-k.com` → **Cloudflare** (proxied / orange-cloud)
  → **Cloudflare Access** login (intentional auth gate, leave it) → **Vercel** origin.
- Gotcha: a Google Cloud Storage *"Object not found / Is this your bucket?"* 404
  means Cloudflare's origin (or the `nuera` DNS record) points at a GCS bucket, not
  Vercel. Fix in Cloudflare (`CNAME nuera → cname.vercel-dns.com` + add the domain in
  Vercel; drop any Origin Rule/Worker routing to GCS). The repo has no GCS config and
  never deployed there.

## Verify
No test suite shipped. During the rehaul, verification = `node --check` on the
JS + a headless puppeteer run (render 153 cards, filters/search, modal, WhatsApp
links, runtime schema) + an axe-core WCAG 2.1 A/AA audit (must be 0 violations).
Only ~76 of 435 lines have a Mobile Klinik comparison (all iPhone screens);
the savings UI must degrade gracefully where `mk_price`/`savings` are null.
## 2026-06-06 - [CSS Performance] Learning: [Adding content-visibility: auto with a contain-intrinsic-size effectively defers rendering of off-screen elements without layout shifts, making it perfect for long lists or below-the-fold content in single-page vanilla apps.] Action: [Look for opportunities to apply content-visibility to long lists or heavy components that aren't visible on initial load.]

## Foundation refresh (TELUS/UDS "Allium" bones, Nuera palette)
- The inline token block in `index.html` now follows the TELUS/UDS (Allium) system in its
  BONES while keeping the OG dark-neon palette: Inter four-weight scale (300/400/500/700;
  hero **display 300** + gradient), 4px spacing scale, Allium radii (`--radius-card` 24),
  TELUS motion (`--dur-250/300`, `--ease-default`). Dark-only. **Do not adopt the proprietary
  HelveticaNowTELUS font** — Inter (SIL OFL) is the deliberate, commercially-safe choice.
- One solid action green `#34d399` (savings + WhatsApp + FAB); danger `#ef4444`. Heavy text is
  700, never 800. Legacy token names (`--radius-sm/md/lg`, `--dur-fast/base/slow`, `--space-16`,
  `--ease-out`, the short colour aliases) are retained as aliases — keep them; runtime markup +
  CSS depend on them. Filter pills keep `role="radio"` + `aria-checked` (NOT the design's
  `aria-pressed`) — it's the more correct, axe-clean semantics.
- `pricing-data.json` may carry a precomputed `stats` object (max saving, avg %, top 6
  comparisons). `app.js` uses it when present and falls back to `computeSavingsStats` (Rule 1).
  The sync job (`cloud/pricing-sync/lib/transform.js` → `computeStats`) emits it.
- Verify with the run-* driver (24/24) AND `tests/a11y.cjs` (axe 0 violations); CI runs both
  on every PR via `.github/workflows/verify.yml`. SW cache is `nuera-v3`.
