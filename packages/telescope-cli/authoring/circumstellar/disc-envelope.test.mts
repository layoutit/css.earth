import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { centreDepthThroughStar, discDensity, fitDiscEnvelope, profileDiscDensity, ringGeometry, smoothToBeam, subtractPointSources, type SkyPlane } from './disc-envelope.mts';
import type { SkyProjection } from '@cssearth/fits';

const SIZE = 64, HALF = 140, STEP = 2 * HALF / SIZE;

/** A sky plane rendered from a density: each column integrated along the line of sight, plus a stated noise. */
function render(density: (x: number, y: number, z: number) => number, noise: number): SkyPlane {
  const plane = new Float32Array(SIZE * SIZE);
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 - 0.5; };
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const x = -HALF + (i + 0.5) * STEP, y = -HALF + (j + 0.5) * STEP;
    let column = 0;
    for (let k = 0; k < SIZE; k++) column += density(x, y, -HALF + (k + 0.5) * STEP) * STEP;
    plane[j * SIZE + i] = column + noise * random() * 3.4;
  }
  return { size: SIZE, halfUnits: HALF, step: STEP, plane, background: 0, noise, backgroundPixels: 1000, mosaicArcsecPerPixel: 0.0624, starPixel: [0, 0], unit: 'MJy/sr' };
}
const ring = { radiusUnits: 80, gaussianWidthUnits: 12, gaussianHeightUnits: 4, inclinationDeg: 30, positionAngleDeg: 100, centreUnits: [3, -2] as const, nearSidePositionAngleDeg: 190 };

test('an inclined ring is recovered from its own projection: radius, inclination, position angle and centre', () => {
  const sky = render(discDensity(ring), 0.02);
  const geometry = ringGeometry(sky, { innerMaskUnits: 30, outerUnits: 120 });
  assert.ok(Math.abs(geometry.semiMajorUnits - 80) < 3, `radius ${geometry.semiMajorUnits}`);
  assert.ok(Math.abs(geometry.inclinationDeg - 30) < 3, `inclination ${geometry.inclinationDeg}`);
  assert.ok(Math.abs(geometry.positionAngleDeg - 100) < 3, `position angle ${geometry.positionAngleDeg}`);
  assert.ok(Math.hypot(geometry.centreUnits[0] - 3, geometry.centreUnits[1] + 2) < 3, `centre ${geometry.centreUnits}`);
  const fit = fitDiscEnvelope(sky, geometry, { innerMaskUnits: 30, outerUnits: 120, nearSidePositionAngleDeg: 190, heightOfRadius: 0.05 });
  assert.equal(fit.shape, 'inclined-ring');
  assert.ok(Math.abs(fit.ring.gaussianWidthUnits - 12) < 3, `width ${fit.ring.gaussianWidthUnits}`);
  assert.ok(fit.ring.residualRms < fit.shell.residualRms && fit.ring.residualRms < fit.constantDepthResidualRms);
  assert.ok(fit.ring.residualRms < 0.15 * fit.signalRms, `residual ${fit.ring.residualRms} of ${fit.signalRms}`);
  // The projection barely changes with the vertical height, which is why it is a stated convention.
  const spread = Math.max(...fit.heightResiduals.map(h => h.residualRms)) - Math.min(...fit.heightResiduals.map(h => h.residualRms));
  assert.ok(spread < 0.05 * fit.signalRms, `height residuals spread ${spread}`);
});

test('the density puts the stated near side toward the observer', () => {
  // Along the minor axis at position angle 190 (west of south), the ring plane lies at positive z: toward the observer.
  const density = discDensity(ring), r = 80;
  const nearX = -r * Math.sin(190 * Math.PI / 180), nearY = r * Math.cos(190 * Math.PI / 180);
  let best = -Infinity, at = 0;
  for (let z = -HALF; z <= HALF; z += 1) { const v = density(nearX * Math.cos(30 * Math.PI / 180) + 3, nearY * Math.cos(30 * Math.PI / 180) - 2, z); if (v > best) { best = v; at = z; } }
  assert.ok(at > 20, `near side at z ${at}`);
});

test('an off-centre ring whose plane holds the star: the centre depth puts the star in the plane, and the projection keeps', () => {
  // The fixture's centre is 3 units west and 2 south of the star. Without a centre depth the plane misses the star.
  const depth = centreDepthThroughStar(ring), through = { ...ring, centreDepthUnits: depth };
  const off = (model: typeof ring & { centreDepthUnits?: number }) => {
    // The star's distance from the mid-plane: where the density of a very wide ring peaks along the sight line through the star.
    const density = profileDiscDensity({ ...model, gaussianHeightUnits: 0.5 }, [{ radiusUnits: 0, value: 1 }, { radiusUnits: 200, value: 1 }]);
    let best = -Infinity, at = 0;
    for (let z = -20; z <= 20; z += 0.01) { const v = density(0, 0, z); if (v > best) { best = v; at = z; } }
    return at;
  };
  assert.ok(Math.abs(off(ring)) > 0.5, `without a centre depth the plane crosses the star's sight line at z ${off(ring)}`);
  assert.ok(Math.abs(off(through)) < 0.02, `with it, at z ${off(through)}`);
  // A shift along the line of sight changes no column: both project to the same image.
  const flat = render(discDensity(ring), 0), moved = render(discDensity(through), 0);
  const worst = flat.plane.reduce((most, value, p) => Math.max(most, Math.abs(value - moved.plane[p]!)), 0), peak = flat.plane.reduce((most, value) => Math.max(most, value), 0);
  assert.ok(worst < 0.02 * peak, `projection changed by ${worst} of ${peak}`);
});

test('a spherical shell is not drawn as a ring', () => {
  const sky = render((x, y, z) => Math.exp(-(((Math.hypot(x, y, z) - 80) / 12) ** 2) / 2), 0.02);
  const geometry = ringGeometry(sky, { innerMaskUnits: 30, outerUnits: 120 });
  assert.ok(geometry.inclinationDeg < 10, `a shell projects to a circle, not ${geometry.inclinationDeg} degrees`);
  assert.throws(() => fitDiscEnvelope(sky, geometry, { innerMaskUnits: 30, outerUnits: 120, nearSidePositionAngleDeg: 190, heightOfRadius: 0.05 }), /No inclined ring beats/u);
});

test('a ridge that is mostly noise is refused', () => {
  const sky = render(() => 0, 1);
  assert.throws(() => ringGeometry(sky, { innerMaskUnits: 30, outerUnits: 120 }), /ridge is found in only/u);
});

/** A north-up, east-left image of 0.19 arcsec pixels about RA 53.2, Dec -9.46, with an ALMA-like beam. */
const W = 120, H = 110, PIXEL = 0.19, RA0 = 53.2, DEC0 = -9.46, COS = Math.cos(DEC0 * Math.PI / 180);
const projection: SkyProjection = {
  pixelOf: (ra, dec) => [(W - 1) / 2 - (ra - RA0) * COS * 3600 / PIXEL, (H - 1) / 2 + (dec - DEC0) * 3600 / PIXEL],
  skyOf: (x, y) => [RA0 - (x - (W - 1) / 2) * PIXEL / 3600 / COS, DEC0 + (y - (H - 1) / 2) * PIXEL / 3600],
  scaleArcsec: PIXEL,
};
const header = { BMAJ: 1.288 / 3600, BMIN: 0.955 / 3600, BPA: -78.3 };
/** A point source as the image shows it: the beam, drawn independently of the code under test, at an offset in arcsec. */
function pointImage(peak: number, eastArcsec: number, northArcsec: number, majorArcsec = 1.288, minorArcsec = 0.955, paDeg = -78.3) {
  const values = new Float64Array(W * H), k = 2 * Math.sqrt(2 * Math.log(2)), pa = paDeg * Math.PI / 180;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = -(x - (W - 1) / 2) * PIXEL - eastArcsec, n = (y - (H - 1) / 2) * PIXEL - northArcsec;
    const along = e * Math.sin(pa) + n * Math.cos(pa), across = e * Math.cos(pa) - n * Math.sin(pa);
    values[y * W + x] = peak * Math.exp(-((along * k / majorArcsec) ** 2 + (across * k / minorArcsec) ** 2) / 2);
  }
  return values;
}

test('a point source at its published position and peak is removed to nothing', () => {
  const image = pointImage(990e-6, 3.1, -2.4);
  const cleaned = subtractPointSources('synthetic', image, W, H, header, projection, [{ raDeg: RA0 + 3.1 / 3600 / COS, decDeg: DEC0 - 2.4 / 3600, peak: 990e-6 }]);
  // Within 0.001% of the peak: the synthetic projection's scale is taken at the image centre.
  assert.ok(Math.max(...cleaned.map(Math.abs)) < 1e-8, `left ${Math.max(...cleaned.map(Math.abs))}`);
});

test('smoothing to a larger beam keeps the peak of a point source and scales an even field by the ratio of the beam areas', () => {
  // A point source's peak per beam is its flux, whatever the beam; an even field's Jy per beam grows with the beam's area.
  const smoothed = smoothToBeam('synthetic', pointImage(1e-3, 0, 0), W, H, header, projection, { majorArcsec: 1.6, minorArcsec: 1.2, positionAngleDeg: 102 });
  const expected = pointImage(1e-3, 0, 0, 1.6, 1.2, 102);
  assert.ok(Math.abs(Math.max(...smoothed) / Math.max(...expected) - 1) < 0.01, `peak ${Math.max(...smoothed)} against ${Math.max(...expected)}`);
  const worst = Math.max(...expected.map((v, i) => Math.abs(v - smoothed[i]!)));
  assert.ok(worst < 0.02e-3, `shape differs by ${worst}`);
  const even = smoothToBeam('synthetic', new Float64Array(W * H).fill(1), W, H, header, projection, { majorArcsec: 1.6, minorArcsec: 1.2, positionAngleDeg: 102 });
  assert.ok(Math.abs(even[(H >> 1) * W + (W >> 1)]! - (1.6 * 1.2) / (1.288 * 0.955)) < 1e-9);
  assert.throws(() => smoothToBeam('synthetic', even, W, H, header, projection, { majorArcsec: 1, minorArcsec: 0.8, positionAngleDeg: 0 }), /does not fit inside the target beam/u);
});

test('a published ring width is scored as stated, not searched', () => {
  const sky = render(discDensity(ring), 0.02);
  const geometry = ringGeometry(sky, { innerMaskUnits: 30, outerUnits: 120 });
  const fit = fitDiscEnvelope(sky, geometry, { innerMaskUnits: 30, outerUnits: 120, nearSidePositionAngleDeg: 190, heightOfRadius: 0.05, publishedWidthUnits: 11 });
  assert.equal(fit.ring.gaussianWidthUnits, 11);
});
