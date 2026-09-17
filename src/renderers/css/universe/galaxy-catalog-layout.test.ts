import { expect, test } from 'vitest';
import type { PreparedGalaxyRecord } from '@cssearth/catalog';
import { admitGalaxyLabels, catalogVolumeCorners, projectCatalogAperture, projectCatalogBounds, projectCatalogPosition } from './galaxy-catalog-layout.js';

const world = { referenceFrame: 'test', epochJdTt: 1,
  pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
const viewport = { focalPixels: 100, principalOffsetPixels: [2, -3] as const };
const rect = { left: 0, right: 30, top: 0, bottom: 12 };
function candidate(id: string, distanceM: number, detailed = false) {
  return { object: { id, ...(detailed ? { detailedObjectId: id } : {}) } as PreparedGalaxyRecord,
    x: 0, y: 0, distanceM, labelRect: rect };
}
test('projects prepared metre coordinates in the shared observer including translation and the principal point', () => {
  // The identity pose looks down -z with +y up; a point above the axis lands above the principal point on a y-down screen.
  expect(projectCatalogPosition([10, 20, -100], world, viewport)).toMatchObject({ x: 12, y: -23 });
  const moved = { ...world, pose: { ...world.pose, positionM: [10, 0, 0] as const } };
  expect(projectCatalogPosition([10, 20, -100], moved, viewport)).toMatchObject({ x: 2, y: -23 });
  expect(projectCatalogPosition([0, 0, 100], world, viewport)).toBeNull();
});
test('foreground exclusions beat all catalogue labels; major objects beat minor neighbours and selection wins', () => {
  const near = candidate('near', 100), far = candidate('far', 200, true);
  expect(admitGalaxyLabels([far, near], [], null)).toEqual([{ ...far, placement: 0 }]);
  expect(admitGalaxyLabels([far, near], [rect], null)).toEqual([]);
  expect(admitGalaxyLabels([far, near], [], 'near')).toEqual([{ ...near, placement: 0 }]);
  expect(admitGalaxyLabels([candidate('far', 200), near], [], null)).toEqual([{ ...near, placement: 0 }]);
});

test('a clickable target beats a nearer disabled label even when its prepared class has lower priority', () => {
  const disabled = { ...candidate('disabled', 1, true), navigable: false };
  const clickable = { ...candidate('clickable', 100), navigable: true };
  expect(admitGalaxyLabels([disabled, clickable], [], null)).toEqual([{ ...clickable, placement: 0 }]);
});

test('a clickable label tries another side before yielding its space to disabled names', () => {
  const alternate = { left: -50, right: -20, top: 0, bottom: 12 };
  const target = { ...candidate('target', 100), navigable: true, alternateLabelRects: [alternate] };
  const disabled = { ...candidate('disabled', 1), navigable: false, labelRect: alternate };
  expect(admitGalaxyLabels([disabled, target], [rect], null)).toEqual([{ ...target, labelRect: alternate, placement: 1 }]);
});
test('catalogues use the shared desktop budget, including a distant selected label, with stable ties', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ ...candidate(String(i).padStart(2, '0'), 100 + i),
    labelRect: { left: i * 40, right: i * 40 + 30, top: 0, bottom: 12 } }));
  const accepted = admitGalaxyLabels(rows, [], '39');
  expect(accepted).toHaveLength(24); expect(accepted[0]!.object.id).toBe('39');
  expect(admitGalaxyLabels([...rows].reverse(), [], '39')).toEqual(accepted);
});
test('an R500 aperture is projected with sphere perspective, including off-axis displacement and the near-plane limit', () => {
  const centred = projectCatalogPosition([0, 0, -100], world, viewport)!;
  const result = projectCatalogAperture(10, centred, viewport)!;
  expect(result.x).toBe(2); expect(result.y).toBe(-3);
  expect(result.a).toBeCloseTo(100 * 10 / Math.sqrt(10000 - 100), 10);
  expect(result.b).toBeCloseTo(result.a, 10);
  const off = projectCatalogAperture(10, projectCatalogPosition([50, 0, -100], world, viewport)!, viewport)!;
  expect(off.x).toBeGreaterThan(52); expect(off.a).toBeGreaterThan(off.b);
  expect(projectCatalogAperture(101, centred, viewport)).toBeNull();
});

test('cloud bounds follow physical scale and orientation instead of its central catalogue marker', () => {
  const corners = catalogVolumeCorners({ referenceFrame: 'test', epochJdTt: 1,
    originM: [0, 0, -100], metersPerUnit: 2, localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
    boundsUnits: { min: [-10, -2, -3], max: [10, 2, 3] } });
  const bounds = projectCatalogBounds(corners, world, viewport)!;
  expect(bounds.top).toBeCloseTo(-3 - 2000 / 94);
  expect(bounds.right).toBeCloseTo(2 + 400 / 94);
  const rolled = { ...world, pose: { ...world.pose, orientationXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as const } };
  const orbitBounds = projectCatalogBounds(corners, rolled, viewport)!;
  expect(orbitBounds.top).toBeCloseTo(-3 - 400 / 94);
  expect(orbitBounds.right).toBeCloseTo(2 + 2000 / 94);
  expect(projectCatalogBounds(corners, { ...world, pose: { ...world.pose, positionM: [0, 0, -100] } }, viewport)).toBeNull();
});
