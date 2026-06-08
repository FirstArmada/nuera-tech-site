#!/usr/bin/env node
'use strict';
/* Cross-platform / cross-browser layout gate — drives the build-less site in all
 * three Playwright engines (Chromium · Firefox · WebKit) across desktop + mobile
 * device profiles and asserts the responsive layout + CSS stacking contexts hold
 * everywhere. WebKit/Mobile-Safari is the headline target: it surfaces the
 * backdrop-filter / content-visibility rendering bugs the Chromium-only gates
 * (tests/mobile.cjs, tests/a11y.cjs) can't see.
 *
 * Build-less by design: the repo ships NO node_modules and NO @playwright/test
 * runner. This is a standalone CommonJS script using the global Playwright
 * *library* API + native node:assert (same convention as tests/mobile.cjs and
 * the run-* driver). It self-resolves the global install and exits non-zero if
 * any engine/viewport fails so CI can gate on it.
 *
 *   # one-time: install the library + the three browser engines globally
 *   npm install -g playwright
 *   playwright install --with-deps chromium firefox webkit
 *   # run:
 *   NODE_PATH="$(npm root -g)" node tests/cross-platform.cjs
 *
 * Env overrides:  PORT (default 8125) · BASE (drive an external URL) · SHOTS (screenshot dir)
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('node:assert');
const { execSync } = require('child_process');

// ---- resolve the global Playwright library (repo has no node_modules) -------
function loadPlaywright() {
  try { return require('playwright'); } catch (_) { /* fall through to global */ }
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(root, 'playwright'));
}
const { chromium, firefox, webkit, devices } = loadPlaywright();

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8125);
const BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || '/tmp/nuera-xplat-shots';
fs.mkdirSync(SHOTS, { recursive: true });

// ---- tiny static server (module scripts need a JS MIME type) ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
function startServer() {
  const server = http.createServer((req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(REPO, path.normalize(p));
      if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (e) { console.error(e); res.writeHead(500); res.end('server error'); }
  });
  return new Promise((rs, rj) => { server.once('error', rj); server.listen(PORT, '127.0.0.1', () => rs(server)); });
}

// ---- assertion helper: log on pass, throw (with message) on fail ------------
let assertCount = 0;
function aok(cond, msg) { assertCount++; assert.ok(cond, msg); console.log(`    ✓ ${msg}`); }

// ---- engine × viewport matrix -----------------------------------------------
// Firefox is desktop-only (Playwright mobile/touch emulation is a Chromium/WebKit
// feature); Chromium carries the Android profile, WebKit the iOS-Safari profile.
const DESKTOP = { viewport: { width: 1920, height: 1080 } };           // standard 1080p
const dev = (name, fallback) => devices[name] || fallback;
const MATRIX = [
  { engine: chromium, engineName: 'chromium', label: 'Chromium · Desktop 1080p', ctx: DESKTOP },
  { engine: chromium, engineName: 'chromium', label: 'Chromium · Pixel 5 (Android)',
    ctx: dev('Pixel 5', { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 }) },
  { engine: firefox, engineName: 'firefox', label: 'Firefox · Desktop 1080p', ctx: DESKTOP },
  { engine: webkit, engineName: 'webkit', label: 'WebKit · Desktop 1080p', ctx: DESKTOP },
  { engine: webkit, engineName: 'webkit', label: 'WebKit · iPhone 13 (Mobile Safari)',
    ctx: dev('iPhone 13', { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 }) },
];

// ===========================================================================
// Assertion groups (run for every matrix entry)
// ===========================================================================

// Safari rendering guard — the backdrop-filter glass bar + content-visibility card
// grid must actually paint with a real box. A WebKit regression collapses these to
// height:0; running it on every engine makes it a cross-browser invariant.
async function assertSafariRenderGuard(page) {
  for (const sel of ['.controls-inner', '#grid']) {
    const loc = page.locator(sel);
    aok(await loc.isVisible(), `${sel} is visible`);
    const box = await loc.boundingBox();
    aok(!!box && box.height > 0, `${sel} has a rendered height > 0 (${box ? Math.round(box.height) : 'null'}px)`);
  }
  // content-visibility:auto cards must still measure non-zero (contain-intrinsic-size fallback)
  const cardBox = await page.locator('#grid .card').first().boundingBox();
  aok(!!cardBox && cardBox.height > 0, `first .card paints (content-visibility ok · ${cardBox ? Math.round(cardBox.height) : 'null'}px)`);
}

// Sticky elements stay pinned and introduce no horizontal layout shift on scroll.
async function assertStickyElements(page) {
  const header = page.locator('.header');
  const controls = page.locator('.controls');
  aok(await header.isVisible(), '.header is visible');
  aok((await header.evaluate((el) => getComputedStyle(el).position)) === 'sticky', '.header is position:sticky');
  aok(await controls.isVisible(), '.controls is visible');
  aok((await controls.evaluate((el) => getComputedStyle(el).position)) === 'sticky', '.controls is position:sticky');

  const widthBefore = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(80);
  const headerTop = await header.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  aok(headerTop <= 1, `.header stays pinned to the top after scroll (top=${headerTop}px)`);
  const widthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
  aok(Math.abs(widthAfter - widthBefore) <= 1, `no horizontal layout shift on scroll (${widthBefore}px → ${widthAfter}px)`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);
}

// Mobile action bar: visible + welded to the bottom edge on phones; absent on desktop.
async function assertMobileActionBar(page, isMobile) {
  const ab = page.locator('.actionbar');
  if (isMobile) {
    aok(await ab.isVisible(), '.actionbar is visible on mobile');
    const box = await ab.boundingBox();
    const vh = page.viewportSize().height;
    aok(!!box && Math.abs((box.y + box.height) - vh) <= 2,
      `.actionbar is fixed to the bottom edge (bottom=${box ? Math.round(box.y + box.height) : 'null'}px · viewport=${vh}px)`);
  } else {
    aok((await ab.evaluate((el) => getComputedStyle(el).display)) === 'none', '.actionbar is hidden on desktop (display:none)');
  }
}

// Z-index & modals: the device <dialog> (top layer) must rest above the sticky
// header, and the chat panel must not bleed through it.
async function assertDialogStacking(page) {
  await page.waitForSelector('.nt-chat-panel', { state: 'attached', timeout: 5000 }); // chat.js injects it (hidden)
  const card = page.locator('#grid .card').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForSelector('#detail[open]', { timeout: 5000 });

  aok(await page.locator('#detail').evaluate((d) => d.open === true), 'device <dialog> opened as a modal');

  // Topmost painted element at the viewport centre is inside the dialog.
  aok(await page.evaluate(() => {
    const d = document.getElementById('detail');
    const el = document.elementFromPoint(innerWidth >> 1, innerHeight >> 1);
    return !!el && d.contains(el);
  }), 'dialog sheet is the topmost element at the viewport centre');

  // Over the sticky header strip the modal backdrop wins — the header is not on top.
  aok(await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth >> 1, 20);
    const h = document.querySelector('.header');
    return !!el && !h.contains(el);
  }), 'dialog rests above .header (header is covered, not topmost)');

  // The chat panel must not bleed through: hidden → can't; visible → must sit under the modal.
  aok(await page.evaluate(() => {
    const p = document.querySelector('.nt-chat-panel');
    if (!p) return true;
    const cs = getComputedStyle(p);
    if (p.hidden || cs.display === 'none' || cs.visibility === 'hidden') return true;
    const r = p.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!el && !p.contains(el); // something other than the panel (the backdrop/dialog) is on top
  }), '.nt-chat-panel does not bleed through the modal');

  // Native modal semantics: focus is trapped inside the dialog.
  aok(await page.evaluate(() => document.getElementById('detail').contains(document.activeElement)),
    'focus is held inside the dialog (native modal trap)');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('detail').open, { timeout: 5000 });
}

// ===========================================================================
// Driver
// ===========================================================================
(async () => {
  const server = process.env.BASE ? null : await startServer();
  const failures = [];
  const skipped = [];

  for (const m of MATRIX) {
    console.log(`\n▶ ${m.label}`);
    let browser;
    try {
      // --no-sandbox is Chromium-only (required when running as root); Firefox/WebKit reject it.
      browser = await m.engine.launch(m.engine === chromium ? { args: ['--no-sandbox'] } : {});
    } catch (e) {
      // Most common cause: the engine binary isn't installed. Record + keep going.
      console.error(`    ⚠ cannot launch ${m.engineName}: ${e.message.split('\n')[0]}`);
      console.error(`      run:  playwright install ${m.engineName}`);
      skipped.push(m.label);
      continue;
    }
    try {
      const context = await browser.newContext({ ...m.ctx, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#grid .card', { timeout: 20000 }); // runtime render from pricing-data.json
      const isMobile = page.viewportSize().width < 560;

      await assertSafariRenderGuard(page);
      await assertStickyElements(page);
      await assertMobileActionBar(page, isMobile);
      await assertDialogStacking(page);
      aok(pageErrors.length === 0, `no uncaught page errors (${pageErrors.length})`);

      await page.screenshot({ path: `${SHOTS}/${m.engineName}-${isMobile ? 'mobile' : 'desktop'}.png` });
      console.log(`    ✔ PASS`);
    } catch (e) {
      console.error(`    ✗ FAIL — ${e.message}`);
      failures.push({ label: m.label, msg: e.message });
    } finally {
      await browser.close().catch(() => {});
    }
  }

  if (server) server.close();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Cross-platform gate: ${MATRIX.length - failures.length - skipped.length}/${MATRIX.length} profiles passed · ${assertCount} assertions run`);
  if (skipped.length) console.log(`Skipped (engine not installed): ${skipped.join(', ')}`);
  if (failures.length) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(`  ✗ ${f.label}\n      ${f.msg}`);
    process.exit(1);
  }
  if (skipped.length) { console.error('\nIncomplete: install the missing engines and re-run.'); process.exit(3); }
  console.log('All engines + viewports passed.');
})().catch((e) => { console.error('CROSS-PLATFORM ERROR:', e); process.exit(2); });
