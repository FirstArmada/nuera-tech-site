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

// ---- tiny DOM helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => '$' + Number(n).toFixed(Number.isInteger(n) ? 0 : 2);
const moneyExact = (n) => '$' + Number(n).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanVariant = (v) => (!v || v === '-' || v === '—' || v.trim() === '') ? '' : v.trim();
const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

// ---- state ----
const state = { devices: [], filtered: [], byModel: new Map(), brand: 'all', type: 'all', q: '', limit: 12 };

// ===========================================================================
// Boot
// ===========================================================================
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  const loadMoreBtn = $('#load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      state.limit += 12;
      renderGrid();
    });
  }
  initReveal();
  initScrollTop();
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
    renderStats(repairs);
    buildFilters();
    buildSpotlight();
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
  const withMk = repairs.filter((r) => r.mk_price != null && r.savings != null);
  const maxSaving = withMk.length ? Math.max(...withMk.map((r) => r.savings)) : 0;
  const avgPct = withMk.length
    ? Math.round(withMk.reduce((a, r) => a + (r.savings / r.mk_price) * 100, 0) / withMk.length)
    : 0;
  const top = [...withMk].sort((a, b) => b.savings - a.savings);
  return { withMk, maxSaving, avgPct, top };
}

function renderStats(repairs) {
  const { maxSaving, avgPct } = computeSavingsStats(repairs);
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('devices', state.devices.length);
  set('maxSaving', maxSaving ? money(Math.round(maxSaving)) : '—');
  set('avgPct', avgPct ? avgPct + '% less' : '—');

  // CTA headline uses the single best real comparison, computed at runtime
  const best = computeSavingsStats(repairs).top[0];
  if (best) {
    $('#cta-headline').textContent =
      `Why pay Mobile Klinik ${moneyExact(best.mk_price)} for a ${best.model} screen?`;
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
    state.limit = 12; // Reset limit on filter
    setPressed(brandWrap, btn);
    renderGrid();
  });
  typeWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]'); if (!btn) return;
    state.type = btn.dataset.type;
    state.limit = 12; // Reset limit on filter
    setPressed(typeWrap, btn);
    renderGrid();
  });

  // search
  const input = $('#search');
  const clear = $('#search-clear');
  const onSearch = debounce(() => {
    state.q = input.value.trim().toLowerCase();
    state.limit = 12; // Reset limit on search
    clear.classList.toggle('show', input.value.length > 0);
    renderGrid();
  }, 110);
  input.addEventListener('input', onSearch);
  clear.addEventListener('click', () => { input.value = ''; state.q = ''; state.limit = 12; clear.classList.remove('show'); renderGrid(); input.focus(); });

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
  const loadMoreBtn = $('#load-more');
  const { brand, type, q, limit } = state;

  const list = state.devices.filter((d) =>
    (brand === 'all' || d.brand === brand) &&
    (type === 'all' || d.types.has(type)) &&
    (!q || d.search.includes(q)));
  state.filtered = list;

  grid.setAttribute('aria-busy', 'false');
  if (!list.length) {
    grid.innerHTML = `<div class="empty">
      <p style="font-weight:700;font-size:1.1rem;color:var(--text)">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" style="margin-top:14px" href="${waLink('Hi Nuera Tech! Do you repair: ' + (q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>
    </div>`;
  } else {
    const visibleList = list.slice(0, limit);
    grid.innerHTML = visibleList.map(cardHTML).join('');
    if (list.length > limit) {
      loadMoreBtn.style.display = 'inline-flex';
    } else {
      loadMoreBtn.style.display = 'none';
    }
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
    <span class="card-view">View ${d.repairs.length} repair${d.repairs.length === 1 ? '' : 's'}
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
  $('#grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    openDevice(card.dataset.model, card);
  });
  $('#detail-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  dlg.addEventListener('close', () => { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
}

function openDevice(model, trigger) {
  const d = state.byModel.get(model); if (!d) return;
  lastFocus = trigger || document.activeElement;
  $('#detail-title').textContent = d.model;
  const cnt = d.repairs.length;
  $('#detail-sub').textContent = `${cnt} repair${cnt === 1 ? '' : 's'} · ${brandLabel(d.brand)} · from ${moneyExact(d.minPrice)}`;

  // order: screen, battery, backglass, chargeport, then price
  const order = { screen: 0, battery: 1, backglass: 2, chargeport: 3 };
  const rows = [...d.repairs].sort((a, b) => (order[a.chip] - order[b.chip]) || (a.price - b.price));

  $('#detail-body').innerHTML = rows.map((r) => rowHTML(r, d.model)).join('');

  const allMsg = `Hi Nuera Tech! I'd like to book a repair for my ${d.model}.`;
  $('#detail-book-all').href = waLink(allMsg);

  $('#detail').showModal();
  $('#detail-body').scrollTop = 0;
}

function rowHTML(r, model) {
  const v = cleanVariant(r.variant);
  const hasSave = r.mk_price != null && r.savings != null && r.savings > 0;
  const compare = hasSave
    ? `<div class="compare"><span class="mk">MK ${moneyExact(r.mk_price)}</span><span class="save">Save ${money(Math.round(r.savings))} · ${Math.round((r.savings / r.mk_price) * 100)}% less</span></div>`
    : '';
  const parts = [`${r.repair_type}${v ? ' — ' + v : ''}`, `Nuera price ${moneyExact(r.price)}`];
  if (hasSave) parts.push(`Mobile Klinik ${moneyExact(r.mk_price)} — I save ${money(Math.round(r.savings))}`);
  const msg = `Hi Nuera Tech! I'd like to book:\n• ${r.repair_type}${v ? ' (' + v + ')' : ''} for my ${model}\n• Your price: ${moneyExact(r.price)}` + (hasSave ? `\n• (Mobile Klinik: ${moneyExact(r.mk_price)} — I save ${money(Math.round(r.savings))})` : '');
  return `<div class="rrow">
    <div class="info">
      <div class="rtype">${esc(r.repair_type)}</div>
      ${v ? `<div class="rvar">${esc(v)}</div>` : ''}
      ${compare}
    </div>
    <div class="right">
      <div class="price"><span class="cur">$</span>${Number(r.price).toFixed(2)}</div>
      <a class="book" href="${waLink(msg)}" target="_blank" rel="noopener" aria-label="Book ${esc(r.repair_type)} for ${esc(model)} on WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.768-.967z"/></svg>
        Book
      </a>
    </div>
  </div>`;
}

// ===========================================================================
// Savings spotlight (interactive bar comparison)
// ===========================================================================
function buildSpotlight() {
  const repairs = state.devices.flatMap((d) => d.repairs);
  const { top } = computeSavingsStats(repairs);
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
    $('#spot-save').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> You save ${money(Math.round(r.savings))} · ${Math.round((r.savings / r.mk_price) * 100)}% less`;
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
