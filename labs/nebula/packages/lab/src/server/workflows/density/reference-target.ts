/** Rebuild the historical star-catalogue calibration panel from its native observation. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import { decomposeFilledComponents } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { extendedMap, rectifyObservation, writeObservationPanel } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { acquire, hash, json, pinned } from './io.ts';
import { writeAtomic } from '@cssearth/bake/volume/node';

export async function bakeReferenceTarget(root: string, cataloguePath: string) {
  const { depthModel: refs } = await json(resolve(root, cataloguePath));
  if (!refs?.target) return;
  try { await pinned(root, refs.target); console.log('REFERENCE_TARGET_CACHED'); return; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const recipe = await jsonAfterPin(refs.cloudRecipe), object = await jsonAfterPin(refs.cloudObject);
  async function jsonAfterPin(pin: { path: string; sha256: string }) {
    await pinned(root, pin); return json(resolve(root, pin.path));
  }
  await acquire(root, recipe.photo);
  const mapping = createObservationMapping(recipe.wcs, object.properties.volume);
  const photo = await rectifyObservation(await pinned(root, recipe.photo), mapping, recipe.analysis.width);
  const decomposition = decomposeFilledComponents(photo.intensity, photo.width, photo.height, recipe.analysis.decomposition);
  const extended = extendedMap(decomposition, photo.intensity.length), target = new Float32Array(photo.intensity.length);
  for (let p = 0; p < target.length; p++) target[p] = (recipe.channels.compact ? decomposition.compact[p]! : 0) +
    (recipe.channels.diffuse ? decomposition.diffuse[p]! : 0) + (recipe.channels.extended ? extended[p]! : 0);
  const temporary = await mkdtemp(join(tmpdir(), 'nebula-reference-'));
  try {
    const output = join(temporary, 'target.png');
    await writeObservationPanel(output, photo, target);
    const bytes = await readFile(output);
    assert.equal(hash(bytes), refs.target.sha256, 'Historical star reference replay differs.');
    await writeAtomic(resolve(root, refs.target.path), bytes);
    console.log('REFERENCE_TARGET_READY: byte-identical star calibration panel');
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
