import { readFile } from 'node:fs/promises';
import { readObservation } from '../../../tools/objects/terrestrial-layers/observation-raster.mts';
import { paintMissingCoverage } from '@cssearth/bake/raster';

// Exercise the source conversion without requiring an intermediate image in
// the installable runtime. Browser captures cover the delivered packed atlas.
export async function observation(id: string, lens: string, width = 8192, height = 4096) {
  const root = new URL(`../../../src/objects/${id}/source/`, import.meta.url).pathname;
  const config = JSON.parse((await readFile(`${root}/preparation/terrestrial.json`)).toString('utf8'));
  const manifest = JSON.parse((await readFile(`${root}/manifest.json`)).toString('utf8'));
  const entry = manifest.inputs.find((input: { lensId: string; }) => input.lensId === lens);
  const recipe = config.raster.observations.find((input: { id: string; }) => input.id === lens);
  const {rgb, missing} = await readObservation(root, entry, recipe.validity, width, height);
  const info = {width, height, channels: 3 as const};
  return {data: paintMissingCoverage(rgb, info, missing), info};
}
