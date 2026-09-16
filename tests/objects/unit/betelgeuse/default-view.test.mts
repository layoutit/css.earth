/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser.
 * The numbers were also measured in Chrome through the app's world camera and the polar-cap leaf (2026-09-16):
 * sub-camera longitude -12.1, latitude -10.5 at pitch 0; pole 40.06 degrees from screen-right at the default camera. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../../../tools/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse');
const json = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;
const DEG = Math.PI / 180;
const direction = (ra: number, dec: number): [number, number, number] => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

test('the default camera looks at the photographed hemisphere, as close as the orbit reaches', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const raster = requireRecord(await json('source/preparation/raster.json'));
  const lensFrame = requireRecord(requireArray(requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0]).science).lens).frames)[0]);
  const subObserver = { longitudeDegrees: -requireFiniteNumber(lensFrame.observerWestLongitude), latitudeDegrees: requireFiniteNumber(lensFrame.observerLatitude) };
  const camera = requireRecord(runtime.camera) as never, worldFrame = requireRecord(requireRecord(descriptor.properties).worldFrame) as never;
  const view = defaultViewGeometry('betelgeuse', camera, worldFrame);
  // From Betelgeuse the Earth lies below the ecliptic plane the orbit never pitches under, so the best default is 18 degrees off.
  const separation = angularSeparationDegrees(view.subCamera, subObserver);
  assert.ok(separation < 20, `default view ${separation.toFixed(1)} degrees from the sub-observer point`);
  assert.ok(Math.abs(view.subCamera.longitudeDegrees - -13.7) < 0.5 && Math.abs(view.subCamera.latitudeDegrees - -11.8) < 0.5,
    `sub-camera point ${view.subCamera.longitudeDegrees.toFixed(1)}, ${view.subCamera.latitudeDegrees.toFixed(1)}`);
});

test('the pole and the sky directions land where the browser measured them', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const rotation = requireRecord(await json('source/preparation/rotation.json'));
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(BODY, '../../../packages/astronomy/data/bodies/betelgeuse.json'), 'utf8')) as unknown).star);
  const view = defaultViewGeometry('betelgeuse', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const pole = view.screen(direction(requireFiniteNumber(rotation.rightAscensionDegrees), requireFiniteNumber(rotation.declinationDegrees)));
  assert.ok(Math.abs(pole.angleDegrees - 40.1) < 0.5, `pole ${pole.angleDegrees.toFixed(2)} degrees from screen-right (Chrome measured 40.06)`);
  // The lens's off-limb plate is turned to this angle: image north 48 degrees clockwise of the pole (mirrored), so image-up is at -1.6 degrees.
  const ra = requireFiniteNumber(star.rightAscensionDegrees), dec = requireFiniteNumber(star.declinationDegrees);
  const north = view.screen([-Math.sin(dec * DEG) * Math.cos(ra * DEG), -Math.sin(dec * DEG) * Math.sin(ra * DEG), Math.cos(dec * DEG)]);
  const east = view.screen([-Math.sin(ra * DEG), Math.cos(ra * DEG), 0]);
  assert.ok(Math.abs(north.angleDegrees - 90) < 1, `celestial north is up: ${north.angleDegrees.toFixed(1)}`);
  // Measured, not endorsed: on the sky east is 90 degrees counterclockwise of north; the scene shows it clockwise. See the README.
  const eastFromNorth = ((east.angleDegrees - north.angleDegrees) % 360 + 540) % 360 - 180;
  assert.ok(Math.abs(eastFromNorth + 90) < 1, `east is ${eastFromNorth.toFixed(1)} degrees from north on screen`);
});
