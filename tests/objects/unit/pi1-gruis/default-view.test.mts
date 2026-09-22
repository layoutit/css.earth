/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser. The star's
 * presentation frame puts its display axis up and the default camera is derived to face the Sun, where Earth observes the star
 * from, so the default view is the sub-Earth point. */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('pi1-gruis');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../../../tools/sources/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/pi1-gruis');
const json = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;
const DEG = Math.PI / 180;
const direction = (ra: number, dec: number): [number, number, number] => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

test('the default camera looks at the photographed hemisphere, straight at the sub-Earth point', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const raster = requireRecord(await json('source/preparation/raster.json'));
  const lensFrame = requireRecord(requireArray(requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0]).science).lens).frames)[0]);
  const subObserver = { longitudeDegrees: -requireFiniteNumber(lensFrame.observerWestLongitude), latitudeDegrees: requireFiniteNumber(lensFrame.observerLatitude) };
  const view = defaultViewGeometry('pi1-gruis', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const separation = angularSeparationDegrees(view.subCamera, subObserver);
  assert.ok(separation < 0.01, `default view ${separation.toFixed(3)} degrees from the sub-observer point`);
  assert.ok(Math.abs(view.subCamera.longitudeDegrees) < 0.01 && Math.abs(view.subCamera.latitudeDegrees) < 0.01,
    `sub-camera point ${view.subCamera.longitudeDegrees.toFixed(1)}, ${view.subCamera.latitudeDegrees.toFixed(1)}`);
});

test('the display axis stands up on screen, with celestial north up and the Earth toward the viewer', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const rotation = requireRecord(await json('source/preparation/rotation.json'));
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(BODY, '../../../packages/astronomy/data/bodies/pi1-gruis.json'), 'utf8')) as unknown).star);
  assert.equal(star.presentationUp, 'display-axis');
  const view = defaultViewGeometry('pi1-gruis', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const pole = view.screen(direction(requireFiniteNumber(rotation.rightAscensionDegrees), requireFiniteNumber(rotation.declinationDegrees)));
  assert.ok(Math.abs(pole.angleDegrees - 90) < 0.1, `display axis ${pole.angleDegrees.toFixed(2)} degrees from screen-right`);
  const ra = requireFiniteNumber(star.rightAscensionDegrees), dec = requireFiniteNumber(star.declinationDegrees);
  const north = view.screen([-Math.sin(dec * DEG) * Math.cos(ra * DEG), -Math.sin(dec * DEG) * Math.sin(ra * DEG), Math.cos(dec * DEG)]);
  const east = view.screen([-Math.sin(ra * DEG), Math.cos(ra * DEG), 0]);
  const earth = view.screen(direction(ra, dec).map(v => -v) as [number, number, number]);
  assert.ok(Math.abs(north.angleDegrees - 90) < 0.1, `celestial north is up: ${north.angleDegrees.toFixed(1)}`);
  // Earth lies straight along the line of sight, so it has no screen angle of its own.
  assert.ok(earth.towardViewer, 'the Earth direction points at the viewer');
  // As on the sky seen from Earth, east is 90 degrees counterclockwise of north.
  const eastFromNorth = ((east.angleDegrees - north.angleDegrees) % 360 + 540) % 360 - 180;
  assert.ok(Math.abs(eastFromNorth - 90) < 0.1, `east is ${eastFromNorth.toFixed(1)} degrees from north on screen`);
});
