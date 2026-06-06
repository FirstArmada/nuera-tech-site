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

## Verify
No test suite shipped. During the rehaul, verification = `node --check` on the
JS + a headless puppeteer run (render 153 cards, filters/search, modal, WhatsApp
links, runtime schema) + an axe-core WCAG 2.1 A/AA audit (must be 0 violations).
Only ~76 of 435 lines have a Mobile Klinik comparison (all iPhone screens);
the savings UI must degrade gracefully where `mk_price`/`savings` are null.
