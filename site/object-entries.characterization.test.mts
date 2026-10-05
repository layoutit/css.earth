import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readObjectEntry, onObjectEntry, readWorldPlace } from './object-entries.mts';
test('entries cache successes and 404s, retry failures, and notify before readers continue', async t => {
  const urls: string[] = []; let failed = true;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url);
    if (url.includes('absent')) return new Response('', { status: 404 });
    if (url.includes('retry') && failed) { failed = false; return new Response('', { status: 503 }); }
    return new Response(JSON.stringify({ world: { files: ['root', 'holder'], row: { id: 'star' } } }));
  });
  const calls: string[] = []; const stop = onObjectEntry(id => calls.push(id));
  const a = readObjectEntry('char/a b'), b = readObjectEntry('char/a b');
  assert.equal(a, b); await a;
  assert.deepEqual(calls, ['char/a b']);
  assert.equal(urls[0], '/objects/char%2Fa%20b/entry.json');
  const replay: string[] = []; const unsubscribe = onObjectEntry(id => replay.push(id));
  assert.deepEqual(replay, calls); unsubscribe();
  assert.equal(await readObjectEntry('char-absent'), null);
  assert.equal(await readObjectEntry('char-absent'), null);
  assert.equal(urls.filter(url => url.includes('absent')).length, 1);
  await assert.rejects(readObjectEntry('char-retry'), /Object entry request for char-retry failed: 503/); await readObjectEntry('char-retry');
  assert.equal(urls.filter(url => url.includes('retry')).length, 2);
  assert.deepEqual(replay, ['char/a b']); stop();
  assert.deepEqual(await readWorldPlace('char/a b'), { files: ['root', 'holder'], row: { id: 'star' } });
});
test('world places distinguish absent entries, plain entries, optional rows and malformed worlds', async t => {
  const entries: unknown[] = [null, 'plain', {}, { world: { files: [] } }, { world: null }, { world: { files: ['root', 1] } }, { world: {} }, { world: { files: ['root'], row: null } }];
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(entries.shift())));
  for (let i = 0; i < 3; i++) assert.equal(await readWorldPlace('char-plain-' + i), null);
  assert.deepEqual(await readWorldPlace('char-empty'), { files: [] });
  for (let i = 0; i < 3; i++) await assert.rejects(readWorldPlace('char-malformed-' + i), /world must name the files to read for it/);
  assert.deepEqual(await readWorldPlace('char-null-row'), { files: ['root'], row: null });
});
