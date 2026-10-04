import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import type { Archive } from './archives.mts';
import { renameStars } from './rename.mts';
import { STORED_SPEC } from './refresh.mts';

const archive: Archive = {
  text: async () => 'id\nNAME New Star\n',
  bytes: async () => { throw new Error('Unexpected download'); },
  exists: async () => false,
};

test('unreadable hosted specs abort before any star is renamed; absent specs are allowed', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'rename-stars-'));
  const objects = resolve(root, 'src/objects');
  const star = JSON.stringify({ name: 'Old Star', system: 'Old Star system', target: 'Old Star' });
  try {
    for (const id of ['star', 'hosted', 'ordinary']) await mkdir(dirname(resolve(objects, id, STORED_SPEC)), { recursive: true });
    await writeFile(resolve(objects, 'star', STORED_SPEC), star);
    const hosted = resolve(objects, 'hosted', STORED_SPEC);
    for (const bad of ['{', 'null', '[]']) {
      await writeFile(hosted, bad);
      await assert.rejects(renameStars(root, ['star'], archive), /hosted/);
      assert.equal(await readFile(resolve(objects, 'star', STORED_SPEC), 'utf8'), star);
    }
    await rm(hosted);
    await mkdir(hosted);
    await assert.rejects(renameStars(root, ['star'], archive), /hosted/);
    await rm(hosted, { recursive: true });
    await writeFile(hosted, JSON.stringify({ host: 'star', planets: [{ name: 'Old Star b' }] }));
    const result = await renameStars(root, ['star'], archive);
    assert.deepEqual(result.refresh, ['star', 'hosted']);
    assert.match(await readFile(hosted, 'utf8'), /New Star b/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
