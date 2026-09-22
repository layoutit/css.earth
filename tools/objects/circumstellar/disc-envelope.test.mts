import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { discDensity, fitDiscEnvelope, ringGeometry, type SkyPlane } from './disc-envelope.mts';

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
