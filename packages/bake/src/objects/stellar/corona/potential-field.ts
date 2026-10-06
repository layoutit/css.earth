// The potential-field source-surface extrapolation of a star's surface magnetic map.
//
// The corona's field is taken as current-free between the surface (r = 1) and a source surface (r = sourceRadii), where
// the wind drags it radial. It follows from the radial field at the surface alone (Altschuler & Newkirk 1969; Schatten,
// Wilcox & Ness 1969). With the surface map expanded in real orthonormal spherical harmonics, B_r(1) = Σ b_lm Y_lm:
//   B_r(r)     =  Σ b_lm Y_lm        [(l+1) r^-(l+2) + l r^(l-1) s^-(2l+1)] / [(l+1) + l s^-(2l+1)]
//   B_theta(r) = -Σ b_lm dY_lm/dθ    [r^-(l+2) - r^(l-1) s^-(2l+1)]         / [(l+1) + l s^-(2l+1)]
//   B_phi(r)   = -Σ b_lm dY_lm/dφ/sinθ [same radial factor]
// with s the source radius, all radii in stellar radii. At r = s the tangential field vanishes.

/** Orthonormal associated Legendre functions P̄_l^m(cos θ) for 0 <= m <= l <= lmax, and their derivatives in θ. */
export function orthonormalLegendre(lmax: number, theta: number) {
  const x = Math.cos(theta), s = Math.max(1e-12, Math.sin(theta)), index = (l: number, m: number) => l * (l + 1) / 2 + m;
  const p = new Float64Array((lmax + 1) * (lmax + 2) / 2), dp = new Float64Array(p.length);
  p[0] = Math.sqrt(1 / (4 * Math.PI));
  for (let m = 1; m <= lmax; m++) p[index(m, m)] = -Math.sqrt((2 * m + 1) / (2 * m)) * s * p[index(m - 1, m - 1)]!;
  for (let m = 0; m < lmax; m++) p[index(m + 1, m)] = Math.sqrt(2 * m + 3) * x * p[index(m, m)]!;
  for (let m = 0; m <= lmax; m++) for (let l = m + 2; l <= lmax; l++) {
    const a = Math.sqrt((4 * l * l - 1) / (l * l - m * m)), b = Math.sqrt(((l - 1) ** 2 - m * m) / (4 * (l - 1) ** 2 - 1));
    p[index(l, m)] = a * (x * p[index(l - 1, m)]! - b * p[index(l - 2, m)]!);
  }
  // dP̄_l^m/dθ = [l x P̄_l^m - sqrt((2l+1)(l²-m²)/(2l-1)) P̄_(l-1)^m] / sin θ
  for (let l = 0; l <= lmax; l++) for (let m = 0; m <= l; m++) {
    const lower = l > m ? Math.sqrt((2 * l + 1) * (l * l - m * m) / (2 * l - 1)) * p[index(l - 1, m)]! : 0;
    dp[index(l, m)] = (l * x * p[index(l, m)]! - lower) / s;
  }
  return { p, dp, index };
}

export interface SurfaceFieldMap { readonly width: number; readonly height: number; /** B_r in gauss, rows from the north pole, columns from longitude 0 eastward. */ readonly radial: Float64Array }
export interface FieldHarmonics { readonly lmax: number; /** Cosine and sine coefficients of the real harmonics, indexed l(l+1)/2 + m. */ readonly cosine: Float64Array; readonly sine: Float64Array }

/** Expand a surface map in real orthonormal harmonics by quadrature over its equal-angle cells. */
export function expandSurfaceField(map: SurfaceFieldMap, lmax: number): FieldHarmonics {
  const count = (lmax + 1) * (lmax + 2) / 2, cosine = new Float64Array(count), sine = new Float64Array(count);
  const dTheta = Math.PI / map.height, dPhi = 2 * Math.PI / map.width;
  for (let row = 0; row < map.height; row++) {
    const theta = (row + 0.5) * dTheta, { p, index } = orthonormalLegendre(lmax, theta), area = Math.sin(theta) * dTheta * dPhi;
    for (let column = 0; column < map.width; column++) {
      const value = map.radial[row * map.width + column]! * area, phi = (column + 0.5) * dPhi;
      for (let m = 0; m <= lmax; m++) {
        const c = Math.cos(m * phi) * (m === 0 ? 1 : Math.SQRT2), s = Math.sin(m * phi) * Math.SQRT2;
        for (let l = m; l <= lmax; l++) { const i = index(l, m); cosine[i] += value * p[i]! * c; if (m > 0) sine[i] += value * p[i]! * s; }
      }
    }
  }
  return { lmax, cosine, sine };
}

/** The field (B_r, B_theta, B_phi) in gauss at a place, for a source surface at `sourceRadii`. Beyond it the field is radial
 * and falls as r^-2 from its value on the source surface. */
export function potentialField(harmonics: FieldHarmonics, sourceRadii: number, radii: number, theta: number, phi: number): [number, number, number] {
  const r = Math.min(radii, sourceRadii), { p, dp, index } = orthonormalLegendre(harmonics.lmax, theta), sinTheta = Math.max(1e-12, Math.sin(theta));
  let br = 0, bt = 0, bp = 0;
  for (let l = 1; l <= harmonics.lmax; l++) {
    const closure = sourceRadii ** -(2 * l + 1), denominator = (l + 1) + l * closure;
    const radial = ((l + 1) * r ** -(l + 2) + l * r ** (l - 1) * closure) / denominator, tangential = (r ** -(l + 2) - r ** (l - 1) * closure) / denominator;
    for (let m = 0; m <= l; m++) {
      const i = index(l, m), norm = m === 0 ? 1 : Math.SQRT2, c = Math.cos(m * phi) * norm, s = Math.sin(m * phi) * norm;
      const a = harmonics.cosine[i]!, b = m > 0 ? harmonics.sine[i]! : 0;
      br += radial * p[i]! * (a * c + b * s);
      bt -= tangential * dp[i]! * (a * c + b * s);
      bp -= tangential * p[i]! * m * (-a * s + b * c) / sinTheta;
    }
  }
  const beyond = radii > sourceRadii ? (sourceRadii / radii) ** 2 : 1;
  return [br * beyond, radii > sourceRadii ? 0 : bt, radii > sourceRadii ? 0 : bp];
}

/** The surface map a set of harmonics stands for, to check an expansion against its input. */
export function synthesizeSurfaceField(harmonics: FieldHarmonics, width: number, height: number): Float64Array {
  const out = new Float64Array(width * height);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++)
    out[row * width + column] = potentialField(harmonics, 1e9, 1, (row + 0.5) * Math.PI / height, (column + 0.5) * 2 * Math.PI / width)[0];
  return out;
}

/** Whether the field line through a place is closed: followed both ways, it meets the surface at both ends before reaching
 * the source surface. Midpoint steps of `step` stellar radii in spherical coordinates. */
export function fieldLineClosed(harmonics: FieldHarmonics, sourceRadii: number, radii: number, theta: number, phi: number, step = 0.03): boolean {
  if (radii >= sourceRadii) return false;
  const inside = (angle: number) => Math.min(Math.PI - 1e-6, Math.max(1e-6, angle));
  for (const direction of [1, -1]) {
    let r = radii, t = theta, p = phi;
    for (let i = 0; ; i++) {
      if (i === 4000) return false;
      const [br, bt, bp] = potentialField(harmonics, sourceRadii, r, t, p), strength = Math.hypot(br, bt, bp);
      if (!(strength > 0)) return false;
      const h = direction * step / strength, rm = r + 0.5 * h * br, tm = t + 0.5 * h * bt / r, pm = p + 0.5 * h * bp / (r * Math.max(1e-6, Math.sin(t)));
      if (rm >= sourceRadii) return false;
      if (rm <= 1) break;
      const [mr, mt, mp] = potentialField(harmonics, sourceRadii, rm, inside(tm), pm), middle = Math.hypot(mr, mt, mp);
      if (!(middle > 0)) return false;
      const k = direction * step / middle;
      r += k * mr; t = inside(t + k * mt / rm); p += k * mp / (rm * Math.max(1e-6, Math.sin(tm)));
      if (r >= sourceRadii) return false;
      if (r <= 1) break;
    }
  }
  return true;
}

/** The share of each sphere that open field crosses, by radius: from field lines traced on 10° cells at `OPEN_SHARE_RADII`,
 * joined by straight lines in radius, and 1 from the source surface outward. Never under `OPEN_SHARE_FLOOR`. */
export const OPEN_SHARE_RADII = [1.05, 1.2, 1.5, 2, 2.4] as const, OPEN_SHARE_FLOOR = 0.05;
export function openShare(harmonics: FieldHarmonics, sourceRadii: number) {
  const NW = 36, NH = 18, shares = OPEN_SHARE_RADII.filter(radii => radii < sourceRadii).map(radii => {
    let open = 0, all = 0;
    for (let row = 0; row < NH; row++) { const theta = (row + 0.5) * Math.PI / NH, weight = Math.sin(theta);
      for (let column = 0; column < NW; column++) { all += weight; if (!fieldLineClosed(harmonics, sourceRadii, radii, theta, (column + 0.5) * 2 * Math.PI / NW)) open += weight; } }
    return [radii, Math.max(OPEN_SHARE_FLOOR, open / all)] as const;
  });
  const knots = [...shares, [sourceRadii, 1] as const];
  return Object.assign((radii: number) => {
    if (radii >= sourceRadii) return 1;
    let i = 0; while (i < knots.length - 2 && radii > knots[i + 1]![0]) i++;
    const [r0, s0] = knots[i]!, [r1, s1] = knots[i + 1]!;
    return s0 + (s1 - s0) * Math.max(0, Math.min(1, (radii - r0) / (r1 - r0)));
  }, { shares });
}
