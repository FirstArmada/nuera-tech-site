import test from 'node:test';
import assert from 'node:assert';
import { transform, computeStats } from '../lib/transform.js';

test('transform', async (t) => {
  await t.test('maps valid rows correctly', () => {
    const rows = [
      {
        Model: 'iPhone 13',
        'Repair Type': 'Screen Replacement',
        Variant: 'A2633',
        Brand: 'iphone',
        Chip: 'screen',
        Price: '$150.00',
        'MK Price': '$200.00',
        SKU: 'IP13-SCR'
      }
    ];

    const result = transform(rows, { date: '2024-01-01' });

    assert.strictEqual(result.generated, '2024-01-01');
    assert.strictEqual(result.repairs.length, 1);

    const repair = result.repairs[0];
    assert.strictEqual(repair.model, 'iPhone 13');
    assert.strictEqual(repair.repair_type, 'Screen Replacement');
    assert.strictEqual(repair.variant, 'A2633');
    assert.strictEqual(repair.brand, 'iphone');
    assert.strictEqual(repair.chip, 'screen');
    assert.strictEqual(repair.price, 150);
    assert.strictEqual(repair.mk_price, 200);
    assert.strictEqual(repair.savings, 50);
    assert.strictEqual(repair.sku, 'IP13-SCR');
  });

  await t.test('skips incomplete rows', () => {
    const rows = [
      { Model: '', 'Repair Type': 'Screen', Price: '100' }, // missing model
      { Model: 'iPhone 12', 'Repair Type': '', Price: '100' }, // missing repair_type
      { Model: 'iPhone 12', 'Repair Type': 'Screen', Price: '' }, // missing price
      { Model: 'iPhone 12', 'Repair Type': 'Screen', Price: null }, // null price
      // { Model: 'iPhone 12', 'Repair Type': 'Screen', Price: 'N/A' }, // Actually parses to 0 or null depending on logic
      { Model: 'iPhone 12', 'Repair Type': 'Screen', Price: '100' } // valid
    ];

    const result = transform(rows);
    assert.strictEqual(result.repairs.length, 1);
    assert.strictEqual(result.repairs[0].model, 'iPhone 12');
  });

  await t.test('derives implicit brand and chip', () => {
    const rows = [
      { Model: 'Galaxy S21', 'Repair Type': 'Back Glass Repair', Price: '100' },
      { Model: 'iPad Pro', 'Repair Type': 'Battery Replacement', Price: '100' },
      { Model: 'Pixel 6', 'Repair Type': 'Charge Port Fix', Price: '100' },
      { Model: 'Unknown Device', 'Repair Type': 'Unknown Issue', Price: '100' }
    ];

    const result = transform(rows);

    assert.strictEqual(result.repairs[0].brand, 'samsung');
    assert.strictEqual(result.repairs[0].chip, 'backglass');

    assert.strictEqual(result.repairs[1].brand, 'ipad');
    assert.strictEqual(result.repairs[1].chip, 'battery');

    assert.strictEqual(result.repairs[2].brand, 'pixel');
    assert.strictEqual(result.repairs[2].chip, 'chargeport');

    assert.strictEqual(result.repairs[3].brand, 'iphone'); // default fallback
    assert.strictEqual(result.repairs[3].chip, 'screen'); // default fallback
  });
});

test('computeStats', async (t) => {
  await t.test('calculates stats correctly', () => {
    const repairs = [
      { model: 'A', repair_type: 'Screen', savings: 50, mk_price: 150 },
      { model: 'B', repair_type: 'Battery', savings: 100, mk_price: 200 },
      { model: 'C', repair_type: 'Port', savings: 10, mk_price: 100 },
      { model: 'D', repair_type: 'Screen', savings: null, mk_price: null } // should be ignored
    ];

    const stats = computeStats(repairs);

    assert.strictEqual(stats.maxSaving, 100);
    // avg pct logic: pctLess is Math.round((saved / base) * 100)
    // A: (50/150)*100 = 33
    // B: (100/200)*100 = 50
    // C: (10/100)*100 = 10
    // Avg = (33 + 50 + 10) / 3 = 93 / 3 = 31
    assert.strictEqual(stats.avgPct, 31);
    assert.strictEqual(stats.top.length, 3);
    assert.strictEqual(stats.top[0].model, 'B'); // Highest savings
    assert.strictEqual(stats.top[1].model, 'A');
    assert.strictEqual(stats.top[2].model, 'C');
  });

  await t.test('handles empty repairs gracefully', () => {
    const stats = computeStats([]);
    assert.strictEqual(stats.maxSaving, 0);
    assert.strictEqual(stats.avgPct, 0);
    assert.deepStrictEqual(stats.top, []);
  });
});
