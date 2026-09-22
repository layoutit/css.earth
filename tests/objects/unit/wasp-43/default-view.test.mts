/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser. The star's
 * presentation frame puts its display axis up, so the camera orbit lies in the star's equator and the default view sits one
 * degree from the sub-Earth point. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireFiniteNumber, requireRecord } from '../../../../tools/sources/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/wasp-43');
const json = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;
const DEG = Math.PI / 180;
const direction = (ra: number, dec: number): [number, number, number] => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

test('the default camera looks at the Earth-facing hemisphere, straight at the sub-Earth point', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  // Earth observes the star from the Sun's direction; the star's pole is its planet's orbit normal, which that direction is
  // 7.8 degrees off, so the sub-Earth point is not on this body frame's equator.
  const { requireBodyFixedSunDirection } = await import('../../../../src/platform/solar-geometry.mts');
  const toEarth = requireBodyFixedSunDirection('wasp-43');
  const subObserver = { longitudeDegrees: Math.atan2(toEarth[1], toEarth[0]) / DEG, latitudeDegrees: Math.asin(toEarth[2]) / DEG };
  const view = defaultViewGeometry('wasp-43', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const separation = angularSeparationDegrees(view.subCamera, subObserver);
  assert.ok(separation < 0.01, `default view ${separation.toFixed(3)} degrees from the sub-observer point`);
  assert.ok(Math.abs(subObserver.latitudeDegrees - 7.8) < 0.1, `sub-Earth latitude ${subObserver.latitudeDegrees.toFixed(2)}`);
});

test('the star\'s pole, WASP-43b\'s orbit normal, stands up on screen, with the Earth toward the viewer', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(BODY, '../../../packages/astronomy/data/bodies/wasp-43.json'), 'utf8')) as unknown).star);
  assert.equal(star.presentationUp, 'display-axis');
  const { readAuthoredRotation } = await import('../../../../tools/objects/authored-rotation.mts');
  const { sha256 } = await import('../../../../src/platform/sha256.mts');
  const worldFrame = requireRecord(requireRecord(descriptor.properties).worldFrame);
  const epoch = requireFiniteNumber(requireRecord(worldFrame).epochJdTt ?? 2461286.5);
  const bytes = await readFile(resolve(BODY, 'source/preparation/rotation.json'));
  const rotation = await readAuthoredRotation(BODY, { path: 'source/preparation/rotation.json', sha256: sha256(bytes) }, epoch);
  const planetBytes = await readFile(resolve(BODY, '../wasp-43b/source/preparation/rotation.json'));
  const planet = await readAuthoredRotation(resolve(BODY, '../wasp-43b'), { path: 'source/preparation/rotation.json', sha256: sha256(planetBytes) }, epoch);
  assert.ok(Math.abs(rotation.poleRightAscensionRad - planet.poleRightAscensionRad) < 1e-9 && Math.abs(rotation.poleDeclinationRad - planet.poleDeclinationRad) < 1e-9, 'the pole is the planet\'s orbit normal');
  assert.equal(rotation.spinRateRadPerDay, 0, 'no rotation period is measured');
  const view = defaultViewGeometry('wasp-43', requireRecord(runtime.camera) as never, worldFrame as never);
  const pole = view.screen(direction(rotation.poleRightAscensionRad / DEG, rotation.poleDeclinationRad / DEG));
  assert.ok(Math.abs(pole.angleDegrees - 90) < 0.1, `pole ${pole.angleDegrees.toFixed(2)} degrees from screen-right`);
  const ra = requireFiniteNumber(star.rightAscensionDegrees), dec = requireFiniteNumber(star.declinationDegrees);
  const earth = view.screen(direction(ra, dec).map(v => -v) as [number, number, number]);
  assert.ok(earth.towardViewer, 'the Earth direction points at the viewer');
});
