import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseObjShape } from './obj-shape.mts';
import { createSourceMeshLighting } from './source-mesh-lighting.mts';
const recipe = { maximumDistanceMeters: 2, rayOffsetMeters: .001, ambient: .2, diffuse: .8,
  floodLights: [{ direction: [0,0,1], weight: .8 }] };
const floor = 'v -10 -10 0\nv 10 -10 0\nv 0 10 0\nf 1 2 3\n';
const roof = 'v -10 -10 5\nv 0 10 5\nv 10 -10 5\nf 4 5 6\n';
const mesh = (roofed = false) => parseObjShape(floor + (roofed ? roof : ''), {
  metersPerUnit: 1, expectedVertices: roofed ? 6 : 3, expectedFaces: roofed ? 2 : 1 });

test('texel projection uses local origins and a measured overhang casts a shadow', () => {
  const open = createSourceMeshLighting(mesh(), recipe, 1, [0,0,1]);
  assert.deepEqual(open.sample([0,0,.1], [0,0,1]), { flood: 1, shadow: 1 });
  assert.deepEqual(open.sample([0,0,-.1], [0,0,1]), { flood: 1, shadow: 1 });
  const closed = createSourceMeshLighting(mesh(true), recipe, 1, [0,0,1]);
  assert.deepEqual(closed.sample([0,0,.1], [0,0,1]), { flood: 1, shadow: .2 });
  assert.equal(closed.report.projected, 1); assert.equal(closed.report.castShadow, 1);
  assert.ok(Math.abs(closed.report.maximumProjectionMeters - .1) < 1e-9);
});
test('a missing nearby hit is reported and uses the supplied coarse normal', () => {
  const lighting = createSourceMeshLighting(mesh(), recipe, 1, [0,0,1]);
  assert.deepEqual(lighting.sample([30,30,0], [1,0,0]), { flood: .2, shadow: .2 });
  assert.equal(lighting.report.fallback, 1);
  for (const change of [{ ambient: .9 }, { rayOffsetMeters: 5 }, { maximumDistanceMeters: Infinity }]) {
    assert.throws(() => createSourceMeshLighting(mesh(), { ...recipe, ...change }, 1, [0,0,1]));
  }
});

test('uniform flood preserves the unshaded surface while the opt-in bank keeps source shadows', () => {
  const lighting = createSourceMeshLighting(mesh(true), { ...recipe, uniformFlood: true }, 1, [0,0,1]);
  assert.deepEqual(lighting.sample([0,0,.1], [0,0,1]), { flood: 1, shadow: .2 });
  assert.deepEqual(lighting.sample([30,30,0], [1,0,0]), { flood: 1, shadow: .2 });
  assert.deepEqual(lighting.sample([30,30,0], [0,0,1]), { flood: 1, shadow: 1 });
  assert.throws(() => createSourceMeshLighting(mesh(), { ...recipe, uniformFlood: 'true' }, 1, [0,0,1]));
});
