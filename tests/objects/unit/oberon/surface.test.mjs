import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';

const root = new URL('../../../../src/planets/oberon/source/', import.meta.url).pathname;
const read = async path => JSON.parse(await readFile(root + path));

test('Oberon preserves the original cube inside its source gzip', async () => {
  const {inputs} = await read('manifest.json');
  const entry = inputs.find(input => input.lensId === 'normal');
  const bytes = gunzipSync(await readFile(root + entry.path));
  assert.equal(bytes.length, 1926319);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '4eaa0d4c9a04eed1185d06b54d17229a9ea30ff130fe5b36e49c5b39a01646ee');
});

test('Oberon native tile order and negative-longitude map origin preserve geographic samples', async () => {
  const config = await read('preparation/terrestrial.json');
  const {inputs} = await read('manifest.json');
  const entry = inputs.find(input => input.lensId === 'normal');
  const policy = config.raster.observations[0].validity;
  const mosaic = await loadScienceSurface(root, {path: entry.path, format: 'isis3', grid: policy.grid, sampling: 'bilinear'});
  // Independently decoded with Python struct from the pinned original's 319x479
  // tiles, then projected and interpolated at USGS Gazetteer feature centres.
  for (const [longitude, latitude, expected] of [
    [44.4, -46.1, 1801.8438809626675], // Hamlet
    [112.5, -58.4, 744.4427197819706], // Macbeth
    [42.9, -66, 1238.0726591338328], // Othello
    [345.2, -11.4, 561.2082762425086], // Coriolanus
  ]) assert.ok(Math.abs(mosaic.sample(longitude, latitude) - expected) < .000001);
  assert.equal(mosaic.sample(180, 60), null, 'Unobserved north remains missing');
  assert.ok(Math.abs(mosaic.sample(180, -85) - 805.4895808007486) < .000001);
  assert.equal(mosaic.sample(0, -60), mosaic.sample(360, -60), 'Prime-meridian wrap retains the same samples');

  const {rgb, missing} = await readObservation(root, entry, policy, 360, 180);
  assert.equal(missing[30 * 360 + 180], 1);
  const index = 136 * 360 + 44;
  assert.equal(missing[index], 0);
  assert.equal(rgb[index * 3], Math.round(1109.5577025264845 / 2100 * 255));
  const dark = 101 * 360 + 345;
  assert.equal(missing[dark], 0, 'Observed dark terrain is not a coverage gap');
  assert.ok(rgb[dark * 3] > 0 && rgb[dark * 3] < 128);
});

test('Oberon context crop consumes an entirely observed portion of the mapped source', async () => {
  const descriptor = await read('preparation/navigation.json');
  const {source} = descriptor;
  const {missing} = await readObservation(root, source, source.raster, source.width, source.height);
  const crop = descriptor.operations.find(operation => operation.type === 'extract');
  for (let y = crop.top; y < crop.top + crop.height; y++) {
    for (let x = crop.left; x < crop.left + crop.width; x++) {
      assert.equal(missing[y * source.width + x], 0);
    }
  }
});
