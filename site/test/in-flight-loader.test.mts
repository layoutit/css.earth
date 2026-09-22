import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createInFlightLoader } from '../in-flight-loader.mts';

test('in-flight loader shares concurrent work but releases successful values', async () => {
  let calls = 0, resolve!: (value: object) => void;
  const load = createInFlightLoader(async (_key: string) => {
    calls++;
    return new Promise<object>(done => { resolve = done; });
  });
  const first = load('m42'), shared = load('m42');
  assert.equal(first, shared); assert.equal(calls, 0);
  await Promise.resolve(); assert.equal(calls, 1);
  const value = {};
  resolve(value); assert.equal(await first, value);
  await Promise.resolve();
  const fresh = load('m42');
  assert.notEqual(fresh, first);
  await Promise.resolve(); assert.equal(calls, 2);
  resolve({}); await fresh;
});

test('in-flight loader releases failures so a later request can retry', async () => {
  let calls = 0;
  const load = createInFlightLoader(async () => {
    calls++;
    if (calls === 1) throw new Error('temporary');
    return 'ready';
  });
  await assert.rejects(load('m8'), /temporary/u);
  await Promise.resolve();
  assert.equal(await load('m8'), 'ready');
  assert.equal(calls, 2);
});
