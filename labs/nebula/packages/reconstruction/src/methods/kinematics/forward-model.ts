import type { CalibrationAnchor, KinematicParameters, PreparedKinematics, SlitEvidence } from './types.ts';
import { readKinematicParameters } from './validation.ts';
export function calibratedValue(pixel: number, [a, b]: [CalibrationAnchor, CalibrationAnchor]): number {
  return a.value + (pixel - a.pixel) * (b.value - a.value) / (b.pixel - a.pixel);
}
/** Infinite-resolution centroid loci of an infinitesimally thin, optically thin ellipsoid.
 * Observer coordinates: x west, z away. v = expansionKmS / equatorialRadius * r.
 * Keep the independently supplied projected x radius fixed as depth/inclination change.
 * This is an explicit kinematic prior, never a conversion of image intensity to velocity.
 */
export function shellVelocities(offsetArcsec: number, parameters: KinematicParameters): [number, number] | null {
  const p = readKinematicParameters(parameters);
  if (!Number.isFinite(offsetArcsec)) throw new TypeError('Invalid slit offset.');
  const angle = p.inclinationDegrees * Math.PI / 180, s = Math.sin(angle), c = Math.cos(angle);
  const a = p.radiusArcsec / Math.sqrt(c * c + p.depthRatio ** 2 * s * s), polar = a * p.depthRatio;
  const inverseA = 1 / a ** 2, delta = 1 / polar ** 2 - inverseA;
  const xx = inverseA + delta * s * s, zz = inverseA + delta * c * c, xz = delta * s * c;
  const b = 2 * xz * offsetArcsec, d = b * b - 4 * zz * (xx * offsetArcsec ** 2 - 1);
  if (d < -1e-12) return null;
  const root = Math.sqrt(Math.max(0, d)), speedPerArcsec = p.expansionKmS / a;
  return [(-b - root) / (2 * zz) * speedPerArcsec, (-b + root) / (2 * zz) * speedPerArcsec];
}
/** Server/preparation only. Points remain observations; model has exactly two surfaces. */
export function prepareKinematicsComparison(evidence: SlitEvidence, parameters: KinematicParameters, evidenceSha256: string): PreparedKinematics {
  if (!/^[a-f0-9]{64}$/.test(evidenceSha256) || /^0+$/.test(evidenceSha256)) throw new TypeError('Missing source identity.');
  const p = readKinematicParameters(parameters), f = evidence.figure;
  const observed = evidence.samples.map(sample => {
    const heliocentricKmS = calibratedValue(sample.pixelY, f.velocityCalibration);
    return { id: sample.id, offsetArcsec: calibratedValue(sample.pixelX, f.offsetCalibration), heliocentricKmS,
      relativeKmS: heliocentricKmS - evidence.systemic.valueKmS };
  });
  const boundX = Math.ceil(Math.max(p.radiusArcsec, ...observed.map(point => Math.abs(point.offsetArcsec))) / 25) * 25;
  const curves: { x: number; velocities: [number, number] }[] = [];
  for (let index = 0; index <= 256; index++) {
    const x = -p.radiusArcsec + 2 * p.radiusArcsec * index / 256;
    const velocities = shellVelocities(x, p); if (velocities) curves.push({ x, velocities });
  }
  const boundY = Math.ceil(Math.max(40, ...observed.map(point => Math.abs(point.relativeKmS)),
    ...curves.flatMap(point => point.velocities.map(Math.abs))) / 10) * 10;
  const width = 760, height = 380, left = 60, right = 742, top = 20, bottom = 325;
  const xMap = (x: number) => left + (x + boundX) / (2 * boundX) * (right - left);
  const yMap = (v: number) => bottom - (v + boundY) / (2 * boundY) * (bottom - top);
  const curvePath = (branch: 0 | 1) => curves.map((point, index) => `${index ? 'L' : 'M'}${xMap(point.x).toFixed(3)},${yMap(point.velocities[branch]).toFixed(3)}`).join(' ');
  let squared = 0, comparedPoints = 0, outsideProjectedShell = 0;
  for (const point of observed) {
    const prediction = shellVelocities(point.offsetArcsec, p);
    if (!prediction) { outsideProjectedShell++; continue; }
    const distance = Math.min(...prediction.map(velocity => Math.abs(velocity - point.relativeKmS)));
    squared += distance ** 2; comparedPoints++;
  }
  const center = shellVelocities(0, p)!;
  return { schema: 'cssearth-kinematics-comparison@1', evidenceSha256, evidence, parameters: p,
    chart: { width, height, left, right, top, bottom, zeroY: yMap(0), zeroX: xMap(0),
      systemicBandTop: yMap(evidence.systemic.uncertaintyKmS), systemicBandHeight: yMap(-evidence.systemic.uncertaintyKmS) - yMap(evidence.systemic.uncertaintyKmS),
      xTicks: [-100, -50, 0, 50, 100].filter(value => Math.abs(value) <= boundX).map(value => ({ value, position: xMap(value) })),
      yTicks: [-boundY, -boundY / 2, 0, boundY / 2, boundY].map(value => ({ value, position: yMap(value) })),
      points: observed.map(point => ({ ...point, cx: xMap(point.offsetArcsec), cy: yMap(point.relativeKmS) })),
      approachingPath: curvePath(0), recedingPath: curvePath(1) },
    metrics: { nearestSurfaceRmsKmS: comparedPoints ? Math.sqrt(squared / comparedPoints) : null, comparedPoints, outsideProjectedShell,
      centralApproachingKmS: center[0], centralRecedingKmS: center[1],
      offsetReadoutArcsec: f.readoutUncertaintyPixels * Math.abs((f.offsetCalibration[1].value - f.offsetCalibration[0].value) / (f.offsetCalibration[1].pixel - f.offsetCalibration[0].pixel)),
      velocityReadoutKmS: f.readoutUncertaintyPixels * Math.abs((f.velocityCalibration[1].value - f.velocityCalibration[0].value) / (f.velocityCalibration[1].pixel - f.velocityCalibration[0].pixel)) } };
}
