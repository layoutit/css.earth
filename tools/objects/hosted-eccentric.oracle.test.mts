import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { hostSkyFrame, hostedOrbitStateRelativeBmjdTdb, type HostedOrbit } from '@cssearth/astronomy';
import { readOracleFixture } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { dotN as dot } from '../../src/platform/vector3.mts';

const fixture = await readOracleFixture('astronomy/hosted-eccentric.json');
const numbers = (value: unknown) => requireArray(value).map(entry => requireFiniteNumber(entry));
function compare(actual: readonly number[], expected: readonly number[], label: string, scale: number) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, axis) => {
    const error = Math.abs(value - expected[axis]!);
    // Both implementations receive the same representable BMJD timestamp.
    // Budget for float64 Kepler solving, unit conversion and frame rotation.
    assert.ok(error <= 1e-11 * scale, `${label} ${axis}: ${value} differs from ${expected[axis]} by ${error}`);
  });
}

test('eccentric hosted states match CSPICE conics in the observer-local frame', () => {
  for (const entry of requireArray(fixture.cases.orbits)) {
    const expected = requireRecord(entry);
    const host = {
      rightAscensionDegrees: requireFiniteNumber(expected.rightAscensionDegrees),
      declinationDegrees: requireFiniteNumber(expected.declinationDegrees),
    };
    const orbit: HostedOrbit = {
      periodDays: requireFiniteNumber(expected.periodDays),
      semiMajorAxisStellarRadii: requireFiniteNumber(expected.semiMajorAxisStellarRadii),
      inclinationDegrees: requireFiniteNumber(expected.inclinationDegrees),
      eccentricity: requireFiniteNumber(expected.eccentricity),
      argumentOfPeriapsisDegrees: requireFiniteNumber(expected.argumentOfPeriapsisDegrees),
      epochDefinition: 'inferior-conjunction',
      transitTimeBmjdTdb: requireFiniteNumber(expected.transitTimeBmjdTdb),
      ascendingNodePositionAngleDegrees: requireFiniteNumber(expected.nodePositionAngleDegrees),
      sources: { period: 'CSPICE oracle', shape: 'CSPICE oracle', phase: 'CSPICE oracle', orientation: 'CSPICE oracle' },
    };
    const radiusKm = requireFiniteNumber(expected.stellarRadiusKm);
    const semimajorKm = radiusKm * orbit.semiMajorAxisStellarRadii;
    const speedScale = 2 * Math.PI * semimajorKm / orbit.periodDays;
    const frame = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees);
    for (const stateEntry of requireArray(expected.states)) {
      const expectedState = requireRecord(stateEntry);
      const label = `${requireString(expected.id)} ${requireString(expectedState.label)}`;
      const state = hostedOrbitStateRelativeBmjdTdb(
        orbit, host, radiusKm, requireFiniteNumber(expectedState.epochBmjdTdb),
      );
      const localPosition = [dot(state.positionKm, frame.x), dot(state.positionKm, frame.y), dot(state.positionKm, frame.z)];
      const localVelocity = [dot(state.velocityKmPerDay, frame.x), dot(state.velocityKmPerDay, frame.y), dot(state.velocityKmPerDay, frame.z)];
      compare(localPosition, numbers(expectedState.observerLocalPositionKm), `${label} position`, semimajorKm);
      compare(localVelocity, numbers(expectedState.observerLocalVelocityKmPerDay), `${label} velocity`, speedScale);
      if (requireString(expectedState.label) === 'transit') assert.ok(localPosition[2]! > 0, `${label} is in front`);
      if (requireString(expectedState.label) === 'behind') assert.ok(localPosition[2]! < 0, `${label} is behind`);
    }
  }
});
