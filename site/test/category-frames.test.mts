import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { prepareCategoryFrame, CATEGORY_FRAMED_SHARE } from '../build/prepare/prepare-world-presentation.mts';
import { PREPARED_WORLD_PRESENTATION } from '../prepared-world-presentation.mts';
import { CATEGORY_FRAMES, categoryZoomTarget } from '../system-framing.mts';
const test = sourceTest();

test('a category frames the nearest members around their own centre, leaving the far outliers out', () => {
  // Nine members within 10 m of the Sun and one at 1 km: the far tenth does not stretch the box.
  const near = Array.from({ length: 9 }, (_, index) => [index + 1, -(index + 1), 0]);
  const frame = prepareCategoryFrame([[1000, 0, 0], ...near]);
  assert.equal(CATEGORY_FRAMED_SHARE, .9);
  assert.deepEqual(frame, { centreM: [5, -5, 0], minimumM: [-4, -4, 0], maximumM: [4, 4, 0] });
});

test('a category with one member, or with every member at one point, has no frame to fit', () => {
  assert.equal(prepareCategoryFrame([[1, 2, 3]]), null);
  assert.equal(prepareCategoryFrame([[1, 2, 3], [1, 2, 3]]), null);
  assert.equal(prepareCategoryFrame([]), null);
});

test('every header pill has a prepared frame, and the galaxy frame holds the Magellanic Clouds and Andromeda', async () => {
  // The pills in site/components/ObjectShell.astro.
  for (const classification of ['planet', 'satellite', 'comet', 'asteroid', 'star', 'nebula', 'galaxy']) {
    assert.ok(PREPARED_WORLD_PRESENTATION.categoryFrames.has(classification), `${classification} has no prepared frame`);
    assert.ok(CATEGORY_FRAMES.has(classification));
  }
  const galaxy = PREPARED_WORLD_PRESENTATION.categoryFrames.get('galaxy')!;
  // A member on the box's edge comes back from centre + offset within rounding of itself.
  const holds = (point: readonly number[]) => point.every((value, axis) => {
    const tolerance = 1e-12 * Math.abs(value);
    return value >= galaxy.centreM[axis]! + galaxy.minimumM[axis]! - tolerance && value <= galaxy.centreM[axis]! + galaxy.maximumM[axis]! + tolerance;
  });
  // LMC (50 kpc) and M31 (776 kpc) are both galaxies the Local Group layer draws.
  const catalogue = JSON.parse(await readFile(resolve(import.meta.dirname, '../../src/objects/local-group/prepared/catalogue.json'), 'utf8')) as { objects: { detailedObjectId?: string; positionM: number[] }[] };
  for (const id of ['lmc', 'm31']) {
    const row = catalogue.objects.find(object => object.detailedObjectId === id);
    assert.ok(row && holds(row.positionM), `${id} lies outside the galaxy frame`);
  }
});

test('a pill fits its box at the current angle, centred on it, and a category without a box stays put', () => {
  const frame = CATEGORY_FRAMES.get('planet')!;
  const from = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [0, 0, 1e9] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const optics = { focalPixels: 600, framingRadiusPixels: 300, widthPixels: 800, heightPixels: 600, principalOffsetPixels: [0, 0] as const,
    visibleRect: null, detailHandoffDiameterPixels: 80 };
  const target = categoryZoomTarget('planet', from, optics, { left: -380, right: 380, top: -280, bottom: 280 })!;
  assert.deepEqual(target.focusPositionM, frame.centre);
  assert.deepEqual(target.world.pose.orientationXyzw, from.pose.orientationXyzw);
  // Looking down -z, the camera sits on the +z side of the box's centre, beyond its near face.
  assert.ok(target.world.pose.positionM[2] - frame.centre[2] > frame.candidate.maximumM[2]);
  assert.equal(categoryZoomTarget('no-such-category', from, optics, { left: -380, right: 380, top: -280, bottom: 280 }), null);
});
