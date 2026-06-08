#!/usr/bin/env node
'use strict';
/* Mobile layout-integrity gate — serves the build-less site, drives it in a
 * mobile-emulated headless Chromium (iPhone SE · 375×667, touch, coarse pointer)
 * and asserts the things the desktop a11y/flow gates can't see:
 *
 *   1. The sticky/fixed stack co-exists: .header(60) · .controls(40) · .fab(70)
 *      · .actionbar(75) · .nt-chat-panel(80) never trap focus, never occlude the
 *      card grid or footer, and the device-detail <dialog> (top layer) always
 *      paints ABOVE every one of them — z-index can't collide with the top layer.
 *   2. Safe-area / viewport: the FAB stack is lifted clear of the .actionbar and
 *      the body reserves the bar's height so the footer is never occluded.
 *   3. The grid + sticky search bar produce no horizontal overflow and no layout
 *      shift while typing — at 375px AND a cramped 320px.
 *
 * The repo ships no node_modules by design, so this self-resolves the global
 * Playwright install (same trick as the run-* driver + a11y gate). Exits
 * non-zero on any failed assertion so CI enforces the mobile baseline.
 *
 *   NODE_PATH="$(npm root -g)" node tests/mobile.cjs
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

// ---- resolve Playwright (global install; repo has no node_modules) ----------
function loadChromium() {
  try { return require('playwright').chromium; } catch (_) { /* fall through */ }
  const root = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(root, 'playwright')).chromium;
}
const chromium = loadChromium();

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8124);
const BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || '/tmp/nuera-mobile-shots';
fs.mkdirSync(SHOTS, { recursive: true });

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

// ---- check harness (mirrors the run-* driver) -------------------------------
const results = [];
const ok = (n, x = '') => { results.push({ pass: true }); console.log(`  PASS  ${n}${x ? ' — ' + x : ''}`); };
const bad = (n, x = '') => { results.push({ pass: false, n }); console.log(`  FAIL  ${n}${x ? ' — ' + x : ''}`); };
const check = (n, c, x = '') => (c ? ok(n, x) : bad(n, x));

// iPhone SE viewport (375×667) with touch + mobile emulation so @media(hover:none)/
// (pointer:coarse) and the ≤559.98px actionbar breakpoint all engage.
const IPHONE_SE = { width: 375, height: 667 };

(async () => {
  const server = process.env.BASE ? null : await startServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const pageErrors = [];
  try {
    const ctx = await browser.newContext({
      viewport: IPHONE_SE, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      reducedMotion: 'reduce', // settle reveal fades + dialog open animation instantly
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    console.log('\n[1] Boot on a mobile viewport (iPhone SE · 375×667)');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid .card', { timeout: 15000 });
    await page.waitForSelector('.nt-chat-launch', { timeout: 5000 }); // chat.js injects it into .fab
    check('mobile media (hover:none) active', await page.evaluate(() => matchMedia('(hover: none)').matches));
    await page.screenshot({ path: `${SHOTS}/mobile-01-home.png` });

    // -- helper: is the page free of horizontal overflow? -----------------------
    const overflowX = () => page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);

    console.log('\n[2] No horizontal overflow / grid collapses to one column');
    check('no horizontal overflow at 375px', (await overflowX()) <= 1, `${await overflowX()}px`);
    const gridCols = await page.locator('#grid').evaluate((g) =>
      getComputedStyle(g).gridTemplateColumns.split(' ').length);
    check('grid is single-column ≤520px', gridCols === 1, `${gridCols} column(s)`);
    const cardWide = await page.locator('#grid .card:visible').first().evaluate((c) =>
      c.getBoundingClientRect().width <= window.innerWidth + 1);
    check('first card does not exceed viewport width', cardWide);

    console.log('\n[3] .actionbar visible on mobile + takes over the WhatsApp CTA');
    const ab = page.locator('.actionbar');
    check('.actionbar is visible', await ab.isVisible());
    const abBox = await ab.boundingBox();
    check('.actionbar is pinned to the bottom edge',
      !!abBox && Math.abs((abBox.y + abBox.height) - IPHONE_SE.height) <= 1,
      abBox ? `bottom=${Math.round(abBox.y + abBox.height)}` : '(no box)');
    check('.actionbar book button is the WhatsApp CTA',
      (await page.locator('.actionbar-book').getAttribute('href') || '').includes('wa.me/12269784666'));

    console.log('\n[4] Footer is NOT occluded by the fixed action bar');
    const bodyPadBottom = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    check('body reserves ≥ actionbar height as padding-bottom', bodyPadBottom >= (abBox ? abBox.height - 1 : 72),
      `padding-bottom=${bodyPadBottom}px · bar=${abBox ? Math.round(abBox.height) : '?'}px`);
    // The last footer link, scrolled to, must be the topmost element at its own centre
    // (i.e. the action bar is not painted over it).
    const footLink = page.locator('footer a').last();
    await footLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(60);
    const footClickable = await footLink.evaluate((a) => {
      const r = a.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === a || a.contains(top) || top.contains(a));
    });
    check('footer link is reachable (not covered by .actionbar)', footClickable);
    await page.evaluate(() => window.scrollTo(0, 0));

    console.log('\n[5] Sticky .controls search bar: functional, no layout shift');
    check('.controls is position:sticky',
      await page.locator('.controls').evaluate((el) => getComputedStyle(el).position === 'sticky'));
    const widthBefore = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.locator('#search').fill('iphone');
    await page.waitForTimeout(300);
    const widthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
    check('no horizontal layout shift while typing in search', Math.abs(widthAfter - widthBefore) <= 1,
      `${widthBefore}px → ${widthAfter}px`);
    check('search still filters the grid',
      (await page.locator('#result-count').textContent() || '').trim().length > 0
      && (await page.locator('#grid .card:visible').count()) > 0);
    check('no horizontal overflow after search', (await overflowX()) <= 1);
    await page.locator('#search-clear').click();
    await page.waitForTimeout(150);

    console.log('\n[6] FAB stack is lifted clear of the .actionbar (no overlap)');
    const fabBox = await page.locator('.fab').boundingBox();
    check('.fab bottom sits above the .actionbar top',
      !!fabBox && !!abBox && (fabBox.y + fabBox.height) <= abBox.y + 2,
      fabBox && abBox ? `fab.bottom=${Math.round(fabBox.y + fabBox.height)} · bar.top=${Math.round(abBox.y)}` : '');

    console.log('\n[7] Stacking order: header(60) < fab(70) < actionbar(75) < chat(80)');
    const z = await page.evaluate(() => {
      const zi = (sel) => parseInt(getComputedStyle(document.querySelector(sel)).zIndex, 10);
      return { header: zi('.header'), controls: zi('.controls'), fab: zi('.fab'),
        actionbar: zi('.actionbar'), chat: zi('.nt-chat-panel') };
    });
    check('z-index ladder is intact (40<60<70<75<80)',
      z.controls === 40 && z.header === 60 && z.fab === 70 && z.actionbar === 75 && z.chat === 80,
      JSON.stringify(z));

    console.log('\n[8] Device <dialog> opens in the top layer — above EVERY fixed layer');
    // Open the chat panel first so we prove the modal beats the highest z-index (chat:80).
    await page.locator('.nt-chat-launch').click();
    await page.waitForTimeout(80);
    check('chat panel opens above the page', await page.locator('.nt-chat-panel').isVisible());
    // Close it (Esc) so it doesn't intercept the card tap, then open the device sheet.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);

    const firstCard = page.locator('#grid .card:visible').first();
    const cardModel = await firstCard.getAttribute('data-model');
    await firstCard.click();
    await page.waitForSelector('#detail[open]', { timeout: 5000 });
    check('device dialog is a real modal (dialog.open)',
      await page.locator('#detail').evaluate((d) => d.open));

    // The decisive z-index assertion: at the viewport centre, the topmost painted
    // element is INSIDE #detail. If the header/actionbar/chat panel were colliding,
    // elementFromPoint would return one of them instead.
    const centreHit = await page.evaluate(() => {
      const dlg = document.getElementById('detail');
      const el = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2));
      return { inDialog: !!el && dlg.contains(el), tag: el ? el.tagName : null };
    });
    check('dialog sheet is topmost at viewport centre (no z-collision)', centreHit.inDialog,
      `hit <${(centreHit.tag || '').toLowerCase()}>`);

    // Over the header's strip the backdrop (top layer) must win — not .header.
    const headerCovered = await page.evaluate(() => {
      const el = document.elementFromPoint(Math.floor(innerWidth / 2), 24);
      const header = document.querySelector('.header');
      return !!el && !header.contains(el); // backdrop/dialog, never a header descendant
    });
    check('.header is covered by the modal backdrop (not on top)', headerCovered);

    // Over the action bar's strip the backdrop must likewise win — not .actionbar.
    const barCovered = await page.evaluate(() => {
      const el = document.elementFromPoint(Math.floor(innerWidth / 2), innerHeight - 24);
      const bar = document.querySelector('.actionbar');
      return !!el && !bar.contains(el);
    });
    check('.actionbar is covered by the modal backdrop (not on top)', barCovered);
    await page.screenshot({ path: `${SHOTS}/mobile-02-dialog.png` });

    console.log('\n[9] Modal focus trap + restore (native <dialog> semantics)');
    check('focus moved into the dialog on open',
      await page.evaluate(() => document.getElementById('detail').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('detail').open, { timeout: 5000 });
    await page.waitForTimeout(40); // let the close listener restore focus
    check('focus restored to the originating card on close',
      await page.evaluate((m) => document.activeElement &&
        document.activeElement.classList.contains('card') &&
        document.activeElement.dataset.model === m, cardModel));

    console.log('\n[10] Cramped device (320px): still no horizontal overflow');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(120);
    check('no horizontal overflow at 320px', (await overflowX()) <= 1, `${await overflowX()}px`);
    check('.actionbar still visible at 320px', await page.locator('.actionbar').isVisible());
    await page.screenshot({ path: `${SHOTS}/mobile-03-320.png` });

    check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  } finally {
    await browser.close().catch(() => {});
    if (server) server.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\nMobile layout gate: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.error('FAILED:\n  ' + failed.map((r) => r.n).join('\n  ')); process.exit(1); }
})().catch((e) => { console.error('MOBILE TEST ERROR:', e); process.exit(2); });
