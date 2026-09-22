import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('comet-1p');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { readAuthoredRotation } from '../../../../tools/objects/authored-rotation.mts';
const root = resolve(import.meta.dirname, '../../../../src/objects/comet-1p');
const json = async (path: string) => JSON.parse((await readFile(resolve(root, path))).toString('utf8'));

test('Halley keeps east-positive source anchors, asymmetric origin and closed retained geometry', async () => {
  const config = await json('source/preparation/terrestrial.json'), profile = config.geometry.radialTerrain;
  const source = await loadPdsRadiusTable(resolve(root, 'source', profile.path), profile.grid);
  // Independent cardinal rows from the PDS4 table. 90E is distinct from 270E;
  // the long-axis ends have different distances from the published origin.
  for (const [lon, lat, metres] of [[0,0,3000],[90,0,3270],[180,0,3689.634],[270,0,3850],[0,90,5750],[0,-90,8800]] as const) {
    assert.ok(Math.abs(required(source.sample(lon, lat)) - metres) < 0.001);
  }
  const prepared = await json('prepared/terrain.json');
  const metresPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const positions = [], lookup = new Map(), indices = [];
  for (const face of prepared.faces) for (const v of face.vertices) {
    const p = v.map((x: number) => x * metresPerUnit), k = v.join(',');
    if (!lookup.has(k)) {
      // Compare distances instead of rounded strings at decimal half steps.
      const error = Math.min(...source.positions.map(q => Math.hypot(...p.map((x: number, i: number) => x - q[i]))));
      assert.ok(error < 1e-8, 'retain source positions within scale conversion roundoff');
      lookup.set(k, positions.length); positions.push(p);
    }
    indices.push(lookup.get(k));
  }
  assert.equal(prepared.faces.length, 1000);
  const topology = validateClosedMesh(Uint32Array.from(indices), positions);
  const full = validateClosedMesh(Uint32Array.from(source.indices.flat()), source.positions);
  assert.equal(topology.components, 1); assert.equal(topology.eulerCharacteristic, 2);
  assert.ok(Math.abs(topology.signedVolumeCubicMeters / full.signedVolumeCubicMeters - 1) < .01);
  assert.ok(Math.abs(full.signedVolumeCubicMeters - 402178495186.9002) < 1);
  assert.ok(Math.abs(Math.cbrt(full.signedVolumeCubicMeters * 3 / (4 * Math.PI)) - config.geometry.radiusKm * 1000) < .001);
});

test('Halley display attitude stays fixed without inventing a physical spin', async () => {
  const descriptor = await json('object.json');
  const ref = descriptor.properties.recipe.sources.find((s: { id: string; }) => s.id === 'rotation');
  const a = await readAuthoredRotation(root, ref, 2461286.5);
  const b = await readAuthoredRotation(root, ref, 2461316.5);
  assert.deepEqual(a, b); assert.equal(a.spinRateRadPerDay, 0);
  assert.equal(a.poleDeclinationRad, Math.PI / 2);
});
