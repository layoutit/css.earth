import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { overlayCorners, rayToOverlayPlane, wcsPixelRay, type ImageWcs, type OverlayFrame } from './overlay-wcs.js';

test('TAN corner and interior rays match independent Astropy WCS fixtures', async () => {
  const oracle = JSON.parse(await readFile('labs/nebula/models/overlay-wcs-oracle.json', 'utf8'));
  for (const fixture of oracle.fixtures) for (let i = 0; i < fixture.pixels.length; i++) {
    const [x, y] = fixture.pixels[i];
    const actual = wcsPixelRay(fixture.wcs as ImageWcs, x, y);
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[axis]! - fixture.expectedIcrsRays[i][axis]) < 1e-12,
      `${fixture.id}: pixel ${i}, axis ${axis}`);
  }
});

test('full image planes retain publisher angular footprints in each existing density frame', async () => {
  const recipe = JSON.parse(await readFile('labs/nebula/models/image-overlays.json', 'utf8'));
  for (const target of recipe.targets) {
    const descriptor = JSON.parse(await readFile(target.referenceObject, 'utf8'));
    const frame = descriptor.properties.volume as OverlayFrame;
    const originRay = frame.originM.map(v => v / Math.hypot(...frame.originM)) as [number, number, number];
    const origin = rayToOverlayPlane(originRay, frame);
    assert.ok(Math.hypot(...origin) < 1e-12);
    for (const input of target.images) {
      const points = overlayCorners(input.wcs, frame);
      assert.ok(points.every(p => Math.abs(p[2]) < 1e-12), 'observational image must lie on the common physical tangent plane');
      assert.ok(Math.hypot(points[0]![0] - points[1]![0], points[0]![1] - points[1]![1]) > 1);
    }
  }
});
