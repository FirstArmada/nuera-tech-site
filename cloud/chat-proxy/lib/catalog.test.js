import test from 'node:test';
import assert from 'node:assert';
import { searchModels, ensureFresh } from './catalog.js';

test('catalog - searchModels', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      repairs: [
        { brand: 'iphone', model: 'iPhone 12', chip: 'screen', price: 100 },
        { brand: 'iphone', model: 'iPhone 13', chip: 'battery', price: 80 },
        { brand: 'samsung', model: 'Galaxy S21', chip: 'screen', price: 150 },
      ]
    })
  });

  try {
    await ensureFresh();

    await t.test('finds models by query', () => {
      const results = searchModels('iphone');
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].model, 'iPhone 12');
      assert.strictEqual(results[1].model, 'iPhone 13');
    });

    await t.test('filters by brand', () => {
      const results = searchModels('', 'samsung');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].model, 'Galaxy S21');
      assert.strictEqual(results[0].brand, 'samsung');
    });

    await t.test('filters by query and brand', () => {
      const results = searchModels('12', 'iphone');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].model, 'iPhone 12');
    });

    await t.test('returns empty array when no match', () => {
      const results = searchModels('nokia');
      assert.strictEqual(results.length, 0);
    });

    await t.test('handles empty inputs', () => {
      const results = searchModels();
      assert.strictEqual(results.length, 3);
    });

    await t.test('is case insensitive', () => {
      const results = searchModels('IPHONE 13');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].model, 'iPhone 13');
    });

    await t.test('handles null/undefined gracefully', () => {
      const results1 = searchModels(null, null);
      assert.strictEqual(results1.length, 3);
      const results2 = searchModels(undefined, undefined);
      assert.strictEqual(results2.length, 3);
    });

  } finally {
    global.fetch = originalFetch;
  }
});
