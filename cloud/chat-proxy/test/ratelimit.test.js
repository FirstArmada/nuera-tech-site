import { test } from 'node:test';
import assert from 'node:assert';
import { createRateLimiter } from '../lib/ratelimit.js';

test('createRateLimiter - allows requests up to capacity and denies when empty', () => {
    // A test that does not need mock timers because it happens "instantly"
    const allow = createRateLimiter({ capacity: 3, refillPerSec: 1, sweepMs: 600000 });

    assert.strictEqual(allow('192.168.1.1'), true);
    assert.strictEqual(allow('192.168.1.1'), true);
    assert.strictEqual(allow('192.168.1.1'), true);
    assert.strictEqual(allow('192.168.1.1'), false); // Capacity 3 exhausted

    assert.strictEqual(allow('192.168.1.2'), true); // Independent bucket
});

test('createRateLimiter - refills tokens over time', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setInterval'] });
    const allow = createRateLimiter({ capacity: 2, refillPerSec: 1, sweepMs: 600000 });

    // Exhaust capacity
    assert.strictEqual(allow('10.0.0.1'), true);
    assert.strictEqual(allow('10.0.0.1'), true);
    assert.strictEqual(allow('10.0.0.1'), false);

    // Advance time by 1000ms to refill 1 token (refillPerSec is 1)
    t.mock.timers.tick(1000);

    // 1 token available
    assert.strictEqual(allow('10.0.0.1'), true);
    assert.strictEqual(allow('10.0.0.1'), false);

    // Advance time by 5000ms to refill fully (capped at 2)
    t.mock.timers.tick(5000);

    assert.strictEqual(allow('10.0.0.1'), true);
    assert.strictEqual(allow('10.0.0.1'), true);
    assert.strictEqual(allow('10.0.0.1'), false);
});

test('createRateLimiter - sweeps idle buckets to prevent memory leaks', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setInterval'] });

    // Spy on Map.prototype.delete to verify it gets called during sweep
    const deleteCalledFor = [];
    const originalDelete = Map.prototype.delete;
    t.mock.method(Map.prototype, 'delete', function(key) {
      deleteCalledFor.push(key);
      return originalDelete.call(this, key);
    });

    const allow = createRateLimiter({ capacity: 10, refillPerSec: 1, sweepMs: 500 });

    // Create activity for two IPs
    allow('203.0.113.1');
    allow('203.0.113.2');

    // Advance time slightly, under sweep threshold
    t.mock.timers.tick(250);

    // Refresh activity for IP 1
    allow('203.0.113.1');

    // Advance time by another 300ms, triggering the interval (500ms total elapsed)
    // IP 1 was updated at t=250 (now t=550, delta=300 -> under sweepMs 500)
    // IP 2 was updated at t=0 (now t=550, delta=550 -> over sweepMs 500)
    t.mock.timers.tick(300);

    assert.ok(deleteCalledFor.includes('203.0.113.2'), 'IP 2 should have been swept (idle for > 500ms)');
    assert.ok(!deleteCalledFor.includes('203.0.113.1'), 'IP 1 should not have been swept (active within 500ms)');
});
