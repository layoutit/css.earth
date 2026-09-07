import {readFile} from 'node:fs/promises';
import {readObservation} from '../../../tools/objects/terrestrial-layers/solid-raster.mjs';
import {paintMissingCoverage} from '../../../src/platform/prepare-missing-coverage.mjs';

// Exercise the source conversion without requiring an intermediate image in
// the installable runtime. Browser captures cover the delivered packed atlas.
export async function observation(id, lens, width = 8192, height = 4096) {
  const root = new URL(`../../../src/planets/${id}/source/`, import.meta.url).pathname;
  const config = JSON.parse(await readFile(`${root}/preparation/terrestrial.json`));
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`));
  const entry = manifest.inputs.find(input => input.lensId === lens);
  const recipe = config.raster.observations.find(input => input.id === lens);
  const {rgb, missing} = await readObservation(root, entry, recipe.validity, width, height);
  const info = {width, height, channels: 3};
  return {data: paintMissingCoverage(rgb, info, missing), info};
}
