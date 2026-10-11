import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareImageLayerOverlays } from './cloud-overlays.ts';

async function object(t: { after(fn: () => Promise<void>): void }) {
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-image-overlays-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, 'source')); await mkdir(resolve(dir, 'prepared'));
  return dir;
}

test('a bank with no overlays and no cloud source bakes as before: nothing is drawn over its layers', async t => {
  const dir = await object(t);
  await prepareImageLayerOverlays(dir, undefined, 'nebula');
  await prepareImageLayerOverlays(dir, { optical: [] }, 'nebula');
  assert.deepEqual(await readdir(resolve(dir, 'prepared')), []);
});

test('a bank whose descriptor names overlay banks needs their source', async t => {
  const dir = await object(t);
  await assert.rejects(prepareImageLayerOverlays(dir, { optical: ['cloud'] }, 'nebula'), /nebula: object\.json names overlay banks but source\/cloud-points\.json is missing/u);
});

test('only a missing source is passed over: a source that cannot be read, or that the overlay bake refuses, fails the bake', async t => {
  const dir = await object(t);
  await mkdir(resolve(dir, 'source/cloud-points.json'));
  await assert.rejects(prepareImageLayerOverlays(dir, undefined, 'nebula'), /EISDIR/u, 'a source that is there but unreadable is not taken for none');
  await rm(resolve(dir, 'source/cloud-points.json'), { recursive: true });
  await writeFile(resolve(dir, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id: 'nebula', type: 'image-layer-bank', properties: {
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [1e19, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1e14, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    preparation: { source: 'source/recipe.json' } } }));
  await writeFile(resolve(dir, 'source/cloud-points.json'), JSON.stringify({ points: 'none', occluder: [] }));
  await assert.rejects(prepareImageLayerOverlays(dir, undefined, 'nebula'), /source\/cloud-points\.json points is a list/u, "the overlay bake's own error reaches the caller");
});
