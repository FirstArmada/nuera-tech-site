/* Nuera Tech — runtime app
 * Pricing is fetched at runtime from /pricing-data.json and never baked into HTML (Rule 1).
 * WhatsApp number is fixed at +1 226 978 4666 (Rule 2).
 */
const WA = '12269784666';
const DATA_URL = '/pricing-data.json';

const BRANDS = [
  { id: 'all', label: 'All' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'ipad', label: 'iPad' },
  { id: 'samsung-tab', label: 'Samsung Tab' },
];
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

// Inline SVG glyph reused on every WhatsApp "Book" link (keeps us off icon CDNs).
const WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.768-.967z"/></svg>';

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

// ---- tiny DOM helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => '$' + Number(n).toFixed(Number.isInteger(n) ? 0 : 2);
const moneyExact = (n) => '$' + Number(n).toFixed(2);
// Percent cheaper than the compared (Mobile Klinik) price. Callers guard base > 0.
const pctLess = (saved, base) => Math.round((saved / base) * 100);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanVariant = (v) => (!v || v === '-' || v === '—' || v.trim() === '') ? '' : v.trim();
const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Pull a paint colour out of a back-glass variant string, e.g.
// "Back Glass (No Logo) — Titanium Natural" → { name:"Titanium Natural", hex:"#b9a894" }.
// Returns null when no known colour is found (caller falls back to text chips).
function parseColor(variant) {
  const v = cleanVariant(variant);
  if (!v) return null;
  const parts = v.split(/—|–/); // text after the last em/en dash carries the colour
  const seg = parts[parts.length - 1].replace(/\(.*?\)/g, ' ').replace(/no logo|large camera hole|back glass|service pack/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!seg) return null;
  const low = seg.toLowerCase();
  // longest key first so "titanium black" wins over "black"
  const keys = Object.keys(SWATCH_COLORS).sort((a, b) => b.length - a.length);
  for (const k of keys) if (low.includes(k)) return { name: seg, hex: SWATCH_COLORS[k] };
  return null;
}

// Short label for a quality/grade tier chip (screen & battery options).
// The full variant text is still shown as the group subtitle and in the booking message.
function tierLabel(r) {
  const original = cleanVariant(r.variant);
  if (!original) return 'Standard';
  const dash = original.match(/^.*?[—–]\s*(.+)$/); // descriptor after the first em/en dash
  let v;
  if (dash) {
    v = dash[1].trim();
    if (v.includes(' / ') && !v.includes('(')) v = v.split(' / ')[0].trim(); // drop "/ SOH 99–100%" specs
  } else {
    // No dash: strip only a bare leading repair noun, keep the distinguishing remainder.
    let s = original.replace(/^(screen assembly|screen|battery|charge port)\b\s*/i, '').trim();
    if (!s) return 'Standard';                       // variant was just "Battery", "Screen", …
    if (/^\(.*\)$/.test(s)) s = s.slice(1, -1).trim();           // "(AMP)" → "AMP"
    else if (s.includes(' (')) s = s.slice(0, s.indexOf(' (')).trim(); // "Inner Display (Main)" → "Inner Display"
    v = s;
  }
  if (!v) return 'Standard';
  return v.length > 30 ? v.slice(0, 29).trim() + '…' : v;
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
const state = { devices: [], byModel: new Map(), brand: 'all', type: 'all', q: '', groups: [], openModel: null };

// ===========================================================================
// Boot
// ===========================================================================
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  initReveal();
  initScrollTop();
  initHeader();
  initFaq();
  initWhatsAppDefaults();
  initDialog();
  loadData();
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
    const stats = computeSavingsStats(repairs);
    renderStats(stats);
    buildFilters();
    buildSpotlight(stats);
    renderGrid();
    injectPriceSchema(repairs);
  } catch (err) {
    console.error('[nuera] failed to load pricing:', err);
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `<div class="errorbox">
      <p style="font-weight:700;font-size:1.05rem">We couldn't load live pricing right now.</p>
      <p style="color:var(--muted)">Please refresh, or message us and we'll quote you directly.</p>
      <a class="btn btn-wa" style="margin-top:14px" href="${waLink("Hi Nuera Tech! I'd like a repair quote.")}" target="_blank" rel="noopener">Message us on WhatsApp</a>
    </div>`;
    $('#result-count').textContent = 'Pricing unavailable';
  }
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
    d.minPrice = Math.min(...d.repairs.map((r) => r.price));
    d.maxSaving = Math.max(0, ...d.repairs.map((r) => r.savings || 0));
    d.search = d.model.toLowerCase();
  }
  state.byModel = map;
  state.devices = [...map.values()];
}

// ===========================================================================
// Hero stats (runtime) + CTA copy + spotlight source
// ===========================================================================
function computeSavingsStats(repairs) {
  const withMk = repairs.filter((r) => r.mk_price != null && r.mk_price > 0 && r.savings != null);
  const maxSaving = withMk.length ? Math.max(...withMk.map((r) => r.savings)) : 0;
  const avgPct = withMk.length
    ? Math.round(withMk.reduce((a, r) => a + pctLess(r.savings, r.mk_price), 0) / withMk.length)
    : 0;
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
      `Why pay Mobile Klinik ${moneyExact(best.mk_price)} for a ${best.model} ${what}?`;
    $('#cta-sub').textContent =
      `Nuera does it for ${moneyExact(best.price)} — that's ${money(Math.round(best.savings))} back in your pocket, same quality parts. Find your device and book in under a minute.`;
  }
}

// ===========================================================================
// Filters
// ===========================================================================
function buildFilters() {
  const counts = (key, val) => state.devices.filter((d) =>
    key === 'brand' ? (val === 'all' || d.brand === val)
                    : (val === 'all' || d.types.has(val))).length;

  const brandWrap = $('#brand-filters');
  brandWrap.innerHTML = BRANDS
    .filter((b) => b.id === 'all' || state.devices.some((d) => d.brand === b.id))
    .map((b) => `<button class="pill" type="button" role="button" data-brand="${b.id}" aria-pressed="${b.id === 'all'}">${b.label}<span class="cnt">${counts('brand', b.id)}</span></button>`)
    .join('');

  const typeWrap = $('#type-filters');
  typeWrap.innerHTML = TYPES
    .filter((t) => t.id === 'all' || state.devices.some((d) => d.types.has(t.id)))
    .map((t) => `<button class="pill rt" type="button" role="button" data-type="${t.id}" aria-pressed="${t.id === 'all'}">${t.label}</button>`)
    .join('');

  brandWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-brand]'); if (!btn) return;
    state.brand = btn.dataset.brand;
    setPressed(brandWrap, btn);
    renderGrid();
  });
  typeWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]'); if (!btn) return;
    state.type = btn.dataset.type;
    setPressed(typeWrap, btn);
    renderGrid();
  });

  // search
  const input = $('#search');
  const clear = $('#search-clear');
  const onSearch = debounce(() => {
    state.q = input.value.trim().toLowerCase();
    clear.classList.toggle('show', input.value.length > 0);
    renderGrid();
  }, 110);
  input.addEventListener('input', onSearch);
  clear.addEventListener('click', () => { input.value = ''; state.q = ''; clear.classList.remove('show'); renderGrid(); input.focus(); });

  // Deep link ?q= (WebSite SearchAction)
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) { input.value = urlQ; state.q = urlQ.trim().toLowerCase(); clear.classList.add('show'); }
}

function setPressed(wrap, active) {
  $$('.pill', wrap).forEach((p) => p.setAttribute('aria-pressed', String(p === active)));
}

// ===========================================================================
// Grid
// ===========================================================================
function renderGrid() {
  const grid = $('#grid');
  const { brand, type, q } = state;
  const list = state.devices.filter((d) =>
    (brand === 'all' || d.brand === brand) &&
    (type === 'all' || d.types.has(type)) &&
    (!q || d.search.includes(q)));

  grid.setAttribute('aria-busy', 'false');
  if (!list.length) {
    grid.innerHTML = `<div class="empty">
      <p style="font-weight:700;font-size:1.1rem;color:var(--text)">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" style="margin-top:14px" href="${waLink('Hi Nuera Tech! Do you repair: ' + (q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>
    </div>`;
  } else {
    grid.innerHTML = list.map(cardHTML).join('');
  }
  observeReveal(grid);

  const count = $('#result-count');
  count.textContent = list.length
    ? `${list.length} device${list.length === 1 ? '' : 's'}`
      + (brand !== 'all' ? ` · ${BRANDS.find((b) => b.id === brand)?.label}` : '')
      + (q ? ` · “${state.q}”` : '')
    : 'No matches';
  $('#result-hint').textContent = list.length ? 'Tap a device for full pricing' : '';
}

function cardHTML(d) {
  const chips = [...d.types].map((t) => `<span class="rt-chip ${t}">${CHIP_LABEL[t] || t}</span>`).join('');
  const save = d.maxSaving > 0
    ? `<div class="save-tag">save up to ${money(Math.round(d.maxSaving))}<span>vs Mobile Klinik</span></div>`
    : '';
  return `<button class="card reveal" type="button" data-model="${esc(d.model)}" aria-label="View pricing for ${esc(d.model)}">
    <div class="card-top">
      <span class="card-model">${esc(d.model)}</span>
      <span class="brand-tag">${brandLabel(d.brand)}</span>
    </div>
    <div class="rt-chips">${chips}</div>
    <div class="card-foot">
      <span class="from">from<b>${moneyExact(d.minPrice)}</b></span>
      ${save}
    </div>
    <span class="card-view">View pricing &amp; options
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </span>
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
  $('#detail-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  dlg.addEventListener('close', () => { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });

  // Option/colour picking is event-delegated so it survives each re-render.
  body.addEventListener('click', (e) => {
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

  $('#detail-title').textContent = d.model;
  const gc = groups.length;
  $('#detail-sub').textContent =
    `${gc} repair type${gc === 1 ? '' : 's'} · ${brandLabel(d.brand)} · from ${moneyExact(d.minPrice)}`;
  $('#detail-body').innerHTML = groups.map((g, i) => groupHTML(g, i, d.model)).join('');

  $('#detail-book-all').href = waLink(`Hi Nuera Tech! I'd like to book a repair for my ${d.model}.`);
  $('#detail').showModal();
  $('#detail-body').scrollTop = 0;
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
    ? `<span class="mk">Mobile Klinik ${moneyExact(r.mk_price)}</span><span class="save">Save ${money(Math.round(r.savings))} · ${pctLess(r.savings, r.mk_price)}% less</span>`
    : '';
}

function bookMsg(r, model) {
  const v = cleanVariant(r.variant);
  const hasSave = r.mk_price != null && r.mk_price > 0 && r.savings != null && r.savings > 0;
  return `Hi Nuera Tech! I'd like to book:\n• ${r.repair_type}${v ? ' (' + v + ')' : ''} for my ${model}\n• Your price: ${moneyExact(r.price)}`
    + (hasSave ? `\n• (Mobile Klinik: ${moneyExact(r.mk_price)} — I save ${money(Math.round(r.savings))})` : '');
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
    return `<button class="opt" type="button" role="radio" aria-checked="${o === g.selected}" tabindex="${o === g.selected ? 0 : -1}" data-g="${gi}" data-o="${o}">${flag}<span class="opt-label">${esc(tierLabel(r))}</span><span class="opt-price">${moneyExact(r.price)}</span></button>`;
  }).join('');
  return `<div class="opts" role="radiogroup" aria-label="${esc(g.rtype)} options">${chips}</div>`;
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
          <a class="book" data-book="${gi}" href="${waLink(bookMsg(r, model))}" target="_blank" rel="noopener" aria-label="Book ${esc(g.rtype)} for ${esc(model)} on WhatsApp">${WA_SVG}Book</a>
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
  set(`[data-book="${gi}"]`, (el) => { el.href = waLink(bookMsg(r, state.openModel)); });
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
    $('#spot-device').textContent = `${r.model} — ${r.repair_type}`;
    $('#spot-sub').textContent = 'Same quality parts. Same repair. One honest price.';
    $('#spot-save').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> You save ${money(Math.round(r.savings))} · ${pctLess(r.savings, r.mk_price)}% less`;
    const max = r.mk_price;
    $('#spot-bars').innerHTML = `
      <div class="bar-row"><span class="bar-name">Mobile Klinik</span><div class="bar-track"><div class="bar-fill bar-mk" data-w="100">${moneyExact(r.mk_price)}</div></div></div>
      <div class="bar-row"><span class="bar-name">Nuera</span><div class="bar-track"><div class="bar-fill bar-nuera" data-w="${(r.price / max) * 100}">${moneyExact(r.price)}</div></div></div>`;
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
    ents.forEach((en) => { if (en.isIntersecting) { show(0); io.disconnect(); } });
  }, { threshold: 0.3 });
  io.observe(card);
}

// ===========================================================================
// Runtime price-bearing structured data (kept out of static HTML per Rule 1)
// ===========================================================================
function injectPriceSchema(repairs) {
  const prices = repairs.map((r) => r.price).filter((n) => typeof n === 'number');
  if (!prices.length) return;
  const node = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Phone & tablet repair — Guelph',
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
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(node);
  document.head.appendChild(s);
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
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
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

  const closeItem = (d) => {
    $('summary', d).setAttribute('aria-expanded', 'false');
    const wrap = $('.qa-wrap', d);
    if (reduce || !wrap) { d.open = false; return; }
    // Let the 0fr collapse animation play, then drop the [open] attribute.
    const done = () => { d.open = false; wrap.removeEventListener('transitionend', done); };
    wrap.addEventListener('transitionend', done);
    setTimeout(() => { if (d.open) { d.open = false; wrap.removeEventListener('transitionend', done); } }, 350);
  };

  items.forEach((d) => {
    const summary = $('summary', d);
    const wrap = $('.qa-wrap', d);
    if (wrap && !wrap.id) wrap.id = 'qa-body-' + Math.random().toString(36).slice(2, 8);
    summary.setAttribute('aria-expanded', d.open ? 'true' : 'false');
    if (wrap) summary.setAttribute('aria-controls', wrap.id);

    summary.addEventListener('click', (e) => {
      e.preventDefault(); // we drive open/close so the close can animate
      if (!d.open) {
        items.forEach((o) => { if (o !== d && o.open) closeItem(o); });
        d.open = true;
        summary.setAttribute('aria-expanded', 'true');
      } else {
        closeItem(d);
      }
    });
  });
}

let revealIO;
function initReveal() {
  revealIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  observeReveal(document);
}
function observeReveal(root) { $$('.reveal:not(.in)', root).forEach((el) => revealIO.observe(el)); }

// ---- utils ----
function debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }

// ===========================================================================
// PWA service worker
// ===========================================================================
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
