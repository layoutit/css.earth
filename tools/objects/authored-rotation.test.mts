import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readAuthoredRotation } from './authored-rotation.mts';

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
