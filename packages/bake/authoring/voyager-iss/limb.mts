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
  /** Where the rays started: the recorded prediction, or the bright-pixel centroid when the disc sat whole in the frame far from it. */
  seed: 'prediction' | 'centroid';
}

export const VOYAGER_LIMB_POLICY: LimbPolicy = { searchPixels: 300, inlierPixels: 3, marginPixels: 12, sunlitMarginDegrees: 10 };

export function fitLimb(image: LimbImage, prediction: LimbPrediction, policy: LimbPolicy = VOYAGER_LIMB_POLICY): LimbFit {
  const { width, height, values } = image, [cxPredicted, cyPredicted] = prediction.centre, r0 = prediction.radiusPixels, m = policy.marginPixels;
  if (!(r0 > 0) || !(width > 2 * m) || !(height > 2 * m) || values.length !== width * height) throw new RangeError('Invalid limb fit input.');
  const at = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < m || yi < m || xi >= width - m || yi >= height - m ? NaN : values[yi * width + xi]!;
  };
  // Sky and disc levels from this frame, by what a disc of the predicted size must occupy: the sky is the median of the
  // darkest 30 % of the frame, the disc the median of the brightest half of its expected area (a tiny disc is a tiny share
  // of the frame, so plain percentiles would put its level in the sky noise).
  const all: number[] = [];
  for (let y = m; y < height - m; y++) for (let x = m; x < width - m; x++) { const v = values[y * width + x]!; if (!Number.isNaN(v)) all.push(v); }
  all.sort((a, b) => a - b);
  if (all.length < 100) throw new RangeError('Too few valid pixels for a limb fit.');
  const area = Math.PI * r0 * r0, skyLevel = all[Math.floor(all.length * 0.15)]!;
  // The disc level is set by pixels with bright neighbours three rows above and below them: a disc has them, a dropout
  // streak (one or two rows) or a star does not. Forty percent of the disc area from the top keeps a half-lit disc in range.
  const supported: number[] = [];
  for (let y = m + 3; y < height - m - 3; y++) for (let x = m; x < width - m; x++) {
    const v = values[y * width + x]!;
    if (v > skyLevel && values[(y - 3) * width + x]! >= 0.5 * v && values[(y + 3) * width + x]! >= 0.5 * v) supported.push(v);
  }
  supported.sort((a, b) => a - b);
  const discCount = Math.max(50, Math.min(Math.round(area * 0.4), Math.floor(supported.length / 4)));
  const discLevel = Math.max(supported[Math.max(0, supported.length - discCount)] ?? skyLevel, skyLevel + 1e-6), span = discLevel - skyLevel, middle = skyLevel + span / 2;
  // Pixels far brighter than the disc are artefacts, never disc.
  const ceiling = skyLevel + 4 * span;
  const skyBelow = skyLevel + 0.2 * span, litAbove = skyLevel + 0.35 * span, drop = 0.12 * span;
  // The recorded pointing can miss by more than the search band, and by more than a small disc's own size. When the lit
  // pixels form one blob of about the predicted disc area that sits whole inside the frame, its centroid seeds the rays.
  let cx0 = cxPredicted, cy0 = cyPredicted, seed: LimbFit['seed'] = 'prediction';
  { let sx = 0, sy = 0, n = 0, minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = m; y < height - m; y++) for (let x = m; x < width - m; x++) { const v = values[y * width + x]!; if (v > middle && v < ceiling) { sx += x; sy += y; n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
    const whole = minX > m && minY > m && maxX < width - 1 - m && maxY < height - 1 - m, extent = Math.max(maxX - minX, maxY - minY);
    if (n > 0.3 * area && n < 1.3 * area && whole && extent < 2.6 * r0) { cx0 = sx / n; cy0 = sy / n; seed = 'centroid'; }
  }
  // Windows scale with the disc so a small disc still shows sky beyond and lit ground inside its edge.
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, Math.round(v)));
  const outsideFrom = clamp(0.05 * r0, 3, 6), outsideTo = clamp(0.2 * r0, 10, 14) + outsideFrom;
  const insideFrom = clamp(0.08 * r0, 3, 5), insideTo = clamp(0.3 * r0, 9, 10) + insideFrom;
  const outsideNeeded = Math.max(4, Math.round(0.7 * (outsideTo - outsideFrom))), insideNeeded = Math.max(4, Math.round(0.6 * (insideTo - insideFrom)));
  const step = (x: number, y: number, c: number, s: number, r: number) => at(x + c * (r - 1.5), y + s * (r - 1.5)) - at(x + c * (r + 1.5), y + s * (r + 1.5));
  const points: [number, number][] = [], cosLimit = Math.cos((90 - policy.sunlitMarginDegrees) * Math.PI / 180);
  const search = seed === 'centroid' ? Math.min(policy.searchPixels, Math.max(20, 0.5 * r0)) : policy.searchPixels;
  for (let a = 0; a < 360; a += 0.5) {
    const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
    if (prediction.sunDirection && c * prediction.sunDirection[0] + s * prediction.sunDirection[1] < cosLimit) continue;
    // Scan inward; the first drop with sky beyond and disc inside is the outermost edge of the disc on this ray.
    for (let r = r0 + search; r > Math.max(2, r0 - search); r -= 0.5) {
      if (!(step(cx0, cy0, c, s, r) > drop)) continue;
      let best = -Infinity, edge = r;
      for (let q = r - 3; q <= r + 3; q += 0.25) { const g = step(cx0, cy0, c, s, q); if (g > best) { best = g; edge = q; } }
      let dark = 0, outside = 0, lit = 0, inside = 0;
      for (let q = edge + outsideFrom; q < edge + outsideTo; q++) { const v = at(cx0 + c * q, cy0 + s * q); if (Number.isNaN(v)) continue; outside++; if (v < skyBelow) dark++; }
      for (let q = edge - insideTo; q < edge - insideFrom; q++) { const v = at(cx0 + c * q, cy0 + s * q); if (Number.isNaN(v)) continue; inside++; if (v > litAbove) lit++; }
      if (outside >= outsideNeeded && dark >= 0.8 * outside && inside >= insideNeeded && lit >= 0.8 * inside) { points.push([cx0 + c * edge, cy0 + s * edge]); break; }
      r = edge - 3;
    }
  }
  const residual = (centre: readonly number[], [x, y]: readonly number[]) => Math.hypot(centre[0]! - x!, centre[1]! - y!) - r0;
  const inliers = (centre: readonly number[]) => points.filter(p => Math.abs(residual(centre, p)) < policy.inlierPixels);
  // Consensus over pairs: two edge points and the radius fix two candidate centres.
  let consensus: [number, number] = [cx0, cy0], count = 0;
  for (let i = 0; i < points.length; i += 2) for (let j = i + 7; j < points.length; j += 3) {
    const [x1, y1] = points[i]!, [x2, y2] = points[j]!, half = Math.hypot(x2 - x1, y2 - y1) / 2;
    if (half < Math.max(5, 0.1 * r0) || half >= r0) continue;
    const h = Math.sqrt(r0 * r0 - half * half), ux = -(y2 - y1) / (2 * half), uy = (x2 - x1) / (2 * half);
    for (const sign of [1, -1]) {
      const centre: [number, number] = [(x1 + x2) / 2 + sign * h * ux, (y1 + y2) / 2 + sign * h * uy];
      if (Math.hypot(centre[0] - cx0, centre[1] - cy0) > search) continue;
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
  const centre = used.length >= Math.min(20, minimumEdgePoints(r0)) ? refine(used, consensus) : consensus;
  used = inliers(centre);
  const rmsPixels = used.length ? Math.sqrt(used.reduce((sum, p) => sum + residual(centre, p) ** 2, 0) / used.length) : NaN;
  return { edgePoints: used.length, candidates: points.length, centre, shift: [centre[0] - cxPredicted, centre[1] - cyPredicted], rmsPixels,
    levels: { sky: skyLevel, disc: discLevel }, seed };
}

/** A frame is placed only when enough of its limb agrees with one circle. */
export const LIMB_ACCEPTANCE = { minimumEdgePoints: 40, maximumRmsPixels: 3 } as const;
/** Edge points a fit needs: 40 for a large disc, fewer for a small one whose sunlit limb holds fewer distinct pixels. */
export const minimumEdgePoints = (radiusPixels: number) => Math.min(LIMB_ACCEPTANCE.minimumEdgePoints, Math.max(12, Math.round(radiusPixels / 2)));
export const limbAccepted = (fit: LimbFit, radiusPixels = Infinity) => fit.edgePoints >= minimumEdgePoints(radiusPixels) && fit.rmsPixels < LIMB_ACCEPTANCE.maximumRmsPixels;
