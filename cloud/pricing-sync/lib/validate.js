/* Validation gate before any PR is opened. Mirrors the JSON-parse check the
 * SessionStart hook runs, plus structural assertions and a count-sanity check
 * against the currently committed file (catches a truncated/empty sheet read).
 */
import { BRANDS, CHIPS } from './transform.js';

export function validate(data, prev) {
  JSON.parse(JSON.stringify(data)); // round-trips → catches non-serializable values

  if (!data || typeof data !== 'object') throw new Error('not an object');
  if (typeof data.generated !== 'string') throw new Error('missing "generated" date');
  if (typeof data.source !== 'string') throw new Error('missing "source"');
  if (!Array.isArray(data.repairs) || !data.repairs.length) throw new Error('repairs[] is empty');

  data.repairs.forEach((r, i) => {
    const at = `repairs[${i}]`;
    for (const f of ['model', 'repair_type', 'variant', 'sku']) {
      if (typeof r[f] !== 'string') throw new Error(`${at}.${f} must be a string`);
    }
    if (!BRANDS.includes(r.brand)) throw new Error(`${at}.brand "${r.brand}" not in ${BRANDS.join('|')}`);
    if (!CHIPS.includes(r.chip)) throw new Error(`${at}.chip "${r.chip}" not in ${CHIPS.join('|')}`);
    if (typeof r.price !== 'number' || !(r.price > 0)) throw new Error(`${at}.price must be a positive number`);
    if (r.mk_price !== null && typeof r.mk_price !== 'number') throw new Error(`${at}.mk_price must be number|null`);
    if (r.savings !== null && typeof r.savings !== 'number') throw new Error(`${at}.savings must be number|null`);
  });

  if (prev && Array.isArray(prev.repairs) && prev.repairs.length) {
    const ratio = data.repairs.length / prev.repairs.length;
    if (ratio < 0.8 || ratio > 1.2) {
      throw new Error(`repair count ${data.repairs.length} differs >20% from current ${prev.repairs.length} — aborting`);
    }
  }
  return true;
}
