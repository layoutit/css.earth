import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodyFixedToIcrf, hostSkyFrame, hostedOrbitPhase, hostedOrbitStateRelativeKm, type HostedOrbit } from '@cssearth/astronomy';
import { readOracleFixture } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';
import { synchronousRotationElements } from './authored-rotation.mts';

const fixture = await readOracleFixture('astronomy/hosted-orbit.json');
const numbers = (value: unknown) => requireArray(value).map(entry => requireFiniteNumber(entry));
const vector = (value: unknown) => numbers(value) as [number, number, number];
function close(actual: number, expected: number, label: string, relative = 3e-12) {
  const error = Math.abs(actual - expected), tolerance = relative * Math.max(1, Math.abs(expected));
  assert.ok(error <= tolerance, `${label}: ${actual} differs from ${expected} by ${error}`);
}
function compare(actual: readonly number[], expected: readonly number[], label: string, relative?: number) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => close(value, expected[index]!, `${label} ${index}`, relative));
}

test('host sky frames match Astropy directional offsets, including near the celestial pole', () => {
  for (const entry of requireArray(fixture.cases.frames)) {
    const expected = requireRecord(entry);
    const frame = hostSkyFrame({
      rightAscensionDegrees: requireFiniteNumber(expected.rightAscensionDegrees),
      declinationDegrees: requireFiniteNumber(expected.declinationDegrees),
    }, requireFiniteNumber(expected.nodePositionAngleDegrees));
    compare(frame.x, vector(expected.x), 'sky x');
    compare(frame.y, vector(expected.y), 'sky y');
    compare(frame.z, vector(expected.z), 'sky z');
  }
});

test('hosted circular states and synchronous orientation match the independent fixture', () => {
  for (const entry of requireArray(fixture.cases.orbits)) {
    const expected = requireRecord(entry);
    const star = {
      rightAscensionDegrees: requireFiniteNumber(expected.rightAscensionDegrees),
      declinationDegrees: requireFiniteNumber(expected.declinationDegrees),
    };
    const orbit: HostedOrbit = {
      periodDays: requireFiniteNumber(expected.periodDays),
      semiMajorAxisStellarRadii: requireFiniteNumber(expected.semiMajorAxisStellarRadii),
      inclinationDegrees: requireFiniteNumber(expected.inclinationDegrees),
      eccentricity: 0,
      transitTimeBmjdTdb: requireFiniteNumber(expected.transitTimeBmjdTdb),
      ascendingNodePositionAngleDegrees: requireFiniteNumber(expected.nodePositionAngleDegrees),
      sources: { period: 'synthetic oracle', shape: 'synthetic oracle', phase: 'synthetic oracle', orientation: 'synthetic oracle' },
    };
    const radius = requireFiniteNumber(expected.stellarRadiusKm), semimajor = radius * orbit.semiMajorAxisStellarRadii;
    const speed = 2 * Math.PI * semimajor / orbit.periodDays;
    for (const stateEntry of requireArray(expected.states)) {
      const expectedState = requireRecord(stateEntry), epoch = requireFiniteNumber(expectedState.epochJdTt);
      const label = `${requireString(expected.id)} at ${requireFiniteNumber(expectedState.cycles)} cycles`;
      close(hostedOrbitPhase(orbit, epoch), requireFiniteNumber(expectedState.phaseRadians), `${label} phase`);
      const state = hostedOrbitStateRelativeKm(orbit, star, radius, epoch);
      compare(state.positionKm.map(value => value / semimajor), vector(expectedState.positionKm).map(value => value / semimajor), `${label} position direction`);
      compare(state.velocityKmPerDay.map(value => value / speed), vector(expectedState.velocityKmPerDay).map(value => value / speed), `${label} velocity direction`);
      close(Math.hypot(...state.positionKm), semimajor, `${label} radius`);
      close(Math.hypot(...state.velocityKmPerDay), speed, `${label} speed`);
      const radialFraction = state.positionKm.reduce((sum, value, axis) => sum + value * state.velocityKmPerDay[axis]!, 0) / (semimajor * speed);
      close(radialFraction, 0, `${label} radial velocity`);
      compare(bodyFixedToIcrf(synchronousRotationElements(state.positionKm, state.velocityKmPerDay, orbit.periodDays)), numbers(expectedState.bodyFixedToIcrf), `${label} synchronous orientation`, 2e-11);
    }
  }
});
