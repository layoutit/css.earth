/** The NSX limb profile, the quadratic fit and a neutron star's gravity, on a small table with a known law. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fitQuadraticLimb, neutronStarLog10Gravity, nsxLimbProfile, type NsxTable } from '@cssearth/bake/objects/stellar';

/** A table whose intensity is (0.2 + 0.8 mu) x a spectrum that does not depend on mu: the law u1 = 0.8, u2 = 0 at every node. */
export function linearLimbTable(): NsxTable {
  const log10Temperature = [5, 6.5], log10Gravity = [13.7, 15], log10EnergyOverKt = [-1, 0, 1], mu = [1, 0.75, 0.5, 0.25, 0.05, 0.000001];
  const log10Intensity = new Float64Array(log10Temperature.length * log10Gravity.length * log10EnergyOverKt.length * mu.length);
  let row = 0;
  for (const temperature of log10Temperature) for (const gravity of log10Gravity) for (const energy of log10EnergyOverKt) for (const cosine of mu)
    log10Intensity[row++] = Math.log10(0.2 + 0.8 * cosine) - energy * energy + 0.1 * temperature - 0.01 * gravity;
  return { log10Temperature, log10Gravity, log10EnergyOverKt, mu, log10Intensity };
}

test('the limb profile is the energy-integrated intensity against the centre, and the quadratic fit recovers a known law', () => {
  const profile = nsxLimbProfile(linearLimbTable(), 5.4, 14.26);
  profile.mu.forEach((mu, index) => assert.ok(Math.abs(profile.intensity[index]! - (0.2 + 0.8 * mu) / 1) < 1e-12));
  const law = fitQuadraticLimb(profile);
  assert.ok(Math.abs(law.u1 - 0.8) < 1e-9 && Math.abs(law.u2) < 1e-9 && law.largestMiss < 1e-9);
  assert.throws(() => nsxLimbProfile(linearLimbTable(), 4.9, 14), /outside the NSX table's 5 to 6.5/u);
});

test("a neutron star's gravity carries the relativistic factor", () => {
  // PSR J0437-4715: 1.418 solar masses, 11.36 km. Newtonian GM/R^2 is 1.458e14 cm/s^2; (1 - 2GM/Rc^2)^(-1/2) is 1.259.
  assert.ok(Math.abs(neutronStarLog10Gravity(1.418, 11.36) - 14.264) < 0.001);
  assert.throws(() => neutronStarLog10Gravity(3, 5), /inside its own horizon/u);
});
