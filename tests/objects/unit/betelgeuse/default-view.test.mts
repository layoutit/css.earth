/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser. The presentation puts the
 * ALMA pole up, so the camera orbit lies in the star's equator, which contains the line of sight from Earth. */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('betelgeuse');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../../../tools/sources/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse');
const json = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;
const DEG = Math.PI / 180;
const direction = (ra: number, dec: number): [number, number, number] => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

test('the default camera looks straight at the photographed hemisphere, at the sub-Earth point', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const raster = requireRecord(await json('source/preparation/raster.json'));
  const lensFrame = requireRecord(requireArray(requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0]).science).lens).frames)[0]);
  const subObserver = { longitudeDegrees: -requireFiniteNumber(lensFrame.observerWestLongitude), latitudeDegrees: requireFiniteNumber(lensFrame.observerLatitude) };
  const camera = requireRecord(runtime.camera) as never, worldFrame = requireRecord(requireRecord(descriptor.properties).worldFrame) as never;
  const view = defaultViewGeometry('betelgeuse', camera, worldFrame);
  const separation = angularSeparationDegrees(view.subCamera, subObserver);
  assert.ok(separation < 0.01, `default view ${separation.toFixed(3)} degrees from the sub-observer point`);
  assert.ok(Math.abs(view.subCamera.longitudeDegrees) < 0.01 && Math.abs(view.subCamera.latitudeDegrees) < 0.01,
    `sub-camera point ${view.subCamera.longitudeDegrees.toFixed(1)}, ${view.subCamera.latitudeDegrees.toFixed(1)}`);
});

test('the pole stands up and the sky keeps its handedness: north 48 degrees clockwise of the pole, east counterclockwise of north', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const rotation = requireRecord(await json('source/preparation/rotation.json'));
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(BODY, '../../../packages/astronomy/data/bodies/betelgeuse.json'), 'utf8')) as unknown).star);
  const view = defaultViewGeometry('betelgeuse', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const pole = view.screen(direction(requireFiniteNumber(rotation.rightAscensionDegrees), requireFiniteNumber(rotation.declinationDegrees)));
  assert.ok(Math.abs(pole.angleDegrees - 90) < 0.1, `pole ${pole.angleDegrees.toFixed(2)} degrees from screen-right`);
  // The pole lies 48 degrees east of north on the sky, so celestial north sits 48 degrees clockwise of it; the lens's off-limb plate turns image-up by -48 degrees.
  const ra = requireFiniteNumber(star.rightAscensionDegrees), dec = requireFiniteNumber(star.declinationDegrees);
  const north = view.screen([-Math.sin(dec * DEG) * Math.cos(ra * DEG), -Math.sin(dec * DEG) * Math.sin(ra * DEG), Math.cos(dec * DEG)]);
  const east = view.screen([-Math.sin(ra * DEG), Math.cos(ra * DEG), 0]);
  assert.ok(Math.abs(north.angleDegrees - 42) < 0.1, `celestial north at ${north.angleDegrees.toFixed(1)} degrees from screen-right`);
  // As on the sky seen from Earth, east is 90 degrees counterclockwise of north.
  const eastFromNorth = ((east.angleDegrees - north.angleDegrees) % 360 + 540) % 360 - 180;
  assert.ok(Math.abs(eastFromNorth - 90) < 0.1, `east is ${eastFromNorth.toFixed(1)} degrees from north on screen`);
  // The light outside the disc is no longer a plate whose turn preparation derives: it is a dataset of the
  // betelgeuse-shell volume, placed by that bank's own frame, so there is no rotation for this test to check.
  assert.ok(!JSON.stringify(await json('prepared/assets.json')).includes('"offLimb"'),
    'the off-limb plate is withdrawn; the volume carries that light');
});
