import { expect, test } from 'vitest';
import { createPreparedRingProjector, createSphereChordTest, orbitBoundsMayContribute } from './prepared-ring-projection.js';
import { rayHitsSphereBefore } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';

const project = ([x, y, z]: Vector3) => [130 + 800 * x / -z, -40 + 800 * y / -z];
const limits = { toEye: (point: Vector3) => point, project, near: .1, clipX: 1000, clipY: 600 };

test('prepared orbit bounds reject only offscreen or fully faded chords across camera and physical scales', () => {
  let seed = 23751, rejected = 0, retained = 0;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const scale of [1, 1e8, 1e14]) for (let index = 0; index < 400; index++) {
    const radius = 10 ** (random() * 4 - 2) * scale;
    const center: Vector3 = [(random() - .5) * 3000 * scale, (random() - .5) * 2000 * scale,
      (index % 4 === 0 ? 1 : -1) * 10 ** (random() * 5) * scale];
    const vertices: Vector3[] = Array.from({ length: 16 }, () => {
      const a = random() * Math.PI * 2, z = random() * 2 - 1, r = Math.sqrt(1 - z * z) * radius;
      return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a), center[2] + z * radius];
    });
    const near = .1 * scale;
    const keep = orbitBoundsMayContribute(center, radius, 800, [130, -40], near, 1000, 600, 12);
    if (keep) { retained++; continue; }
    rejected++;
    const reference = createPreparedRingProjector({ ...limits, near, hidden: () => false })(vertices, vertices.map(() => 1));
    const xs = reference.flatMap(s => [s[0], s[2]]), ys = reference.flatMap(s => [s[1], s[3]]);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(reference.length === 0 || extent <= 12).toBe(true);
  }
  expect(rejected).toBeGreaterThan(500); expect(retained).toBeGreaterThan(30);
  expect(orbitBoundsMayContribute([0, 0, -.2], 1, 800, [130, -40], .1, 1000, 600, 12)).toBe(true);
  expect(orbitBoundsMayContribute([0, 0, -1000], 1, 800, [130, -40], .1, 1000, 600, 12)).toBe(false);
});

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

test('prepared active chord indices preserve clipping while avoiding zero-weight vertex transforms', () => {
  let transformed = 0;
  for (const scale of [1, 1e14]) for (const distance of [-200, -30, 0, 30, 200, 1e8]) {
    const vertices: Vector3[] = Array.from({ length: 128 }, (_, i) => [
      100 * Math.cos(i * Math.PI / 64) * scale, 60 * Math.sin(i * Math.PI / 64) * scale, distance * scale]);
    const trail = vertices.map((_, i) => i >= 100 ? (i - 99) / 28 : 0);
    const active = trail.flatMap((weight, index) => weight > 0 ? [index] : []);
    const common = { ...limits, near: .1 * scale, hidden: (point: Vector3) => rayHitsSphereBefore(point, [0, 0, -50 * scale], 10 * scale) };
    const reference = createPreparedRingProjector(common)(vertices, trail);
    transformed = 0;
    const result = createPreparedRingProjector({ ...common, toEye: point => { transformed++; return point; } })(vertices, trail, active);
    expect(result).toEqual(reference);
    expect(transformed).toBeLessThan(vertices.length / 2);
  }
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

test('measurement demand preserves the clipped extent up to its existing saturation at every physical scale', () => {
  let seed = 928571;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const scale of [1, 1e8, 1e16]) for (let view = 0; view < 80; view++) {
    const distance = (random() - .2) * 500 * scale, radius = 10 ** (random() * 3) * scale;
    const vertices: Vector3[] = Array.from({ length: 128 }, (_, index) => {
      const angle = index * Math.PI / 64;
      return [radius * Math.cos(angle), radius * .7 * Math.sin(angle), distance + radius * .4 * Math.sin(angle)];
    });
    const trail = vertices.map((_, index) => view % 3 === 0 && index < 93 ? 0 : (index + 1) / 128);
    const active = trail.flatMap((weight, index) => weight > 0 ? [index] : []);
    const occluder: Vector3 = [30 * scale, -15 * scale, -100 * scale];
    const projector = createPreparedRingProjector({ ...limits, near: .1 * scale,
      hidden: point => rayHitsSphereBefore(point, occluder, 12 * scale),
      mayOcclude: createSphereChordTest(occluder, 12 * scale, project) });
    const segments = projector(vertices, trail, active);
    const xs = segments.flatMap(s => [s[0], s[2]]), ys = segments.flatMap(s => [s[1], s[3]]);
    const extent = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    for (const saturation of [48, 128]) {
      expect(projector.measureExtent(vertices, trail, saturation, active)).toBe(Math.min(extent, saturation));
    }
  }
});

test('a saturated hidden orbit stops transforming chords while its visible path still projects completely', () => {
  const vertices: Vector3[] = Array.from({ length: 128 }, (_, index) => [100 * Math.cos(index * Math.PI / 64), 80 * Math.sin(index * Math.PI / 64), -200]);
  const trail = vertices.map(() => 1); let transforms = 0;
  const projector = createPreparedRingProjector({ ...limits, toEye: p => { transforms++; return p; }, hidden: () => false, mayOcclude: () => false });
  expect(projector.measureExtent(vertices, trail, 128)).toBe(128);
  expect(transforms).toBeLessThan(20);
  transforms = 0;
  expect(projector(vertices, trail)).toHaveLength(128);
  expect(transforms).toBe(128);
  for (const invalid of [0, NaN, Infinity]) expect(() => projector.measureExtent(vertices, trail, invalid)).toThrow();
});


test('interior prepared chords share one camera projection per endpoint without reusing a stale view', () => {
  const vertices: Vector3[] = Array.from({ length: 128 }, (_, index) => [
    100 * Math.cos(index * Math.PI / 64), 80 * Math.sin(index * Math.PI / 64), -200]);
  const trail = vertices.map(() => 1);
  let projections = 0, offset = 0;
  const projector = createPreparedRingProjector({ ...limits, hidden: () => { throw new Error('Unoccluded chord reached ray splitting'); },
    mayOcclude: () => false, project: p => { projections++; return [offset + 800 * p[0] / -p[2], 800 * p[1] / -p[2]]; } });
  const first = projector(vertices, trail);
  expect(first).toHaveLength(128);
  // Previously every chord projected both endpoints before and after clipping:
  // 512 calls. A handful of endpoint rounding corrections may need a reproject.
  expect(projections).toBeLessThan(150);
  offset = 100; projections = 0;
  const second = projector(vertices, trail);
  expect(second).toHaveLength(128);
  expect(projections).toBeLessThan(150);
  for (let i = 0; i < first.length; i++) {
    expect(second[i]![0]).toBeCloseTo(first[i]![0] + 100, 10);
    expect(second[i]![2]).toBeCloseTo(first[i]![2] + 100, 10);
    expect(second[i]![1]).toBe(first[i]![1]);
    expect(second[i]![3]).toBe(first[i]![3]);
    expect(second[i]![4]).toBe(first[i]![4]);
  }
});
