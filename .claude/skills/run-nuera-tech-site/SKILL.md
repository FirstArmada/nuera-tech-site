---
name: run-nuera-tech-site
description: Run, serve, launch, preview, screenshot, smoke-test, or drive the Nuera Tech site (a build-less static SPA for a Guelph phone-repair shop). Use when asked to run/start/serve/screenshot the site or to verify the pricing UI, device finder, brand/type filters, search, device modal, savings spotlight, or WhatsApp booking links work in a real browser.
---

Build-less static single-page site: `index.html` + `assets/js/app.js` fetch
`pricing-data.json` at **runtime** and render everything client-side (no prices
are baked into the HTML). "Running it" therefore means serving the repo over
HTTP and driving it in a real browser. The handle is a committed Playwright
driver — **`.claude/skills/run-nuera-tech-site/driver.cjs`** — which starts its
own static server, drives headless Chromium through the real user flows, writes
screenshots, and prints a PASS/FAIL summary.

All paths below are relative to the repo root.

## Prerequisites

Node is preinstalled (`node v22.22.2`). The only thing to install is Chromium
for Playwright (Playwright itself is a global package, `Version 1.56.1`):

```bash
playwright install chromium
```

No `apt-get` was needed in this container — Chromium's system libraries were
already present and it launches headless with `--no-sandbox`. (On a bare Ubuntu,
if Chromium fails to launch with a missing `lib*.so`, run
`playwright install-deps chromium`.)

## Setup

None. The repo ships **no `node_modules` and no build step** by design — that's
the project's "build-less" architecture. Nothing to install or compile.

## Build

None — static files are served straight from the repo root.

## Run (agent path)

One command. It self-resolves the global Playwright install, serves the repo on
`127.0.0.1:8000`, drives every user flow, and tears the server down:

```bash
node .claude/skills/run-nuera-tech-site/driver.cjs
```

Expected tail: `==== 24/24 checks passed ====`. Exit code is non-zero if any
check fails. Screenshots land in **`/tmp/nuera-shots/`**:

| screenshot | shows |
|---|---|
| `01-hero.png`, `01b-fullpage.png` | hero with runtime stats (153 devices, max saving, avg %) |
| `02-spotlight.png` | savings spotlight (MK-vs-Nuera bars + device pills) |
| `03-modal.png`, `03b-modal-switched.png` | device modal + a switched screen tier |
| `04-swatches.png` | iPhone 14 back-glass colour swatches |
| `05-mobile-home.png`, `06-mobile-modal.png` | mobile grid + bottom-sheet modal |

What it verifies: runtime data load → 153 cards; hero stats / CTA filled at
runtime; every WhatsApp link is `wa.me/12269784666`; spotlight animation + pill
switching; brand & type filters; debounced search; device modal open/close;
tier price + Book-link update; back-glass colour swatch switching; mobile
bottom-sheet; and that there are no uncaught page errors or data-load console
errors.

Env overrides (optional): `PORT` (default `8000`), `SHOTS` (default
`/tmp/nuera-shots`), and `BASE` to drive an already-served URL instead of
spawning the built-in server.

## Run (human path)

Serve the repo with any static server and open it in a browser — useless in a
headless container, but this is what a human does locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

## Test

The project's "test/lint" is artifact validation (mirrored by the SessionStart
hook): JSON parses, and every JS artifact passes a syntax check.

```bash
# data contract: the runtime-fetched JSON must be valid
node -e "JSON.parse(require('fs').readFileSync('pricing-data.json','utf8')); JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8')); console.log('JSON OK')"
# JS syntax (app.js is an ES module → check via a temp .mjs; sw.js is a worker)
node --check sw.js && tmp=$(mktemp --suffix=.mjs) && cp assets/js/app.js "$tmp" && node --check "$tmp" && rm -f "$tmp" && echo "JS OK"
```

Or run the whole startup check at once:

```bash
CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh
```

## Gotchas

- **`chromium-cli` is NOT in this container.** The generic "web app" run pattern
  assumes it; here it's absent. Playwright *is* installed, with browsers at
  `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. That's why the harness is a
  committed Playwright `.cjs`, not an inline `chromium-cli` heredoc.
- **No `node_modules` by design.** `require('playwright')` won't resolve from
  inside the repo. `driver.cjs` self-resolves via `npm root -g`; a one-off
  script of your own needs `NODE_PATH="$(npm root -g)" node yourscript.cjs`.
  (This is also why the driver is `.cjs`, not `.mjs` — `NODE_PATH` resolution
  works for CommonJS `require`, not ESM `import`.)
- **Running as root → `--no-sandbox` is mandatory.** Chromium refuses to launch
  otherwise; the driver passes it.
- **The device dialog has a 0.26s open animation** (`@keyframes dlg-in`, opacity
  0→1). Screenshot the instant `#detail[open]` appears and you capture the grid
  *behind* a still-transparent dialog — it looks like the modal never opened,
  but it did and is fully interactive. The driver waits 450ms (`SETTLE`) before
  every modal screenshot. The mobile bottom-sheet has the same animation.
- **ES module scripts need a JavaScript MIME type.** `app.js` is loaded with
  `type="module"`; serve it as `text/plain` and the browser silently refuses to
  execute it → a blank grid with no thrown error. The built-in server (and
  `python3 -m http.server`) send `text/javascript`; a hand-rolled server may not.
- **Expected console noise locally (not app errors):** two `404`s for
  `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` — Vercel
  injects those only on its own platform — plus one `ERR_CERT_AUTHORITY_INVALID`
  from the headless browser prefetching the absolute-URL OG image
  (`https://nuera.talha-k.com/...og-image.png`). The driver ignores these and
  only fails on data-related console errors.

## Troubleshooting

- **`Cannot find module 'playwright'`**: the repo has no `node_modules`. Run
  `playwright install chromium` once; the driver self-resolves the global
  package. For your own script, prefix with `NODE_PATH="$(npm root -g)"`.
- **Chromium fails to launch — `error while loading shared libraries: lib*.so`**:
  install the browser's OS deps with `playwright install-deps chromium`. (Not
  hit in this container; standard fix on a bare Ubuntu.)
- **Blank grid / 0 cards**: the runtime fetch or the module script didn't load.
  Confirm `pricing-data.json` returns 200 and `app.js` is served with a JS
  content-type, then re-check the JSON with the Test command above.
- **`EADDRINUSE`**: port 8000 is busy — `PORT=8080 node .claude/skills/run-nuera-tech-site/driver.cjs`.
- **Screenshot shows the grid, not the open modal**: you shot during the 0.26s
  open animation; settle ~450ms after `#detail[open]` before capturing.
