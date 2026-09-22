import {requireRecord} from '../../../../tools/sources/source-values.mts';
import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {decodeCalibratedCamera} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
import {coveredPixels,loadLens} from '../surface-observation-lens.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/proteus/source');
const readJson = async (path: string) => JSON.parse(await readFile(resolve(source, path), 'utf8'));
const anchors:Record<string,readonly (readonly[number,number,number])[]> = {
  c1137328: [[474, 500, 295], [464, 505, 266], [414, 440, -48], [0, 0, 0]],
  c1137339: [[467, 591, 322], [457, 596, 371], [410, 531, -17], [0, 0, 0]],
  c1137350: [[393, 376, 270], [383, 381, 343], [333, 316, -47], [0, 0, 0]],
};

test('Proteus color preserves the six exact public inputs and signed FICOR I/F anchors', async () => {
  const manifest = await readJson('manifest.json');
  const entries = manifest.inputs.filter((input: { consumers: string|string[]; }) => input.consumers.includes('voyager-color-frames'));
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    const bytes = await readFile(resolve(source, entry.path));
    assert.ok(bytes.length > 0, entry.path);
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
  const observation = await loadLens('proteus', 'filter-color');
  const { rgb, missing } = observation.preview(96, 48);
  const valid = Array.from(missing, (value, index) => value ? -1 : index).filter(index => index >= 0);
  assert.ok(valid.length > 40, 'the selected three-band interior must contain actual mapped data');
  assert.ok(valid.length < missing.length/2, 'the unseen globe must remain unknown');
  assert.ok(valid.some(index => rgb[index*3] !== rgb[index*3+2]), 'filter color must retain measured band differences');
  const bands = array(requireRecord)(requireRecord(observation.report.frames[0]).bands);
  assert.deepEqual(bands.map(band => requireRecord(band).filter), ['GREEN', 'BLUE', 'VIOLET']);
  // Point the violet camera away from the body: no color may be borrowed from the other filters.
  const outside = await loadLens('proteus', 'filter-color', recipe => { requireRecord(array(requireRecord)(recipe.frames)[0].blue).center = [2000, 2000]; });
  assert.equal(coveredPixels(outside.preview(32, 16).missing), 0, 'no color may be borrowed from other filters when violet is absent');
});
