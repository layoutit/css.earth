import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCatalogueDots } from './dot-catalogues.mts';
test('dot loading delegates its binary kind and origin-root URL unchanged', async () => {
  const calls: [string, string][] = [];
  const read = async <Value,>(kind: string, url: string): Promise<Value> => {
    calls.push([kind, url]); throw new Error('worker rejected');
  };
  await assert.rejects(loadCatalogueDots('https://example.test/nested/?x=1', read), /worker rejected/);
  assert.deepEqual(calls, [['catalogue-dots', 'https://example.test/catalogues/dots.bin']]);
  assert.throws(() => loadCatalogueDots('relative', read), TypeError);
});

test('successful catalogue worker payload passes through unchanged', async () => {
  const dots = { rows: ['fixture'] };
  const result = await loadCatalogueDots('https://example.test/', async <Value,>() => dots as Value);
  assert.equal(result, dots);
});
