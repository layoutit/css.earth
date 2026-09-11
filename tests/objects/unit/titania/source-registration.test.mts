import {required} from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';

const root = new URL('../../../../src/planets/titania/source/', import.meta.url).pathname;

test('Titania mosaic and stereo-limb DEM retain their original geographic values and masks', async () => {
  const config = JSON.parse((await readFile(root + 'preparation/terrestrial.json')).toString('utf8'));
  const manifest = JSON.parse((await readFile(root + 'manifest.json')).toString('utf8'));
  const inspection = JSON.parse((await readFile(root + 'observations/source-inspection.json')).toString('utf8'));
  const entry = manifest.inputs.find((source: { lensId: string; }) => source.lensId === 'normal');
  const policy = config.raster.observations[0].validity;
  const mosaic = await loadScienceSurface(root, {path: entry.path, format: 'isis3', grid: policy.grid, sampling: 'bilinear'});
  const dem = await loadScienceSurface(root, config.raster.scientific[0]);
  // Expected values come from an independent NumPy untile and coordinate lookup
  // on the original cubes, including the 0/360 seam and valid negative DN.
  for (const sample of inspection.samples) {
    for (const [id, source, tolerance] of [['normal', mosaic, 0.00001], ['elevation', dem, 0.00000001]] as const) {
      const actual = source.sample(sample.longitude, sample.latitude);
      if (sample[id] === null) assert.equal(actual, null, `${sample.name}: ${id} remains missing`);
      else assert.ok(actual !== null && Math.abs(actual - sample[id]) < tolerance, `${sample.name}: ${id} geographic sample differs`);
    }
  }
  assert.equal(mosaic.sample(-25, -40), mosaic.sample(335, -40));
  assert.equal(dem.sample(-25, -40), dem.sample(335, -40));
  const {rgb, missing} = await readObservation(root, entry, policy, 360, 180);
  assert.equal(missing[30 * 360 + 180], 1, 'Unobserved north remains missing');
  const index = 145 * 360 + 351;
  assert.equal(missing[index], 0, 'Observed southern terrain survives resampling');
  const value = required(mosaic.sample(351.5, -55.5));
  const [low, high] = policy.displayRange;
  assert.equal(rgb[index * 3], Math.round(Math.max(0, Math.min(255, (value - low) / (high - low) * 255))));
});
