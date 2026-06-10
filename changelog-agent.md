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

## Cycle 6 — TELUS/UDS (Allium) foundation + verification gate
- Re-grounded the design foundations on the TELUS/UDS (Allium) system while preserving the OG Nuera dark-neon palette (per a Claude Design handoff): Inter on the four-weight scale (300/400/500/700; hero **display 300** + brand gradient), the Allium 4px spacing + radius scale, TELUS 250/300ms motion, and the semantic-token architecture. Dark-only — no light theme. Inter stays (the proprietary HelveticaNowTELUS face was deliberately not adopted).
- Unified **one solid action green** (`#34d399` — savings + WhatsApp; retired the green→cyan WhatsApp gradient and the WhatsApp-brand FAB green) and **sharpened danger red** to `#ef4444`; pure black/white text on solid semantic fills. All heavy weights dropped 800 → 700.
- Buttons to a 48px Allium pill; eyebrow tracking `.08em`; tokenized the ad-hoc section paddings. Legacy radius/motion/spacing names are kept as aliases so JS-coupled runtime markup still resolves (0 undefined tokens).
- Selective UDS iconography: inlined the Allium **search** + **hamburger** glyphs; kept the rest of the design-blessed Lucide/Feather set, the WhatsApp glyph and the brand mark (CSP-safe, no icon CDN).
- Modern motion: migrated all interaction motion to the **TELUS curve** (`--ease-default` `cubic-bezier(.4,0,.2,1)`) at Allium **250/300ms** durations, applied system-wide through the motion tokens. (A View Transitions cross-fade on filter changes was prototyped but **reverted** — `startViewTransition` defers the grid's DOM update, which conflicts with the synchronous-filter contract the committed driver enforces.)
- Precompute: the `pricing-sync` job now emits a `stats` view-model (max saving, avg %, top comparisons); `app.js` consumes it and falls back to deriving in-browser (Rule 1 intact). Committed `pricing-data.json` carries the precomputed `stats`.
- Added a CI quality gate — `.github/workflows/verify.yml`: artifact validation + the Playwright user-flow driver (24/24) + an axe-core WCAG 2.1 A/AA audit (`tests/a11y.cjs`, 0 violations). Bumped the service-worker cache to `nuera-v3`.

## Cycle 7 — Accessibility: Label in Name + heading order
- Fixed WCAG 2.5.3 (Label in Name) on every device card: the cards now take their accessible name from visible content (model, brand, per-type prices, savings, CTA) instead of a `View pricing for …` `aria-label` that omitted all of that — so what a screen reader announces now includes (and exposes) the prices a sighted user sees. The "Load More Devices" button's `aria-label` was likewise reworded to lead with its exact visible label (`Load More Devices — N remaining`). Clears axe `label-content-name-mismatch` on all ~130 cards and the load-more control.
- Fixed heading order: footer column headings ("Explore" / "Contact") demoted `h4 → h3` (class-based styling unchanged) so levels no longer jump from the FAQ `h2` straight to `h4` (axe `heading-order`).
- Closed a gate blind spot: `label-content-name-mismatch` is a WCAG 2.1 A rule (2.5.3) but ships from axe tagged `experimental`, so the tag-only filter silently skipped it — which is how the card mismatch passed CI green. `tests/a11y.cjs` now opts the rule in explicitly, so the audit genuinely covers the WCAG 2.1 A/AA surface it promises (now 32 checks, still 0 violations; verified it fails on a re-introduced mismatch).
