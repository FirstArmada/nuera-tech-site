#!/usr/bin/env node
'use strict';
/* Nuera Tech — run/drive harness (the deliverable of the run-nuera-tech-site skill).
 *
 * The site is a build-less static SPA: index.html + assets/js/app.js fetch
 * pricing-data.json at RUNTIME and render everything client-side (Rule 1 — no
 * prices are baked into the HTML). So "running it" means serving the repo over
 * HTTP and driving it in a real browser. This script does both: it starts a
 * tiny static server, launches headless Chromium (Playwright), exercises the
 * real user flows (data load, hero stats, savings spotlight, brand/type
 * filters, search, device modal, tier + colour switching, WhatsApp deep-links),
 * writes screenshots, then prints a PASS/FAIL summary and exits non-zero on any
 * failure.
 *
 * Run (no extra env needed — it self-resolves the global Playwright install):
 *   node .claude/skills/run-nuera-tech-site/driver.cjs
 *
 * Env overrides:
 *   PORT   static-server port                         (default 8000)
 *   BASE   drive this URL instead of spawning a server (e.g. a deployed URL)
 *   SHOTS  screenshot output directory                (default /tmp/nuera-shots)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// ---- resolve Playwright -----------------------------------------------------
// The project ships NO node_modules by design (build-less). Playwright lives in
// the global root, so require() won't find it from inside the repo. Try the
// normal resolution first (honours NODE_PATH), then fall back to `npm root -g`.
function loadChromium() {
  try { return require('playwright').chromium; } catch (_) { /* fall through */ }
  try {
    const root = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(root, 'playwright')).chromium;
  } catch (e) {
    console.error('Cannot load Playwright. Install it once:\n  npm i -g playwright && playwright install chromium');
    throw e;
  }
}
const chromium = loadChromium();

const REPO = path.resolve(__dirname, '../../..');        // .claude/skills/run-*/ -> repo root
const PORT = Number(process.env.PORT || 8000);
const SHOTS = process.env.SHOTS || '/tmp/nuera-shots';
const BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const SETTLE = 450;   // the device dialog has a 0.26s "dlg-in" open animation; settle past it before screenshots
fs.mkdirSync(SHOTS, { recursive: true });

// ---- tiny static server -----------------------------------------------------
// Module scripts (app.js is type="module") REFUSE to execute unless served with
// a JavaScript MIME type — a naive server that returns text/plain yields a blank
// grid with no obvious error. Set the content types explicitly.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
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
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// ---- check harness ----------------------------------------------------------
const results = [];
const ok = (n, x = '') => { results.push({ n, pass: true, x }); console.log(`  PASS  ${n}${x ? ' — ' + x : ''}`); };
const bad = (n, x = '') => { results.push({ n, pass: false, x }); console.log(`  FAIL  ${n}${x ? ' — ' + x : ''}`); };
const check = (n, c, x = '') => (c ? ok(n, x) : bad(n, x));

(async () => {
  const server = process.env.BASE ? null : await startServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });   // --no-sandbox: required as root
  const consoleErrors = [];
  const pageErrors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const cardByModel = (re) => page.locator('#grid .card', { has: page.locator('.card-model', { hasText: re }) });

    console.log('\n[1] Navigate + runtime data load');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid .card', { timeout: 15000 });
    const cardCount = await page.locator('#grid .card').count();
    check('grid rendered device cards', cardCount > 100, `${cardCount} cards`);

    const stat = async (k) => (await page.locator(`[data-stat="${k}"]`).textContent() || '').trim();
    const devicesStat = await stat('devices');
    check('hero stat: device count', devicesStat === '153', `"${devicesStat}"`);
    check('hero stat: max saving filled', /^\$\d/.test(await stat('maxSaving')));
    check('hero stat: avg % filled', /%/.test(await stat('avgPct')));
    const resultCount = (await page.locator('#result-count').textContent() || '').trim();
    check('result count matches grid', resultCount.startsWith(String(cardCount)), `"${resultCount}"`);

    const ctaHead = (await page.locator('#cta-headline').textContent() || '').trim();
    check('CTA headline filled at runtime', ctaHead.toLowerCase().includes('mobile klinik'), `"${ctaHead.slice(0, 56)}…"`);
    const waGeneral = await page.locator('a[data-wa="general"]').first().getAttribute('href');
    check('WhatsApp number is 12269784666', !!waGeneral && waGeneral.includes('wa.me/12269784666'), waGeneral || '(none)');
    await page.screenshot({ path: `${SHOTS}/01-hero.png` });
    await page.screenshot({ path: `${SHOTS}/01b-fullpage.png`, fullPage: true });

    console.log('\n[1b] Load More pagination');
    const PAGE = 12; // mirrors PAGE_SIZE in app.js
    const visInit = await page.locator('#grid .card:visible').count();
    check('initial grid capped to one page', visInit === PAGE, `${visInit} visible of ${cardCount}`);
    check('Load More shown when catalogue exceeds a page', (await page.locator('#load-more').evaluate((el) => el.hidden)) === false);
    await page.locator('#load-more').click();
    await page.waitForTimeout(150);
    check('Load More reveals the next page', (await page.locator('#grid .card:visible').count()) === PAGE * 2);
    await page.locator('#search').fill('iphone');
    await page.waitForTimeout(300);
    check('new search resets pagination to one page', (await page.locator('#grid .card:visible').count()) === PAGE);
    await page.locator('#search-clear').click();
    await page.waitForTimeout(200);

    console.log('\n[2] Savings spotlight animates into view');
    check('spotlight revealed (not hidden)', (await page.locator('#spotlight').evaluate((el) => el.hidden)) === false);
    await page.locator('#spotlight').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const f = document.querySelector('#spot-bars .bar-nuera');
      return f && f.style.width && f.style.width !== '0%';
    }, { timeout: 5000 }).catch(() => {});
    const spotDevice = (await page.locator('#spot-device').textContent() || '').trim();
    const pillCount = await page.locator('#spot-pills .spot-pill').count();
    check('spotlight has device + pills', !!spotDevice && pillCount > 0, `"${spotDevice}", ${pillCount} pills`);
    await page.screenshot({ path: `${SHOTS}/02-spotlight.png` });
    if (pillCount >= 3) {
      await page.locator('#spot-pills .spot-pill').nth(2).click();
      await page.waitForTimeout(150);
      const spotDevice2 = (await page.locator('#spot-device').textContent() || '').trim();
      check('spotlight pill switches device', spotDevice2 !== spotDevice, `"${spotDevice}" -> "${spotDevice2}"`);
    }

    console.log('\n[3] Brand filter (iPhone)');
    // The grid renders all cards once and filters by toggling [hidden], so the
    // assertions below count VISIBLE cards (:visible); a raw '.card' count would
    // always return the full catalogue regardless of the active filter.
    const iphonePillCnt = (await page.locator('[data-brand="iphone"] .cnt').textContent() || '').trim();
    await page.locator('[data-brand="iphone"]').click();
    await page.waitForTimeout(150);
    const afterBrand = await page.locator('#grid .card:visible').count();
    const allIphone = await page.locator('#grid .card:visible .brand-tag').evaluateAll((els) => els.every((e) => e.textContent.trim() === 'iPhone'));
    // Pagination caps the VISIBLE set to one page; the pill + result-count still report the full total.
    check('iPhone filter visible capped to one page', afterBrand === Math.min(Number(iphonePillCnt), 12), `${afterBrand} visible, pill says ${iphonePillCnt}`);
    check('all visible filtered cards are iPhone', allIphone && afterBrand > 0);
    check('result count reflects full iPhone total', (((await page.locator('#result-count').textContent()) || '').trim()).startsWith(iphonePillCnt), iphonePillCnt);
    await page.locator('[data-brand="all"]').click();
    await page.waitForTimeout(100);

    console.log('\n[4] Type filter (Back Glass)');
    await page.locator('[data-type="backglass"]').click();
    await page.waitForTimeout(150);
    const afterType = await page.locator('#grid .card:visible').count();
    check('back-glass filter narrows grid', afterType > 0 && afterType < cardCount, `${afterType} of ${cardCount}`);
    await page.locator('[data-type="all"]').click();
    await page.waitForTimeout(100);

    console.log('\n[5] Search (debounced) -> iPhone 12 Mini');
    await page.locator('#search').fill('iPhone 12 Mini');
    await page.waitForTimeout(300);
    const searchCards = await page.locator('#grid .card:visible').count();
    const firstModel = (await page.locator('#grid .card:visible .card-model').first().textContent() || '').trim();
    check('search narrows to the model', searchCards >= 1 && firstModel === 'iPhone 12 Mini', `${searchCards} card(s), first="${firstModel}"`);

    console.log('\n[6] Open device modal + switch screen tier');
    await cardByModel(/^iPhone 12 Mini$/).first().click();
    await page.waitForSelector('#detail[open]', { timeout: 5000 });
    await page.waitForTimeout(SETTLE);                          // let the open animation finish before the shot
    check('modal opens with device title', (await page.locator('#detail-title').textContent() || '').trim() === 'iPhone 12 Mini');
    await page.screenshot({ path: `${SHOTS}/03-modal.png` });
    if ((await page.locator('#detail-body .opts').count()) > 0) {
      const priceEl = page.locator('#detail-body [data-price]').first();
      const bookEl = page.locator('#detail-body [data-book]').first();
      const priceBefore = (await priceEl.textContent() || '').trim();
      const bookBefore = await bookEl.getAttribute('href');
      await page.locator('#detail-body .opts').first().locator('.opt[aria-checked="false"]').first().click();
      await page.waitForTimeout(150);
      const priceAfter = (await priceEl.textContent() || '').trim();
      const bookAfter = await bookEl.getAttribute('href');
      check('switching tier updates price', priceBefore !== priceAfter, `${priceBefore} -> ${priceAfter}`);
      check('switching tier updates Book link', bookBefore !== bookAfter);
      check('Book link is a WhatsApp deep-link', !!bookAfter && bookAfter.startsWith('https://wa.me/12269784666?text='));
      await page.screenshot({ path: `${SHOTS}/03b-modal-switched.png` });
    } else {
      bad('modal had a multi-option group', 'no .opts found');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Escape closes the modal', (await page.locator('#detail[open]').count()) === 0);

    console.log('\n[7] Back-glass colour swatches (iPhone 14)');
    await page.locator('#search').fill('iPhone 14');
    await page.waitForTimeout(300);
    await cardByModel(/^iPhone 14$/).first().click();
    await page.waitForSelector('#detail[open]', { timeout: 5000 });
    await page.waitForTimeout(SETTLE);
    const swatchCount = await page.locator('#detail-body .swatch').count();
    check('back-glass renders colour swatches', swatchCount >= 2, `${swatchCount} swatches`);
    await page.screenshot({ path: `${SHOTS}/04-swatches.png` });
    if (swatchCount >= 2) {
      const colourSub = () => page.locator('#detail-body .rgroup-sub').filter({ hasText: 'Colour:' }).first();
      const before = (await colourSub().textContent() || '').trim();
      await page.locator('#detail-body .swatch[aria-checked="false"]').first().click();
      await page.waitForTimeout(150);
      const after = (await colourSub().textContent() || '').trim();
      check('selecting a swatch changes the colour label', before !== after, `"${before}" -> "${after}"`);
    }
    await page.keyboard.press('Escape');
    await ctx.close();

    console.log('\n[8] Mobile viewport — bottom-sheet modal');
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    await mp.goto(BASE, { waitUntil: 'domcontentloaded' });
    await mp.waitForSelector('#grid .card', { timeout: 15000 });
    await mp.screenshot({ path: `${SHOTS}/05-mobile-home.png` });
    await mp.locator('#grid .card').first().click();
    await mp.waitForSelector('#detail[open]', { timeout: 5000 });
    await mp.waitForTimeout(SETTLE);
    check('mobile modal opens', !!(await mp.locator('#detail-title').textContent()));
    await mp.screenshot({ path: `${SHOTS}/06-mobile-modal.png` });
    await mctx.close();

    console.log('\n[console/page errors]');
    console.log('  console.error:', consoleErrors.length ? consoleErrors : '(none)');
    console.log('  pageerror   :', pageErrors.length ? pageErrors : '(none)');
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    // The only expected console noise locally is Vercel's injected analytics 404s
    // and a cert error for the absolute-URL OG image; flag anything data-related.
    const dataErr = consoleErrors.filter((e) => /pricing|fetch|HTTP \d|app\.js/i.test(e));
    check('no data-load console errors', dataErr.length === 0, dataErr.join(' | '));
  } finally {
    await browser.close().catch(() => {});
    if (server) server.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n==== ${passed}/${results.length} checks passed ====`);
  console.log('Screenshots in', SHOTS);
  if (failed.length) { console.log('FAILED:', failed.map((f) => f.n + (f.x ? ` (${f.x})` : '')).join('; ')); process.exit(1); }
})().catch((e) => { console.error('DRIVER ERROR:', e); process.exit(2); });
