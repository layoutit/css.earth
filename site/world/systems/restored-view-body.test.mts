import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { OBJECTS, requireObject } from '../../directory/objects.mts';
import { seedObjectDirectory } from '../../directory/object-directory.mts';
mock.method(globalThis, 'fetch', async () => Response.json({ ancestors: [] }));
const { restoredViewBody, setZoomCentre, zoomStepOf } = await import('./inside-view.mts');
seedObjectDirectory(OBJECTS);

/** A camera standing `offsetM` from `originM`, the way a restored view places it: an exact offset from the body it is near. */
const cameraAt = (originM: readonly number[], offsetM: readonly [number, number, number]) => ({
  referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  pose: { positionM: [originM[0]! + offsetM[0], originM[1]! + offsetM[1], originM[2]! + offsetM[2]] as const, orientationXyzw: [0, 0, 0, 1] as const,
    focusOffset: { originM: originM as [number, number, number], offsetM } },
});

test('a view restored next to a body inside the Milky Way belongs to that body, not to the Sun behind it', () => {
  const nebula = requireObject('ngc-7662').worldFrame;
  // Twenty of its radii away, as the view beside the Blue Snowball on /milky-way/ stands (2026-10-07).
  assert.equal(restoredViewBody(cameraAt(nebula.originM, [20 * nebula.bodyRadiusM, 0, 0]) as never), 'ngc-7662');
});

test('a view restored among the stars, next to no body, keeps the page and centres the zoom on the nearest star', () => {
  setZoomCentre('sun');
  try {
    const nebula = requireObject('ngc-7662').worldFrame;
    // Far beyond any body's reach (10,000 of the nebula's radii), still inside the Milky Way.
    assert.equal(restoredViewBody(cameraAt(nebula.originM, [1e4 * nebula.bodyRadiusM, 0, 0]) as never), null);
    assert.notEqual(zoomStepOf({ objectId: 'milky-way' })?.centreId, 'sun');
  } finally { setZoomCentre('sun'); }
});

test('the object seen from inside is never the body a restored view stands next to', () => {
  const sun = requireObject('sun').worldFrame;
  assert.notEqual(restoredViewBody(cameraAt(sun.originM, [1e15, 0, 0]) as never), 'milky-way');
});
