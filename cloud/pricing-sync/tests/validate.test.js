import { test } from 'node:test';
import assert from 'node:assert';
import { validate } from '../lib/validate.js';
import { BRANDS, CHIPS } from '../lib/transform.js';

test('validates a correct data object', () => {
  const validData = {
    generated: '2023-10-01',
    source: 'test',
    repairs: [
      {
        model: 'iPhone 13',
        repair_type: 'Screen Replacement',
        variant: '',
        sku: 'IP13-SCR',
        brand: BRANDS[0],
        chip: CHIPS[0],
        price: 150,
        mk_price: 200,
        savings: 50
      }
    ],
    stats: {
      maxSaving: 50,
      avgPct: 25,
      top: []
    }
  };

  assert.strictEqual(validate(validData), true);
});

test('throws on missing or invalid top-level fields', () => {
  assert.throws(() => validate(null), /not an object/);
  assert.throws(() => validate({}), /missing "generated" date/);
  assert.throws(() => validate({ generated: '2023' }), /missing "source"/);
  assert.throws(() => validate({ generated: '2023', source: 'test' }), /repairs\[\] is empty/);
  assert.throws(() => validate({ generated: '2023', source: 'test', repairs: [] }), /repairs\[\] is empty/);
});

test('throws on non-serializable data', () => {
  const data = {
    generated: '2023',
    source: 'test',
    repairs: [{ price: 100 }]
  };
  data.circular = data;
  assert.throws(() => validate(data), TypeError);
});

test('throws on invalid repair fields', () => {
  const baseData = () => ({
    generated: '2023',
    source: 'test',
    repairs: [
      {
        model: 'iPhone 13',
        repair_type: 'Screen Replacement',
        variant: '',
        sku: 'IP13-SCR',
        brand: BRANDS[0],
        chip: CHIPS[0],
        price: 150,
        mk_price: 200,
        savings: 50
      }
    ]
  });

  const runWithRepair = (override) => {
    const data = baseData();
    data.repairs[0] = { ...data.repairs[0], ...override };
    validate(data);
  };

  assert.throws(() => runWithRepair({ model: 123 }), /repairs\[0\].model must be a string/);
  assert.throws(() => runWithRepair({ brand: 'unknown' }), /not in/);
  assert.throws(() => runWithRepair({ chip: 'unknown' }), /not in/);
  assert.throws(() => runWithRepair({ price: -10 }), /price must be a positive number/);
  assert.throws(() => runWithRepair({ price: '100' }), /price must be a positive number/);
  assert.throws(() => runWithRepair({ mk_price: '200' }), /mk_price must be number\|null/);
  assert.throws(() => runWithRepair({ savings: '50' }), /savings must be number\|null/);
});

test('validates stats object if present', () => {
  const validData = {
    generated: '2023',
    source: 'test',
    repairs: [{ model: '', repair_type: '', variant: '', sku: '', brand: BRANDS[0], chip: CHIPS[0], price: 100, mk_price: null, savings: null }]
  };

  assert.throws(() => validate({ ...validData, stats: null }), /stats must be an object/);
  assert.throws(() => validate({ ...validData, stats: { maxSaving: '10' } }), /stats.maxSaving must be a number/);
  assert.throws(() => validate({ ...validData, stats: { maxSaving: 10, avgPct: '10' } }), /stats.avgPct must be a number/);
  assert.throws(() => validate({ ...validData, stats: { maxSaving: 10, avgPct: 10, top: null } }), /stats.top must be an array/);
});

test('throws on >20% repair count difference', () => {
  const data = {
    generated: '2023',
    source: 'test',
    repairs: Array.from({ length: 100 }).fill({ model: '', repair_type: '', variant: '', sku: '', brand: BRANDS[0], chip: CHIPS[0], price: 100, mk_price: null, savings: null })
  };

  const prevTooLarge = { repairs: Array.from({ length: 130 }) };
  const prevTooSmall = { repairs: Array.from({ length: 80 }) };
  const prevOk = { repairs: Array.from({ length: 110 }) };

  assert.throws(() => validate(data, prevTooLarge), /differs >20% from current/);
  assert.throws(() => validate(data, prevTooSmall), /differs >20% from current/);
  assert.strictEqual(validate(data, prevOk), true);
});
