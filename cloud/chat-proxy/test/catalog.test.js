import test from 'node:test';
import assert from 'node:assert';
import { getDevice, ensureFresh } from '../lib/catalog.js';

test('getDevice', async (t) => {
  await t.test('returns null for empty string or null input', () => {
    assert.strictEqual(getDevice(null), null);
    assert.strictEqual(getDevice(''), null);
    assert.strictEqual(getDevice(undefined), null);
  });

  await t.test('returns null when device is not in cache', () => {
    assert.strictEqual(getDevice('Nonexistent Device'), null);
  });

  await t.test('returns device after fetching catalog', async () => {
    await ensureFresh();
    const device = getDevice('iPhone 12');
    assert.ok(device);
    assert.strictEqual(device.model, 'iPhone 12');
  });

  await t.test('is case insensitive', async () => {
    await ensureFresh();
    const device = getDevice('IPHONE 12');
    assert.ok(device);
    assert.strictEqual(device.model, 'iPhone 12');
  });
});
