import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readAuthoredRotation } from './authored-rotation.mjs';

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
