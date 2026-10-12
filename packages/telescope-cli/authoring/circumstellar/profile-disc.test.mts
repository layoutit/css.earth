import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitDiscEnvelope, profileDiscDensity, scoreEnvelope, type SkyPlane, type RingGeometry } from './disc-envelope.mts';

test('a central peak and several rings use a measured-profile disc instead of forcing one Gaussian belt', () => {
  const size = 32, halfUnits = 40, step = 2 * halfUnits / size, inclinationDeg = 45, positionAngleDeg = 138;
  const phi = positionAngleDeg * Math.PI / 180, cosI = Math.cos(inclinationDeg * Math.PI / 180);
  // An independent thin-disc sky image: its radial brightness is evaluated directly on the deprojected image plane.
  const brightness = (r: number) => Math.exp(-((r / 6) ** 2) / 2) + 0.12 * Math.exp(-(((r - 18) / 2) ** 2) / 2) + 0.06 * Math.exp(-(((r - 28) / 2) ** 2) / 2);
  const plane = Float32Array.from({ length: size * size }, (_, p) => {
    const east = -(-halfUnits + (p % size + 0.5) * step), north = -halfUnits + (Math.floor(p / size) + 0.5) * step;
    return brightness(Math.hypot(east * Math.sin(phi) + north * Math.cos(phi), (east * Math.cos(phi) - north * Math.sin(phi)) / cosI));
  });
  const sky: SkyPlane = { size, halfUnits, step, plane, background: 0, noise: 0.001, backgroundPixels: 100,
    mosaicArcsecPerPixel: 0.01, starPixel: [16, 16], unit: 'fixture brightness' };
  const geometry: RingGeometry = { semiMajorUnits: 32, semiMinorUnits: 32 * cosI, centreUnits: [0, 0], inclinationDeg, positionAngleDeg,
    ridge: [], ridgeResidualUnits: 0, binningSpread: { semiMajorUnits: 0, inclinationDeg: 0, positionAngleDeg: 0 } };
  const options = { innerMaskUnits: 0, outerUnits: 35, nearSidePositionAngleDeg: 228, heightOfRadius: 2 / 32, depthSamples: 64 };
  assert.throws(() => fitDiscEnvelope(sky, geometry, options), /edge of the search/u, 'the existing single-belt gate still rejects this image');
  const baseline = fitDiscEnvelope(sky, geometry, { ...options, comparisonOnly: true });
  const profile = Array.from({ length: 81 }, (_, k) => ({ radiusUnits: k * 0.5, value: brightness(k * 0.5) }));
  const score = scoreEnvelope(sky, profileDiscDensity(baseline.ring, profile), options);
  assert.ok(score.residualRms < baseline.ring.residualRms / 3, `profile ${score.residualRms}, Gaussian ${baseline.ring.residualRms}`);
  assert.ok(score.residualRms < baseline.shell.residualRms && score.residualRms < baseline.constantDepthResidualRms,
    'the accepted profile must still beat the spherical-shell and constant-depth alternatives');
});
