# Nuera Tech — Guelph Phone Repair

Premium, dark/neon marketing + pricing site for **Nuera Tech**, a phone & tablet
repair shop in Guelph, Ontario. The site's job: make the savings-vs-Mobile-Klinik
story obvious and turn visitors into booked repairs over WhatsApp.

**Live:** https://nuera.talha-k.com — auto-deploys from `main` via Vercel (~30s).

## Architecture

Intentionally **build-less**: hand-crafted static files served straight from the
repo root. No framework, no bundler, no `node_modules` to ship. This is the most
robust option for a live site that fans out to multiple deploy targets (Vercel,
the self-hosted OpenResty mirror) and it's plenty fast for a
single-page experience — native ES modules + edge compression do the rest.

```
index.html                 # Shell: semantic markup, inlined critical CSS, static JSON-LD
pricing-data.json          # 435 repair lines — FETCHED AT RUNTIME, never inlined (Rule 1)
manifest.webmanifest       # PWA manifest (installable)
sw.js                      # Service worker — offline shell + stale-while-revalidate pricing
robots.txt / sitemap.xml   # SEO
vercel.json                # Vercel: cache + security headers (CSP), cleanUrls
wrangler.jsonc             # Cloudflare Workers: assets-only Worker config (build-less)
_headers                   # Cloudflare: per-path cache + security headers (mirrors vercel.json)
.assetsignore              # Cloudflare: repo files to exclude from the deployed site
assets/
  js/app.js                # ES module: fetch → group → render → filter/search → modal → WA
  fonts/inter-var-latin.woff2   # Self-hosted Inter (variable, latin subset, 48 KB)
  icons/                   # logo.svg (wordmark lockup) + neon "N" mark, PWA icons, favicons, OG image
```

## The two hard rules

1. **`pricing-data.json` is fetched at runtime — never hardcoded into HTML.**
   All prices, hero stats, the savings spotlight, the CTA headline, and even the
   price-bearing `AggregateOffer` structured data are derived in `app.js` *after*
   the fetch. The static HTML contains zero prices.
2. **WhatsApp number is `+1 226 978 4666`** (`wa.me/12269784666`). Defined once in
   `app.js` (`WA`) and never changed.

## Key features

- **Savings spotlight** — animated side-by-side bars (Mobile Klinik vs Nuera) for
  the highest-savings repairs, with a device picker.
- **Device finder** — instant brand + repair-type filters and debounced search over
  153 devices; accessible card grid; bottom-sheet detail modal on mobile.
- **WhatsApp booking** — every repair row deep-links to WhatsApp with a pre-filled
  message (device, repair, price, and the dollar saving).
- **PWA** — installable, offline-capable app shell.
- **Accessibility** — 0 axe-core WCAG 2.1 A/AA violations; full keyboard support,
  focus management, reduced-motion support, semantic landmarks.
- **SEO** — LocalBusiness + WebSite + FAQPage JSON-LD (static, price-free) plus a
  runtime AggregateOffer; OG/Twitter cards; sitemap/robots.
- **Performance** — inlined CSS (no render-blocking), self-hosted font, inline SVG
  icons (no icon-library CDN), long-cache immutable assets.

## Local development & verification

No install needed to edit. To verify like CI does:

```bash
# serve the repo root with any static server, e.g.
npx serve .            # or: python3 -m http.server 8000

# headless checks used during development (puppeteer + axe-core):
#   render 153 cards, filters/search, modal + WhatsApp links, runtime schema,
#   and a WCAG 2.1 A/AA audit — all green.
```

## Deploy

Push to `main` → Vercel builds (static, no build command) and deploys to
`nuera.talha-k.com`. `vercel.json` sets caching + a strict Content-Security-Policy.
The `.github/workflows/deploy.yml` mirror copies the full site to the OpenResty box.

**Production topology.** `nuera.talha-k.com` is proxied through **Cloudflare**
(orange-cloud) and gated by a **Cloudflare Access** policy — auth is required to view
the site (intentional). Cloudflare's origin is **Vercel**, so a request flows:
Cloudflare DNS → Cloudflare Access login → Vercel → static files from this repo.

**Troubleshooting.** A Google Cloud Storage *"Error 404 — Object not found / Is this
your bucket?"* page means Cloudflare's origin (or the `nuera` DNS record) is pointed at
a GCS bucket instead of Vercel. Fix it in Cloudflare: point `nuera` at Vercel
(`CNAME → cname.vercel-dns.com`), add the domain to the Vercel project, and remove any
Origin Rule / Worker / record routing to GCS. (The Access login wall is separate and
intentional — leave it.)
