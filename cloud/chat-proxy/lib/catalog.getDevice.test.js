import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert';
import { ensureFresh, getDevice } from './catalog.js';

// getDevice() returns the indexed device record for an exact (case-insensitive)
// model match, or null. fetch is mocked so the catalog loads deterministic data.
describe('catalog.js - getDevice', () => {
  before(async () => {
    mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        repairs: [
          { brand: 'iphone', model: 'iPhone 13', repair_type: 'Screen', variant: '', chip: 'screen', price: 100 },
          { brand: 'samsung', model: 'Galaxy S21', repair_type: 'Battery', variant: '', chip: 'battery', price: 80 },
        ],
      }),
    }));
    await ensureFresh();
  });

  test('returns the device record for an exact model match', () => {
    const device = getDevice('iphone 13');
    assert.ok(device);
    assert.strictEqual(device.model, 'iPhone 13');
    assert.strictEqual(device.brand, 'iphone');
    assert.strictEqual(device.repairs.length, 1);
    assert.strictEqual(device.repairs[0].chip, 'screen');
  });

  test('matches case-insensitively', () => {
    const device = getDevice('GaLaXy S21');
    assert.ok(device);
    assert.strictEqual(device.model, 'Galaxy S21');
    assert.strictEqual(device.brand, 'samsung');
  });

  test('returns null for an unknown model', () => {
    assert.strictEqual(getDevice('Unknown Model'), null);
  });

  test('returns null for an empty string', () => {
    assert.strictEqual(getDevice(''), null);
  });

  test('returns null for null or undefined', () => {
    assert.strictEqual(getDevice(null), null);
    assert.strictEqual(getDevice(undefined), null);
  });

  test('returns null for a number or object not in the cache', () => {
    assert.strictEqual(getDevice(123), null);
    assert.strictEqual(getDevice({}), null);
  });
});
