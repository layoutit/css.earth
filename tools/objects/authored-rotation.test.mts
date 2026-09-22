import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { obliquitySpinAxis, readAuthoredRotation } from './authored-rotation.mts';

test('a measured meridian advances from its source epoch, including retrograde spin', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-rotation-'));
  try {
    const source = { schema: 'cssearth-measured-rotation@1', rightAscensionDegrees: 90,
      declinationDegrees: 30, primeMeridianDegrees: 60, spinDegreesPerDay: -30,
      referenceEpochJdTt: 2451545, source: 'Independent test solution', coordinateSystem: 'Test body frame' };
    const bytes = Buffer.from(JSON.stringify(source));
    await writeFile(join(directory, 'rotation.json'), bytes);
    const reference = { path: 'rotation.json', sha256: createHash('sha256').update(bytes).digest('hex') };
    for (const [days, degrees] of [[0, 60], [1, 30], [2, 0], [-1, 90]]) {
      const rotation = await readAuthoredRotation(directory, reference, source.referenceEpochJdTt + days);
      assert.ok(Math.abs(rotation.primeMeridianRad - degrees * Math.PI / 180) < 1e-12);
      assert.equal(rotation.poleRightAscensionRad, Math.PI / 2);
      assert.equal(rotation.spinRateRadPerDay, -Math.PI / 6);
    }
    await assert.rejects(readAuthoredRotation(directory, reference, NaN), /Invalid measured rotation/);
    await assert.rejects(readAuthoredRotation(directory, { ...reference, sha256: '0'.repeat(64) }, 2451545), /pin differs/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a PCK quadratic meridian advances phase and instantaneous spin consistently', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-accelerated-rotation-'));
  try {
    const source = { schema: 'cssearth-measured-rotation@1', rightAscensionDegrees: 0,
      declinationDegrees: 90, primeMeridianDegrees: 10, spinDegreesPerDay: 20,
      primeMeridianQuadraticDegreesPerDaySquared: 2, referenceEpochJdTt: 2451545,
      source: 'Analytic accelerating rotation', coordinateSystem: 'Test body frame' };
    const bytes = Buffer.from(JSON.stringify(source)); await writeFile(join(directory, 'rotation.json'), bytes);
    const reference = { path: 'rotation.json', sha256: createHash('sha256').update(bytes).digest('hex') };
    for (const [days, phase, rate] of [[0, 10, 20], [3, 88, 32], [-2, -22, 12]]) {
      const rotation = await readAuthoredRotation(directory, reference, source.referenceEpochJdTt + days);
      assert.ok(Math.abs(rotation.primeMeridianRad - phase * Math.PI / 180) < 1e-12);
      assert.ok(Math.abs(rotation.spinRateRadPerDay - rate * Math.PI / 180) < 1e-12);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a synchronous rotation faces +X at the centre it orbits, +Z along the orbit normal, and spins at the orbital rate', async () => {
  const { bodyFixedToIcrf } = await import('@cssearth/astronomy');
  const { synchronousRotationElements } = await import('./authored-rotation.mts');
  const cases: [number[], number[]][] = [[[3.2e6, -1.1e6, 0.4e6], [-2.0e6, -4.5e6, 7.1e6]], [[-1, 0.2, -0.9], [0.3, 1, 0.1]], [[0, 0, 5], [1, 0, 0]]];
  for (const [position, velocity] of cases) {
    const elements = synchronousRotationElements(position, velocity, 0.8134741);
    const m = bodyFixedToIcrf(elements), length = Math.hypot(...position);
    const normal = [position[1]! * velocity[2]! - position[2]! * velocity[1]!, position[2]! * velocity[0]! - position[0]! * velocity[2]!, position[0]! * velocity[1]! - position[1]! * velocity[0]!];
    const normalLength = Math.hypot(...normal);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(m[axis * 3]! + position[axis]! / length) < 1e-12, 'body +X points at the host');
      assert.ok(Math.abs(m[axis * 3 + 2]! - normal[axis]! / normalLength) < 1e-12, 'body +Z is the orbit normal');
    }
    assert.ok(Math.abs(elements.spinRateRadPerDay - 2 * Math.PI / 0.8134741) < 1e-12);
  }
});

test('a uniform synchronous rotation refuses an eccentric orbit until an explicit rotation law is authored', async () => {
  const { synchronousRotationElements } = await import('./authored-rotation.mts');
  assert.throws(() => synchronousRotationElements([1, 0, 0], [0, 1, 0], 2, .1), /explicit authored rotation law/);
});

test('a spin axis measured against an orbit reproduces the published true obliquity and lies on the orbit normal when aligned', () => {
  // Cristo et al. (2024, A&A 682, A28), HD 189733: lambda -1.00, i* 71.87 degrees with their orbit's i 85.508 give psi 13.6 +/- 6.9.
  assert.ok(Math.abs(obliquitySpinAxis(85.508, 71.87, -1).trueObliquityDegrees - 13.68) < 0.01);
  const aligned = obliquitySpinAxis(85.71, 85.71, 0), rad = Math.PI / 180;
  assert.ok(aligned.trueObliquityDegrees < 1e-6);
  [0, Math.sin(85.71 * rad), Math.cos(85.71 * rad)].forEach((value, axis) => assert.ok(Math.abs(aligned.spin[axis]! - value) < 1e-12));
  // The true obliquity does not depend on the sign of lambda.
  assert.equal(obliquitySpinAxis(85.71, 71.87, 1).trueObliquityDegrees, obliquitySpinAxis(85.71, 71.87, -1).trueObliquityDegrees);
});
