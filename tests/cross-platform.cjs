const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Resolve Global Playwright Engine
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    try {
      const root = execSync('npm root -g').toString().trim();
      return require(path.join(root, 'playwright'));
    } catch (err) {
      console.error('\n✖ Playwright not found globally.');
      console.error('Run: npm install -g playwright');
      process.exit(3);
    }
  }
}

// 2. Local Static Server
function startServer(dir) {
  const mimes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.png': 'image/png'
  };

  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    try {
      const urlPath = req.url === '/' ? 'index.html' : req.url.split('?')[0];
      // Resolve request path against `root` and enforce containment to prevent traversal.
      const decodedPath = decodeURIComponent(urlPath);
      const relativePath = decodedPath.replace(/^[/\\]+/, '');
      const safePath = path.resolve(root, relativePath);
      if (safePath !== root && !safePath.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const data = fs.readFileSync(safePath);
      const ext = path.extname(safePath);
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(process.env.PORT || 0, () => {
      resolve({ server, port: server.address().port });
    });
  });
}

// 3. Assertion Helper
function aok(cond, msg) {
  if (!cond) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`    ✓ ${msg}`);
}

// 4. Test Matrix and Runner
async function runSuite() {
  const pw = loadPlaywright();
  const { chromium, firefox, webkit, devices } = pw;

  const baseDir = process.env.BASE || path.join(__dirname, '..');
  const shotsDir = process.env.SHOTS || path.join(__dirname, 'shots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  const { server, port } = await startServer(baseDir);
  const targetUrl = `http://localhost:${port}/`;

  const matrix = [
    { engine: chromium, name: 'Chromium - Desktop', profile: { viewport: { width: 1920, height: 1080 } } },
    { engine: chromium, name: 'Chromium - Pixel 5', profile: devices['Pixel 5'] },
    { engine: firefox, name: 'Firefox - Desktop', profile: { viewport: { width: 1920, height: 1080 } } },
    { engine: webkit, name: 'WebKit - Desktop', profile: { viewport: { width: 1920, height: 1080 } } },
    { engine: webkit, name: 'WebKit - iPhone 13', profile: devices['iPhone 13'] }
  ];

  let hasFailure = false;
  let missingEngines = false;

  console.log(`\nStarting Cross-Platform Layout Gate at ${targetUrl}`);

  for (const run of matrix) {
    console.log(`\n▶ [${run.name}]`);
    let browser;

    try {
      const launchArgs = run.name.includes('Chromium') ? ['--no-sandbox'] : [];

      browser = await run.engine.launch({ args: launchArgs }).catch(e => {
        if (e.message.includes('Executable doesn\'t exist')) throw new Error('MISSING_ENGINE');
        throw e;
      });

      const context = await browser.newContext({ ...run.profile, reducedMotion: 'reduce' });
      const page = await context.newPage();

      let pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');
      aok(pageErrors.length === 0, 'No console/page errors detected');

      // --- SAFARI RENDERING GUARD ---
      const innerBox = await page.locator('.controls-inner').boundingBox();
      aok(innerBox && innerBox.height > 0, '.controls-inner painted non-zero height (backdrop-filter bug guard)');

      const gridBox = await page.locator('.grid').boundingBox();
      aok(gridBox && gridBox.height > 0, '.grid painted non-zero height');

      const cardBox = await page.locator('.card').first().boundingBox();
      aok(cardBox && cardBox.height > 0, '.card retains height (content-visibility collapse guard)');

      // --- STICKY ELEMENTS ---
      const header = page.locator('.header');
      aok(await header.evaluate(el => window.getComputedStyle(el).position) === 'sticky', '.header is position:sticky');
      aok(await page.locator('.controls').evaluate(el => window.getComputedStyle(el).position) === 'sticky', '.controls is position:sticky');

      // Scroll to trigger sticky states and check layout shift
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(100);

      const headerRect = await header.boundingBox();
      aok(headerRect.y <= 1, '.header remains pinned to the top edge after scroll');

      const noHorizontalShift = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      aok(noHorizontalShift, 'No horizontal overflow / layout shift detected');

      // --- MOBILE ACTION BAR ---
      const isMobile = page.viewportSize().width < 560;
      const actionbar = page.locator('.actionbar');

      if (isMobile) {
        await actionbar.waitFor({ state: 'visible' });
        const abBox = await actionbar.boundingBox();
        const vpHeight = page.viewportSize().height;
        aok(Math.abs((abBox.y + abBox.height) - vpHeight) < 2, 'Mobile .actionbar is visible and strictly bottom-welded');
      } else {
        aok(await actionbar.isHidden(), '.actionbar is hidden on desktop viewports');
      }

      // --- Z-INDEX & MODALS ---
      await page.locator('.card').first().click();
      const dialog = page.locator('dialog');
      await dialog.waitFor({ state: 'visible' });
      aok(await dialog.evaluate(el => el.hasAttribute('open')), 'Device <dialog> modal opened successfully');

      // Assert Top-Layer Coverage via elementFromPoint
      const centerTarget = await header.boundingBox();
      const topElAtHeader = await page.evaluate(({x, y}) => {
          const el = document.elementFromPoint(x, y);
          return el && el.closest('dialog') !== null;
      }, { x: centerTarget.x + 50, y: centerTarget.y + 10 });
      aok(topElAtHeader, 'Top-layer <dialog> securely covers the sticky .header (z-index guard)');

      const chatPanel = page.locator('.nt-chat-panel');
      if (await chatPanel.isVisible()) {
          const chatRect = await chatPanel.boundingBox();
          const topElAtChat = await page.evaluate(({x, y}) => {
              const el = document.elementFromPoint(x, y);
              return el && el.closest('dialog') !== null;
          }, { x: chatRect.x + 20, y: chatRect.y + 20 });
          aok(topElAtChat, '.nt-chat-panel does not bleed through the active <dialog>');
      } else {
          aok(true, '.nt-chat-panel is hidden, no bleed-through possible');
      }

      // Close modal
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      aok(true, '<dialog> closed cleanly via Escape');

      // Screenshot save
      const shotName = `${run.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      await page.screenshot({ path: path.join(shotsDir, shotName) });

      console.log(`    ★ Profile Passed`);

    } catch (e) {
      if (e.message === 'MISSING_ENGINE') {
        const engineBinary = run.name.split(' - ')[0].toLowerCase();
        console.warn(`    ⚠ Missing binary for ${engineBinary}. (Run: playwright install ${engineBinary})`);
        missingEngines = true;
      } else {
        console.error(`    ✖ ${e.message}`);
        hasFailure = true;
      }
    } finally {
      if (browser) await browser.close();
    }
  }

  server.close();

  console.log('\n--- Test Run Complete ---');
  if (missingEngines) process.exit(3);
  if (hasFailure) process.exit(1);
  process.exit(0);
}

runSuite();
