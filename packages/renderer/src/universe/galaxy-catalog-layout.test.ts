import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { PreparedGalaxyRecord } from '@cssearth/catalog';
import { admitGalaxyLabels, catalogVolumeCorners, projectCatalogBounds, projectCatalogPosition } from './galaxy-catalog-layout.js';

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
  assert.partialDeepStrictEqual(projectCatalogPosition([10, 20, -100], world, viewport), { x: 12, y: -23 });
  const moved = { ...world, pose: { ...world.pose, positionM: [10, 0, 0] as const } };
  assert.partialDeepStrictEqual(projectCatalogPosition([10, 20, -100], moved, viewport), { x: 2, y: -23 });
  assert.equal(projectCatalogPosition([0, 0, 100], world, viewport), null);
});
test('foreground exclusions beat all catalogue labels; major objects beat minor neighbours and selection wins', () => {
  const near = candidate('near', 100), far = candidate('far', 200, true);
  assert.deepEqual(admitGalaxyLabels([far, near], [], null), [{ ...far, placement: 0 }]);
  assert.deepEqual(admitGalaxyLabels([far, near], [rect], null), []);
  assert.deepEqual(admitGalaxyLabels([far, near], [], 'near'), [{ ...near, placement: 0 }]);
  assert.deepEqual(admitGalaxyLabels([candidate('far', 200), near], [], null), [{ ...near, placement: 0 }]);
});

test('a clickable target beats a nearer disabled label even when its prepared class has lower priority', () => {
  const disabled = { ...candidate('disabled', 1, true), navigable: false };
  const clickable = { ...candidate('clickable', 100), navigable: true };
  assert.deepEqual(admitGalaxyLabels([disabled, clickable], [], null), [{ ...clickable, placement: 0 }]);
});

test('a clickable label tries another side before yielding its space to disabled names', () => {
  const alternate = { left: -50, right: -20, top: 0, bottom: 12 };
  const target = { ...candidate('target', 100), navigable: true, alternateLabelRects: [alternate] };
  const disabled = { ...candidate('disabled', 1), navigable: false, labelRect: alternate };
  assert.deepEqual(admitGalaxyLabels([disabled, target], [rect], null), [{ ...target, labelRect: alternate, placement: 1 }]);
});
test('catalogues use the shared desktop budget, including a distant selected label, with stable ties', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ ...candidate(String(i).padStart(2, '0'), 100 + i),
    labelRect: { left: i * 40, right: i * 40 + 30, top: 0, bottom: 12 } }));
  const accepted = admitGalaxyLabels(rows, [], '39');
  assert.equal(accepted.length, 24); assert.equal(accepted[0]!.object.id, '39');
  assert.deepEqual(admitGalaxyLabels([...rows].reverse(), [], '39'), accepted);
});
test('cloud bounds follow physical scale and orientation instead of its central catalogue marker', () => {
  const corners = catalogVolumeCorners({ referenceFrame: 'test', epochJdTt: 1,
    originM: [0, 0, -100], metersPerUnit: 2, localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
    boundsUnits: { min: [-10, -2, -3], max: [10, 2, 3] } });
  const bounds = projectCatalogBounds(corners, world, viewport)!;
  assert.ok(Math.abs(bounds.top - (-3 - 2000 / 94)) < 10 ** -2 / 2, `${bounds.top} is not close to ${-3 - 2000 / 94}`);
  assert.ok(Math.abs(bounds.right - (2 + 400 / 94)) < 10 ** -2 / 2, `${bounds.right} is not close to ${2 + 400 / 94}`);
  const rolled = { ...world, pose: { ...world.pose, orientationXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as const } };
  const orbitBounds = projectCatalogBounds(corners, rolled, viewport)!;
  assert.ok(Math.abs(orbitBounds.top - (-3 - 400 / 94)) < 10 ** -2 / 2, `${orbitBounds.top} is not close to ${-3 - 400 / 94}`);
  assert.ok(Math.abs(orbitBounds.right - (2 + 2000 / 94)) < 10 ** -2 / 2, `${orbitBounds.right} is not close to ${2 + 2000 / 94}`);
  assert.equal(projectCatalogBounds(corners, { ...world, pose: { ...world.pose, positionM: [0, 0, -100] } }, viewport), null);
});
