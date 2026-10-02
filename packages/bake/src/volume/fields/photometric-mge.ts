import { readPhotometricMgeRecipe, type PhotometricMgeRecipe, type SimulationDepthPrior } from '@cssearth/objects';
/** x is west, y north, z away. The density is relative light per angular-depth unit, not calibrated flux. */
export function samplePhotometricMge(recipe: PhotometricMgeRecipe): SimulationDepthPrior {
  const parsed = readPhotometricMgeRecipe(recipe);
  const inclination = parsed.inclinationDegrees * Math.PI / 180, pa = parsed.positionAngleEastOfNorthDegrees * Math.PI / 180;
  const sinI = Math.sin(inclination), cosI = Math.cos(inclination), sign = parsed.lineOfSightTiltSign;
  const axis = [sinI * Math.cos(pa), sinI * Math.sin(pa), sign * cosI];
  const totalAmplitude = parsed.gaussians.reduce((sum, row) => sum + row.centralAmplitude, 0);
  const rows = parsed.gaussians.map(row => {
    const qSquared = (row.projectedAxisRatio ** 2 - cosI ** 2) / sinI ** 2;
    return { inverseVariance: 1 / row.sigmaArcsec ** 2, inverseQSquared: 1 / qSquared,
      amplitude: row.centralAmplitude / totalAmplitude * row.projectedAxisRatio /
        (Math.sqrt(2 * Math.PI) * row.sigmaArcsec * Math.sqrt(qSquared)) };
  });
  // An enclosing sphere retains every tilted Gaussian out to the explicitly chosen ellipsoidal cutoff.
  const radius = parsed.cutoffSigma * Math.max(...parsed.gaussians.map(row => row.sigmaArcsec));
  const cutoffSquared = parsed.cutoffSigma ** 2;
  return { bounds: { min: [-radius, -radius, -radius], max: [radius, radius, radius] },
    sampleDensity(x, y, z) {
      if (![x, y, z].every(Number.isFinite)) throw new TypeError('MGE coordinates must be finite.');
      const axial = axis[0]! * x + axis[1]! * y + axis[2]! * z;
      const cylindricalSquared = Math.max(0, x * x + y * y + z * z - axial * axial);
      let density = 0;
      for (const row of rows) {
        const radiusSquared = (cylindricalSquared + axial * axial * row.inverseQSquared) * row.inverseVariance;
        if (radiusSquared < cutoffSquared) density += row.amplitude * Math.exp(-.5 * radiusSquared);
      }
      return density;
    } };
}
