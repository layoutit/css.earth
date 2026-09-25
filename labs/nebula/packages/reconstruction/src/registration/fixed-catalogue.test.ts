import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticChanceMatches, cataloguePixel, chanceExcess, CHANCE_RADIUS_PIXELS } from './fixed-catalogue.ts';
import { wcsPixelRay, type ImageWcs } from '@cssearth/bake/volume';
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

/** Recorded SMC runs of the density-aware chance control: close matches inside the 0.75-pixel chance radius,
 * every shifted and wrong-transform control count in that radius, and the analytic rate for the detection density. */
const recorded = {
  'AllWISE 10 degree HiPS (qualified)': { close: 7153, controls: [31, 30, 31, 47, 43, 49, 53, 40], analytic: 28.62, expect: true },
  'AllWISE W2/W1 composite': { close: 7096, controls: [211, 186, 209, 222, 229, 217, 197, 196], analytic: 202.51, expect: true },
  'AllWISE W4/W3/W1 composite': { close: 7140, controls: [89, 88, 94, 99, 110, 107, 98, 95], analytic: 82.76, expect: true },
  'DSS2 blue/red composite': { close: 5068, controls: [203, 178, 189, 218, 210, 207, 219, 171], analytic: 199.59, expect: true },
  'Herschel SPIRE 250 composite (no stars)': { close: 31, controls: [32, 22, 28, 30, 33, 33, 28, 27], analytic: 27.71, expect: false },
  'AllWISE, reference pixel shifted 40 px': { close: 32, controls: [38, 45, 38, 35, 30, 37, 41, 31], analytic: 28.57, expect: false },
  'AllWISE W2/W1 composite, shifted 40 px': { close: 215, controls: [202, 202, 219, 203, 230, 250, 199, 208], analytic: 202.63, expect: false },
  'WISE press image on its publisher SIN WCS': { close: 109, controls: [33, 34, 36, 32, 29, 31, 40, 37], analytic: 35.4, expect: false },
};
test('the chance control scales with detection density and still refuses every known-bad fixed WCS', () => {
  for (const [name, row] of Object.entries(recorded)) {
    const result = chanceExcess(row.close, row.controls, row.analytic);
    assert.equal(result.pass, row.expect, `${name}: ratio ${result.ratio.toFixed(2)} over expectation ${result.expectation}`);
  }
  // The rule is an excess over the chance rate, not a fixed fraction of the matches: ten times the detections
  // raise the expectation ten-fold, and a real registration keeps its margin while a chance one never gains it.
  assert.equal(chanceExcess(7000, [200], 190).pass, true);
  assert.equal(chanceExcess(700, [200], 190).pass, false);
  assert.equal(chanceExcess(99, [1], 1).pass, false, 'a handful of close matches never qualifies an image');
  const analytic = analyticChanceMatches(7195, 259413, CHANCE_RADIUS_PIXELS, 4000, 4000);
  assert.ok(Math.abs(analytic - 202.51) < 1, `analytic chance matches ${analytic}`);
  assert.ok(analyticChanceMatches(7195, 36093, CHANCE_RADIUS_PIXELS, 4000, 4000) < analytic / 5, 'a sparser raster expects far fewer chance matches');
});
