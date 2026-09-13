/**
 * Hapke (1984) macroscopic roughness: the effective cosines of incidence and
 * emission and the shadowing function S for a mean slope angle θ̄, following the
 * USGS ISIS3 implementation (isis/src/base/objs/Hapke/Hapke.cpp at tag 10.0.0_LTS,
 * commit 1638a583e95be76d50e16cbe70f2c8e237528132) step for step, including its
 * clamps (exponents capped at 23, sines floored at 1e-10) and its branch on
 * whether incidence exceeds emission. Angles in radians.
 */
export interface RoughnessGeometry { readonly mu0e: number; readonly mue: number; readonly shadowing: number }

export function hapkeRoughness(mu0: number, mu: number, phase: number, theta: number): RoughnessGeometry {
  const cost = Math.cos(theta), sint = Math.sin(theta);
  const cott = cost / Math.max(1e-10, sint), cot2t = cott * cott, tant = sint / cost;
  const sr = Math.sqrt(1 + Math.PI * tant * tant), osr = 1 / sr;
  const sini = Math.sqrt(Math.max(0, 1 - mu0 * mu0)), sine = Math.sqrt(Math.max(0, 1 - mu * mu));
  const coti = mu0 / Math.max(1e-10, sini), cot2i = coti * coti;
  const ecoti = Math.exp(Math.min(-cot2t * cot2i / Math.PI, 23)), ecot2i = Math.exp(Math.min(-2 * cott * coti / Math.PI, 23));
  const u0p0 = osr * (mu0 + sini * tant * ecoti / (2 - ecot2i));
  const cote = mu / Math.max(1e-10, sine), cot2e = cote * cote;
  const ecote = Math.exp(Math.min(-cot2t * cot2e / Math.PI, 23)), ecot2e = Math.exp(Math.min(-2 * cott * cote / Math.PI, 23));
  const up0 = osr * (mu + sine * tant * ecote / (2 - ecot2e));
  // Azimuth between the planes of incidence and emission from the phase angle; undefined at normal incidence or emission.
  const sinei = sine * sini;
  let caz = 1, azimuth = 0;
  if (sinei !== 0) { caz = (Math.cos(phase) - mu * mu0) / sinei; azimuth = caz <= -1 ? Math.PI : caz > 1 ? 0 : Math.acos(caz); }
  const halfAzimuth = azimuth / 2;
  const faz = halfAzimuth >= Math.PI / 2 ? 0 : Math.exp(Math.min(-2 * Math.tan(halfAzimuth), 23));
  const sin2a2 = Math.sin(halfAzimuth) ** 2, api = azimuth / Math.PI;
  let u0p: number, up: number, q: number;
  if (mu0 >= mu) {
    // Incidence no larger than emission.
    q = osr * mu0 / u0p0;
    const ecei = 2 - ecot2e - api * ecot2i, s2ei = sin2a2 * ecoti;
    u0p = osr * (mu0 + sini * tant * (caz * ecote + s2ei) / ecei);
    up = osr * (mu + sine * tant * (ecote - s2ei) / ecei);
  } else {
    q = osr * mu / up0;
    const ecee = 2 - ecot2i - api * ecot2e, s2ee = sin2a2 * ecote;
    u0p = osr * (mu0 + sini * tant * (ecoti - s2ee) / ecee);
    up = osr * (mu + sine * tant * (caz * ecoti + s2ee) / ecee);
  }
  return { mu0e: u0p, mue: up, shadowing: up * mu0 / (up0 * u0p0 * sr * (1 - faz + faz * q)) };
}
