import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { visibilityComponents } from '@cssearth/bake/prepared-presentation';
import { partitionSurface } from '@cssearth/bake/prepared-presentation';
import { verifyRayOrder } from './fixtures/prepared-visibility-oracle.mts';

type Triangle = Parameters<typeof visibilityComponents>[0][number];
const face = (z: number): Triangle => [[-2, -2, z], [2, -2, z], [0, 2, z]];
test('front-facing occluders paint after the faces behind them, independently of source order', () => {
  assert.deepEqual(visibilityComponents([face(2), face(0), face(1)], [1, 1, 1]), [[1], [2], [0]]);
  assert.deepEqual(visibilityComponents([face(2), face(0), face(1)], [-1, -1, -1]), [[0], [2], [1]]);
});
test('coplanar faces retain source order and exact sub-epsilon depth differences are not discarded', () => {
  assert.deepEqual(visibilityComponents([face(0), face(0)], [1, 1]), [[0], [1]]);
  assert.deepEqual(visibilityComponents([face(1e-30), face(0)], [1, 1]), [[1], [0]]);
});
test('intersecting faces remain one native depth component', () => {
  const crossing: Triangle = [[-2, -2, -1], [2, -2, 1], [0, 2, 0]];
  assert.deepEqual(visibilityComponents([face(0), crossing], [1, 1]), [[0, 1]]);
});
test('an irreducible core remains native while safely ordered faces are extracted', () => {
  const crossing: Triangle = [[-2, -2, -1], [2, -2, 1], [0, 2, 0]];
  const triangles = Array.from({ length: 130 }, (_, i) => i % 2 ? crossing : face(0));
  triangles.push(face(10));
  const plan = partitionSurface(triangles, 64, triangles.map(() => 1));
  assert.deepEqual(plan.groups.map(group => group.length), [130, 1]);
  assert.deepEqual(plan.groups.flat().toSorted((a, b) => a - b), triangles.map((_, i) => i));
});
test('a nonseparable mesh gets a fixed prepared order without changing its faces', () => {
  const triangles = [face(2), face(0), face(1)];
  const result = partitionSurface(triangles, 1, [1, 1, 1]);
  assert.deepEqual(result, { order: { sequence: [{ group: 0 }, { group: 1 }, { group: 2 }] }, groups: [[1], [2], [0]] });
});

test('prepared component painting matches independent front-facing ray intersections', () => {
  const triangles: Triangle[] = [];
  for (let z = -4; z <= 4; z++) triangles.push(face(z));
  // Nonintersecting oblique faces exercise perspective and opposed facing.
  triangles.push([[-3,-3,-3],[-3,3,3],[-3,3,-3]]);
  const signs = triangles.map((_, i) => i === 9 ? -1 : 1);
  const plan = partitionSurface(triangles, 2, signs);
  const eyes: Parameters<typeof verifyRayOrder>[3] = [[0,0,20], [6,4,20], [-6,-4,20], [-20,0,0], [20,0,0]];
  const targets = Array.from({ length: 25 }, (_, i): Triangle[number] => [(i % 5 - 2) / 4, (Math.floor(i / 5) - 2) / 4, 0]);
  assert.ok(verifyRayOrder(triangles, signs, plan, eyes, targets).overlaps > 50);
});


test('a separable convex surface keeps a fixed paint order through every camera octant', () => {
  const triangles: Triangle[] = [], signs: number[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    triangles.push([[x, 0, 0], [0, y, 0], [0, 0, z]]);
    signs.push(x * y * z);
  }
  // Geometric splitting is possible, but no two front-facing convex faces
  // occlude each other. It must not create camera-dependent z-index changes.
  const plan = partitionSurface(triangles, 1, signs);
  assert.ok('sequence' in plan.order);
  assert.ok(plan.order.sequence.every(entry => 'group' in entry));
  assert.equal(plan.groups.length, 8);
  const eyes: Triangle[number][] = [];
  for (const x of [-20, 20]) for (const y of [-20, 20]) for (const z of [-20, 20]) eyes.push([x, y, z]);
  const targets: Triangle[number][] = triangles.map(([a, b, c]) => [(a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
  assert.equal(verifyRayOrder(triangles, signs, plan, eyes, targets).rays, 64);
});
