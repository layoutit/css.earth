import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { framedMembers, notableBodies, prepareCategoryFrame, CATEGORY_FRAMED_SHARE } from './prepare-world-presentation.mts';
import { NAVIGATIONAL_STAR_OBJECT_IDS } from './navigational-stars.mts';
import { WORLD_OBJECTS } from '../../../world/systems/world-objects.mts';
import { PREPARED_WORLD_PRESENTATION } from '../../../world/prepared-world-presentation.mts';
import { CATEGORY_FRAMES, categoryZoomTarget } from '../../../world/systems/system-framing.mts';
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

test('a category frames its members inside the smallest region that holds most of them', () => {
  // Three stars of the galaxy and one of another galaxy, both galaxies inside the group: the galaxy holds most.
  const regions: Record<string, string[]> = { a: ['galaxy', 'group'], b: ['galaxy', 'group'], c: ['galaxy', 'group'], far: ['group'], loose: [] };
  const regionsOf = (id: string) => regions[id]!;
  const members = (...ids: string[]) => ids.map(id => ({ id }));
  assert.deepEqual(framedMembers(members('a', 'b', 'c', 'far'), regionsOf), members('a', 'b', 'c'));
  // Half is not most: the group, which holds all four, frames them.
  assert.deepEqual(framedMembers(members('a', 'b', 'far', 'far'), regionsOf).length, 4);
  // No region holds most of them: every member is framed.
  assert.deepEqual(framedMembers(members('a', 'loose', 'loose'), regionsOf).length, 3);
  assert.deepEqual(framedMembers([], regionsOf), []);
});

test('a category framed by its listed landmarks holds every one of them, however far', () => {
  // Nine members within 10 m and one at 1 km: by the share the far tenth is left out; as a list all ten are framed.
  const near = Array.from({ length: 9 }, (_, index) => [index + 1, 0, 0]), far = [1000, 0, 0];
  assert.equal(prepareCategoryFrame([...near, far])!.maximumM[0]! * 2, 8);
  assert.equal(prepareCategoryFrame([...near, far], 1)!.maximumM[0]! * 2, 999);
});

test('the Stars box holds the Milky Way\'s stars and the Galaxies box the Nearby Universe\'s galaxies', () => {
  const PARSEC_M = 3.085677581491367e16;
  const place = (id: string) => WORLD_OBJECTS.find(object => object.id === id)!.worldFrame!.originM;
  const holds = (classification: string, id: string) => {
    const frame = PREPARED_WORLD_PRESENTATION.categoryFrames.get(classification)!;
    // A star at the edge of the box is inside it: the box is stored as a centre and two half-widths, which round.
    const slack = 1e-9 * Math.max(...frame.maximumM.map((value, axis) => value - frame.minimumM[axis]!));
    return place(id).every((value, axis) => value >= frame.centreM[axis]! + frame.minimumM[axis]! - slack && value <= frame.centreM[axis]! + frame.maximumM[axis]! + slack);
  };
  const side = (classification: string) => { const frame = PREPARED_WORLD_PRESENTATION.categoryFrames.get(classification)!; return Math.max(...frame.maximumM.map((value, axis) => value - frame.minimumM[axis]!)); };
  // Fitted around every notable star, the box was 8.6 Mpc wide: the camera landed among galaxies, where no star is drawn.
  for (const star of NAVIGATIONAL_STAR_OBJECT_IDS) assert.ok(holds('star', star), `${star} lies outside the star frame`);
  assert.ok(side('star') < 1000 * PARSEC_M, 'the star frame is the navigational stars\' box: Deneb, the farthest, is 433 parsecs away');
  assert.ok(!holds('star', 'm31-v1'), 'a star of Andromeda is marked, not framed');
  assert.ok(side('star') < 30e3 * PARSEC_M, 'the star frame is smaller than the Milky Way');
  // The galaxies' box reached the quasar 3C 273, 670 Mpc out, where the markers are clusters. GN-z11 is farther still.
  for (const galaxy of ['m81', 'm87', 'ngc-1365']) assert.ok(holds('galaxy', galaxy), `${galaxy} lies outside the galaxy frame`);
  assert.ok(!holds('galaxy', 'gn-z11'), 'a galaxy past the Nearby Universe is marked, not framed');
  assert.ok(side('galaxy') < 100e6 * PARSEC_M, 'the galaxy frame is smaller than the Nearby Universe');
});

test('every header pill has a prepared frame, and the galaxy frame holds the Magellanic Clouds and Andromeda', async () => {
  // The pills in site/components/ObjectShell.astro.
  for (const classification of ['planet', 'satellite', 'comet', 'asteroid', 'star', 'exoplanet', 'nebula', 'galaxy']) {
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
  const catalogue = JSON.parse(await readFile(resolve(import.meta.dirname, '../../../src/objects/local-group-galaxies/prepared/catalogue.json'), 'utf8')) as { objects: { detailedObjectId?: string; positionM: number[] }[] };
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

test('a notable body is featured itself or orbits within a featured system, however deep', () => {
  const objects = [{ id: 'host', discovery: { featured: true } }, { id: 'barycentre-planet', discovery: { featured: false } },
    { id: 'plain-star', discovery: { featured: false } }, { id: 'plain-planet', discovery: { featured: false } },
    { id: 'default-feature', discovery: { featured: false } }];
  const centres = new Map([['barycentre-planet', 'barycentre'], ['barycentre', 'host'], ['plain-planet', 'plain-star']]);
  assert.deepEqual([...notableBodies(objects, new Set(['default-feature']), centres)], ['host', 'barycentre-planet', 'default-feature']);
});

test('the Exoplanets and Stars pills mark and frame their notable members, the directly imaged planets among them', () => {
  const exoplanets = PREPARED_WORLD_PRESENTATION.categoryFrames.get('exoplanet')?.memberIds;
  assert.ok(exoplanets && exoplanets.size >= 2);
  for (const id of ['hr-8799-b', 'beta-pictoris-b', 'pds-70-b', 'trappist-1e', 'wasp-18b']) assert.ok(exoplanets.has(id), id);
  assert.ok(!exoplanets.has('kepler-1651b'), 'a planet of an unfeatured star is left to search');
  assert.ok(PREPARED_WORLD_PRESENTATION.categoryFrames.get('star')?.memberIds?.has('betelgeuse'));
  assert.equal(PREPARED_WORLD_PRESENTATION.categoryFrames.get('planet')?.memberIds, undefined, 'every planet is notable');
});
