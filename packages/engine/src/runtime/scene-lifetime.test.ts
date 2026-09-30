import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createSceneLifetime } from './scene-lifetime.js';

describe('scene lifetime ownership', () => {
  it('invalidates first and releases every owner once in reverse order', () => {
    const lifetime = createSceneLifetime();
    const calls: number[] = [];
    const error = new Error('cleanup');
    lifetime.onDispose(() => { assert.equal(lifetime.disposed, true); calls.push(1); });
    lifetime.onDispose(() => { calls.push(2); throw error; });
    lifetime.onDispose(() => { calls.push(3); });
    assert.deepEqual(lifetime.destroy(), [error]);
    assert.deepEqual(calls, [3, 2, 1]);
    assert.deepEqual(lifetime.destroy(), []);
    assert.deepEqual(lifetime.onDispose(() => { throw error; }), [error]);
    assert.deepEqual(lifetime.stats(), { disposed: true, ownerCount: 0, waiterCount: 0 });
  });

  it('settles cancellation and owns a native rejection arriving after disposal', async () => {
    const lifetime = createSceneLifetime();
    let reject: (error: Error) => void = () => { throw new Error('Missing promise executor'); };
    const native = new Promise<never>((_, fail) => { reject = fail; });
    const waiting = lifetime.wait(native);
    lifetime.destroy();
    assert.deepEqual((await waiting), { cancelled: true });
    reject(new Error('late rejection'));
    assert.deepEqual((await lifetime.wait(Promise.reject(new Error('already disposed')))), { cancelled: true });
    await Promise.resolve();
  });

  it('preserves live values and failures without accumulating waiters', async () => {
    const lifetime = createSceneLifetime();
    lifetime.onDispose(() => {});
    for (let index = 0; index < 1000; index++) {
      assert.deepEqual((await lifetime.wait(Promise.resolve(index))), { cancelled: false, value: index });
      assert.deepEqual(lifetime.stats(), { disposed: false, ownerCount: 1, waiterCount: 0 });
    }
    const error = new Error('live failure');
    await assert.rejects(lifetime.wait(Promise.reject(error)), (error: unknown) => error === error);
    lifetime.destroy();
  });
});
