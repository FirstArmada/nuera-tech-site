/* Mobile Klinik comparison overlay.
 *
 * IMPORTANT: MK prices MUST come from an AUTHORIZED source — never a scraper.
 * (Mobile Klinik is a TELUS brand; use the sanctioned internal feed/sheet.)
 *
 * Default implementation reads a second Sheet/range via the same ADC path. If
 * MK_SHEET_ID / MK_SHEET_RANGE are not set, the overlay is empty and mk_price /
 * savings stay as the master sheet had them (typically null — sparse coverage is
 * expected and the site UI degrades gracefully). See cloud/infra/README.md.
 */
import { readSheetObjects } from './sheets.js';
import { round2 } from './transform.js';

export async function loadMkOverlay() {
  const sheetId = process.env.MK_SHEET_ID;
  const range = process.env.MK_SHEET_RANGE;
  if (!sheetId || !range) return new Map();

  const rows = await readSheetObjects(sheetId, range);
  const map = new Map();
  for (const row of rows) {
    const model = String(row[process.env.MK_COL_MODEL || 'Model'] || '').trim().toLowerCase();
    const chip = String(row[process.env.MK_COL_CHIP || 'Chip'] || '').trim().toLowerCase();
    const price = Number(String(row[process.env.MK_COL_PRICE || 'MK Price'] || '').replace(/[^0-9.\-]/g, ''));
    if (model && chip && Number.isFinite(price)) map.set(`${model}|${chip}`, price);
  }
  return map;
}

// Apply the overlay, recomputing savings. Rows without an authorized MK datapoint
// keep mk_price / savings = null.
export function applyMkOverlay(data, overlay) {
  if (!overlay || !overlay.size) return data;
  for (const r of data.repairs) {
    const mk = overlay.get(`${r.model.toLowerCase()}|${r.chip}`);
    if (mk != null && Number.isFinite(mk)) {
      r.mk_price = round2(mk);
      r.savings = round2(mk - r.price);
    }
  }
  return data;
}
