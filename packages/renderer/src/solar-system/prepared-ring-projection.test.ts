import { expect, test } from 'vitest';
import { createPreparedRingProjector, createRetainedRingProjection, createSphereChordTest, orbitBoundsMayContribute, orbitProjectionCapacity } from './prepared-ring-projection.js';
import { rayHitsSphereBefore } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';

// The projector reads prepared vertices as consecutive x, y, z; these fixtures are written as points.
type Projector = ReturnType<typeof createPreparedRingProjector>;
type Rest<F> = F extends (vertices: Float64Array, ...rest: infer R) => unknown ? R : never;
const createProjector = (options: Parameters<typeof createPreparedRingProjector>[0]) => {
  const projector = createPreparedRingProjector(options), flat = (points: readonly Vector3[]) => Float64Array.from(points.flat());
  return Object.assign((points: readonly Vector3[], ...rest: Rest<Projector>) => projector(flat(points), ...rest),
    { measureExtent: (points: readonly Vector3[], ...rest: Rest<Projector['measureExtent']>) => projector.measureExtent(flat(points), ...rest) });
};
const project = ([x, y, z]: Vector3) => [130 + 800 * x / -z, -40 + 800 * y / -z];
const limits = { toEye: (point: Vector3) => point, project, near: .1, clipX: 1000, clipY: 600 };

test('the chord test bounds a sphere by its exact screen outline, inside the old cube bound', () => {
  let seed = 12345;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let trial = 0; trial < 200; trial++) {
    const radius = 1 + random() * 20, center: Vector3 = [(random() - .5) * 200, (random() - .5) * 200, -radius - 1 - random() * 300];
    const test = createSphereChordTest(center, radius, project);
    let outside = 0;
    for (let sample = 0; sample < 400; sample++) {
      const u = random() * 2 - 1, angle = random() * 2 * Math.PI, ring = Math.sqrt(1 - u * u);
      const point = project([center[0] + radius * ring * Math.cos(angle), center[1] + radius * ring * Math.sin(angle), center[2] + radius * u]);
      // A zero-length chord at each surface point must overlap the bound.
      if (!test(point, point)) outside++;
    }
    expect(outside).toBe(0);
  }
  // A near sphere: points just beyond its outline but inside the cube's corner bound no longer count.
  const near: Vector3 = [0, 0, -12], test = createSphereChordTest(near, 10, project);
  const edge = project([Math.sin(Math.asin(10 / 12)), 0, -Math.cos(Math.asin(10 / 12))])[0]!;
  expect(test([edge - 1, -40], [edge - 1, -40])).toBe(true);
  expect(test([edge + 50, -40], [edge + 50, -40])).toBe(false);
  expect(project([10, 0, -2])[0]! > edge + 50).toBe(true);
});

test('distance fade preserves nearby chords and clips a long distant continuation into bounded opacity bands', () => {
  const vertices: Vector3[] = [[-10, 0, -100], [10, 0, -100], [2000, 200, -4000]];
  const trail = [1, 1], pool = createRetainedRingProjection(orbitProjectionCapacity(vertices.length));
  const options = { ...limits, hidden: () => false, mayOcclude: () => false };
  const original = createProjector(options)(vertices, trail, undefined, true, undefined, false);
  const projector = createProjector({ ...options, depthFade: { start: 400, end: 1600 } });
  const faded = projector(vertices, trail, undefined, true, pool, false);
  expect(faded[0]).toEqual(original[0]);
  expect(faded.length).toBeGreaterThan(5);
  expect(faded.length).toBeLessThan(20);
  expect(faded.some(s => s[4] > 0 && s[4] < .2)).toBe(true);
  expect(faded.every(s => s[4] > 0 && s[4] <= 1 && s.every(Number.isFinite))).toBe(true);
  // The far endpoint no longer appears; intermediate points stay on the
  // original projected line, rather than inventing a different orbit curve.
  const end = project(vertices[2]);
  expect(faded.every(s => Math.hypot(s[2] - end[0], s[3] - end[1]) > 1)).toBe(true);
  for (const s of faded.slice(1)) {
    const line = original[1], dx = line[2] - line[0], dy = line[3] - line[1];
    expect(Math.abs((s[0] - line[0]) * dy - (s[1] - line[1]) * dx)).toBeLessThan(1e-7);
  }
  expect(projector(vertices, trail, undefined, true, pool, false)).toBe(faded);
  const distant = createProjector({ ...options, depthFade: { start: 5000, end: 20000 } })(vertices, trail, undefined, true, undefined, false);
  expect(distant).toEqual(original);
});

test('fade clipping handles reversed chords, near-plane crossings and hidden trails', () => {
  const vertices: Vector3[] = [[50, 0, -4000], [10, 0, -100], [0, 0, 100]];
  const projector = createProjector({ ...limits, hidden: () => false, depthFade: { start: 400, end: 1600 } });
  const faded = projector(vertices, [1, 1], undefined, false, undefined, false);
  expect(faded.length).toBeGreaterThan(10);
  expect(faded.every(s => s.every(Number.isFinite))).toBe(true);
  expect(faded[0][4]).toBeLessThan(faded.at(-1)![4]);
  expect(projector(vertices, [0, 0], undefined, false, undefined, false)).toEqual([]);
  expect(() => createProjector({ ...limits, hidden: () => false, depthFade: { start: 400, end: 300 } })).toThrow(/fade/);
});

test('a retained projection preserves clipped snapshots while reusing bounded slots through retirement and re-entry', () => {
  const vertices: Vector3[] = Array.from({ length: 128 }, (_, i) => [
    100 * Math.cos(i * Math.PI / 64), 80 * Math.sin(i * Math.PI / 64), -200]);
  const trail = vertices.map(() => 1), retained = createRetainedRingProjection(vertices.length * 2);
  let offset = 0;
  const projector = createProjector({ ...limits,
    toEye: p => [p[0] + offset, p[1], p[2]],
    hidden: p => rayHitsSphereBefore(p, [0, 0, -100], 10),
    mayOcclude: createSphereChordTest([0, 0, -100], 10, project) });
  const first = projector(vertices, trail, undefined, false, retained);
  const slots = [...first], snapshot = projector(vertices, trail);
  for (offset of [150, 1000, -500, 0]) {
    const expected = projector(vertices, trail);
    const actual = projector(vertices, trail, undefined, false, retained);
    expect(actual).toBe(first);
    expect(actual).toEqual(expected);
    for (let i = 0; i < Math.min(slots.length, actual.length); i++) expect(actual[i]).toBe(slots[i]);
  }
  expect(snapshot).toEqual(first);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot[0])).toBe(true);
  expect(() => projector(vertices, trail, undefined, false, createRetainedRingProjection(1))).toThrow(/capacity/);
});

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
    const reference = createProjector({ ...limits, near, hidden: () => false })(vertices, vertices.map(() => 1));
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
  const reference = createProjector({ ...limits, hidden })(vertices, trail);
  expect(calls).toBeGreaterThan(60); calls = 0;
  const result = createProjector({ ...limits, hidden, mayOcclude: createSphereChordTest(center, radius, project) })(vertices, trail);
  expect(result).toEqual(reference); expect(calls).toBe(0);
});

test('full orbit reveal includes zero-weight chords at uniform opacity and restores the trail afterwards', () => {
  const vertices: Vector3[] = [[-50, 30, -200], [50, 30, -200], [50, 40, -200], [-50, 40, -200]];
  const trail = [0, .2, .6, 1], active = [1, 2, 3];
  const projector = createProjector({ ...limits, hidden: () => false });
  const original = projector(vertices, trail, active);
  const revealed = projector(vertices, trail, active, true);
  expect(original).toHaveLength(3);
  expect(revealed).toHaveLength(4);
  expect(revealed).toEqual(projector(vertices, [1, 1, 1, 1]));
  expect(revealed.every(segment => segment[4] === 1)).toBe(true);
  expect(projector(vertices, trail, active)).toEqual(original);
  expect(trail).toEqual([0, .2, .6, 1]);
});

test('full orbit reveal never adds a closing chord to an open trajectory', () => {
  const vertices: Vector3[] = [[-50, 30, -200], [50, 30, -200], [50, 40, -200], [-50, 40, -200]];
  const trail = [0, .5, 1], active = [1, 2], retained = createRetainedRingProjection(8);
  const projector = createProjector({ ...limits, hidden: () => false, mayOcclude: () => false });
  const original = projector(vertices, trail, active, false, undefined, false);
  const revealed = projector(vertices, trail, active, true, undefined, false);
  expect(original).toHaveLength(2);
  expect(revealed).toHaveLength(vertices.length - 1);
  expect(revealed.every(segment => segment[4] === 1)).toBe(true);
  expect(revealed).toEqual(projector(vertices, [1, 1, 1, 0]));
  expect(projector(vertices, trail, active, true, retained, false)).toEqual(revealed);
  expect(projector(vertices, trail, active, false, retained, false)).toEqual(original);
  expect(projector(vertices, [1, 1, 1, 1], undefined, true), 'bound rings retain their closing chord').toHaveLength(4);
});

test('prepared active chord indices preserve clipping while avoiding zero-weight vertex transforms', () => {
  let transformed = 0;
  for (const scale of [1, 1e14]) for (const distance of [-200, -30, 0, 30, 200, 1e8]) {
    const vertices: Vector3[] = Array.from({ length: 128 }, (_, i) => [
      100 * Math.cos(i * Math.PI / 64) * scale, 60 * Math.sin(i * Math.PI / 64) * scale, distance * scale]);
    const trail = vertices.map((_, i) => i >= 100 ? (i - 99) / 28 : 0);
    const active = trail.flatMap((weight, index) => weight > 0 ? [index] : []);
    const common = { ...limits, near: .1 * scale, hidden: (point: Vector3) => rayHitsSphereBefore(point, [0, 0, -50 * scale], 10 * scale) };
    const reference = createProjector(common)(vertices, trail);
    transformed = 0;
    const result = createProjector({ ...common, toEye: point => { transformed++; return point; } })(vertices, trail, active);
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
      const reference = createProjector(common);
      const optimized = createProjector({ ...common, mayOcclude: createSphereChordTest(c, r, project) });
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
    // Extent is independent of traversal order, including near-plane and
    // occlusion splits. Drawing continues to consume the authored order.
    const scattered = [...active].sort((a, b) => (a * 73) % 128 - (b * 73) % 128);
    const occluder: Vector3 = [30 * scale, -15 * scale, -100 * scale];
    const projector = createProjector({ ...limits, near: .1 * scale,
      hidden: point => rayHitsSphereBefore(point, occluder, 12 * scale),
      mayOcclude: createSphereChordTest(occluder, 12 * scale, project) });
    const segments = projector(vertices, trail, active);
    const xs = segments.flatMap(s => [s[0], s[2]]), ys = segments.flatMap(s => [s[1], s[3]]);
    const extent = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    for (const saturation of [48, 128]) {
      expect(projector.measureExtent(vertices, trail, saturation, active)).toBe(Math.min(extent, saturation));
      expect(projector.measureExtent(vertices, trail, saturation, scattered)).toBe(Math.min(extent, saturation));
    }
  }
});

test('a saturated hidden orbit stops transforming chords while its visible path still projects completely', () => {
  const vertices: Vector3[] = Array.from({ length: 128 }, (_, index) => [100 * Math.cos(index * Math.PI / 64), 80 * Math.sin(index * Math.PI / 64), -200]);
  const trail = vertices.map(() => 1); let transforms = 0;
  const projector = createProjector({ ...limits, toEye: p => { transforms++; return p; }, hidden: () => false, mayOcclude: () => false });
  expect(projector.measureExtent(vertices, trail, 128)).toBe(128);
  expect(transforms).toBeLessThan(20);
  const sequentialTransforms = transforms;
  transforms = 0;
  const separated = [0, 64, ...vertices.flatMap((_, index) => index === 0 || index === 64 ? [] : [index])];
  expect(projector.measureExtent(vertices, trail, 128, separated)).toBe(128);
  expect(transforms).toBeLessThan(sequentialTransforms);
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
  const projector = createProjector({ ...limits, hidden: () => { throw new Error('Unoccluded chord reached ray splitting'); },
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
