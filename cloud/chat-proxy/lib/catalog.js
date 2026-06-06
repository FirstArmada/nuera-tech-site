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

let cache = { at: 0, repairs: [], byModel: new Map(), summary: null };
let inflight = null;

function buildIndex(repairs) {
  const byModel = new Map();
  for (const r of repairs) {
    const key = String(r.model).toLowerCase();
    if (!byModel.has(key)) byModel.set(key, { model: r.model, brand: r.brand, repairs: [] });
    byModel.get(key).repairs.push(r);
  }
  const brands = [...new Set(repairs.map((r) => r.brand))];
  const chips = [...new Set(repairs.map((r) => r.chip))];
  const prices = repairs.map((r) => r.price).filter((n) => typeof n === 'number');
  const summary = {
    deviceCount: byModel.size,
    repairCount: repairs.length,
    brands: brands.map((b) => BRAND_LABEL[b] || b),
    repairTypes: chips.map((c) => CHIP_LABEL[c] || c),
    priceRange: prices.length ? { low: Math.min(...prices), high: Math.max(...prices) } : null,
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
