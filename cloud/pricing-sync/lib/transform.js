/* Transform Master Price List rows → the exact pricing-data.json shape the site
 * expects: { generated, source, repairs: [{ model, repair_type, variant, brand,
 * chip, price, mk_price, savings, sku }] }. Every field + type preserved.
 *
 * Column headers vary per sheet, so the mapping is configurable via env. Set these
 * to match your sheet's actual header text (see cloud/infra/README.md).
 */
const COLUMN_MAP = {
  model: process.env.COL_MODEL || 'Model',
  repair_type: process.env.COL_REPAIR_TYPE || 'Repair Type',
  variant: process.env.COL_VARIANT || 'Variant',
  brand: process.env.COL_BRAND || 'Brand',
  chip: process.env.COL_CHIP || 'Chip',
  price: process.env.COL_PRICE || 'Price',
  mk_price: process.env.COL_MK_PRICE || 'MK Price',
  sku: process.env.COL_SKU || 'SKU',
};

export const BRANDS = ['iphone', 'samsung', 'pixel', 'ipad', 'samsung-tab'];
export const CHIPS = ['screen', 'battery', 'backglass', 'chargeport'];
export const round2 = (n) => Math.round(n * 100) / 100;
export const pctLess = (saved, base) => Math.round((saved / base) * 100);

// Precompute the savings view-model the site renders (hero stats, CTA copy, the
// spotlight's top comparisons) so the browser doesn't re-derive it on every load.
// Mirrors app.js computeSavingsStats exactly; app.js falls back to deriving when absent.
export function computeStats(repairs) {
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
  const top = [...withMk]
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 6)
    .map(({ model, repair_type, chip, price, mk_price, savings }) =>
      ({ model, repair_type, chip, price, mk_price, savings }));
  return { maxSaving, avgPct, top };
}

function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// NueraExpress — the premium "same-day, on-site (we come to you), urgent" tier.
// It is a flat per-visit priority surcharge over the standard price, configured here
// (env-driven, mirroring COLUMN_MAP) and consumed at runtime by app.js. Kept in the
// data file — not hardcoded in HTML — so the surcharge/copy stays editable via the
// sheet/job config without a code change (Rule 1). app.js carries a fallback.
export function expressConfig() {
  return {
    enabled: (process.env.EXPRESS_ENABLED ?? 'true') !== 'false',
    surcharge: num(process.env.EXPRESS_SURCHARGE) ?? 49, // flat per-visit priority fee (CAD)
    label: 'NueraExpress',
    tagline: 'Same-day · on-site · urgent',
    eta: 'Same-day — we come to you',
    area: process.env.EXPRESS_AREA || 'Guelph & nearby (Wellington County)',
  };
}

// Fallbacks only used when the sheet has no explicit brand/chip column.
function deriveBrand(model, given) {
  const g = String(given || '').toLowerCase().trim();
  if (BRANDS.includes(g)) return g;
  const m = String(model).toLowerCase();
  if (m.includes('ipad')) return 'ipad';
  if (m.includes('iphone')) return 'iphone';
  if (m.includes('pixel')) return 'pixel';
  if (m.includes('tab')) return 'samsung-tab';
  if (m.includes('galaxy') || m.includes('samsung')) return 'samsung';
  return g || 'iphone';
}
function deriveChip(repairType, given) {
  const g = String(given || '').toLowerCase().trim();
  if (CHIPS.includes(g)) return g;
  const t = String(repairType).toLowerCase();
  if (t.includes('back glass') || t.includes('backglass')) return 'backglass';
  if (t.includes('charge') || t.includes('port')) return 'chargeport';
  if (t.includes('batter')) return 'battery';
  return 'screen';
}

export function transform(rows, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const repairs = [];
  for (const row of rows) {
    const model = String(row[COLUMN_MAP.model] || '').trim();
    const repair_type = String(row[COLUMN_MAP.repair_type] || '').trim();
    const price = num(row[COLUMN_MAP.price]);
    if (!model || !repair_type || price == null) continue; // skip incomplete rows

    const mk_price = num(row[COLUMN_MAP.mk_price]);
    repairs.push({
      model,
      repair_type,
      variant: String(row[COLUMN_MAP.variant] || '').trim(),
      brand: deriveBrand(model, row[COLUMN_MAP.brand]),
      chip: deriveChip(repair_type, row[COLUMN_MAP.chip]),
      price,
      mk_price,
      savings: mk_price != null ? round2(mk_price - price) : null,
      sku: String(row[COLUMN_MAP.sku] || '').trim(),
    });
  }
  return { generated: date, source: 'Google Sheets — Master Price List', repairs, stats: computeStats(repairs), express: expressConfig() };
}
