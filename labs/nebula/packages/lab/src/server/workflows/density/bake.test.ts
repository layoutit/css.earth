import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { acquire, hash, localPath, pinned } from './io.ts';
import { parseBakeArgs, readRecipe } from './config.ts';

test('bake arguments reject misspelled stages rather than unexpectedly running all processing', () => {
  assert.equal(parseBakeArgs([]).stage, 'all');
  assert.equal(parseBakeArgs([]).research, false);
  assert.equal(parseBakeArgs(['--research']).research, true);
  assert.equal(parseBakeArgs(['--stage=assets']).stage, 'assets');
  assert.throws(() => parseBakeArgs(['--stage=asset']));
  assert.throws(() => parseBakeArgs(['--image']));
  assert.throws(() => parseBakeArgs(['--force']));
  assert.equal(parseBakeArgs(['--if-missing']).ifMissing, true);
  assert.throws(() => parseBakeArgs(['--if-missing', '--stage=assets']));
  assert.throws(() => parseBakeArgs(['--if-missing', '--image=vista-infrared']));
});

test('image-filtered bakes require explicit research opt-in', () => {
  const filter = '--image=wise-wide-infrared';
  for (const args of [[filter], [filter, '--stage=all'], [filter, '--stage=removal'], [filter, '--stage=reconstruction']]) {
    assert.throws(() => parseBakeArgs(args), /--image requires --research/);
    assert.equal(parseBakeArgs(['--research', ...args]).image, 'wise-wide-infrared');
    assert.equal(parseBakeArgs([...args, '--research']).research, true);
  }
});

test('acquisition rejects altered local sources without downloading or overwriting them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-bake-source-'));
  try {
    await writeFile(join(root, 'source.dat'), 'changed');
    await acquire(root, { path: 'source.dat', url: 'https://invalid.invalid/source' });
    assert.equal(await readFile(join(root, 'source.dat'), 'utf8'), 'changed', 'a present source is never fetched');
    await assert.rejects(pinned(root, { path: '../escape' }), /Invalid recipe path/);
    assert.throws(() => localPath(root, '/tmp/escape'), /Invalid recipe path/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the saved bake closes its inputs and preserves all three accepted material treatments', async () => {
  const root = process.cwd(), recipe = await readRecipe(root, resolve(root, 'labs/nebula/models/lmc/bake.json'));
  assert.deepEqual(recipe.images.map(image => image.imageId), ['vista-infrared', 'horalek-widefield', 'wise-wide-infrared']);
  const saved = JSON.parse(await readFile(resolve(root, 'labs/nebula/models/lmc/app-lens-settings.json'), 'utf8'));
  for (const image of recipe.images) assert.deepEqual(image.appearance, saved.lenses.find((lens: any) => lens.imageId === image.imageId).appearance);
  const temporary = await mkdtemp(join(tmpdir(), 'nebula-bake-recipe-'));
  try {
    const wrongPlacement = structuredClone(recipe); wrongPlacement.images[0]!.placement.scale = -1;
    await writeFile(join(temporary, 'changed.json'), JSON.stringify(wrongPlacement));
    await assert.rejects(readRecipe(root, join(temporary, 'changed.json')));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
