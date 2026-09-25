import { parseLabModelJson } from '../../resources/model-paths.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { overlayCorners, rayToOverlayPlane, wcsPixelRay, type ImageWcs, type OverlayFrame, registeredOverlayCorners, type ImageRegistration } from '@cssearth/bake/volume';

test('TAN and ordinary SIN rays match independent Astropy WCS fixtures', async () => {
  const oracle = parseLabModelJson(await readFile('labs/nebula/packages/lab/src/features/alignment/fixtures/astropy-wcs.json', 'utf8'));
  for (const fixture of oracle.fixtures) for (let i = 0; i < fixture.pixels.length; i++) {
    const [x, y] = fixture.pixels[i];
    const actual = wcsPixelRay(fixture.wcs as ImageWcs, x, y);
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[axis]! - fixture.expectedIcrsRays[i][axis]) < 1e-12,
      `${fixture.id}: pixel ${i}, axis ${axis}`);
  }
});

test('full image planes retain publisher angular footprints in each existing density frame', async () => {
  const records = JSON.parse(await readFile('labs/nebula/packages/lab/src/features/alignment/fixtures/legacy-sky-geometry.json', 'utf8'));
  for (const { target, provenance, frame } of records) {
    const originRay = frame.originM.map((v: number) => v / Math.hypot(...frame.originM)) as [number, number, number];
    const origin = rayToOverlayPlane(originRay, frame);
    assert.ok(Math.hypot(...origin) < 1e-12);
    for (const input of target.images) {
      const receipt = provenance.images.find((image: { input: { id: string } }) => image.input.id === input.id);
      assert.ok(receipt, `${input.id}: prepared provenance is missing`);
      const points = input.registration ? registeredOverlayCorners(input.registration as ImageRegistration,
        receipt.sourceDimensions[0], receipt.sourceDimensions[1], frame) : overlayCorners(input.wcs, frame);
      assert.ok(points.every(p => Math.abs(p[2]) < 1e-12), 'observational image must lie on the common physical tangent plane');
      assert.ok(points.flat().every(Number.isFinite), `${input.id}: footprint must stay finite`);
      const area = Math.abs(points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length]!;
        return sum + point[0] * next[1] - point[1] * next[0];
      }, 0)) / 2;
      assert.ok(area > 0, `${input.id}: publisher or registered footprint must retain positive area`);
      for (let corner = 0; corner < points.length; corner++) for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(points[corner]![axis]! - receipt.verticesUnits[corner][axis]) < 1e-12,
          `${input.id}: prepared corner ${corner}/${axis} differs from its source registration`);
      }
    }
  }
});
