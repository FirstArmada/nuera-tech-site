import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert';
import { ensureFresh, getDevice } from './catalog.js';

describe('catalog.js - getDevice', () => {
  before(async () => {
    mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        repairs: [
          { brand: 'iphone', model: 'iPhone 13', chip: 'screen', price: 100 },
          { brand: 'samsung', model: 'Galaxy S21', chip: 'battery', price: 80 }
        ]
      })
    }));

    await ensureFresh();
  });

  test('returns device object for exact model match', () => {
    const device = getDevice('iphone 13');
    assert.deepStrictEqual(device, {
      brand: 'iphone',
      model: 'iPhone 13',
      repairs: [
        { brand: 'iphone', model: 'iPhone 13', chip: 'screen', price: 100 }
      ]
    });
  });

  test('returns device object case-insensitively', () => {
    const device = getDevice('GaLaXy S21');
    assert.deepStrictEqual(device, {
      brand: 'samsung',
      model: 'Galaxy S21',
      repairs: [
        { brand: 'samsung', model: 'Galaxy S21', chip: 'battery', price: 80 }
      ]
    });
  });

  test('returns null for unknown model', () => {
    const device = getDevice('Unknown Model');
    assert.strictEqual(device, null);
  });

  test('returns null when model is empty', () => {
    const device = getDevice('');
    assert.strictEqual(device, null);
  });

  test('returns null when model is null or undefined', () => {
    assert.strictEqual(getDevice(null), null);
    assert.strictEqual(getDevice(undefined), null);
  });

  test('returns null when model is an object or number not in cache', () => {
    assert.strictEqual(getDevice(123), null);
    assert.strictEqual(getDevice({}), null);
  });
});
