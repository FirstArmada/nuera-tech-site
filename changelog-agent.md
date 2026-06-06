# Changelog Agent

## Cycle 1
- Optimized mobile padding on pricing grid
- Increased touch targets for 'Book This Repair' CTA
- Adjusted text sizes for mobile viewports

## Cycle 2
- Added hover states for JS category filter pills (.filter-btn)

## Cycle 3
- Added `aria-hidden="true"` to lucide icon elements for screen reader accessibility

## Cycle 4 — Full rehaul
- Rebuilt the site around a build-less, modular architecture (HTML shell + `assets/js/app.js` ES module + inlined critical CSS).
- New premium dark/neon identity; self-hosted Inter variable font; inline SVG icons (dropped the lucide CDN dependency).
- Added an animated "savings spotlight" (Mobile Klinik vs Nuera comparison bars) and a faster device finder (brand + repair-type filters, debounced search, accessible card grid, bottom-sheet modal).
- WhatsApp deep links now pre-fill device, repair, price and dollar savings.
- Added a PWA (manifest + offline service worker), generated icon/OG assets, robots.txt, sitemap.xml.
- Hardened delivery via `vercel.json`: per-path caching + strict Content-Security-Policy and security headers.
- Made all prices and savings stats runtime-derived (Rule 1); structured data is static + a runtime AggregateOffer.
- Verified: headless render/interaction tests + 0 axe-core WCAG 2.1 A/AA violations.

## Cycle 5 — Deploy hygiene
- Removed the unused GitHub Pages workflow (`.github/workflows/static.yml`); it failed on every push to `main` and Vercel is the canonical host.
- Documented the real production topology in the README — Cloudflare (proxied) → Cloudflare Access (intentional auth gate) → Vercel origin — plus a troubleshooting note for the Google Cloud Storage "Object not found / Is this your bucket?" 404 (origin/DNS pointed at a GCS bucket instead of Vercel).
