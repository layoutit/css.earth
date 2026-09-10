import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {decodeCalibratedCamera, prepareShapeCameraColor} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';

const source = resolve(import.meta.dirname, '../../../../src/planets/proteus/source');
const readJson = async path => JSON.parse(await readFile(resolve(source, path), 'utf8'));
const anchors = {
  c1137328: [[474, 500, 295], [464, 505, 266], [414, 440, -48], [0, 0, 0]],
  c1137339: [[467, 591, 322], [457, 596, 371], [410, 531, -17], [0, 0, 0]],
  c1137350: [[393, 376, 270], [383, 381, 343], [333, 316, -47], [0, 0, 0]],
};

test('Proteus color preserves the six exact public inputs and signed FICOR I/F anchors', async () => {
  const manifest = await readJson('manifest.json');
  const entries = manifest.inputs.filter(input => input.consumers.includes('voyager-color-frames'));
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    const bytes = await readFile(resolve(source, entry.path));
    assert.equal(bytes.length, entry.expectedBytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.expectedSha256);
    if (!entry.path.endsWith('.IMG')) continue;
    const id = entry.path.match(/(C\d+)_GEOMED/)[1].toLowerCase();
    const image = decodeCalibratedCamera(bytes);
    assert.equal(image.width, 1000); assert.equal(image.height, 1000); assert.equal(image.offset, 2000);
    // Independently read archived little-endian signed DN; the attached label
    // and detached REFLECTANCE_SCALING_FACTOR both specify I/F = DN * 0.0001.
    for (const [x, y, dn] of anchors[id]) assert.ok(Math.abs(image.data[y*1000+x]-dn*.0001) < 1e-8);
  }
});

test('Proteus filter color samples all three actual cameras and withholds a missing channel', async () => {
  const manifest = await readJson('manifest.json');
  const terrestrial = await readJson('preparation/terrestrial.json');
  const recipe = terrestrial.raster.mosaics.find(map => map.id === 'filter-color');
  const entries = manifest.inputs.filter(input => input.consumers.includes(recipe.consumer));
  const shape = terrestrial.geometry.radialTerrain;
  const map = await prepareShapeCameraColor(source, entries, recipe, 96, 48, shape);
  const valid = Array.from(map.missing, (missing, index) => missing ? -1 : index).filter(index => index >= 0);
  assert.ok(valid.length > 40, 'the selected three-band interior must contain actual mapped data');
  assert.ok(valid.length < map.missing.length/2, 'the unseen globe must remain unknown');
  assert.ok(valid.some(index => map.rgb[index*3] !== map.rgb[index*3+2]), 'filter color must retain measured band differences');
  for (const channel of map.grid.channels) {
    assert.ok(channel.coveragePixels >= valid.length);
    assert.equal(channel.frames[0].level, 1);
    assert.ok(Number.isFinite(channel.beforeDisplay.mean));
    assert.ok(channel.frames[0].maskedSourceSamples.count > 0);
  }
  const outside = structuredClone(recipe);
  outside.channels[2].frames[0].center = [2000, 2000];
  const missingBand = await prepareShapeCameraColor(source, entries, outside, 32, 16, shape);
  assert.equal(missingBand.grid.channels[2].coveragePixels, 0);
  assert.equal(missingBand.grid.coveragePixels, 0, 'no color may be borrowed from other filters when violet is absent');
  assert.ok(missingBand.missing.every(value => value === 1));
});
