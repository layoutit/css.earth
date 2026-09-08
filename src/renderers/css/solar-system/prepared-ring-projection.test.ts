import { expect, test } from 'vitest';
import { createPreparedRingProjector, createSphereChordTest } from './prepared-ring-projection.js';
import { rayHitsSphereBefore } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';

const project = ([x, y, z]: Vector3) => [130 + 800 * x / -z, -40 + 800 * y / -z];
const limits = { toEye: (point: Vector3) => point, project, near: .1, clipX: 1000, clipY: 600 };

test('off-shadow prepared chords bypass the detailed ray test without changing projection', () => {
  const center: Vector3 = [0, 0, -100], radius = 1;
  const vertices: Vector3[] = [[-50, 30, -200], [50, 30, -200], [50, 40, -200], [-50, 40, -200]];
  const trail = [1, .8, .6, .4]; let calls = 0;
  const hidden = (p: Vector3) => { calls++; return rayHitsSphereBefore(p, center, radius); };
  const reference = createPreparedRingProjector({ ...limits, hidden })(vertices, trail);
  expect(calls).toBeGreaterThan(60); calls = 0;
  const result = createPreparedRingProjector({ ...limits, hidden, mayOcclude: createSphereChordTest(center, radius, project) })(vertices, trail);
  expect(result).toEqual(reference); expect(calls).toBe(0);
});

test('broad phase preserves detailed clipping at limbs, eye plane, near-plane crossings and astronomical scales', () => {
  let seed = 93217;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const scale of [1, 1e8, 1e14]) {
    for (const center of [[0, 0, -100], [20, -10, -50], [0, 0, -.5], [0, 0, 1]] as Vector3[]) {
      const c = center.map(v => v * scale) as unknown as Vector3, r = 3 * scale;
      const hidden = (p: Vector3) => rayHitsSphereBefore(p, c, r);
      const common = { ...limits, near: .1 * scale, hidden };
      const reference = createPreparedRingProjector(common);
      const optimized = createPreparedRingProjector({ ...common, mayOcclude: createSphereChordTest(c, r, project) });
      const segments: Vector3[][] = [
        [[-20, 0, -200], [20, 0, -200]], // Through the centre of the shadow.
        [[-20, 6, -200], [20, 6, -200]], // Grazing limb.
        [[-5, 0, .5], [5, 0, -200]], // Crosses the eye/near plane.
      ];
      for (let i = 0; i < 200; i++) segments.push(Array.from({length: 2}, () => [
        (random() - .5) * 300, (random() - .5) * 200, 2 - random() * 400,
      ] as Vector3));
      for (const segment of segments) {
        const vertices = segment.map(p => p.map(v => v * scale) as unknown as Vector3);
        expect(optimized(vertices, [1, 0])).toEqual(reference(vertices, [1, 0]));
      }
    }
  }
});
