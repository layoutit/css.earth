import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { hostSkyFrame, hostedOrbitStateRelativeBmjdTdb, type HostedOrbit } from '@cssearth/astronomy';
import { fitTransit } from '@cssearth/telescope/node';

function ringFlux(distance: number, radius: number, u1: number, u2: number, steps = 2500) {
  if (distance >= 1 + radius) return 1;
  const intensity = (r: number) => { const mu = Math.sqrt(Math.max(0, 1 - r * r)); return 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2; };
  const total = Math.PI * (1 - u1 / 3 - u2 / 6), low = Math.max(0, distance - radius), high = Math.min(1, distance + radius), dr = (high - low) / steps;
  let blocked = 0;
  for (let k = 0; k < steps; k++) {
    const r = low + (k + .5) * dr;
    const arc = r <= radius - distance ? 2 * Math.PI * r : distance === 0 ? (r <= radius ? 2 * Math.PI * r : 0)
      : 2 * r * Math.acos(Math.max(-1, Math.min(1, (r * r + distance * distance - radius * radius) / (2 * r * distance))));
    blocked += intensity(r) * arc * dr;
  }
  return 1 - blocked / total;
}

test('batman and SciPy recover an injected eccentric transit made by independent geometry and integration', () => {
  const orbit: HostedOrbit = { periodDays: 2.3, semiMajorAxisStellarRadii: 8, inclinationDegrees: 90, eccentricity: .22,
    argumentOfPeriapsisDegrees: 37, epochDefinition: 'inferior-conjunction', transitTimeBmjdTdb: 60000,
    ascendingNodePositionAngleDegrees: 23, sources: { period: 'test injection', shape: 'test injection', phase: 'test injection', orientation: 'test injection' } };
  const host = { rightAscensionDegrees: 112, declinationDegrees: -21 }, frame = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees);
  const truth = { shiftSeconds: 12.5, radiusRatio: .13, u1: .25, u2: .2 }, windowDays = .11;
  const time = Array.from({ length: 201 }, (_, index) => -windowDays + 2 * windowDays * index / 200);
  const shifted = { ...orbit, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb + truth.shiftSeconds / 86400 };
  const flux = time.map((offset, index) => {
    const position = hostedOrbitStateRelativeBmjdTdb(shifted, host, 1, orbit.transitTimeBmjdTdb + offset).positionKm;
    const distance = Math.hypot(position[0] * frame.x[0] + position[1] * frame.x[1] + position[2] * frame.x[2],
      position[0] * frame.y[0] + position[1] * frame.y[1] + position[2] * frame.y[2]);
    const transit = ringFlux(distance, truth.radiusRatio, truth.u1, truth.u2), x = offset / windowDays;
    return transit * (1.0004 + .0007 * x - .0003 * x * x) + 8e-6 * Math.sin(index * 1.7);
  });
  const result = fitTransit({ timeDaysFromPrediction: time, flux, error: time.map(() => 3e-5), periodDays: orbit.periodDays,
    semiMajorAxisStellarRadii: orbit.semiMajorAxisStellarRadii, inclinationDegrees: orbit.inclinationDegrees, eccentricity: orbit.eccentricity,
    argumentOfPeriapsisDegrees: orbit.argumentOfPeriapsisDegrees!, startRadiusRatio: .128, windowDays, rangeSeconds: 60 });
  assert.ok(Math.abs(result.shiftSeconds - truth.shiftSeconds) < .35, `shift ${result.shiftSeconds}`);
  assert.ok(Math.abs(result.radiusRatio - truth.radiusRatio) < 2e-4, `radius ratio ${result.radiusRatio}`);
  assert.ok(Math.abs(result.limbDarkening[0] - truth.u1) < .015, `u1 ${result.limbDarkening[0]}`);
  assert.ok(Math.abs(result.limbDarkening[1] - truth.u2) < .025, `u2 ${result.limbDarkening[1]}`);
  assert.equal(result.model.timeScale, 'BMJD_TDB');
  assert.equal(result.model.epoch, 'inferior-conjunction');
  assert.deepEqual(result.software, { 'batman-package': '2.5.3', scipy: '1.18.1', numpy: '2.5.3' });
});
