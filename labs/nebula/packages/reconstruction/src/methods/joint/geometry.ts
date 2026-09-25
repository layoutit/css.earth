import type { JointParameters } from '@cssearth/bake/volume';
const radians = Math.PI / 180;
/** Position angle east of north; positive inclination points its projected axis toward that PA. */
export function jointAxis(p: JointParameters): [number, number, number] {
  const i = p.inclinationDegrees * radians, pa = p.positionAngleDegrees * radians;
  return [-Math.sin(pa) * Math.sin(i), Math.cos(pa) * Math.sin(i), Math.cos(i)];
}
function radialFactor(mu: number, p: JointParameters) {
  const ellipsoid = 1 / Math.sqrt(1 - mu * mu + mu * mu / p.depthRatio ** 2);
  return ellipsoid * (p.family === 'bipolar' ? 1 - .45 * (1 - mu * mu) ** 2 : 1);
}
export function jointSurfaceFunction(x: number, y: number, z: number, p: JointParameters): number {
  const length = Math.hypot(x, y, z); if (length === 0) return -1;
  const a = jointAxis(p), mu = Math.max(-1, Math.min(1, (a[0] * x + a[1] * y + a[2] * z) / length));
  return length / (p.radiusArcsec * radialFactor(mu, p)) - 1;
}
/** All resolved ray/surface crossings. A waisted surface can have more than two. */
export function jointRayDepths(x: number, y: number, p: JointParameters): number[] {
  if (p.family === 'ellipsoid') {
    const a = jointAxis(p), d = 1 / p.depthRatio ** 2 - 1, xy = a[0] * x + a[1] * y;
    const A = 1 + d * a[2] ** 2, B = 2 * d * xy * a[2], C = x * x + y * y + d * xy ** 2 - p.radiusArcsec ** 2;
    const D = B * B - 4 * A * C; if (D < -1e-7) return [];
    const root = Math.sqrt(Math.max(0, D)); return [(-B - root) / (2 * A), (-B + root) / (2 * A)];
  }
  const bound = p.radiusArcsec * Math.max(1, p.depthRatio), steps = 96, roots: number[] = [];
  let z0 = -bound, f0 = jointSurfaceFunction(x, y, z0, p);
  for (let k = 1; k <= steps; k++) {
    const z1 = -bound + 2 * bound * k / steps, f1 = jointSurfaceFunction(x, y, z1, p);
    if (f0 === 0 || f1 === 0 || f0 * f1 < 0) {
      let lo = z0, hi = z1, flo = f0;
      for (let j = 0; j < 18; j++) { const mid = (lo + hi) / 2, fm = jointSurfaceFunction(x, y, mid, p); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } }
      const root = f0 === 0 ? z0 : f1 === 0 ? z1 : (lo + hi) / 2;
      if (!roots.length || Math.abs(root - roots[roots.length - 1]!) > .01) roots.push(root);
    }
    z0 = z1; f0 = f1;
  }
  return roots;
}
/** Five sightlines approximate the published beam footprint, not spectral convolution. */
export function jointBeamDepths(x: number, y: number, p: JointParameters, beamFwhmArcsec: number): number[] {
  const sigma = beamFwhmArcsec / 2.35482;
  return [[0, 0], [sigma, 0], [-sigma, 0], [0, sigma], [0, -sigma]].flatMap(([dx, dy]) => jointRayDepths(x + dx!, y + dy!, p));
}
/** Maximize the projected surface radius in a fixed image direction over line-of-sight elevation. */
function bipolarProjectedRadius(projectedAxis: number, lineOfSightAxis: number, p: JointParameters): number {
  const value = (beta: number) => {
    const cosine = Math.cos(beta), mu = Math.max(-1, Math.min(1, projectedAxis * cosine + lineOfSightAxis * Math.sin(beta)));
    return p.radiusArcsec * radialFactor(mu, p) * cosine;
  };
  const steps = 96, step = Math.PI / steps, samples = Array.from({ length: steps + 1 }, (_, k) => value(-Math.PI / 2 + k * step));
  let maximum = Math.max(...samples);
  // A waist can produce several local maxima. Refine every sampled bracket, then keep the global envelope.
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let k = 1; k < steps; k++) {
    if (samples[k] < samples[k - 1] || samples[k] < samples[k + 1]) continue;
    let lo = -Math.PI / 2 + (k - 1) * step, hi = lo + 2 * step;
    let left = hi - ratio * (hi - lo), right = lo + ratio * (hi - lo), fLeft = value(left), fRight = value(right);
    for (let iteration = 0; iteration < 36; iteration++) {
      if (fLeft < fRight) { lo = left; left = right; fLeft = fRight; right = lo + ratio * (hi - lo); fRight = value(right); }
      else { hi = right; right = left; fRight = fLeft; left = hi - ratio * (hi - lo); fLeft = value(left); }
    }
    maximum = Math.max(maximum, fLeft, fRight);
  }
  return maximum;
}
/** Project the same surface used by rays and emission at the requested image angles. */
export function jointOutline(p: JointParameters, bins = 72): [number, number][] {
  const a = jointAxis(p), d = 1 / p.depthRatio ** 2 - 1;
  // Eliminating z from the ellipsoid quadratic gives its exact projected Schur complement.
  const projectedCoefficient = d / (1 + d * a[2] ** 2);
  return Array.from({ length: bins }, (_, k) => {
    const phi = (k + .5) / bins * 2 * Math.PI - Math.PI, cosine = Math.cos(phi), sine = Math.sin(phi), projectedAxis = a[0] * cosine + a[1] * sine;
    const radius = p.family === 'ellipsoid' ? p.radiusArcsec / Math.sqrt(1 + projectedCoefficient * projectedAxis ** 2) : bipolarProjectedRadius(projectedAxis, a[2], p);
    return [radius * cosine, radius * sine];
  });
}
export function jointBounds(p: JointParameters) { const r = p.radiusArcsec * Math.max(1, p.depthRatio) * 1.22; return { min: [-r, -r, -r] as [number, number, number], max: [r, r, r] as [number, number, number] }; }
/** Neutral finite emission shell. Its thickness is an authored display assumption. */
export function sampleJointEmission(x: number, y: number, z: number, p: JointParameters, out: { [index: number]: number }) {
  const f = jointSurfaceFunction(x, y, z, p), value = Math.abs(f) > .18 ? 0 : .006 * Math.exp(-.5 * (f / .055) ** 2);
  out[0] = value; out[1] = value; out[2] = value;
}
