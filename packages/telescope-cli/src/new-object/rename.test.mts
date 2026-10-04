import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import type { Archive } from './archives/archives.mts';
import { renameStars } from './rename.mts';
import { STORED_SPEC } from './refresh.mts';

const answering = (identifier: string): Archive => ({
  text: async () => `id\n${identifier}\n`,
  bytes: async () => { throw new Error('Unexpected download'); },
  exists: async () => false,
});
const archive = answering('NAME New Star');

test('unreadable hosted specs abort before any star is renamed; absent specs are allowed', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'rename-stars-'));
  const objects = resolve(root, 'src/objects');
  const star = JSON.stringify({ name: 'Old Star', system: 'Old Star system', target: 'Old Star' });
  try {
    for (const id of ['star', 'hosted', 'ordinary']) await mkdir(dirname(resolve(objects, id, STORED_SPEC)), { recursive: true });
    // The guide beside the object folders is a file, not an object without a spec.
    await writeFile(resolve(objects, 'README.md'), '# Objects\n');
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
    // A designation carries over to the bodies the star hosts.
    const result = await renameStars(root, ['star'], answering('* alf Cet'));
    assert.deepEqual(result.refresh, ['star', 'hosted']);
    assert.match(await readFile(hosted, 'utf8'), /Alpha Ceti b/);
    // A name of the star's own does not: its planet keeps the designation it has.
    assert.deepEqual((await renameStars(root, ['star'], archive)).refresh, ['star', 'hosted']);
    assert.match(await readFile(resolve(objects, 'star', STORED_SPEC), 'utf8'), /"name": "New Star"/);
    assert.match(await readFile(hosted, 'utf8'), /Alpha Ceti b/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
