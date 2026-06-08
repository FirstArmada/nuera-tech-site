/* Gemini function-calling tools, resolved server-side against the pricing catalog.
 * Prices are passed through verbatim from pricing-data.json — the model never
 * invents them. Grouping mirrors groupRepairs() in assets/js/app.js, and booking
 * links mirror waLink()/bookMsg() so the assistant's handoff matches the site.
 */
import { ensureFresh, getDevice, searchModels, cleanVariant } from './catalog.js';

// Mirrors the `WA` const in assets/js/app.js (Rule 2 — number defined once there).
// Overridable via env so this stays the single knob if the proxy is reused.
const WA = process.env.WHATSAPP_NUMBER || '12269784666';
const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

// Group a device's repairs by chip, cheapest-first, de-duping identical options.
function groupByChip(repairs) {
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

// Mirrors bookMsg() in assets/js/app.js.
function bookMsg(r, model) {
  const v = cleanVariant(r.variant);
  const hasSave = r.mk_price != null && r.mk_price > 0 && r.savings != null && r.savings > 0;
  return `Hi Nuera Tech! I'd like to book:\n• ${r.repair_type}${v ? ' (' + v + ')' : ''} for my ${model}\n• Your price: $${Number(r.price).toFixed(2)}`
    + (hasSave ? `\n• (Typical price: $${Number(r.mk_price).toFixed(2)} — I save $${Math.round(r.savings)})` : '');
}

export const functionDeclarations = [
  {
    name: 'lookup_repair_price',
    description: "Look up Nuera Tech's repair prices for a specific device model. Returns cheapest-first options per repair type, including the typical-price comparison where one exists.",
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Exact or partial device model, e.g. "iPhone 14 Pro", "Pixel 8".' },
        repair_type: { type: 'string', enum: ['screen', 'battery', 'backglass', 'chargeport'], description: 'Optional repair category to filter to.' },
      },
      required: ['model'],
    },
  },
  {
    name: 'find_devices',
    description: 'Find device models Nuera repairs when the customer is vague or unsure of the exact name. Returns matching models with a starting price.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text, e.g. "samsung tab", "the small iphone".' },
        brand: { type: 'string', enum: ['iphone', 'samsung', 'pixel', 'ipad', 'samsung-tab'], description: 'Optional brand filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_booking_link',
    description: 'Build the WhatsApp booking deep link for a specific repair so the customer can book in one tap. Always use this to share a booking link.',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        repair_type: { type: 'string', enum: ['screen', 'battery', 'backglass', 'chargeport'] },
        variant: { type: 'string', description: 'Optional exact option/variant text.' },
      },
      required: ['model'],
    },
  },
];

function optionOut(r) {
  return {
    repair_type: r.repair_type,
    variant: cleanVariant(r.variant) || null,
    price: r.price,
    mk_price: r.mk_price ?? null,
    savings: r.savings ?? null,
    sku: r.sku,
  };
}

// Single best substring match, used as a fallback when there's no exact model hit.
function bestFuzzy(model) {
  const hits = searchModels(model);
  return hits.length === 1 ? hits[0] : null;
}

function lookupRepairPrice({ model, repair_type }) {
  const d = getDevice(model) || bestFuzzy(model);
  if (!d) return { matched: false, model, message: 'No exact match — call find_devices to list similar models.' };
  const grouped = groupByChip(d.repairs);
  const options = (repair_type ? (grouped[repair_type] || []) : Object.values(grouped).flat().sort((a, b) => a.price - b.price)).map(optionOut);
  return { matched: options.length > 0, model: d.model, brand: d.brand, options };
}

function findDevices({ query, brand }) {
  const devices = searchModels(query, brand).slice(0, 10).map((d) => {
    const prices = d.repairs.map((r) => r.price);
    return { model: d.model, brand: d.brand, from: Math.min(...prices), repair_types: [...new Set(d.repairs.map((r) => r.chip))] };
  });
  return { count: devices.length, devices };
}

function getBookingLink({ model, repair_type, variant }) {
  const d = getDevice(model) || bestFuzzy(model);
  if (!d) return { matched: false, url: waLink(`Hi Nuera Tech! I'd like to book a repair for my ${model}.`) };
  let r = null;
  if (repair_type) {
    const opts = groupByChip(d.repairs)[repair_type] || [];
    r = variant ? (opts.find((o) => cleanVariant(o.variant).toLowerCase() === String(variant).toLowerCase()) || opts[0]) : opts[0];
  }
  const url = r ? waLink(bookMsg(r, d.model)) : waLink(`Hi Nuera Tech! I'd like to book a repair for my ${d.model}.`);
  return { matched: true, model: d.model, url };
}

export async function resolveTool(name, args = {}) {
  await ensureFresh();
  if (name === 'lookup_repair_price') return lookupRepairPrice(args);
  if (name === 'find_devices') return findDevices(args);
  if (name === 'get_booking_link') return getBookingLink(args);
  return { error: `unknown tool: ${name}` };
}
