/* Nuera Tech — runtime app
 * Pricing is fetched at runtime from /pricing-data.json and never baked into HTML (Rule 1).
 * WhatsApp number is fixed at +1 226 978 4666 (Rule 2).
 */
const WA = '12269784666';
const DATA_URL = '/pricing-data.json';
const REVIEWS_URL = '/reviews.json';
// Schema.org Service names per repair type — used for the per-type Service structured data.
const SERVICE_NAME = { screen: 'Screen replacement', battery: 'Battery replacement', backglass: 'Back glass replacement', chargeport: 'Charge port repair' };

const BRANDS = [
  { id: 'all', label: 'All' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'ipad', label: 'iPad' },
  { id: 'samsung-tab', label: 'Samsung Tab' },
];
// Manufacturer shown on the card badge — collapses device families (iphone/ipad → Apple, etc.).
const MANUFACTURER = { iphone: 'Apple', ipad: 'Apple', samsung: 'Samsung', 'samsung-tab': 'Samsung', pixel: 'Google' };
const manufacturer = (b) => MANUFACTURER[b] || brandLabel(b);
// Strip a leading manufacturer word so the card title doesn't echo the badge
// ("Samsung Galaxy S20" → "Galaxy S20", "Google Pixel 10" → "Pixel 10"; Apple names are untouched).
// Optimization: Cache RegExp objects per manufacturer to avoid recompiling on every card render.
const _stripManufacturerRegexCache = new Map();
const stripManufacturer = (model, b) => {
  const m = MANUFACTURER[b];
  if (!m) return model;
  let reg = _stripManufacturerRegexCache.get(m);
  if (!reg) {
    reg = new RegExp(`^${m}\\s+`, 'i');
    _stripManufacturerRegexCache.set(m, reg);
  }
  return model.replace(reg, '');
};
const TYPES = [
  { id: 'all', label: 'All repairs' },
  { id: 'screen', label: 'Screen' },
  { id: 'battery', label: 'Battery' },
  { id: 'backglass', label: 'Back Glass' },
  { id: 'chargeport', label: 'Charge Port' },
];
const CHIP_LABEL = { screen: 'Screen', battery: 'Battery', backglass: 'Back Glass', chargeport: 'Charge Port' };
// Sort weight per repair type, derived from TYPES so the order lives in one place.
const TYPE_ORDER = Object.fromEntries(TYPES.filter((t) => t.id !== 'all').map((t, i) => [t.id, i]));

// "Add to booking" / "added" glyphs for the per-repair multi-select toggle.
const ADD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// One glyph per repair type, shown beside each option group in the detail sheet.
const RTYPE_ICON = {
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.4"/><path d="M11 18h2"/></svg>',
  battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="8" width="16" height="9" rx="2"/><path d="M22 11v3"/><path d="M6 12.5h3"/></svg>',
  backglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.4"/><circle cx="9.5" cy="7" r="1.5"/><circle cx="9.5" cy="11" r="1.5"/></svg>',
  chargeport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v5M15 2v5"/><path d="M7 7h10v3.5a5 5 0 0 1-10 0z"/><path d="M12 15.5V22"/></svg>',
};

// Representative hex for the colour names that appear in back-glass variant strings.
// Used only to paint swatches — the exact variant text is preserved for booking.
const SWATCH_COLORS = {
  'midnight black': '#181a22', 'black titanium': '#34332f', 'titanium black': '#34332f',
  'titanium white': '#e7e4db', 'white titanium': '#e7e4db', 'titanium blue': '#566270',
  'blue titanium': '#566270', 'titanium natural': '#b9a894', 'natural titanium': '#b9a894',
  'desert titanium': '#c8b79e', 'titanium desert': '#c8b79e', 'deep purple': '#4a3f63',
  'starlight': '#efe9dc', 'graphite': '#3a3a3c', 'ultramarine': '#3b4ea0',
  'black': '#1d1d20', 'white': '#f1f1f4', 'blue': '#4a6fa5', 'purple': '#9583c9',
  'red': '#c0392b', 'yellow': '#f3d34a', 'pink': '#e9b9c5', 'green': '#5c7d6a',
  'gold': '#e8d2a8', 'silver': '#d8dade', 'teal': '#3a8a8a',
};

// Precompute the sorted keys once (longest key first so "titanium black" wins over "black")
const SWATCH_KEYS = Object.keys(SWATCH_COLORS).sort((a, b) => b.length - a.length);

// ---- tiny DOM helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => '$' + Number(n).toFixed(Number.isInteger(n) ? 0 : 2);
const moneyExact = (n) => '$' + Number(n).toFixed(2);
// Percent cheaper than the compared (typical) price. Callers guard base > 0.
const pctLess = (saved, base) => Math.round((saved / base) * 100);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanVariant = (v) => (!v || v === '-' || v === '—' || v.trim() === '') ? '' : v.trim();
const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => matchMedia('(hover: hover)').matches;
// Run a DOM mutation inside a View Transition where supported; otherwise (or under reduced motion)
// apply it directly so the existing CSS animations remain the fallback. Used for the device modal.
const withViewTransition = (mutate) => {
  if (typeof document.startViewTransition !== 'function' || reduceMotion()) { mutate(); return; }
  document.startViewTransition(mutate);
};

// Shared easing: mirror the CSS --ease-entrance token so WAAPI animations ride the exact same
// curve as the CSS transitions (one source of truth, no build step). Falls back to the literal
// curve if the var is absent (older engines).
const EASE_ENTRANCE =
  getComputedStyle(document.documentElement).getPropertyValue('--ease-entrance').trim()
  || 'cubic-bezier(.22,1,.36,1)';

// ---- Motion (vanilla — no third-party JS) ----
// All motion is gated on reduceMotion(): reduced-motion users get instant, layout-correct
// updates. Animations use requestAnimationFrame / the Web Animations API (compositor-friendly
// opacity + transform), so there's no render-blocking library and the a11y + driver gates stay green.

// Animate a money figure from 0 → `to` with a rAF easeOutCubic tween. Reduced-motion → set the
// final value immediately. The element must NOT live in an aria-live region (it would flood
// screen readers); it always commits the true final value on the last frame.
function countUp(el, to) {
  if (!el) return;
  const final = '$' + Math.round(to);
  if (reduceMotion()) { el.textContent = final; return; }
  const dur = 900;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = '$' + Math.round(to * eased);
    if (t < 1) requestAnimationFrame(tick); else el.textContent = final;
  };
  requestAnimationFrame(tick);
}

// Brief, non-jarring confirmation that the result set refreshed: an opacity + lift flash on the
// (already aria-live) count. Compositor-only (opacity/transform), skipped under reduced motion,
// and only fired on filter/search changes — never the first build (see renderGrid).
function pulseResultCount(el) {
  if (!el || reduceMotion() || typeof el.animate !== 'function') return;
  el.animate(
    [{ opacity: 0.45, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, easing: EASE_ENTRANCE, fill: 'backwards' },
  );
}

// Pull a paint colour out of a back-glass variant string, e.g.
// "Back Glass (No Logo) — Titanium Natural" → { name:"Titanium Natural", hex:"#b9a894" }.
// Returns null when no known colour is found (caller falls back to text chips).
// Optimization: Pre-compile regexes and memoize results. Since there are many duplicate variant
// strings across devices, caching avoids redundant parsing and substring searching during render.
const _parseColorRegexSplit = /—|–/;
const _parseColorRegexParen = /\(.*?\)/g;
const _parseColorRegexNoise = /no logo|large camera hole|back glass|service pack/gi;
const _parseColorRegexWs = /\s+/g;
const _parseColorCache = new Map();

function parseColor(variant) {
  const v = cleanVariant(variant);
  if (!v) return null;
  const cached = _parseColorCache.get(v);
  if (cached !== undefined) return cached;

  const parts = v.split(_parseColorRegexSplit); // text after the last em/en dash carries the colour
  const seg = parts[parts.length - 1].replace(_parseColorRegexParen, ' ').replace(_parseColorRegexNoise, ' ').replace(_parseColorRegexWs, ' ').trim();
  if (!seg) {
    _parseColorCache.set(v, null);
    return null;
  }
  const low = seg.toLowerCase();
  for (const k of SWATCH_KEYS) {
    if (low.includes(k)) {
      const res = { name: seg, hex: SWATCH_COLORS[k] };
      _parseColorCache.set(v, res);
      return res;
    }
  }
  _parseColorCache.set(v, null);
  return null;
}

// Short label for a quality/grade tier chip (screen & battery options).
// The full variant text is still shown as the group subtitle and in the booking message.
// Optimization: Pre-compile regexes and memoize results to bypass repeated execution
// for the same variant string.
const _tierLabelRegexDash = /^.*?[—–]\s*(.+)$/;
const _tierLabelRegexNoun = /^(screen assembly|screen|battery|charge port)\b\s*/i;
const _tierLabelRegexParenFull = /^\(.*\)$/;
const _tierLabelCache = new Map();

function tierLabel(r) {
  const original = cleanVariant(r.variant);
  if (!original) return 'Standard';
  const cached = _tierLabelCache.get(original);
  if (cached !== undefined) return cached;

  const dash = original.match(_tierLabelRegexDash); // descriptor after the first em/en dash
  let v;
  if (dash) {
    v = dash[1].trim();
    if (v.includes(' / ') && !v.includes('(')) v = v.split(' / ')[0].trim(); // drop "/ SOH 99–100%" specs
  } else {
    // No dash: strip only a bare leading repair noun, keep the distinguishing remainder.
    let s = original.replace(_tierLabelRegexNoun, '').trim();
    if (!s) { _tierLabelCache.set(original, 'Standard'); return 'Standard'; } // variant was just "Battery", "Screen", …
    if (_tierLabelRegexParenFull.test(s)) s = s.slice(1, -1).trim();           // "(AMP)" → "AMP"
    else if (s.includes(' (')) s = s.slice(0, s.indexOf(' (')).trim(); // "Inner Display (Main)" → "Inner Display"
    v = s;
  }
  if (!v) { _tierLabelCache.set(original, 'Standard'); return 'Standard'; }
  const res = v.length > 30 ? v.slice(0, 29).trim() + '…' : v;
  _tierLabelCache.set(original, res);
  return res;
}

// Group a device's repairs by repair type, cheapest first, deciding per group
// whether to render colour swatches (back glass) or text tier chips.
function groupRepairs(repairs) {
  const byType = new Map();
  for (const r of repairs) {
    if (!byType.has(r.chip)) byType.set(r.chip, []);
    byType.get(r.chip).push(r);
  }
  const groups = [];
  for (const [chip, list] of byType) {
    // Collapse exact-duplicate descriptions (same repair + variant) to their lowest price,
    // so the picker never shows two identical-looking options at different prices.
    const best = new Map();
    for (const r of list) {
      const key = r.repair_type.toLowerCase() + '|' + cleanVariant(r.variant).toLowerCase();
      const cur = best.get(key);
      if (!cur || r.price < cur.price) best.set(key, r);
    }
    const opts = [...best.values()].sort((a, b) => a.price - b.price);
    const colors = opts.map((r) => parseColor(r.variant));
    const swatch = chip === 'backglass' && opts.length > 1 && colors.every(Boolean);
    groups.push({ chip, rtype: opts[0].repair_type, options: opts, colors, swatch, selected: 0 });
  }
  return groups.sort((a, b) => (TYPE_ORDER[a.chip] ?? 99) - (TYPE_ORDER[b.chip] ?? 99));
}

// ---- state ----
const state = { devices: [], byModel: new Map(), brand: 'all', type: 'all', q: '', groups: [], selected: new Set(), openModel: null, page: 1, sort: 'default' };
const PAGE_SIZE = 12; // device cards revealed per page; "Load More" adds one page at a time

// ===========================================================================
// Boot
// ===========================================================================
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  initReveal();
  initScrollTop();
  initScrollProgress();
  initHeader();
  initFaq();
  initHours();
  initWhatsAppDefaults();
  initDialog();
  initShareQuote();
  initSearchShortcut();
  loadData();
  loadReviews();
});

async function loadData() {
  const grid = $('#grid');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(DATA_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const repairs = Array.isArray(data?.repairs) ? data.repairs : [];
    if (!repairs.length) throw new Error('No repairs in data');

    buildModel(repairs);
    const stats = usePrecomputedStats(data) || computeSavingsStats(repairs);
    renderStats(stats);
    buildFilters();
    buildSpotlight(stats);
    renderGrid();
    injectStructuredData(data);
  } catch (err) {
    console.error('[nuera] failed to load pricing:', err);
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `<div class="errorbox">
      <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span>
      <p class="empty-title">We couldn't load live pricing.</p>
      <p style="color:var(--muted)">Please refresh, or message us and we'll quote you directly.</p>
      <a class="btn btn-wa" href="${waLink("Hi Nuera Tech! I'd like a repair quote.")}" target="_blank" rel="noopener">Message us on WhatsApp</a>
    </div>`;
    $('#result-count').textContent = 'Pricing unavailable';
  }
}

// ===========================================================================
// Chronological ordering (Definition of Done #1)
// ===========================================================================
// The source array is grouped alphabetically by brand, so it is NOT chronological.
// We reorder state.devices once (newest first) so the default "Newest first" sort
// reflects true recency, derived from a release-year estimate per model name.
const BRAND_RANK = Object.fromEntries(BRANDS.filter((b) => b.id !== 'all').map((b, i) => [b.id, i]));

// Approximate release year from a model name. iPads (and dated iPhone SE) carry an
// explicit "(YYYY)"; otherwise the generation number maps to a year per family
// (iPhone n→2008+n, Galaxy S/Note→2000+n, Z Flip/Fold→2018+n, Pixel→2015+n, Tab→2014+n).
function deviceYear(model) {
  const paren = model.match(/\((\d{4})\)/);
  if (paren) return +paren[1];
  const m = model.toLowerCase();
  if (/iphone air/.test(m)) return 2025;
  if (/iphone xs|iphone xr/.test(m)) return 2018;
  if (/iphone x\b/.test(m)) return 2017;
  if (/iphone se/.test(m)) return 2016;
  const n = parseInt((model.match(/\d+/) || ['0'])[0], 10) || 0;
  if (/galaxy z (flip|fold)/.test(m)) return 2018 + n;
  if (/xcover/.test(m)) return 2016 + n;
  if (/galaxy tab/.test(m)) return 2014 + n;
  if (/galaxy (s|note)/.test(m)) return 2000 + n;
  if (/pixel/.test(m)) return 2015 + n;
  if (/iphone/.test(m)) return 2008 + n;
  return 1900 + n;
}

// Within one brand+year, float the higher-end / later-positioned variant up.
function tierWeight(model) {
  const m = model.toLowerCase();
  if (/pro max|ultra/.test(m)) return 6;
  if (/\bfold\b|pro xl/.test(m)) return 5;
  if (/\bpro\b/.test(m)) return 4;
  if (/\bplus\b|\+|\bflip\b/.test(m)) return 3;
  if (/edge/.test(m)) return 2;
  if (/\bfe\b|\bse\b|\bmini\b|lite|xcover|\d+e\b/.test(m)) return 1;
  return 2;
}

// Newest first, grouped by brand (catalog order), then year desc, tier desc, numeric name.
function chronoCompare(a, b) {
  return (BRAND_RANK[a.brand] ?? 99) - (BRAND_RANK[b.brand] ?? 99)
    || deviceYear(b.model) - deviceYear(a.model)
    || tierWeight(b.model) - tierWeight(a.model)
    || a.model.localeCompare(b.model, undefined, { numeric: true });
}

// ===========================================================================
// Model: group repairs by device
// ===========================================================================
function buildModel(repairs) {
  const map = new Map();
  for (const r of repairs) {
    if (!map.has(r.model)) {
      map.set(r.model, { model: r.model, brand: r.brand, repairs: [], types: new Set() });
    }
    const d = map.get(r.model);
    d.repairs.push(r);
    d.types.add(r.chip);
  }
  for (const d of map.values()) {
    // Single pass over the device's repairs: min price, max saving, cheapest-per-type,
    // and the repair-type words for the search index (was several separate .map() passes).
    let minPrice = Infinity;
    let maxSaving = 0;
    const byType = new Map(); // Map<chip, minPrice> — cheapest price per repair type, shown on the card.
    const rtypeWords = [];
    for (const r of d.repairs) {
      if (r.price < minPrice) minPrice = r.price;
      const saving = r.savings || 0;
      if (saving > maxSaving) maxSaving = saving;
      const cur = byType.get(r.chip);
      if (cur == null || r.price < cur) byType.set(r.chip, r.price);
      rtypeWords.push(r.repair_type);
    }
    d.minPrice = minPrice === Infinity ? 0 : minPrice;
    d.maxSaving = maxSaving;
    d.priceByType = byType;
    // Search index — model + brand names + every repair type (id, chip label, full repair_type)
    // so tokenised queries match a device by model AND by the repairs it offers (DoD #3).
    const typeWords = [...d.types].flatMap((t) => [t, CHIP_LABEL[t] || t]);
    d.search = [d.model, manufacturer(d.brand), brandLabel(d.brand), ...typeWords, ...rtypeWords]
      .join(' ').toLowerCase();
  }
  state.byModel = map;
  state.devices = [...map.values()].sort(chronoCompare); // newest first (default sort)
}

// ===========================================================================
// Hero stats (runtime) + CTA copy + spotlight source
// ===========================================================================
// Use the sync job's precomputed savings stats when present (data.stats); otherwise
// derive them in-browser. Keeps the runtime fast without weakening the fallback (Rule 1).
function usePrecomputedStats(data) {
  const s = data && data.stats;
  if (s && typeof s.maxSaving === 'number' && typeof s.avgPct === 'number' && Array.isArray(s.top)) return s;
  return null;
}

function computeSavingsStats(repairs) {
  const withMk = repairs.filter((r) => r.mk_price != null && r.mk_price > 0 && r.savings != null);
  // Single pass for max saving + the % sum (was three traversals: map+max, reduce).
  let maxSaving = withMk.length ? -Infinity : 0;
  let sumPct = 0;
  for (let i = 0; i < withMk.length; i++) {
    const r = withMk[i];
    if (r.savings > maxSaving) maxSaving = r.savings;
    sumPct += pctLess(r.savings, r.mk_price);
  }
  const avgPct = withMk.length ? Math.round(sumPct / withMk.length) : 0;
  const top = [...withMk].sort((a, b) => b.savings - a.savings);
  return { withMk, maxSaving, avgPct, top };
}

function renderStats(stats) {
  const { maxSaving, avgPct, top } = stats;
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('devices', state.devices.length);
  set('maxSaving', maxSaving ? money(Math.round(maxSaving)) : '—');
  set('avgPct', avgPct ? avgPct + '% less' : '—');

  // CTA headline uses the single best real comparison, computed at runtime
  const best = top[0];
  if (best) {
    const what = (CHIP_LABEL[best.chip] || best.repair_type).toLowerCase();
    $('#cta-headline').textContent =
      `Why pay ${moneyExact(best.mk_price)} elsewhere for a ${best.model} ${what}?`;
    $('#cta-sub').textContent =
      `Nuera does it for ${moneyExact(best.price)} — that's ${money(Math.round(best.savings))} back in your pocket, same quality parts. Find your device and book in under a minute.`;
  }
}

// ===========================================================================
// Search shortcut: press "/" anywhere to jump to the finder search box.
// ===========================================================================
// Registered ONCE at boot (not inside buildFilters, which re-runs per data load).
// Ignored while typing in a field, and while the device modal (<dialog open>) or the
// chat panel is open, so it never yanks focus out of them. The visual "/" hint is
// hidden on touch devices via CSS (@media (hover: none)).
function initSearchShortcut() {
  const input = $('#search');
  if (!input) return;
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const ae = document.activeElement;
    if (ae === input || ae?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open], .nt-chat-panel:not([hidden])')) return; // modal/chat open
    e.preventDefault();
    input.focus({ preventScroll: true });
    input.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  });
}

// ===========================================================================
// Filters
// ===========================================================================
function buildFilters() {
  // One pass to tally devices per brand and per repair type, instead of re-scanning
  // state.devices for every pill (was O(brands × devices) + O(types × devices)).
  const brandCounts = { all: state.devices.length };
  const typeCounts = { all: state.devices.length };
  for (let i = 0; i < state.devices.length; i++) {
    const d = state.devices[i];
    brandCounts[d.brand] = (brandCounts[d.brand] || 0) + 1;
    for (const t of d.types) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const brandWrap = $('#brand-filters');
  brandWrap.innerHTML = BRANDS
    .filter((b) => b.id === 'all' || brandCounts[b.id])
    .map((b) => `<button class="pill" type="button" role="radio" data-brand="${b.id}" aria-checked="${b.id === 'all'}" tabindex="${b.id === 'all' ? 0 : -1}">${b.label}<span class="cnt">${brandCounts[b.id] || 0}</span></button>`)
    .join('');

  const typeWrap = $('#type-filters');
  typeWrap.innerHTML = TYPES
    .filter((t) => t.id === 'all' || typeCounts[t.id])
    .map((t) => `<button class="pill rt" type="button" role="radio" data-type="${t.id}" aria-checked="${t.id === 'all'}" tabindex="${t.id === 'all' ? 0 : -1}">${t.label}</button>`)
    .join('');

  brandWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-brand]'); if (!btn) return;
    state.brand = btn.dataset.brand;
    setPressed(brandWrap, btn);
    renderGrid();
    resetFinderScroll();
  });
  typeWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]'); if (!btn) return;
    state.type = btn.dataset.type;
    setPressed(typeWrap, btn);
    renderGrid();
    resetFinderScroll();
  });

  // Keyboard: arrow keys move focus + select within each radiogroup (roving tabindex).
  wireRoving(brandWrap, (btn) => { state.brand = btn.dataset.brand; setPressed(brandWrap, btn); renderGrid(); resetFinderScroll(); });
  wireRoving(typeWrap, (btn) => { state.type = btn.dataset.type; setPressed(typeWrap, btn); renderGrid(); resetFinderScroll(); });

  // search
  const input = $('#search');
  const clear = $('#search-clear');

  const onSearch = debounce(() => {
    state.q = input.value.trim().toLowerCase();
    clear.classList.toggle('show', input.value.length > 0);
    renderGrid();
  }, 110);
  input.addEventListener('input', onSearch);
  clear.addEventListener('click', () => { input.value = ''; state.q = ''; clear.classList.remove('show'); renderGrid(); resetFinderScroll(); input.focus(); });

  // "Load More" pager. Every filter/search above calls renderGrid() (which resets to page 1); this
  // only grows the page and re-renders, keeping the current scroll position.
  const loadMore = $('#load-more');
  if (loadMore) loadMore.addEventListener('click', () => {
    const shownBefore = state.page * PAGE_SIZE;
    state.page += 1;
    renderGrid({ resetPage: false });
    // keyboard a11y: if that was the final page (button now hidden), focus the first new card
    if (loadMore.hidden) $$('#grid .card:not([hidden])')[shownBefore]?.focus();
  });

  // Sort control — changing it re-renders (which writes the URL) and scrolls back to the finder top.
  const sortSel = $('#sort');
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; renderGrid(); resetFinderScroll(); });

  // Restore brand/type/search/sort from the URL on load (replaces the old ?q=-only deep link), and
  // re-sync on back/forward. The renderGrid() in the load flow then paints the restored state.
  syncFromURL();
  addEventListener('popstate', () => { syncFromURL(); renderGrid(); });
}

function setPressed(wrap, active) {
  $$('.pill', wrap).forEach((p) => {
    const on = p === active;
    p.setAttribute('aria-checked', String(on)); // radio semantics + CSS visual hook
    p.tabIndex = on ? 0 : -1;                    // roving tabindex
  });
}

// Roving-tabindex keyboard nav for a single-select pill radiogroup. Selection
// follows focus (WAI-ARIA radio pattern); mouse + Enter/Space keep the click path.
function wireRoving(wrap, onSelect) {
  wrap.addEventListener('keydown', (e) => {
    const pills = $$('.pill', wrap);
    const i = pills.indexOf(document.activeElement);
    if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % pills.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + pills.length) % pills.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = pills.length - 1;
    else return;
    e.preventDefault();
    pills[j].focus();
    onSelect(pills[j]);
  });
}

// Changing a filter re-renders the grid in place, but the window keeps its scroll
// position — so narrowing a long list can leave you stranded past the end of the new,
// shorter one. Snap back to the top of the finder so results start from the top. We only
// ever scroll up: a filter tapped while already at/above the finder is left untouched.
function resetFinderScroll() {
  const finder = $('#finder');
  if (!finder) return;
  const margin = parseFloat(getComputedStyle(finder).scrollMarginTop) || 0; // clears the sticky header
  // Use the layout offset (offsetTop chain), not getBoundingClientRect: the latter includes the
  // .reveal translateY(22px) transform, which skews the target until the section's reveal
  // animation has settled. offsetTop is transform-independent, so we always land on the heading.
  let target = 0;
  for (let n = finder; n; n = n.offsetParent) target += n.offsetTop;
  target = Math.max(0, target - margin);
  if (window.scrollY <= target) return;
  window.scrollTo({ top: target, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// ===========================================================================
// Grid — build all cards once, then filter by toggling [hidden] (instant, no re-parse)
// ===========================================================================
// ---- URL state (shareable filters) + sort ----
// Sort the matching device list. 'default' preserves the natural (data) order.
function sortDevices(list, sort) {
  if (sort === 'savings') return [...list].sort((a, b) => b.maxSaving - a.maxSaving || a.minPrice - b.minPrice);
  if (sort === 'price') return [...list].sort((a, b) => a.minPrice - b.minPrice || b.maxSaving - a.maxSaving);
  return list;
}

// Write the active brand/type/search/sort to the URL in place (replaceState — shareable + reload-safe,
// no history entries). Defaults are omitted so a pristine finder stays at a clean URL.
function updateURL() {
  const p = new URLSearchParams();
  if (state.brand !== 'all') p.set('brand', state.brand);
  if (state.type !== 'all') p.set('type', state.type);
  const qv = ($('#search')?.value || '').trim();
  if (qv) p.set('q', qv);
  if (state.sort !== 'default') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
}

// Read brand/type/search/sort from the URL, validate, set state, and reflect into the controls.
// Does NOT render — callers (initial load / popstate) call renderGrid().
function syncFromURL() {
  const p = new URLSearchParams(location.search);
  const brand = p.get('brand'); const type = p.get('type');
  const q = p.get('q') || ''; const sort = p.get('sort');
  state.brand = BRANDS.some((b) => b.id === brand) ? brand : 'all';
  state.type = TYPES.some((t) => t.id === type) ? type : 'all';
  state.q = q.trim().toLowerCase();
  state.sort = ['savings', 'price', 'default'].includes(sort) ? sort : 'default';
  const input = $('#search'); const clear = $('#search-clear');
  if (input) { input.value = q; clear?.classList.toggle('show', q.length > 0); }
  const sortSel = $('#sort'); if (sortSel) sortSel.value = state.sort;
  const bw = $('#brand-filters'); const bb = bw && (bw.querySelector(`[data-brand="${state.brand}"]`) || bw.querySelector('[data-brand="all"]')); if (bb) setPressed(bw, bb);
  const tw = $('#type-filters'); const tb = tw && (tw.querySelector(`[data-type="${state.type}"]`) || tw.querySelector('[data-type="all"]')); if (tb) setPressed(tw, tb);
}

let cardEls = null; // Map<model, HTMLElement>, built once
let emptyEl = null; // reused empty-state node

function renderGrid({ resetPage = true } = {}) {
  const grid = $('#grid');
  const { brand, type, q } = state;
  if (resetPage) state.page = 1; // a new filter/search always starts from the first page

  let firstBuild = false;
  if (!cardEls) {
    grid.innerHTML = state.devices.map(cardHTML).join('');
    cardEls = new Map();
    $$('.card', grid).forEach((el) => cardEls.set(el.dataset.model, el));
    grid.setAttribute('aria-busy', 'false');
    observeReveal(grid);      // observe once; the observation persists across hide/show
    initCardSpotlight(grid);  // pointer-tracked glow (desktop + motion-on only)
    firstBuild = true;
  }

  // Filter → sort → map to card elements. Sorting reorders the DOM (only when non-default) so the
  // visual + keyboard order match; 'default' preserves the natural data order (no reorder needed).
  // Tokenised search: split on whitespace and require EVERY token to appear in the device's
  // search index (model + repair types), so "iphone 12 battery" matches the iPhone 12 (DoD #3).
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const matchFn = (d) => (brand === 'all' || d.brand === brand)
    && (type === 'all' || d.types.has(type))
    && tokens.every((t) => d.search.includes(t));
  const matchDevices = sortDevices(state.devices.filter(matchFn), state.sort);
  const matchingEls = matchDevices.map((d) => cardEls.get(d.model)).filter(Boolean);
  const matchSet = new Set(matchingEls);
  const nonMatching = [];
  cardEls.forEach((el) => { if (!matchSet.has(el)) nonMatching.push(el); });
  if (state.sort !== 'default' && matchingEls.length) grid.append(...matchingEls);

  // Pagination: show only the first `visibleCount` matches; the rest stay [hidden] behind "Load
  // More". Animate the transition — never on first build (scroll-reveal handles those), and on a
  // Load-More click only the freshly revealed slice (not the cards already on screen).
  const visibleCount = state.page * PAGE_SIZE;
  const show = matchingEls.slice(0, visibleCount);
  const hide = nonMatching.concat(matchingEls.slice(visibleCount));
  const animateEls = firstBuild ? [] : (resetPage ? show : matchingEls.slice((state.page - 1) * PAGE_SIZE, visibleCount));
  applyFilter(show, hide, animateEls);
  const shown = matchingEls.length;

  // "Load More" is offered only while unshown matches remain.
  const loadMore = $('#load-more');
  if (loadMore) {
    const remaining = shown - visibleCount;
    loadMore.hidden = remaining <= 0;
    if (remaining > 0) loadMore.setAttribute('aria-label', `Load ${Math.min(PAGE_SIZE, remaining)} more devices — ${remaining} remaining`);
  }

  if (!shown) {
    if (!emptyEl) { emptyEl = document.createElement('div'); emptyEl.className = 'empty'; }
    emptyEl.innerHTML = `
      <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <p class="empty-title">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" href="${waLink('Hi Nuera Tech! Do you repair: ' + (state.q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>`;
    if (!emptyEl.isConnected) grid.appendChild(emptyEl);
  } else if (emptyEl && emptyEl.isConnected) {
    emptyEl.remove();
  }

  const count = $('#result-count');
  count.textContent = shown
    ? `${shown} device${shown === 1 ? '' : 's'}`
      + (brand !== 'all' ? ` · ${BRANDS.find((b) => b.id === brand)?.label}` : '')
      + (q ? ` · “${state.q}”` : '')
    : 'No matches';
  $('#result-hint').textContent = shown ? 'Tap a device for full pricing' : '';
  if (!firstBuild) pulseResultCount(count); // visual "results refreshed" cue; never on first paint
  if (resetPage && !firstBuild) updateURL(); // keep the shareable URL in sync (replaceState)
}

// Animate the grid between filter states with a clean "results refresh" — fade + subtle scale the
// matching set into its FINAL layout (Web Animations API; opacity/transform only, compositor-friendly).
// We do NOT animate card positions — that made cards fly across the grid and overlap/ghost on big set
// changes (All → Pixel/Battery). CRITICAL: visibility is toggled SYNCHRONOUSLY (non-matching →
// display:none) so a [hidden] read / Playwright :visible count is correct on the very next tick (driver
// checks 150ms); the fade is opacity/transform only, which Playwright ignores. Reduced-motion / no
// WAAPI → the plain instant toggle.
let filterAnims = []; // our in-flight fade Animations; cancelled on the next filter so they never stack
function applyFilter(showEls, hideEls, animateEls) {
  hideEls.forEach((el) => { el.hidden = true; });
  showEls.forEach((el) => { el.hidden = false; });
  if (!animateEls || !animateEls.length || reduceMotion() || typeof animateEls[0]?.animate !== 'function') return;
  filterAnims.forEach((a) => a.cancel());   // cancel only our fades — never the CSS hover animations
  const n = animateEls.length;
  filterAnims = animateEls.map((el, i) => {
    // A card shown by a filter/page is "revealed": mark it .in so its BASE opacity is 1. Otherwise a
    // not-yet-scroll-revealed card (.reveal ⇒ opacity:0) would fade in then vanish when the WAAPI
    // animation (fill:'backwards') reverts to base. (Never on first build, so the initial
    // scroll-reveal stagger is preserved.)
    el.classList.add('in');
    return el.animate(
      [{ opacity: 0.25, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }],
      {
        duration: 320,
        delay: n > 1 ? (i / (n - 1)) * 280 : 0, // spread the stagger across ~280ms regardless of count
        easing: EASE_ENTRANCE,
        fill: 'backwards',                       // hold the dim start through the delay; no inline styles after
      },
    );
  });
}

// Pointer-tracked spotlight glow on cards: sets --mx/--my (consumed by .card::before). Desktop +
// motion-on only; throttled to a single rect read per animation frame so it stays cheap.
function initCardSpotlight(grid) {
  if (reduceMotion() || !canHover()) return;
  let raf = 0;
  let pending = null;

  // Cache the bounding rect so continuous pointer movement over the same card
  // doesn't trigger a synchronous layout calculation (getBoundingClientRect) on every frame.
  let cachedRect = null;
  let cachedCard = null;

  // Invalidate cache when layout might have changed
  const invalidate = () => { cachedRect = null; cachedCard = null; };
  addEventListener('scroll', invalidate, { capture: true, passive: true });
  addEventListener('resize', invalidate, { passive: true });

  grid.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    pending = { card, x: e.clientX, y: e.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const { card, x, y } = pending;

      if (card !== cachedCard || !cachedRect) {
        cachedCard = card;
        cachedRect = card.getBoundingClientRect();
      }

      const r = cachedRect;
      card.style.setProperty('--mx', `${((x - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((y - r.top) / r.height) * 100}%`);
    });
  }, { passive: true });
}

function cardHTML(d) {
  // Every repair type with its exact price (cheapest tier) — shown without a click (DoD #2).
  const prices = TYPES.filter((t) => t.id !== 'all' && d.priceByType.has(t.id)).map((t) =>
    `<li class="cp-row ${t.id}"><span class="cp-type">${CHIP_LABEL[t.id] || t.id}</span><span class="cp-price">${moneyExact(d.priceByType.get(t.id))}</span></li>`
  ).join('');
  const save = d.maxSaving > 0
    ? `<div class="save-tag">save up to <b>${money(Math.round(d.maxSaving))}</b><span>vs other shops</span></div>`
    : '';
  return `<button class="card reveal" type="button" data-model="${esc(d.model)}" aria-label="View pricing for ${esc(d.model)}">
    <div class="card-top">
      <span class="card-model">${esc(stripManufacturer(d.model, d.brand))}</span>
      <span class="brand-tag">${esc(manufacturer(d.brand))}</span>
    </div>
    <ul class="card-prices">${prices}</ul>
    <div class="card-cta">
      ${save}
      <span class="card-view">View options &amp; book
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </span>
    </div>
  </button>`;
}

const brandLabel = (b) => BRANDS.find((x) => x.id === b)?.label || b;

// ===========================================================================
// Device detail dialog
// ===========================================================================
let lastFocus = null;
function initDialog() {
  const dlg = $('#detail');
  const body = $('#detail-body');
  $('#grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    openDevice(card.dataset.model, card);
  });
  $('#detail-close').addEventListener('click', () => withViewTransition(() => dlg.close()));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) withViewTransition(() => dlg.close()); }); // backdrop
  // Esc fires the dialog's native cancel/close (left un-wrapped → instant); the close listener below
  // still restores focus in every path.
  dlg.addEventListener('close', () => { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });

  // Option/colour picking + bundle add/remove are event-delegated so they survive each re-render.
  body.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { toggleSelect(+add.dataset.add); return; }
    const opt = e.target.closest('[data-g][data-o]'); if (!opt) return;
    selectOption(+opt.dataset.g, +opt.dataset.o);
  });
  // Arrow keys move the selection within a group's radiogroup.
  body.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const cur = e.target.closest('[data-g][data-o]'); if (!cur) return;
    e.preventDefault();
    const g = +cur.dataset.g, n = state.groups[g].options.length;
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const next = (state.groups[g].selected + (fwd ? 1 : -1) + n) % n;
    selectOption(g, next);
    const el = body.querySelector(`[data-g="${g}"][data-o="${next}"]`); if (el) el.focus();
  });
}

function openDevice(model, trigger) {
  const d = state.byModel.get(model); if (!d) return;
  lastFocus = trigger || document.activeElement;
  state.openModel = model;
  const groups = state.groups = groupRepairs(d.repairs);
  state.selected = new Set(); // fresh multi-select bundle per device

  $('#detail-title').textContent = d.model;
  const gc = groups.length;
  $('#detail-sub').textContent =
    `${gc} repair type${gc === 1 ? '' : 's'} · ${brandLabel(d.brand)} · from ${moneyExact(d.minPrice)}`;
  $('#detail-body').innerHTML = groups.map((g, i) => groupHTML(g, i, d.model)).join('');

  updateBundle(); // nothing selected yet → foot CTA books the whole device
  // The sheet is already populated above, so the View Transition captures the filled "new" state.
  withViewTransition(() => { $('#detail').showModal(); $('#detail-body').scrollTop = 0; });
}

// ---- option-group rendering ----
const selOpt = (g) => g.options[g.selected];

function subText(g) {
  const r = selOpt(g);
  if (g.swatch) { const c = g.colors[g.selected]; return 'Colour: ' + (c ? c.name : (cleanVariant(r.variant) || '—')); }
  return cleanVariant(r.variant) || 'Standard option';
}

function compareHTML(r) {
  const hasSave = r.mk_price != null && r.mk_price > 0 && r.savings != null && r.savings > 0;
  return hasSave
    ? `<span class="mk">Typical price ${moneyExact(r.mk_price)}</span><span class="save">Save ${money(Math.round(r.savings))} · ${pctLess(r.savings, r.mk_price)}% less</span>`
    : '';
}

// ---- multi-select bundle (Definition of Done #4) ----
// state.selected holds the indices of the repair groups the user added. Two or more selected
// repairs earn a flat $20 bundle discount. bundleTotals() does the math; bundleMsg() formats the
// strictly-laid-out WhatsApp payload (URL-encoded by waLink) summarising it.
const BUNDLE_DISCOUNT = 20;

function bundleTotals(sel) {
  const original = sel.reduce((s, gi) => s + selOpt(state.groups[gi]).price, 0);
  const discount = sel.length >= 2 ? BUNDLE_DISCOUNT : 0;
  return { original, discount, final: original - discount };
}

// Variant / colour label for a selected group (mirrors quoteText()).
function selLabel(g) {
  return g.swatch ? (g.colors[g.selected]?.name || '') : cleanVariant(selOpt(g).variant);
}

function bundleMsg(model, sel) {
  const { original, discount, final } = bundleTotals(sel);
  const lines = sel.map((gi) => {
    const g = state.groups[gi]; const r = selOpt(g); const v = selLabel(g);
    return `• ${r.repair_type}${v ? ` (${v})` : ''} — ${moneyExact(r.price)}`;
  });
  if (sel.length < 2) {
    return `Hi Nuera Tech! I'd like to book for my ${model}:\n${lines.join('\n')}\n• Total: ${moneyExact(final)}`;
  }
  return [
    `Hi Nuera Tech! I'd like to book a bundle for my ${model}:`,
    ...lines,
    '',
    `Original total: ${moneyExact(original)}`,
    `Bundle discount: -${moneyExact(discount)}`,
    `You pay: ${moneyExact(final)}`,
  ].join('\n');
}

// Add/remove a repair group from the bundle, sync its toggle button, refresh the summary.
function toggleSelect(gi) {
  if (!state.groups[gi]) return;
  const on = !state.selected.has(gi);
  if (on) state.selected.add(gi); else state.selected.delete(gi);
  const btn = $(`#detail-body [data-add="${gi}"]`);
  if (btn) {
    btn.setAttribute('aria-pressed', String(on));
    const ic = btn.querySelector('.rgroup-add-ic'); if (ic) ic.innerHTML = on ? CHECK_SVG : ADD_SVG;
    const tx = btn.querySelector('.rgroup-add-tx'); if (tx) tx.textContent = on ? 'Added' : 'Add';
    const name = state.groups[gi].rtype;
    btn.setAttribute('aria-label', on ? `Remove ${name} from your booking` : `Add ${name} to your booking`);
  }
  updateBundle();
}

// Render the live bundle summary + adapt the foot CTA. Nothing selected → device-level booking.
function updateBundle() {
  const model = state.openModel;
  const box = $('#detail-bundle');
  const cta = $('#detail-book-all');
  const label = $('#detail-book-label');
  if (!model || !cta) return;
  const sel = [...state.selected].sort((a, b) => a - b);
  if (!sel.length) {
    if (box) { box.hidden = true; box.innerHTML = ''; }
    if (label) label.textContent = 'Book this device on WhatsApp';
    cta.href = waLink(`Hi Nuera Tech! I'd like to book a repair for my ${model}.`);
    cta.setAttribute('aria-label', `Book ${model} on WhatsApp`);
    return;
  }
  const { original, discount, final } = bundleTotals(sel);
  if (box) {
    const items = sel.map((gi) => {
      const g = state.groups[gi]; const v = selLabel(g);
      return `<li><span>${esc(g.rtype)}${v ? ` · ${esc(v)}` : ''}</span><b>${moneyExact(selOpt(g).price)}</b></li>`;
    }).join('');
    box.hidden = false;
    box.innerHTML = `<ul class="bundle-list">${items}</ul>
      <div class="bundle-tot">
        <div class="bundle-row"><span>Original total</span><span>${moneyExact(original)}</span></div>
        ${discount ? `<div class="bundle-row bundle-save"><span>Bundle discount (2+ repairs)</span><span>-${moneyExact(discount)}</span></div>` : ''}
        <div class="bundle-row bundle-final"><span>${discount ? 'You pay' : 'Total'}</span><b>${moneyExact(final)}</b></div>
      </div>
      ${sel.length === 1 ? `<p class="bundle-hint">Add one more repair to save ${money(BUNDLE_DISCOUNT)}.</p>` : ''}`;
  }
  if (label) label.textContent = sel.length === 1
    ? `Book this repair — ${moneyExact(final)}`
    : `Book ${sel.length} repairs — ${moneyExact(final)}`;
  cta.href = waLink(bundleMsg(model, sel));
  cta.setAttribute('aria-label', `Book ${sel.length} selected repair${sel.length === 1 ? '' : 's'} for ${model} on WhatsApp`);
}

function optionsHTML(g, gi) {
  if (g.options.length < 2) return '';
  if (g.swatch) {
    const sw = g.options.map((r, o) => {
      const c = g.colors[o];
      return `<button class="swatch" type="button" role="radio" aria-checked="${o === g.selected}" tabindex="${o === g.selected ? 0 : -1}" data-g="${gi}" data-o="${o}" style="--c:${c.hex}" title="${esc(c.name)} · ${moneyExact(r.price)}" aria-label="Colour ${esc(c.name)}, ${moneyExact(r.price)}"></button>`;
    }).join('');
    return `<div class="swatches" role="radiogroup" aria-label="${esc(g.rtype)} colour">${sw}</div>`;
  }
  const showFlag = g.options[g.options.length - 1].price > g.options[0].price; // varies by tier
  const chips = g.options.map((r, o) => {
    const flag = (showFlag && o === 0) ? '<span class="opt-flag">Lowest</span>' : '';
    const delta = r.price - g.options[0].price; // real-data premium over the cheapest tier
    const deltaHTML = delta > 0 ? `<span class="opt-delta">+${moneyExact(delta)}</span>` : '';
    return `<button class="opt" type="button" role="radio" aria-checked="${o === g.selected}" tabindex="${o === g.selected ? 0 : -1}" data-g="${gi}" data-o="${o}">${flag}<span class="opt-label">${esc(tierLabel(r))}</span><span class="opt-price">${moneyExact(r.price)}</span>${deltaHTML}</button>`;
  }).join('');
  // Two tiers read clearest as a segmented toggle; 3+ keep the wrapping chip grid.
  const seg = g.options.length === 2 ? ' opts-seg' : '';
  return `<div class="opts${seg}" role="radiogroup" aria-label="${esc(g.rtype)} options">${chips}</div>`;
}

function groupHTML(g, gi, model) {
  const r = selOpt(g);
  return `<section class="rgroup" role="group" aria-label="${esc(model)} — ${esc(g.rtype)}">
    <div class="rgroup-head">
      <span class="rgroup-ic ${g.chip}" aria-hidden="true">${RTYPE_ICON[g.chip] || ''}</span>
      <div class="rgroup-meta">
        <div class="rgroup-name">${esc(g.rtype)}</div>
        <div class="rgroup-sub" data-sub="${gi}">${esc(subText(g))}</div>
        ${optionsHTML(g, gi)}
        <div class="rgroup-foot">
          <div class="rgroup-price" aria-live="polite">
            <div class="p"><span class="cur">$</span><span data-price="${gi}">${Number(r.price).toFixed(2)}</span></div>
            <div class="rgroup-compare" data-compare="${gi}">${compareHTML(r)}</div>
          </div>
          <button class="rgroup-add" type="button" data-add="${gi}" aria-pressed="false" aria-label="Add ${esc(g.rtype)} to your booking"><span class="rgroup-add-ic" aria-hidden="true">${ADD_SVG}</span><span class="rgroup-add-tx">Add</span></button>
        </div>
      </div>
    </div>
  </section>`;
}

// Apply a new selection: update the radios, the subtitle, price, comparison and booking link.
function selectOption(gi, oi) {
  const g = state.groups[gi]; if (!g || g.selected === oi) return;
  g.selected = oi;
  const body = $('#detail-body');
  const r = selOpt(g);
  body.querySelectorAll(`[data-g="${gi}"][data-o]`).forEach((el) => {
    const on = +el.dataset.o === oi;
    el.setAttribute('aria-checked', String(on));
    el.tabIndex = on ? 0 : -1;
  });
  const set = (sel, fn) => { const el = body.querySelector(sel); if (el) fn(el); };
  set(`[data-sub="${gi}"]`, (el) => { el.textContent = subText(g); });
  set(`[data-price="${gi}"]`, (el) => { el.textContent = Number(r.price).toFixed(2); });
  set(`[data-compare="${gi}"]`, (el) => { el.innerHTML = compareHTML(r); });
  if (state.selected.has(gi)) updateBundle(); // a selected repair's tier changed → refresh totals + payload
}

// ---- share / copy the current quote ----
// Build a plain-text summary of the open device + the currently-selected option per repair type.
function quoteText() {
  const model = state.openModel;
  const groups = state.groups || [];
  if (!model || !groups.length) return '';
  const lines = [`My Nuera Tech repair quote — ${model}:`];
  for (const g of groups) {
    const r = selOpt(g);
    const tier = g.swatch ? (g.colors[g.selected]?.name || '') : cleanVariant(r.variant);
    const hasSave = r.mk_price != null && r.mk_price > 0 && r.savings != null && r.savings > 0;
    lines.push(`• ${g.rtype}${tier ? ` (${tier})` : ''}: ${moneyExact(r.price)}`
      + (hasSave ? ` — save ${money(Math.round(r.savings))} vs other shops` : ''));
  }
  lines.push('', 'Book on WhatsApp: ' + waLink(`Hi Nuera Tech! I'd like to book a repair for my ${model}.`), 'https://nuera.talha-k.com/');
  return lines.join('\n');
}

function initShareQuote() {
  const btn = $('#detail-share');
  const fb = $('#share-feedback');
  if (!btn) return;
  let fbT;
  const flash = (msg) => {
    if (!fb) return;
    fb.textContent = msg;
    fb.classList.add('show');
    clearTimeout(fbT);
    fbT = setTimeout(() => fb.classList.remove('show'), 2400);
  };
  btn.addEventListener('click', async () => {
    const text = quoteText();
    if (!text) return;
    // Native share sheet on capable devices; clipboard everywhere else.
    if (navigator.share) {
      try { await navigator.share({ title: `Nuera Tech — ${state.openModel} repair quote`, text }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; } // user dismissed → fall through to copy
    }
    try { await navigator.clipboard.writeText(text); flash('Copied to clipboard'); }
    catch { flash('Press ⌘/Ctrl+C to copy'); }
  });
}

// ===========================================================================
// Savings spotlight (interactive bar comparison)
// ===========================================================================
function buildSpotlight(stats) {
  const { top } = stats;
  if (!top.length) return;

  const picks = top.slice(0, 6);
  const card = $('#spotlight');
  card.hidden = false;
  const pills = $('#spot-pills');
  pills.innerHTML = picks.map((r, i) =>
    `<button class="spot-pill" type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(r.model)}</button>`).join('');

  const show = (i) => {
    const r = picks[i];
    const saving = Math.round(r.savings);
    const pct = pctLess(r.savings, r.mk_price);
    $('#spot-device').textContent = `${r.model} — ${r.repair_type}`;
    $('#spot-sub').textContent = 'Same quality parts. Same repair. One honest price.';
    // Savings is the visual anchor: a large count-up dollar figure + a "% less" badge.
    const save = $('#spot-save');
    save.innerHTML =
      `<span class="spot-save-eyebrow"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>You save</span>`
      + `<span class="save-amt">$${saving}</span>`
      + `<span class="save-pct">${pct}% less than other shops</span>`;
    countUp($('.save-amt', save), saving);
    const max = r.mk_price;
    const nueraW = (r.price / max) * 100;
    // --bar-w carries the target width so the CSS scroll-driven fill (where supported) can scrub
    // 0 → --bar-w. The double-rAF below sets the resting inline width as the universal baseline;
    // the two agree on the final value, so there's no jump when the scroll animation lands.
    $('#spot-bars').innerHTML = `
      <div class="bar-row"><span class="bar-name">Typical price</span><div class="bar-track"><div class="bar-fill bar-mk" data-w="100" style="--bar-w:100%"><span class="bar-was">${moneyExact(r.mk_price)}</span></div></div></div>
      <div class="bar-row"><span class="bar-name">Nuera</span><div class="bar-track"><div class="bar-fill bar-nuera" data-w="${nueraW}" style="--bar-w:${nueraW}%">${moneyExact(r.price)}</div></div></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('#spot-bars .bar-fill').forEach((el) => { el.style.width = el.dataset.w + '%'; });
    }));
    $$('.spot-pill', pills).forEach((p) => p.setAttribute('aria-pressed', String(+p.dataset.i === i)));
  };

  pills.addEventListener('click', (e) => {
    const btn = e.target.closest('.spot-pill'); if (!btn) return;
    show(+btn.dataset.i);
  });

  // animate when scrolled into view the first time
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      show(0);
      card.closest('.spotlight')?.classList.remove('reserving'); // release the reserved CLS space once populated
      io.disconnect();
    });
  }, { threshold: 0.3 });
  io.observe(card);
}

// ===========================================================================
// Runtime structured data (kept out of static HTML per Rule 1)
// ===========================================================================
// One <script type="application/ld+json"> @graph injected after pricing loads:
//  • a WebPage carrying dateModified (= the data's `generated` date) for freshness;
//  • an aggregate repair Service; and
//  • a per-repair-type Service (screen/battery/back glass/charge port), each with its
//    own CAD price band. Specific, priced services read better to search + AI assistants
//    than one catch-all node. No Review/AggregateRating here: self-hosted reviews are not
//    eligible for review rich results on a LocalBusiness, so we display them as UI only.
function serviceNode(name, serviceType, prices) {
  return {
    '@type': 'Service',
    name,
    serviceType,
    provider: { '@id': 'https://nuera.talha-k.com/#business' },
    areaServed: { '@type': 'City', name: 'Guelph' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'CAD',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: prices.length,
    },
  };
}

function injectStructuredData(data) {
  const repairs = Array.isArray(data?.repairs) ? data.repairs : [];
  const graph = [];

  if (typeof data?.generated === 'string') {
    graph.push({
      '@type': 'WebPage',
      '@id': 'https://nuera.talha-k.com/#webpage',
      url: 'https://nuera.talha-k.com/',
      name: 'Nuera Tech — Guelph Phone Repair',
      isPartOf: { '@id': 'https://nuera.talha-k.com/#website' },
      about: { '@id': 'https://nuera.talha-k.com/#business' },
      dateModified: data.generated,
    });
  }

  const prices = repairs.map((r) => r.price).filter((n) => typeof n === 'number' && n > 0);
  if (prices.length) {
    graph.push(serviceNode('Phone & tablet repair — Guelph', 'Phone and tablet repair', prices));
    for (const t of TYPES) {
      if (t.id === 'all') continue;
      const tp = repairs.filter((r) => r.chip === t.id).map((r) => r.price).filter((n) => typeof n === 'number' && n > 0);
      if (tp.length) graph.push(serviceNode(`${SERVICE_NAME[t.id] || t.label} — Guelph`, SERVICE_NAME[t.id] || t.label, tp));
    }
  }

  if (!graph.length) return;
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  document.head.appendChild(s);
}

// ===========================================================================
// Reviews (runtime-fetched from /reviews.json, kept out of static HTML per Rule 1)
// ===========================================================================
// Progressive enhancement: the #reviews section + hero rating chip ship with a static
// fallback so the page is never blank (and works with JS off / offline). On load we
// fetch /reviews.json (synced from Google by cloud/reviews-sync) and replace the wall +
// aggregate score with the live values. A failed fetch is non-fatal — the fallback stays.
const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || 'G';

function starFill(rating) { return Math.round((Math.max(0, Math.min(5, Number(rating) || 0)) / 5) * 100); }

async function loadReviews() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(REVIEWS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderReviews(await res.json());
  } catch (err) {
    // Non-fatal — leave the static fallback in #reviews as-is.
    console.warn('[nuera] reviews unavailable, keeping static fallback:', err?.message || err);
  }
}

function reviewCardHTML(r) {
  const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
  const who = esc(r.author || 'Google reviewer');
  const initials = esc((r.initials || initialsOf(r.author)).slice(0, 2));
  const meta = r.device || r.time || ''; // device tag (seed) or relative time (Google)
  return `<figure class="review">
      <div class="review-stars" role="img" aria-label="Rated ${rating} out of 5"><span class="stars-on" style="--fill:${starFill(rating)}%">★★★★★</span><span class="stars-off">★★★★★</span></div>
      <blockquote>${esc(r.text)}</blockquote>
      <figcaption><span class="review-avatar" aria-hidden="true">${initials}</span><span class="review-who"><b>${who}</b>${meta ? `<span class="review-device">${esc(meta)}</span>` : ''}</span></figcaption>
    </figure>`;
}

function renderReviews(data) {
  if (!data || typeof data !== 'object') return;
  const rating = Number(data.rating);
  const count = Number(data.review_count);

  // Aggregate: #reviews summary + the hero rating chip (only with a sane score).
  if (rating > 0 && rating <= 5) {
    const score = rating.toFixed(1);
    const fill = starFill(rating);
    const summary = $('#reviews .rating-summary');
    if (summary) {
      summary.innerHTML =
        `<span class="rating-score">${esc(score)}</span>`
        + `<span class="rating-stars" role="img" aria-label="Average rating ${esc(score)} out of 5 stars">`
        + `<span class="stars-on" style="--fill:${fill}%">★★★★★</span><span class="stars-off">★★★★★</span></span>`
        + (count > 0 ? `<span class="rating-meta">from <b>${count}</b> Google reviews</span>` : '');
    }
    const chip = $('.hero-trust .rating-chip');
    if (chip) {
      chip.setAttribute('aria-label', `Rated ${score} out of 5 from Google reviews`);
      chip.querySelector('.stars-on')?.style.setProperty('--fill', fill + '%');
      const b = chip.querySelector('b'); if (b) b.textContent = score;
    }
  }

  // The review wall.
  const reviews = Array.isArray(data.reviews)
    ? data.reviews.filter((r) => r && typeof r.text === 'string' && r.text.trim())
    : [];
  if (reviews.length) {
    const wrap = $('#reviews .reviews');
    if (wrap) wrap.innerHTML = reviews.map(reviewCardHTML).join('');
  }
}

// ===========================================================================
// WhatsApp default messages on static links
// ===========================================================================
function initWhatsAppDefaults() {
  const msg = "Hi Nuera Tech! I'd like to book a repair.";
  $$('[data-wa="general"]').forEach((a) => { a.href = waLink(msg); });
}

// ===========================================================================
// Scroll-to-top + reveal
// ===========================================================================
function initScrollTop() {
  const btn = $('#fab-top');
  let ticking = false;
  const update = () => { btn.classList.toggle('show', window.scrollY > 600); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }));
}

// Reading-progress bar: scale the top gradient line by how far the page is scrolled. rAF-throttled,
// position-driven (not a decorative animation) so it stays accurate under reduced motion too.
function initScrollProgress() {
  const bar = $('#scroll-progress-bar');
  if (!bar) return;

  let maxScroll = 0;
  const recalcMax = () => {
    const doc = document.documentElement;
    maxScroll = doc.scrollHeight - doc.clientHeight;
  };
  recalcMax();

  // Recompute the max scroll height when the window resizes or body size changes.
  addEventListener('resize', recalcMax, { passive: true });
  if (window.ResizeObserver) {
    new ResizeObserver(recalcMax).observe(document.body);
  }

  let ticking = false;
  const update = () => {
    bar.style.setProperty('--p', (maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0).toFixed(4));
    ticking = false;
  };
  update();
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

// "Open now / Closed" status + today-highlight for the Visit section. The #visit hours table is the
// single source of truth: each <tr data-day> (0=Sun…6=Sat) optionally carries data-open/data-close in
// minutes-from-midnight. No-op (and the static table still shows) if the section/rows aren't present.
function initHours() {
  const status = $('#visit-status');
  const rows = $$('#visit .hours tr[data-day]');
  if (!status || !rows.length) return;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fmt = (m) => {
    const h = Math.floor(m / 60), mm = m % 60;
    return `${((h + 11) % 12) + 1}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const num = (v) => (v != null && v !== '' ? +v : null);
  const byDay = new Map();
  rows.forEach((tr) => byDay.set(+tr.dataset.day, { open: num(tr.dataset.open), close: num(tr.dataset.close), tr }));

  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  byDay.get(day)?.tr.classList.add('today');

  const set = (state, text) => { status.dataset.state = state; status.textContent = text; };
  const today = byDay.get(day);
  if (today && today.open != null && today.close != null && mins >= today.open && mins < today.close) {
    set('open', `Open now · closes ${fmt(today.close)}`);
    return;
  }
  // Closed now — surface the next opening within the coming week.
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const slot = byDay.get(d);
    if (!slot || slot.open == null || slot.close == null) continue;
    if (i === 0 && mins < slot.open) { set('closed', `Closed · opens ${fmt(slot.open)}`); return; }
    if (i >= 1) { set('closed', `Closed · opens ${i === 1 ? 'tomorrow' : DAYS[d]} ${fmt(slot.open)}`); return; }
  }
  set('closed', 'Closed');
}

// ===========================================================================
// Header: scroll-aware sticky state + mobile menu
// ===========================================================================
function initHeader() {
  const header = $('.header');
  if (!header) return;
  let ticking = false;
  const update = () => { header.classList.toggle('scrolled', window.scrollY > 8); ticking = false; };
  update();
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });

  // Mobile menu (no-ops gracefully if the toggle/panel aren't present)
  const toggle = $('#nav-toggle');
  const panel = $('#mobile-nav');
  if (!toggle || !panel) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.hidden = !open;
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
  addEventListener('click', (e) => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !e.target.closest('#mobile-nav') && !e.target.closest('#nav-toggle')) setOpen(false);
  });
}

// ===========================================================================
// FAQ: accessible, animated accordion (enhances native <details>)
// ===========================================================================
function initFaq() {
  const items = $$('.faq .qa');
  if (!items.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tear down any in-flight collapse on `d` (its transitionend listener + timeout fallback)
  // so re-opening or closing again starts from a clean state.
  const clearPending = (d) => {
    if (d._faqDone) { $('.qa-wrap', d).removeEventListener('transitionend', d._faqDone); d._faqDone = null; }
    if (d._faqTimer) { clearTimeout(d._faqTimer); d._faqTimer = null; }
    d.classList.remove('closing');
  };

  const closeItem = (d) => {
    const summary = $('summary', d);
    summary.setAttribute('aria-expanded', 'false');
    const wrap = $('.qa-wrap', d);
    clearPending(d);
    if (reduce || !wrap || !d.open) { d.open = false; return; }
    // Start the collapse NOW: .closing drives the row to 0fr while [open] keeps the body
    // rendered, so the close animates. Drop [open] once the row finishes collapsing.
    d.classList.add('closing');
    const done = () => { clearPending(d); d.open = false; };
    d._faqDone = done;
    wrap.addEventListener('transitionend', done);
    d._faqTimer = setTimeout(done, 350);
  };

  const openItem = (d) => {
    clearPending(d); // cancel a pending collapse so a re-open animates from where it is
    d.open = true;
    $('summary', d).setAttribute('aria-expanded', 'true');
  };

  items.forEach((d) => {
    const summary = $('summary', d);
    const wrap = $('.qa-wrap', d);
    if (wrap && !wrap.id) wrap.id = 'qa-body-' + Math.random().toString(36).slice(2, 8);
    summary.setAttribute('aria-expanded', d.open ? 'true' : 'false');
    if (wrap) summary.setAttribute('aria-controls', wrap.id);

    summary.addEventListener('click', (e) => {
      e.preventDefault(); // we drive open/close so the close can animate
      // An item mid-collapse still has [open]; treat it as closed so a click re-opens it.
      const isOpen = d.open && !d.classList.contains('closing');
      if (!isOpen) {
        items.forEach((o) => { if (o !== d) closeItem(o); });
        openItem(d);
      } else {
        closeItem(d);
      }
    });
  });
}

let revealIO;
// Single idempotent reveal path — shared by the scroll observer, the content-visibility fallback,
// and the WebKit viewport sweep below, so whichever fires first reveals the element and detaches
// the others.
function reveal(el) {
  el.classList.add('in');
  if (revealIO) revealIO.unobserve(el);
  el.removeEventListener('contentvisibilityautostatechange', onCVStateChange);
}
// content-visibility:auto can strand the reveal: on a JUMP scroll (refresh with scroll
// restoration, scrollbar drag, in-page anchor) a card can land in the viewport without giving
// IntersectionObserver a recompute, so it stays at opacity:0 forever. When the browser actually
// renders the element (skipped → false ⇒ it's near the viewport), reveal it. No-op on elements
// without content-visibility (the event never fires there), so the scroll stagger is preserved.
// NOTE: this event is Chromium-only — WebKit / iOS Safari rely on revealInView() below instead.
function onCVStateChange(e) { if (!e.skipped) reveal(e.currentTarget); }

// WebKit / iOS Safari jump-scroll & scroll-restoration fallback.
// `contentvisibilityautostatechange` is Chromium-only, so on WebKit nothing catches a section that
// lands in the viewport WITHOUT a scroll gesture — scroll restoration on reload, a bfcache restore
// (back/forward), a deep-link #anchor, or a programmatic jump. The IntersectionObserver never gets a
// recompute for it, so it stays at opacity:0 forever and the whole search bar + device grid vanish.
// Sweep on every event that follows such a jump and reveal anything already in (or entering) the
// viewport. Idempotent with the observer; `:not(.in)` keeps the normal scroll-stagger intact.
function revealInView() {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const toReveal = [];
  $$('.reveal:not(.in)').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > -1) toReveal.push(el);
  });
  toReveal.forEach((el) => reveal(el));
}
// Belt-and-suspenders for a stalled WebKit opacity transition: an element can carry `.in` yet still
// compute opacity:0 if the 0→1 transition never composited (seen after a scroll jump). Snap those
// in-view stragglers visible with a transition-free class — only fires on the timed/event sweeps,
// never per scroll frame, and never touches anything already painted.
function settleReveal() {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const toSettle = [];
  $$('.reveal.in:not(.reveal-shown)').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > -1 && getComputedStyle(el).opacity === '0') toSettle.push(el);
  });
  toSettle.forEach((el) => el.classList.add('reveal-shown'));
}
function initReveal() {
  revealIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) reveal(en.target); });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  observeReveal(document);

  // Drive the WebKit fallback from the events that follow a jump. rAF-throttled; passive listeners.
  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; revealInView(); }); };
  const settle = () => { revealInView(); settleReveal(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  addEventListener('hashchange', settle);
  addEventListener('pageshow', settle);   // bfcache restore (iOS back/forward) reinstates scroll first
  addEventListener('load', settle);
  // Scroll restoration is applied AFTER load on iOS, so a single pass can miss it — sweep a few times.
  settle();
  setTimeout(settle, 300);
  setTimeout(settle, 1200);
}
function observeReveal(root) {
  $$('.reveal:not(.in)', root).forEach((el) => {
    revealIO.observe(el);
    el.addEventListener('contentvisibilityautostatechange', onCVStateChange);
  });
  // A grid built while the viewport is already parked on it (jump/scroll-restore) needs an
  // immediate sweep — its cards were added after the load-time passes already ran.
  if (root !== document) revealInView();
}

// ---- utils ----
function debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }

// ===========================================================================
// PWA service worker
// ===========================================================================
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
