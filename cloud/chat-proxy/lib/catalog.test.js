/* Hermetic unit tests for the pricing catalog index.
 *
 * Run: `node --test cloud/chat-proxy/lib/` (or `npm test` in cloud/chat-proxy).
 * No network and no external deps — global.fetch is stubbed with a fixture so
 * ensureFresh() populates the in-memory cache deterministically.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureFresh, getDevice, groupByChip } from './catalog.js';

const FIXTURE = {
  repairs: [
    { model: 'iPhone 13', brand: 'iphone', chip: 'screen', repair_type: 'Screen Replacement', variant: 'Standard', price: 120, mk_price: 200, savings: 80, sku: 'A1' },
    { model: 'iPhone 13', brand: 'iphone', chip: 'screen', repair_type: 'Screen Replacement', variant: 'Premium', price: 160, mk_price: null, savings: null, sku: 'A2' },
    { model: 'iPhone 13', brand: 'iphone', chip: 'battery', repair_type: 'Battery Replacement', variant: '', price: 80, mk_price: null, savings: null, sku: 'A3' },
    { model: 'Galaxy S21', brand: 'samsung', chip: 'battery', repair_type: 'Battery Replacement', variant: '', price: 90, mk_price: null, savings: null, sku: 'B1' },
  ],
};

test('catalog index — getDevice + cached groupedRepairs', async (t) => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
  t.after(() => { global.fetch = realFetch; });
  await ensureFresh();

  await t.test('exact and case-insensitive model lookup', () => {
    assert.equal(getDevice('iphone 13')?.model, 'iPhone 13');
    assert.equal(getDevice('IPHONE 13')?.model, 'iPhone 13');
    assert.equal(getDevice('Galaxy S21')?.brand, 'samsung');
  });

  await t.test('returns null for unknown, empty, and nullish input', () => {
    assert.equal(getDevice('Nokia 3310'), null);
    assert.equal(getDevice(''), null);
    assert.equal(getDevice(null), null);
    assert.equal(getDevice(undefined), null);
  });

  await t.test('groupedRepairs is precomputed, chip-keyed, cheapest-first', () => {
    const d = getDevice('iPhone 13');
    assert.ok(d.groupedRepairs, 'device carries a precomputed groupedRepairs');
    assert.equal(d.groupedRepairs.screen.length, 2);
    assert.equal(d.groupedRepairs.screen[0].price, 120); // cheapest first
    assert.equal(d.groupedRepairs.screen[1].price, 160);
    assert.equal(d.groupedRepairs.battery[0].price, 80);
  });
});

test('groupByChip de-dupes identical options down to the cheapest', () => {
  const grouped = groupByChip([
    { chip: 'screen', repair_type: 'Screen Replacement', variant: 'Standard', price: 150 },
    { chip: 'screen', repair_type: 'Screen Replacement', variant: 'Standard', price: 120 },
    { chip: 'battery', repair_type: 'Battery Replacement', variant: '', price: 70 },
  ]);
  assert.equal(grouped.screen.length, 1, 'identical screen options collapse to one');
  assert.equal(grouped.screen[0].price, 120, 'kept the cheaper duplicate');
  assert.equal(grouped.battery[0].price, 70);
});
