import {required} from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';

const root = new URL('../../../../src/planets/umbriel/source/', import.meta.url).pathname;
const read = async (path: string) => JSON.parse((await readFile(root + path)).toString('utf8'));

test('Umbriel preserves its original cube inside the pinned source gzip', async () => {
  const {inputs} = await read('manifest.json');
  const entry = inputs.find((input: { lensId: string; }) => input.lensId === 'normal');
  const original = gunzipSync(await readFile(root + entry.path));
  assert.equal(original.length, 1976871);
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '7b794c83fd37fd0b400dacbc4aa253441fe7e4355297741c14f5467c7e96123b');
});

test('Umbriel registers the original 128-column tiles across the longitude seam', async () => {
  const config = await read('preparation/terrestrial.json');
  const {inputs} = await read('manifest.json');
  const entry = inputs.find((input: { lensId: string; }) => input.lensId === 'normal');
  const policy = config.raster.observations[0].validity;
  const mosaic = await loadScienceSurface(root, {path: entry.path, format: 'isis3', grid: policy.grid, sampling: 'bilinear'});
  // Python struct independently read eight 128x460 tiles (including the final
  // padded tile), projected the original label coordinates and interpolated.
  // Feature centres: https://planetarynames.wr.usgs.gov/SearchResults?Target=95_Umbriel
  for (const [longitude, latitude, expected] of [
    [273.6, -7.9, 1586.4980496938824], // Wunda
    [44.3, -37.4, 469.6171207484404], // Fin
    [345.7, -10.8, 649.770441866034], // Kanaloa
    [331.7, -1.8, 326.5726089601968], // Skynd
    [1.8, -30, 548.1517898758885], // Wokolo
  ] as const) assert.ok(Math.abs(required(mosaic.sample(longitude, latitude)) - expected) < .000001);
  assert.equal(mosaic.sample(180, 60), null, 'Unobserved north remains missing');
  assert.equal(mosaic.sample(90, 0), null, 'Unobserved equatorial sector remains missing');
  assert.ok(Math.abs(required(mosaic.sample(180, -85)) - 500.18638675202806) < .000001);
  assert.equal(mosaic.sample(0, -60), mosaic.sample(360, -60));

  const {rgb, missing} = await readObservation(root, entry, policy, 360, 180);
  assert.equal(missing[30 * 360 + 180], 1);
  const index = 135 * 360 + 270;
  const [low, high] = policy.displayRange;
  assert.equal(missing[index], 0);
  assert.equal(rgb[index * 3], Math.round((611.3518118807181 - low) / (high - low) * 255));
  // The 0–1100 trial clipped Wunda's bright ring into flat white patches.
  // This observed pixel near its centre must retain highlight headroom.
  const wunda = 97 * 360 + 273;
  assert.equal(missing[wunda], 0);
  assert.ok(rgb[wunda * 3] > 128 && rgb[wunda * 3] < 255,
    'Wunda ring brightness must remain visible without clipping to white');
});

test('Umbriel context crop preserves observed terrain over its complete footprint', async () => {
  const descriptor = await read('preparation/navigation.json');
  const {source} = descriptor;
  const {missing} = await readObservation(root, source, source.raster, source.width, source.height);
  const crop = descriptor.operations.find((operation: { type: string; }) => operation.type === 'extract');
  for (let y = crop.top; y < crop.top + crop.height; y++) {
    for (let x = crop.left; x < crop.left + crop.width; x++) {
      assert.equal(missing[y * source.width + x], 0);
    }
  }
});
