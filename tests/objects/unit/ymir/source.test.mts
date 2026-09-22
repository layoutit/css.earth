import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('ymir');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const root = new URL('../../../../src/objects/ymir/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Ymir sampled surface preserves the published triangle, polar size and cap volume', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/model.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.components, 1);
  assert.equal(topology.eulerCharacteristic, 2);

  // Reconstruct the equatorial constraint directly from the author's published
  // 25/24/20 km edges, independently of measurements.json or authored vertices.
  const x = (24 ** 2 + 25 ** 2 - 20 ** 2) / 50;
  const y = Math.sqrt(24 ** 2 - x ** 2);
  const centroid = [(25 + x) / 3, y / 3];
  const triangle = [[0, 0], [25, 0], [x, y]].map(point => point.map((value, axis) => value - centroid[axis]));
  const equator = shape.positions.filter(point => Math.abs(point[2]) < 1e-8);
  const touchedEdges = new Set();
  for (const point of equator) {
    const distances = triangle.map((a, edge) => {
      const b = triangle[(edge + 1) % 3];
      return ((b[0] - a[0]) * (point[1] / 1000 - a[1]) - (b[1] - a[1]) * (point[0] / 1000 - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
    });
    assert.ok(distances.every(distance => distance > -1e-8), 'equator escapes the published triangle');
    const edge = distances.findIndex(distance => Math.abs(distance) < 1e-8);
    assert.notEqual(edge, -1, 'equator no longer follows a triangular edge');
    touchedEdges.add(edge);
  }
  assert.equal(touchedEdges.size, 3);
  for (const latitude of [-90, 90]) assert.ok(Math.abs(required(shape.sample(0, latitude)) - 8000) < 0.001);
  // Elliptical caps integrate to 4Ac/3. The 1.5% allowance is for the 5-degree
  // triangular sampling, not the uncertainty of the inferred physical shape.
  const analyticVolume = 4 * (25 * y / 2) * 8 / 3 * 1e9;
  assert.ok(Math.abs(topology.signedVolumeCubicMeters / analyticVolume - 1) < 0.015);
});

test('Ymir material is entirely marked as unmapped', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).raw().toBuffer();
  assert.equal(recipe.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.length > 0 && pixels.every(value => value === 160));
});
