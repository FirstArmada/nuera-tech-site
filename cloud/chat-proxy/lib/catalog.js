/* Pricing catalog: load + index the SAME pricing-data.json the website renders,
 * so the assistant quotes match the page (Rule 1).
 *
 * We read the canonical file from GitHub raw (the source of truth) rather than the
 * deployed site, because the site sits behind Cloudflare Access. Refreshed on a TTL
 * so a merged pricing-sync PR is picked up without redeploying the proxy.
 */
const PRICING_URL = process.env.PRICING_DATA_URL
  || 'https://raw.githubusercontent.com/FirstArmada/nuera-tech-site/main/pricing-data.json';
const TTL_MS = Number(process.env.PRICING_TTL_MS || 600000);

export const BRAND_LABEL = { iphone: 'iPhone', samsung: 'Samsung', pixel: 'Pixel', ipad: 'iPad', 'samsung-tab': 'Samsung Tab' };
export const CHIP_LABEL = { screen: 'Screen', battery: 'Battery', backglass: 'Back Glass', chargeport: 'Charge Port' };

// Mirrors cleanVariant() in assets/js/app.js.
export const cleanVariant = (v) => (!v || v === '-' || v === '—' || String(v).trim() === '') ? '' : String(v).trim();

// Group a device's repairs by chip, cheapest-first, de-duping identical options.
// Mirrors groupRepairs() in assets/js/app.js. Precomputed once per catalog load in
// buildIndex() and cached on each device as `groupedRepairs`, so the per-request tools
// (lookup_repair_price / get_booking_link) reuse it instead of regrouping on every call.
export function groupByChip(repairs) {
  const byChip = new Map();
  for (const r of repairs) {
    if (!byChip.has(r.chip)) byChip.set(r.chip, new Map());
    const key = r.repair_type.toLowerCase() + '|' + cleanVariant(r.variant).toLowerCase();
    const cur = byChip.get(r.chip).get(key);
    if (!cur || r.price < cur.price) byChip.get(r.chip).set(key, r);
  }
  const out = {};
  for (const [chip, m] of byChip) out[chip] = [...m.values()].sort((a, b) => a.price - b.price);
  return out;
}

let cache = { at: 0, repairs: [], byModel: new Map(), summary: null };
let inflight = null;

function buildIndex(repairs) {
  const byModel = new Map();
  const brandsSet = new Set();
  const chipsSet = new Set();
  let low = Infinity;
  let high = -Infinity;
  let hasPrice = false;
  // Single pass: group by model, collect the brand/chip sets, and track the price range.
  for (const r of repairs) {
    const key = String(r.model).toLowerCase();
    if (!byModel.has(key)) byModel.set(key, { model: r.model, brand: r.brand, repairs: [] });
    byModel.get(key).repairs.push(r);
    brandsSet.add(r.brand);
    chipsSet.add(r.chip);
    if (typeof r.price === 'number') {
      if (r.price < low) low = r.price;
      if (r.price > high) high = r.price;
      hasPrice = true;
    }
  }
  // Precompute each device's chip-grouped, cheapest-first options once at load time.
  for (const d of byModel.values()) d.groupedRepairs = groupByChip(d.repairs);
  const summary = {
    deviceCount: byModel.size,
    repairCount: repairs.length,
    brands: [...brandsSet].map((b) => BRAND_LABEL[b] || b),
    repairTypes: [...chipsSet].map((c) => CHIP_LABEL[c] || c),
    priceRange: hasPrice ? { low, high } : null,
  };
  return { byModel, summary };
}

async function refresh() {
  const res = await fetch(PRICING_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`pricing fetch HTTP ${res.status}`);
  const data = await res.json();
  const repairs = Array.isArray(data?.repairs) ? data.repairs : [];
  if (!repairs.length) throw new Error('pricing data has no repairs');
  cache = { at: Date.now(), repairs, ...buildIndex(repairs) };
  return cache;
}

// Ensure the catalog is loaded and fresh. Serves stale data if a refresh fails.
export async function ensureFresh() {
  if (cache.repairs.length && Date.now() - cache.at < TTL_MS) return cache;
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  try {
    return await inflight;
  } catch (e) {
    if (cache.repairs.length) return cache; // serve stale rather than fail
    throw e;
  }
}

export function getDevice(model) {
  return cache.byModel.get(String(model || '').toLowerCase()) || null;
}

export function searchModels(query, brand) {
  const q = String(query || '').toLowerCase().trim();
  let list = [...cache.byModel.values()];
  if (brand) list = list.filter((d) => d.brand === brand);
  if (q) list = list.filter((d) => d.model.toLowerCase().includes(q));
  return list;
}

export function summary() { return cache.summary; }
