import { expect, test } from 'vitest';
import { createWorldFrameProjection } from './world-frame-projection.js';
import { createPreparedRingProjector, createSphereChordTest } from '../solar-system/prepared-ring-projection.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import type { Vector3 } from '../solar-system/types.js';

test('one view shares body eyes and parent shadow bounds without retaining another view', () => {
  const focus = { id: 'focus', positionM: [0, 0, -100] as Vector3, radiusM: 10 };
  const parent = { id: 'parent', positionM: [15, 0, -90] as Vector3, radiusM: 4 };
  let transforms = 0, projections = 0;
  const toEye = (point: Vector3) => { transforms++; return [...point] as Vector3; };
  const project = (point: Vector3) => { projections++; return [800 * point[0] / -point[2], 800 * point[1] / -point[2]]; };
  const first = createWorldFrameProjection(focus, focus, toEye, project);
  const common = first.occlusion(null), other = first.occlusion(parent);
  for (let index = 0; index < 100; index++) {
    expect(first.occlusion(focus)).toBe(common);
    expect(first.occlusion(parent)).toBe(other);
    expect(first.eye(focus)).toBe(first.eye(focus));
    first.eye(parent);
  }
  expect(transforms).toBe(2);
  expect(projections).toBe(8); // Four tangent directions of each unique occluder.
  expect(common.hidden([0, 0, -110])).toBe(true);
  expect(common.hidden([0, 0, -110], focus.id)).toBe(false);
  const next = createWorldFrameProjection(focus, parent,
    point => [point[0] + 200, point[1], point[2]], project);
  expect(next.eye(focus)).toEqual([200, 0, -100]);
  expect(next.occlusion(null).hidden([0, 0, -110])).toBe(false);
  expect(next.occlusion(parent)).toBe(next.occlusion(null));
  expect(first.eye(focus)).toEqual([0, 0, -100]);
});

test('a sphere wholly behind the eye plane hides nothing and sends no chord to the detailed split', () => {
  const behind = { id: 'sun', positionM: [0, 0, 50] as Vector3, radiusM: 10 };
  const front = { id: 'earth', positionM: [0, 0, -100] as Vector3, radiusM: 10 };
  const project = (point: Vector3) => [800 * point[0] / -point[2], 800 * point[1] / -point[2]];
  const frame = createWorldFrameProjection(behind, front, point => [...point] as Vector3, project);
  const occlusion = frame.occlusion(null);
  // The front sphere still hides what lies behind it; the one behind the eye hides nothing, exactly as the ray test says.
  expect(occlusion.hidden([0, 0, -200])).toBe(true);
  expect(occlusion.hidden([30, 0, -200])).toBe(false);
  for (const target of [[30, 0, -200], [0, 5, -1e6], [-1, 1, -0.5]] as Vector3[]) expect(rayHitsSphereBefore(target, [0, 0, 50], 10)).toBe(false);
  const lone = createWorldFrameProjection(behind, behind, point => [...point] as Vector3, project).occlusion(null);
  expect(lone.mayOcclude([-400, 0], [400, 0])).toBe(false);
  expect(lone.hidden([0, 0, -200])).toBe(false);
});

// 180 views x 3 scales of ring projection is CPU-heavy; measured 1-3.6s, close enough to vitest's 5s default to flake on a loaded runner.
test('shared occlusion preserves point visibility, clipped chords and saturated extents', () => {
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
          expect(shared.hidden(target, exceptId)).toBe(oldHidden(target, exceptId));
        }
      }
      const options = { toEye, project, near: .1 * scale, clipX: 500, clipY: 300 };
      const before = createPreparedRingProjector({ ...options, hidden: oldHidden, mayOcclude: oldMay });
      const after = createPreparedRingProjector({ ...options, hidden: shared.hidden, mayOcclude: shared.mayOcclude });
      const flat = Float64Array.from(vertices.flat());
      expect(after(flat, trail)).toEqual(before(flat, trail));
      for (const saturation of [48, 128]) expect(after.measureExtent(flat, trail, saturation))
        .toBe(before.measureExtent(flat, trail, saturation));
    }
  }
}, 20000);
