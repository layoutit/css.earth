import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';

const root = new URL('../../../../src/planets/charon/source/', import.meta.url).pathname;
test('Charon maps source longitude correctly and preserves observation and elevation gaps', async () => {
  const config = JSON.parse((await readFile(`${root}/preparation/terrestrial.json`)).toString('utf8'));
  const manifest = JSON.parse((await readFile(`${root}/manifest.json`)).toString('utf8'));
  const width = 360, height = 180;
  const observation = await readObservation(root, manifest.inputs.find((x: { lensId: string; }) => x.lensId === 'normal'), config.raster.observations[0].validity, width, height);
  assert.equal(observation.missing[70 * width], 0, 'Encounter hemisphere at 0.5 E, 19.5 N is observed');
  assert.equal(observation.missing[170 * width], 1, 'Unobserved southern cap stays missing');
  assert.ok(observation.rgb[70 * width * 3] > 0);
  const dem = await loadScienceSurface(root, config.raster.scientific[0]);
  assert.equal(dem.sample(-0.5, 20), dem.sample(359.5, 20), 'Longitude aliases resolve to the same source cell');
  assert.equal(dem.sample(0, -80), null);
  assert.ok(Number.isFinite(dem.sample(0, 20)));
});
