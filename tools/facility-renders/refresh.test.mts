import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareArtworkRefresh } from './refresh.mts';
import { requireArray, requireRecord } from '../sources/source-values.mts';

const root = resolve(import.meta.dirname, '../..');
const library = await readFile(resolve(root, 'site/source/facilities/render-library.json'));
const change = (edit: (entry: Record<string, unknown>) => void) => {
  const value = requireRecord(JSON.parse(library.toString()));
  const entry = requireArray(value.entries).map(value => requireRecord(value)).find(entry => entry.id === 'cassini');
  assert.ok(entry); edit(entry); return Buffer.from(JSON.stringify(value));
};

test('artwork refresh preserves both graphs when image identities are unchanged', async () => {
  for (const output of await prepareArtworkRefresh(root, library, library, new Map())) {
    assert.deepEqual(JSON.parse(output.text), JSON.parse(await readFile(output.path, 'utf8')));
  }
});
test('artwork-only refresh rejects attribution edits', async () => {
  const after = change(entry => { requireRecord(entry.source).credit = 'Different attribution'; });
  await assert.rejects(prepareArtworkRefresh(root, library, after, new Map()), /source attribution changed/);
});
test('artwork refresh rejects damaged candidate image bytes', async () => {
  await assert.rejects(prepareArtworkRefresh(root, library, library, new Map([['public/shell/facility-renders/cassini.webp', Buffer.from('invalid image')]])), /artwork size/);
});
test('artwork refresh rejects an unbound previous library', async () => {
  await assert.rejects(prepareArtworkRefresh(root, Buffer.concat([library, Buffer.from(' ')]), library, new Map()), /does not match the prepared graph/);
});
