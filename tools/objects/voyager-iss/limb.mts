/**
 * Limb placement for a Voyager ISS frame. The recorded (SEDR) pointing is off by tens to hundreds of pixels, so the disc is
 * found in the image: along rays from the predicted centre, on the sunlit side only (no terminator), the outermost steep
 * bright-to-dark edge with sky beyond it and disc inside it is a limb point. A circle of the predicted radius is fitted to
 * those points by consensus (the centre most points agree with), then refined by least squares on its inliers.
 */

/** A decoded frame: calibrated values, row-major, with NaN where the product holds no data. */
export interface LimbImage { width: number; height: number; values: ArrayLike<number> }
export interface LimbPrediction {
  /** Predicted disc centre in detector pixels (column, row), zero-based. */
  centre: readonly [number, number];
  /** Predicted disc radius in pixels, from range and body radius. */
  radiusPixels: number;
  /** Unit image-plane direction toward the Sun; only limb normals facing it by more than `sunlitMarginDegrees` count. */
  sunDirection?: readonly [number, number];
}
export interface LimbPolicy {
  /** How far the limb may sit from the prediction along each ray, in pixels. */
  searchPixels: number;
  /** Edge points within this distance of the fitted circle are inliers. */
  inlierPixels: number;
  /** Detector margin, in pixels, where samples are ignored. */
  marginPixels: number;
  sunlitMarginDegrees: number;
}
export interface LimbFit {
  edgePoints: number; candidates: number;
  centre: [number, number]; shift: [number, number]; rmsPixels: number;
  levels: { sky: number; disc: number };
}

export const VOYAGER_LIMB_POLICY: LimbPolicy = { searchPixels: 300, inlierPixels: 3, marginPixels: 12, sunlitMarginDegrees: 10 };

export function fitLimb(image: LimbImage, prediction: LimbPrediction, policy: LimbPolicy = VOYAGER_LIMB_POLICY): LimbFit {
  const { width, height, values } = image, [cx0, cy0] = prediction.centre, r0 = prediction.radiusPixels, m = policy.marginPixels;
  if (!(r0 > 0) || !(width > 2 * m) || !(height > 2 * m) || values.length !== width * height) throw new RangeError('Invalid limb fit input.');
  const at = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < m || yi < m || xi >= width - m || yi >= height - m ? NaN : values[yi * width + xi]!;
  };
  // Sky and disc levels from this frame. Scattered light lifts the sky and noise runs both ways, so each level is the median
  // of its side of the midpoint between the 5th and 99.5th percentiles; the top half percent is disc even for a tiny disc.
  const all: number[] = [];
  for (let i = 0; i < width * height; i += 37) { const v = at(i % width, Math.floor(i / width)); if (!Number.isNaN(v)) all.push(v); }
  all.sort((a, b) => a - b);
  if (all.length < 100) throw new RangeError('Too few valid pixels for a limb fit.');
  const middle = (all[Math.floor(all.length * .05)]! + all[Math.floor(all.length * .995)]!) / 2;
  const below = all.filter(v => v < middle), above = all.filter(v => v >= middle);
  const skyLevel = below[below.length >> 1] ?? 0, discLevel = above[above.length >> 1] ?? skyLevel + 1, span = discLevel - skyLevel;
  const skyBelow = skyLevel + 0.2 * span, litAbove = skyLevel + 0.35 * span, drop = 0.12 * span;
  const step = (x: number, y: number, c: number, s: number, r: number) => at(x + c * (r - 1.5), y + s * (r - 1.5)) - at(x + c * (r + 1.5), y + s * (r + 1.5));
  const points: [number, number][] = [], cosLimit = Math.cos((90 - policy.sunlitMarginDegrees) * Math.PI / 180);
  for (let a = 0; a < 360; a += 0.5) {
    const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
    if (prediction.sunDirection && c * prediction.sunDirection[0] + s * prediction.sunDirection[1] < cosLimit) continue;
    // Scan inward; the first drop with sky beyond and disc inside is the outermost edge of the disc on this ray.
    for (let r = r0 + policy.searchPixels; r > r0 - policy.searchPixels; r -= 0.5) {
      if (!(step(cx0, cy0, c, s, r) > drop)) continue;
      let best = -Infinity, edge = r;
      for (let q = r - 3; q <= r + 3; q += 0.25) { const g = step(cx0, cy0, c, s, q); if (g > best) { best = g; edge = q; } }
      let dark = 0, outside = 0, lit = 0, inside = 0;
      for (let q = edge + 6; q < edge + 20; q++) { const v = at(cx0 + c * q, cy0 + s * q); if (Number.isNaN(v)) continue; outside++; if (v < skyBelow) dark++; }
      for (let q = edge - 15; q < edge - 5; q++) { const v = at(cx0 + c * q, cy0 + s * q); if (Number.isNaN(v)) continue; inside++; if (v > litAbove) lit++; }
      if (outside >= 10 && dark >= 0.8 * outside && inside >= 6 && lit >= 0.8 * inside) { points.push([cx0 + c * edge, cy0 + s * edge]); break; }
      r = edge - 3;
    }
  }
  const residual = (centre: readonly number[], [x, y]: readonly number[]) => Math.hypot(centre[0]! - x!, centre[1]! - y!) - r0;
  const inliers = (centre: readonly number[]) => points.filter(p => Math.abs(residual(centre, p)) < policy.inlierPixels);
  // Consensus over pairs: two edge points and the radius fix two candidate centres.
  let consensus: [number, number] = [cx0, cy0], count = 0;
  for (let i = 0; i < points.length; i += 2) for (let j = i + 7; j < points.length; j += 3) {
    const [x1, y1] = points[i]!, [x2, y2] = points[j]!, half = Math.hypot(x2 - x1, y2 - y1) / 2;
    if (half < 20 || half >= r0) continue;
    const h = Math.sqrt(r0 * r0 - half * half), ux = -(y2 - y1) / (2 * half), uy = (x2 - x1) / (2 * half);
    for (const sign of [1, -1]) {
      const centre: [number, number] = [(x1 + x2) / 2 + sign * h * ux, (y1 + y2) / 2 + sign * h * uy];
      if (Math.hypot(centre[0] - cx0, centre[1] - cy0) > policy.searchPixels) continue;
      const n = inliers(centre).length;
      if (n > count) { count = n; consensus = centre; }
    }
  }
  // Gauss-Newton on the centre with the radius fixed.
  const refine = (used: readonly [number, number][], start: [number, number]): [number, number] => {
    let [cx, cy] = start;
    for (let iteration = 0; iteration < 40; iteration++) {
      let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
      for (const [x, y] of used) {
        const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy), jx = dx / d, jy = dy / d, res = d - r0;
        a11 += jx * jx; a12 += jx * jy; a22 += jy * jy; b1 -= jx * res; b2 -= jy * res;
      }
      const det = a11 * a22 - a12 * a12;
      if (!det) break;
      cx += (a22 * b1 - a12 * b2) / det; cy += (a11 * b2 - a12 * b1) / det;
    }
    return [cx, cy];
  };
  let used = inliers(consensus);
  const centre = used.length >= 20 ? refine(used, consensus) : consensus;
  used = inliers(centre);
  const rmsPixels = used.length ? Math.sqrt(used.reduce((sum, p) => sum + residual(centre, p) ** 2, 0) / used.length) : NaN;
  return { edgePoints: used.length, candidates: points.length, centre, shift: [centre[0] - cx0, centre[1] - cy0], rmsPixels,
    levels: { sky: skyLevel, disc: discLevel } };
}

/** A frame is placed only when enough of its limb agrees with one circle. */
export const LIMB_ACCEPTANCE = { minimumEdgePoints: 40, maximumRmsPixels: 3 } as const;
export const limbAccepted = (fit: LimbFit) => fit.edgePoints >= LIMB_ACCEPTANCE.minimumEdgePoints && fit.rmsPixels < LIMB_ACCEPTANCE.maximumRmsPixels;
