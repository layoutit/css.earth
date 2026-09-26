import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNavigationReadiness } from '../navigation/navigation-readiness.mts';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a delayed entry cannot start a flight after a newer selection', async () => {
  const entry = deferred<boolean>(), known = new Set(['venus']), systemReads: string[] = [];
  const ready = { id: 'world' };
  const navigation = createNavigationReadiness({
    context: async () => ready,
    knownObject: (_context, id: string) => known.has(id),
    loadObject: async (_context, id: string) => { assert.equal(id, 'mars'); return entry.promise; },
    systemViewLoaded: () => false,
    loadSystemView: async (_context, id: string) => { systemReads.push(id); },
  });
  const first = navigation.prepare('mars', true);
  await Promise.resolve();
  const second = navigation.prepare('venus', false);
  assert.equal(await second, ready);
  entry.resolve(true);
  assert.equal(await first, null);
  assert.deepEqual(systemReads, [], 'stale selection does not start another load');
});

test('a late system-view failure is ignored after supersession; the current failure propagates', async () => {
  const system = deferred<void>(), ready = { id: 'world' };
  const navigation = createNavigationReadiness({
    context: async () => ready,
    knownObject: () => true,
    loadObject: async () => assert.fail('all entries are ready'),
    systemViewLoaded: (_context, id: string) => id === 'venus',
    loadSystemView: async () => system.promise,
  });
  const first = navigation.prepare('mars', true);
  await Promise.resolve();
  assert.equal(await navigation.prepare('venus', true), ready);
  system.reject(new Error('temporary system-view failure'));
  assert.equal(await first, null);
  await assert.rejects(navigation.prepare('mars', true), /temporary system-view failure/);
});

test('teardown invalidates pending readiness', async () => {
  const entry = deferred<boolean>();
  const navigation = createNavigationReadiness({
    context: async () => ({}), knownObject: () => false, loadObject: async () => entry.promise,
    systemViewLoaded: () => true, loadSystemView: async () => {},
  });
  const pending = navigation.prepare('mars', false);
  await Promise.resolve();
  navigation.invalidate();
  entry.resolve(true);
  assert.equal(await pending, null);
});
