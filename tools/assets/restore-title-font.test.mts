import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PLANET_TITLE_RECIPE as recipe } from '../../src/platform/planet-title-recipe.mts';
import { restoreTitleFont } from './restore-title-font.mts';

test('restores the pinned font from a missing source tree, then works offline', async t => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-title-font-'));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  const bytes = await readFile(resolve(import.meta.dirname, '../..', recipe.checkedFontPath));
  const destination = await restoreTitleFont({ projectRoot, fetchBytes: async url => {
    assert.equal(url, recipe.sourceUrl);
    return bytes;
  } });
  assert.deepEqual(await readFile(destination), bytes);
  const offline = async (): Promise<Uint8Array> => { throw new Error('Unexpected download'); };
  assert.equal(await restoreTitleFont({ projectRoot, fetchBytes: offline }), destination);
  await writeFile(destination, 'corrupted font');
  await assert.rejects(restoreTitleFont({ projectRoot, fetchBytes: offline }), /pinned SHA-256/u);
});

test('rejects a changed download before writing it into the source tree', async t => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-title-font-'));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  await assert.rejects(restoreTitleFont({
    projectRoot, fetchBytes: async () => new Uint8Array([1, 2, 3]),
  }), /pinned SHA-256/u);
  await assert.rejects(readFile(resolve(projectRoot, recipe.checkedFontPath)), { code: 'ENOENT' });
});
