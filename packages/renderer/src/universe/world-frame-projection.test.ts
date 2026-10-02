import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createWorldFrameProjection } from './world-frame-projection.js';
import { createPreparedRingProjector, createSphereChordTest } from '../solar-system/prepared-ring-projection.js';
import { rayHitsSphereBefore } from '@cssearth/engine';
import type { Vector3 } from '@cssearth/engine';

test('one view shares body eyes and parent shadow bounds without retaining another view', () => {
  const focus = { id: 'focus', positionM: [0, 0, -100] as Vector3, radiusM: 10 };
  const parent = { id: 'parent', positionM: [15, 0, -90] as Vector3, radiusM: 4 };
  let transforms = 0, projections = 0;
  const toEye = (point: Vector3) => { transforms++; return [...point] as Vector3; };
  const project = (point: Vector3) => { projections++; return [800 * point[0] / -point[2], 800 * point[1] / -point[2]]; };
  const first = createWorldFrameProjection(focus, focus, toEye, project);
  const common = first.occlusion(null), other = first.occlusion(parent);
  for (let index = 0; index < 100; index++) {
    assert.equal(first.occlusion(focus), common);
    assert.equal(first.occlusion(parent), other);
    assert.equal(first.eye(focus), first.eye(focus));
    first.eye(parent);
  }
  assert.equal(transforms, 2);
  assert.equal(projections, 8); // Four tangent directions of each unique occluder.
  assert.equal(common.hidden([0, 0, -110]), true);
  assert.equal(common.hidden([0, 0, -110], focus.id), false);
  const next = createWorldFrameProjection(focus, parent,
    point => [point[0] + 200, point[1], point[2]], project);
  assert.deepEqual(next.eye(focus), [200, 0, -100]);
  assert.equal(next.occlusion(null).hidden([0, 0, -110]), false);
  assert.equal(next.occlusion(parent), next.occlusion(null));
  assert.deepEqual(first.eye(focus), [0, 0, -100]);
});

test('a sphere wholly behind the eye plane hides nothing and sends no chord to the detailed split', () => {
  const behind = { id: 'sun', positionM: [0, 0, 50] as Vector3, radiusM: 10 };
  const front = { id: 'earth', positionM: [0, 0, -100] as Vector3, radiusM: 10 };
  const project = (point: Vector3) => [800 * point[0] / -point[2], 800 * point[1] / -point[2]];
  const frame = createWorldFrameProjection(behind, front, point => [...point] as Vector3, project);
  const occlusion = frame.occlusion(null);
  // The front sphere still hides what lies behind it; the one behind the eye hides nothing, exactly as the ray test says.
  assert.equal(occlusion.hidden([0, 0, -200]), true);
  assert.equal(occlusion.hidden([30, 0, -200]), false);
  for (const target of [[30, 0, -200], [0, 5, -1e6], [-1, 1, -0.5]] as Vector3[]) assert.equal(rayHitsSphereBefore(target, [0, 0, 50], 10), false);
  const lone = createWorldFrameProjection(behind, behind, point => [...point] as Vector3, project).occlusion(null);
  assert.equal(lone.mayOcclude([-400, 0], [400, 0]), false);
  assert.equal(lone.hidden([0, 0, -200]), false);
});

test('shared occlusion preserves point visibility, clipped chords and saturated extents', { timeout: 20000 }, () => {
  let seed = 987654321;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const scale of [1, 1e9, 1e16]) for (let view = 0; view < 60; view++) {
    const focus = { id: 'focus', positionM: [0, 0, -100 * scale] as Vector3, radiusM: 10 * scale };
    const separate = { id: 'selected', positionM: [12 * scale, -5 * scale, -120 * scale] as Vector3, radiusM: 8 * scale };
    const parent = { id: 'parent', positionM: [-15 * scale, 8 * scale, -90 * scale] as Vector3, radiusM: 6 * scale };
    const selected = view % 2 ? separate : focus;
    const dx = (random() - .5) * 80 * scale, dz = (random() - .5) * 220 * scale;
    const toEye = (point: Vector3): Vector3 => [point[0] - dx, point[1], point[2] - dz];
    const project = (point: Vector3) => [50 + 800 * point[0] / -point[2], -20 + 800 * point[1] / -point[2]];
    const frame = createWorldFrameProjection(focus, selected, toEye, project);
    const focusEye = toEye(focus.positionM), selectedEye = toEye(selected.positionM);
    const focusMay = createSphereChordTest(focusEye, focus.radiusM, project);
    const selectedMay = createSphereChordTest(selectedEye, selected.radiusM, project);
    for (const primary of [null, focus, selected, parent]) {
      const parentEye = primary && toEye(primary.positionM);
      const parentMay = primary && createSphereChordTest(parentEye!, primary.radiusM, project);
      const oldHidden = (target: Vector3, exceptId?: string) =>
        (exceptId !== focus.id && rayHitsSphereBefore(target, focusEye, focus.radiusM)) ||
        (exceptId !== selected.id && rayHitsSphereBefore(target, selectedEye, selected.radiusM)) ||
        Boolean(primary && rayHitsSphereBefore(target, parentEye!, primary.radiusM));
      const oldMay = (a: readonly number[], b: readonly number[]) => focusMay(a, b) || selectedMay(a, b) || Boolean(parentMay?.(a, b));
      const shared = frame.occlusion(primary);
      const vertices: Vector3[] = Array.from({ length: 128 }, (_, index) => {
        const angle = index * Math.PI / 64;
        return [(20 + 75 * Math.cos(angle)) * scale, 45 * Math.sin(angle) * scale, (-110 + 35 * Math.cos(angle)) * scale];
      });
      const trail = vertices.map((_, index) => view % 3 === 0 && index < 93 ? 0 : (index + 1) / 128);
      for (const vertex of vertices) {
        const target = toEye(vertex);
        for (const exceptId of [undefined, focus.id, selected.id, 'child']) {
          // A body's own parent is never itself in the validated registry.
          if (exceptId === primary?.id) continue;
          assert.equal(shared.hidden(target, exceptId), oldHidden(target, exceptId));
        }
      }
      const options = { toEye, project, near: .1 * scale, clipX: 500, clipY: 300 };
      const before = createPreparedRingProjector({ ...options, hidden: oldHidden, mayOcclude: oldMay });
      const after = createPreparedRingProjector({ ...options, hidden: shared.hidden, mayOcclude: shared.mayOcclude });
      const flat = Float64Array.from(vertices.flat());
      assert.deepEqual(after(flat, trail), before(flat, trail));
      for (const saturation of [48, 128]) assert.equal(after.measureExtent(flat, trail, saturation), before.measureExtent(flat, trail, saturation));
    }
  }
});

test('a far disc sliding behind a near sphere is part covered before it is wholly covered, at every scale', () => {
  // A moon of radius 1 at depth 10 (5.7°) and a planet of radius 20 at depth 1000 (1.1°), as a Saturnian moon sees Saturn.
  for (const scale of [1, 1e9, 1e16]) {
    const moon = { id: 'moon', positionM: [0, 0, -10 * scale] as Vector3, radiusM: scale };
    const frame = createWorldFrameProjection(moon, moon, point => [...point] as Vector3, point => [point[0] / -point[2], point[1] / -point[2]]);
    const cover = (x: number) => frame.occlusion(null).cover([x * scale, 0, -1000 * scale], 20 * scale);
    assert.equal(cover(200), null); // 11.3° off the axis: clear.
    assert.equal(cover(100), 'moon'); // The planet's centre is behind the limb, but most of its disc is not.
    assert.equal(cover(118), 'moon'); // Only the planet's near edge is behind.
    assert.equal(cover(50), true);
    assert.equal(cover(0), true);
    assert.equal(frame.occlusion(null).cover([0, 0, -1000 * scale], 20 * scale, moon.id), null);
    // Nothing nearer than the sphere is covered by it.
    assert.equal(frame.occlusion(null).cover([0, 0, -5 * scale], scale / 10), null);
  }
});
