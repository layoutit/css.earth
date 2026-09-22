import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('siarnaq');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const root = new URL('../../../../src/objects/siarnaq/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Siarnaq sampled envelope preserves figure proportions and adopted volume', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/model.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.components, 1);
  assert.equal(topology.eulerCharacteristic, 2);

  // Independent anchors from the two published model views: horizontal span
  // 465 px in both; polar height 344 px; north-view vertical span 437 px.
  const spans = [0, 1, 2].map(axis => {
    const values = shape.positions.map(point => point[axis]);
    return Math.max(...values) - Math.min(...values);
  });
  assert.ok(Math.abs(spans[0] / spans[1] - 465 / 437) < 0.015);
  assert.ok(Math.abs(spans[2] / spans[0] - 344 / 465) < 0.015);
  // The adopted projected envelope is asymmetric; a centered ellipsoid cannot
  // substitute for it while preserving this source feature.
  assert.ok(required(shape.sample(180, 0)) / required(shape.sample(0, 0)) > 1.1);
  const adoptedVolume = 4 * Math.PI * 19500 ** 3 / 3;
  assert.ok(Math.abs(topology.signedVolumeCubicMeters / adoptedVolume - 1) < 0.01);
});

test('Siarnaq material is entirely marked as unmapped', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).raw().toBuffer();
  assert.equal(recipe.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.length > 0 && pixels.every(value => value === 160));
});
