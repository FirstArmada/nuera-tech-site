#!/usr/bin/env node
'use strict';
/* Accessibility gate — serves the build-less site, renders it in headless Chromium,
 * and runs axe-core (WCAG 2.1 A/AA). Exits non-zero on any violation, so CI enforces
 * the 0-violation baseline that STYLEGUIDE.md documents as a hard requirement.
 *
 * The repo ships no node_modules by design, so this self-resolves the global
 * Playwright + axe-core installs (same trick as the run-* driver).
 *
 *   NODE_PATH="$(npm root -g)" node tests/a11y.cjs
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

function g(mod) {
  try { return require(mod); } catch (_) { /* fall through */ }
  const root = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(root, mod));
}
const { chromium } = g('playwright');
const axe = g('axe-core');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8123);
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

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    // reducedMotion so the site's CSS snaps .reveal sections to their settled opacity:1 state —
    // the audit must judge the resting page, never a transient reveal-fade frame.
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid .card', { timeout: 15000 }); // wait for the runtime render
    // Force every deferred/animated region into its fully-rendered, settled state before auditing.
    // Without this the audit is BOTH non-deterministic AND incomplete: content-visibility:auto skips
    // off-screen sections (#why/#how/.cta/#faq/footer) so axe never evaluates them, and the .reveal
    // opacity fade can be sampled mid-transition (a bright accent flattens toward the dark bg → a
    // false "color-contrast" failure). Rendering everything settled scans the whole page reliably —
    // this is the accessible end-state every user reaches, and it leaves the colours under test
    // unchanged (content-visibility/opacity affect rendering + timing, not contrast).
    await page.addStyleTag({ content:
      '*,*::before,*::after{content-visibility:visible !important}'
      + '.reveal{opacity:1 !important;transform:none !important}' });
    await page.waitForTimeout(120); // let layout settle after un-deferring content-visibility
    await page.addScriptTag({ content: axe.source });
    const results = await page.evaluate(async () =>
      await window.axe.run(document, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        // label-content-name-mismatch maps to WCAG 2.1 A (2.5.3 Label in Name) but axe ships it
        // tagged 'experimental', so the tag filter alone leaves it disabled. Opt in explicitly so
        // this gate covers the full WCAG 2.1 A/AA surface STYLEGUIDE.md promises.
        rules: { 'label-content-name-mismatch': { enabled: true } },
      }));
    const v = results.violations || [];
    if (v.length) {
      console.error(`axe-core: ${v.length} WCAG 2.1 A/AA violation(s)`);
      for (const x of v) {
        console.error(`  [${x.impact}] ${x.id} — ${x.help}`);
        for (const n of x.nodes) console.error(`      ${n.target.join(' ')}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`axe-core: 0 violations (WCAG 2.1 A/AA) · ${results.passes.length} checks passed`);
    }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
})().catch((e) => { console.error('A11Y ERROR:', e); process.exit(2); });
