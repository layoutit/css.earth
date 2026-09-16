import assert from 'node:assert/strict';
import test from 'node:test';
import { cataloguePixel } from './fixed-catalogue.ts';
import { wcsPixelRay, type ImageWcs } from '@cssearth/volume-core/coordinates/overlay-wcs';
for (const projection of ['TAN', 'SIN'] as const) test(`Fixed catalogue ${projection} inverts native publisher pixel rays`, () => {
  const wcs: ImageWcs = { projection, coordinateFrame: 'ICRS', referenceDimension: [4000, 4000], referencePixel: [2000, 2000], referenceValueDeg: [13.5, -73], scaleDeg: [-.0025, .0025], rotationDeg: -24.94 };
  for (const pixel of [[.5, .5], [1200.5, 1600.5], [3999.5, 3999.5]]) {
    const ray = wcsPixelRay(wcs, pixel[0]!, pixel[1]!);
    const ra = Math.atan2(ray[1], ray[0]) * 180 / Math.PI, dec = Math.asin(ray[2]) * 180 / Math.PI;
    const actual = cataloguePixel(ra, dec, wcs, 4000, 4000);
    assert.ok(Math.abs(actual[0] - (pixel[0]! - 1)) < 1e-8);
    assert.ok(Math.abs(actual[1] - (4000 - pixel[1]!)) < 1e-8);
  }
});
