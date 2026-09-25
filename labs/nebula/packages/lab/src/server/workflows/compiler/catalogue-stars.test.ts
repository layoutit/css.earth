import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCatalogueStars } from './catalogue-stars.ts';
import type { EmissionFieldModel } from '@cssearth/bake/volume';
import type { CompilerStarInput } from './bake.ts';

function star(id: string, magnitudeV: number, colorIndexBV: number | null = null, raDegrees = 56.75, decDegrees = 24.12) {
  return { id, raDegrees, decDegrees, magnitudeV, colorIndexBV, sourceId: 'fixture-catalogue',
    properMotionRaCosDecMasPerYear: 20, properMotionDecMasPerYear: -45, sourceEpochJulianYear: 1991.25,
    sourceRaDegrees: raDegrees, sourceDecDegrees: decDegrees,
    photometry: { kind: 'johnson-measured', errorMagnitudeV: .01, errorColorIndexBV: colorIndexBV === null ? null : .02 } };
}
function catalogue(stars: ReturnType<typeof star>[]) {
  return { schema: 'cssearth-observed-stellar-catalogue@1', id: 'observed-fixture', frame: 'ICRS', coordinateEpochJulianYear: 2000, stars };
}
function model(): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'fixture', controls: { detail: 1, faint: 1, depth: 1 },
    bounds: { min: [-10000, -10000, -1000], max: [10000, 10000, 1000] }, skyBounds: { min: [-10000, -10000], max: [10000, 10000] }, scaffold: null,
    components: [{ id: 'cloud', basisId: 'cloud', center: [0, 0, 20], sigma: [100, 100, 10], angleRadians: 0,
      projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false }],
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 10000,
      equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
}
const center: [number, number] = [56.75, 24.12];
const prepare = (stars: ReturnType<typeof star>[], maximum = 5000) => prepareCatalogueStars(catalogue(stars), model(), center, maximum, ['optical', 'infrared']);
function light(s: CompilerStarInput): number {
  return s.diameterUnits! ** 2 * s.alpha * (.2126 * s.rgb[0] + .7152 * s.rgb[1] + .0722 * s.rgb[2]) / 255;
}

test('apparent V magnitude ranks bright stars first, with measured color and neutral unknown color', () => {
  const input = [star('faint', 11, .5), star('B', 6, -.15), star('A', 6, 1.5), star('bright-white', 2.8)];
  const result = prepare(input, 3);
  assert.deepEqual(result.stars.map(s => s.id), ['bright-white', 'A', 'B']);
  const [white, red, blue] = result.stars;
  assert.deepEqual(white!.rgb, [255, 255, 255]);
  assert.ok(red!.rgb[0] > red!.rgb[2]);
  assert.ok(blue!.rgb[2] > blue!.rgb[0]);
  assert.ok(white!.diameterUnits! > blue!.diameterUnits! * 3);
  assert.equal(result.receipt.unknownColorCount, 1);
  assert.equal(result.receipt.excludedByBudgetCount, 1);
});

test('disk area and opacity jointly preserve V light ratios across colors with no faint floor', () => {
  const result = prepare([star('white', 6), star('red', 6, 1.8), star('blue', 6, -.2), star('faint', 16, .2)]);
  const white = result.stars.find(s => s.id === 'white')!, faint = result.stars.find(s => s.id === 'faint')!;
  for (const id of ['red', 'blue']) assert.ok(Math.abs(light(result.stars.find(s => s.id === id)!) / light(white) - 1) < 1e-12);
  assert.ok(Math.abs(light(faint) / light(white) - .0001) < 1e-12);
  assert.equal(faint.diameterUnits, 2);
  assert.ok(faint.alpha < .01);
  assert.equal(result.receipt.displayClippedCount, 0);
  const clipped = prepare([star('bright-limit', -10)]);
  assert.equal(clipped.stars[0]!.diameterUnits, 160);
  assert.equal(clipped.stars[0]!.alpha, 1);
  assert.equal(clipped.receipt.displayClippedCount, 1);
});

test('TAN astrometry matches a known off-axis projection and rejects the linear RA approximation', () => {
  // Inverse-TAN: center Dec=0, north=0, west=−tan(2deg) radians.
  const result = prepareCatalogueStars(catalogue([star('off-axis', 6, null, 2, 0)]), model(), [0, 0], 1, ['optical']);
  const [x, y] = result.stars[0]!.positionArcsec;
  const expected = -Math.tan(2 * Math.PI / 180) * 180 / Math.PI * 3600;
  assert.ok(Math.abs(x - expected) < 1e-9);
  assert.equal(y, 0);
  assert.ok(Math.abs(x - -7200) > 2, 'linear RA*cosDec is visibly wrong over this wide field');
  // Independently form unit vectors to verify nonzero declination and north curvature.
  const a = 58.75 * Math.PI / 180, d = 25.12 * Math.PI / 180, a0 = center[0] * Math.PI / 180, d0 = center[1] * Math.PI / 180;
  const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const n = [Math.cos(d0) * Math.cos(a0), Math.cos(d0) * Math.sin(a0), Math.sin(d0)];
  const west = [Math.sin(a0), -Math.cos(a0), 0], north = [-Math.sin(d0) * Math.cos(a0), -Math.sin(d0) * Math.sin(a0), Math.cos(d0)];
  const dot = (u: number[]) => u.reduce((sum, x, i) => sum + x * v[i]!, 0), scale = 180 / Math.PI * 3600 / dot(n);
  const actual = prepare([star('wide', 5, .3, 58.75, 25.12)]).stars[0]!.positionArcsec;
  assert.ok(Math.abs(actual[0] - dot(west) * scale) < 1e-8);
  assert.ok(Math.abs(actual[1] - dot(north) * scale) < 1e-8);
  const wrapped = prepareCatalogueStars(catalogue([star('wrap', 6, null, 0, 0)]), model(), [359, 0], 1, ['optical']);
  assert.ok(wrapped.stars[0]!.positionArcsec[0] < 0);
});

test('dust support never erases a measured star; all image lenses preserve the optical overlay', () => {
  const source = catalogue([star('supported', 6), star('no-dust', 7, 1.1, 58.75, 24.12), star('outside-frame', 2, null, 80, 24)]);
  const before = structuredClone(source), field = model();
  const a = prepareCatalogueStars(source, field, center, 100, ['optical', 'infrared']);
  const b = prepareCatalogueStars(source, field, center, 100, ['other-image']);
  assert.deepEqual(a.stars.map(s => [s.id, s.positionArcsec, s.rgb, s.diameterUnits, s.alpha]),
    b.stars.map(s => [s.id, s.positionArcsec, s.rgb, s.diameterUnits, s.alpha]));
  assert.deepEqual(a.stars.map(s => s.id), ['supported', 'no-dust']);
  assert.notEqual(a.stars[0]!.positionArcsec[2], 0);
  assert.equal(a.stars[1]!.positionArcsec[2], 0);
  assert.equal(a.receipt.referencePlaneCount, 1);
  assert.equal(a.receipt.excludedOutsideFrameCount, 1);
  for (const s of a.stars) assert.deepEqual(s.materials!.optical, s.materials!.infrared);
  assert.deepEqual(source, before);
});

test('malformed catalogue fields, epoch, duplicate identities and invalid limits fail before rendering', () => {
  const row = star('valid', 6, .2);
  for (const patch of [{ magnitudeV: NaN }, { raDegrees: 360 }, { decDegrees: 91 }, { colorIndexBV: 'blue' },
    { sourceEpochJulianYear: null }, { sourceRaDegrees: Infinity }, { properMotionRaCosDecMasPerYear: '20' },
    { photometry: { ...row.photometry, errorMagnitudeV: -1 } }, { photometry: { ...row.photometry, kind: 'invented' } }]) {
    assert.throws(() => prepareCatalogueStars({ ...catalogue([]), stars: [{ ...row, ...patch }] }, model(), center, 10, ['optical']), TypeError);
  }
  const valid = catalogue([row]);
  assert.throws(() => prepareCatalogueStars({ ...valid, coordinateEpochJulianYear: 2016 }, model(), center, 10, ['optical']), /epoch 2000/);
  assert.throws(() => prepare([row, row]), /Duplicate/);
  assert.throws(() => prepareCatalogueStars(valid, model(), center, 5001, ['optical']), /maximum/);
  assert.throws(() => prepareCatalogueStars(valid, model(), center, 10, ['optical', 'optical']), /lens/);
  assert.equal(prepare([row], 0).stars.length, 0);
});
