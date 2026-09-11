import {required} from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';

const root = new URL('../../../../src/planets/ariel/source/', import.meta.url).pathname;

test('Ariel original mosaic and kilometre DEM retain their registered, distinct coverage', async () => {
  const config = JSON.parse((await readFile(root + 'preparation/terrestrial.json')).toString('utf8'));
  const manifest = JSON.parse((await readFile(root + 'manifest.json')).toString('utf8'));
  const entry = manifest.inputs.find((input: { lensId: string; }) => input.lensId === 'normal');
  const policy = config.raster.observations[0].validity;
  const mosaic = await loadScienceSurface(root, {path: entry.path, format: 'isis3', grid: policy.grid, sampling: 'bilinear'});
  const dem = await loadScienceSurface(root, config.raster.scientific[0]);

  // Independent Python float-array untile and map lookup on the pinned original cubes.
  // USGS Gazetteer centres, east-positive longitude: Yangoor, Domovoy, Kachina Chasmata.
  for (const [lon, lat, dn, km] of [
    [279.7, -68.7, 1256.709967734, 1.010731044759],
    [339.7, -71.5, 1783.631260455, -1.888912646873],
    [246, -33.7, 1491.638697556, null],
  ] as const) {
    assert.ok(Math.abs(required(mosaic.sample(lon, lat)) - dn) < 0.000001);
    if (km === null) assert.equal(dem.sample(lon, lat), null, 'Image coverage does not invent an elevation sample');
    else assert.ok(Math.abs(required(dem.sample(lon, lat)) - km) < 0.000001);
  }
  assert.equal(mosaic.sample(-80.3, -68.7), mosaic.sample(279.7, -68.7));
  for (const source of [mosaic, dem]) {
    assert.equal(source.sample(180, 60), null, 'Unobserved northern sample stays missing');
    assert.notEqual(source.sample(180, -85), null, 'Measured southern sample remains valid');
  }

  const {rgb, missing} = await readObservation(root, entry, policy, 360, 180);
  assert.equal(missing[30 * 360 + 180], 1);
  const index = 158 * 360 + 279;
  assert.equal(missing[index], 0);
  assert.deepEqual([...rgb.subarray(index * 3, index * 3 + 3)], [122, 122, 122]);
});
