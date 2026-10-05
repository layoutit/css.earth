import assert from 'node:assert/strict';
import { test } from 'node:test';
test('startup availability validates available and unavailable entries at import', async t => {
  const input = { earth: { available: true }, nebula: { available: false, reason: 'Not restored' } };
  Object.defineProperty(globalThis, '__CSSEARTH_CONTEXT_AVAILABILITY__', { configurable: true, value: input }); t.after(() => Reflect.deleteProperty(globalThis, '__CSSEARTH_CONTEXT_AVAILABILITY__'));
  const { CONTEXT_AVAILABILITY } = await import('./context-availability.mts');
  assert.deepEqual(CONTEXT_AVAILABILITY, input);
  assert.notEqual(CONTEXT_AVAILABILITY, input);
});
