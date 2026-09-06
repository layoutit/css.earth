import { describe, expect, it } from 'vitest';
import { createSceneLifetime } from './scene-lifetime.js';

describe('scene lifetime ownership', () => {
  it('invalidates first and releases every owner once in reverse order', () => {
    const lifetime = createSceneLifetime();
    const calls: number[] = [];
    const error = new Error('cleanup');
    lifetime.onDispose(() => { expect(lifetime.disposed).toBe(true); calls.push(1); });
    lifetime.onDispose(() => { calls.push(2); throw error; });
    lifetime.onDispose(() => { calls.push(3); });
    expect(lifetime.destroy()).toEqual([error]);
    expect(calls).toEqual([3, 2, 1]);
    expect(lifetime.destroy()).toEqual([]);
    expect(lifetime.onDispose(() => { throw error; })).toEqual([error]);
    expect(lifetime.stats()).toEqual({ disposed: true, ownerCount: 0, waiterCount: 0 });
  });

  it('settles cancellation and owns a native rejection arriving after disposal', async () => {
    const lifetime = createSceneLifetime();
    let reject: (error: Error) => void = () => { throw new Error('Missing promise executor'); };
    const native = new Promise<never>((_, fail) => { reject = fail; });
    const waiting = lifetime.wait(native);
    lifetime.destroy();
    expect(await waiting).toEqual({ cancelled: true });
    reject(new Error('late rejection'));
    expect(await lifetime.wait(Promise.reject(new Error('already disposed')))).toEqual({ cancelled: true });
    await Promise.resolve();
  });

  it('preserves live values and failures without accumulating waiters', async () => {
    const lifetime = createSceneLifetime();
    lifetime.onDispose(() => {});
    for (let index = 0; index < 1000; index++) {
      expect(await lifetime.wait(Promise.resolve(index))).toEqual({ cancelled: false, value: index });
      expect(lifetime.stats()).toEqual({ disposed: false, ownerCount: 1, waiterCount: 0 });
    }
    const error = new Error('live failure');
    await expect(lifetime.wait(Promise.reject(error))).rejects.toBe(error);
    lifetime.destroy();
  });
});
