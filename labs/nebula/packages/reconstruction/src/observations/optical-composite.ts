import type { SkyBounds } from '@cssearth/bake/volume';

type Rgb = [number, number, number];
type Point = [number, number];
/** Registered native samplers; RGB is in display units 0–255. False alone means no data. */
export interface OpticalImageSampler {
  nativeWidth: number; nativeHeight: number;
  pixelToSky(x: number, y: number): Point;
  sampleRgb(x: number, y: number, out: Rgb): boolean;
  sampleOriginal(x: number, y: number, out: Rgb): boolean;
  /** Prepared Gaussian low-pass images at the SAME angular sigma and registration in both sources. */
  sampleLowRgb?(x: number, y: number, out: Rgb): boolean;
  sampleLowOriginal?(x: number, y: number, out: Rgb): boolean;
}
export interface OpticalCompositeOptions {
  method?: 'overlap' | 'detail-fusion';
  maxFitSamples?: number; minFitSamples?: number; featherArcsec?: number;
  gainLimits?: Point; offsetLimits?: Point; diffuseLimits?: Point; maxStarResidual?: number;
  detailRatioLimits?: Point; detailLuminanceFloor?: number;
  /** Display matching is supported only in shared coverage; full is an explicit comparison baseline. */
  correctionScope?: 'overlap' | 'full';
}
export interface OpticalCompositeMetadata {
  schema: 'cssearth-optical-composite@1';
  status: 'fitted' | 'insufficient-overlap' | 'insufficient-variation' | 'held-out-regression' | 'detail-fusion';
  sampleCount: number; trainingSampleCount: number; heldOutSampleCount: number; rejectedSampleCount: number;
  heldOutRmseBefore: number | null; heldOutRmseAfter: number | null;
  correction: { gain: Rgb; offset: Rgb };
  limits: Required<OpticalCompositeOptions>;
  fitBoundsArcsec: SkyBounds;
  interpretation: string;
}
export interface OpticalComposite {
  sampleRgb(x: number, y: number, out: Rgb): boolean;
  sampleOriginal(x: number, y: number, out: Rgb): boolean;
  metadata: OpticalCompositeMetadata;
}
type Pair = { reference: Rgb; wide: Rgb };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function median(values: number[]) {
  values.sort((a, b) => a - b); const i = Math.floor(values.length / 2);
  return values.length % 2 ? values[i]! : (values[i - 1]! + values[i]!) / 2;
}
function limits(options: OpticalCompositeOptions): Required<OpticalCompositeOptions> {
  const result = { maxFitSamples: 4096, minFitSamples: 64, featherArcsec: 120,
    gainLimits: [.5, 2] as Point, offsetLimits: [-40, 40] as Point, diffuseLimits: [2, 245] as Point,
    maxStarResidual: 32, correctionScope: 'overlap' as const, method: 'overlap' as const,
    detailRatioLimits: [.5, 2] as Point, detailLuminanceFloor: 4, ...options };
  for (const key of ['gainLimits', 'offsetLimits', 'diffuseLimits', 'detailRatioLimits'] as const) {
    const p = result[key];
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || p[0] > p[1]) throw new TypeError(`Invalid ${key}.`);
    result[key] = [...p];
  }
  if (!Number.isInteger(result.maxFitSamples) || result.maxFitSamples < 20 || result.maxFitSamples > 65536 ||
      !Number.isInteger(result.minFitSamples) || result.minFitSamples < 10 || result.minFitSamples > result.maxFitSamples ||
      !Number.isFinite(result.featherArcsec) || result.featherArcsec <= 0 ||
      !Number.isFinite(result.maxStarResidual) || result.maxStarResidual < 0 ||
      !['overlap', 'full'].includes(result.correctionScope) || !['overlap', 'detail-fusion'].includes(result.method) ||
      !Number.isFinite(result.detailLuminanceFloor) || result.detailLuminanceFloor <= 0 || result.detailLuminanceFloor > 255 ||
      result.detailRatioLimits[0] < .1 || result.detailRatioLimits[0] > 1 || result.detailRatioLimits[1] < 1 || result.detailRatioLimits[1] > 4 ||
      result.gainLimits[0] <= 0 || result.gainLimits[0] > 1 || result.gainLimits[1] < 1 ||
      result.offsetLimits[0] > 0 || result.offsetLimits[1] < 0 || result.diffuseLimits[0] < 0 || result.diffuseLimits[1] > 255) {
    throw new TypeError('Invalid optical composite fit limits.');
  }
  return result;
}
function fitChannel(pairs: Pair[], c: number, settings: Required<OpticalCompositeOptions>): Point | null {
  const x = pairs.map(p => p.wide[c]!), y = pairs.map(p => p.reference[c]!);
  const mx = median([...x]), spread = median(x.map(v => Math.abs(v - mx)));
  if (spread < 2) return null; // Gain cannot be identified from a nearly constant display background.
  const slopes: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const j = (i * 37 + Math.floor(x.length / 2)) % x.length, dx = x[j]! - x[i]!;
    if (Math.abs(dx) >= 4) slopes.push((y[j]! - y[i]!) / dx);
  }
  if (!slopes.length) return null;
  let gain = clamp(median(slopes), ...settings.gainLimits);
  let offset = clamp(median(x.map((v, i) => y[i]! - gain * v)), ...settings.offsetLimits);
  for (let round = 0; round < 4; round++) {
    const residual = x.map((v, i) => y[i]! - gain * v - offset);
    const center = median([...residual]), scale = Math.max(.5, 1.4826 * median(residual.map(v => Math.abs(v - center))));
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < x.length; i++) {
      const w = Math.min(1, 1.5 * scale / Math.max(1e-12, Math.abs(residual[i]! - center))), a = x[i]!, b = y[i]!;
      sw += w; sx += w * a; sy += w * b; sxx += w * a * a; sxy += w * a * b;
    }
    gain = clamp((sxy - sx * sy / sw) / Math.max(1e-12, sxx - sx * sx / sw), ...settings.gainLimits);
    offset = clamp((sy - gain * sx) / sw, ...settings.offsetLimits);
  }
  return [gain, offset];
}
function rmse(pairs: Pair[], gain: Rgb, offset: Rgb) {
  if (!pairs.length) return null;
  return Math.sqrt(pairs.reduce((sum, p) => sum + p.wide.reduce((s, v, c) =>
    s + (clamp(v * gain[c]! + offset[c]!, 0, 255) - p.reference[c]!) ** 2, 0), 0) / (pairs.length * 3));
}
/** Offline relative display matching, never calibrated photometry or a registration fit. */
export function createOpticalComposite(reference: OpticalImageSampler, wide: OpticalImageSampler,
  bounds: SkyBounds, options: OpticalCompositeOptions = {}): OpticalComposite {
  const settings = limits(options), corners = [reference, wide].map(source => {
    if (![source.nativeWidth, source.nativeHeight].every(v => Number.isInteger(v) && v > 0)) throw new TypeError('Invalid native dimensions.');
    const points = [[0, 0], [source.nativeWidth, 0], [source.nativeWidth, source.nativeHeight], [0, source.nativeHeight]]
      .map(([x, y]) => source.pixelToSky(x!, y!));
    const p = points[0]!, q = points[1]!, r = points[3]!;
    if (!points.flat().every(Number.isFinite) || Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) < 1e-12) {
      throw new TypeError('Invalid registered footprint.');
    }
    return points;
  });
  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || bounds.max.some((v, i) => v <= bounds.min[i]!)) throw new TypeError('Invalid fit bounds.');
  if (settings.method === 'detail-fusion' && [reference, wide].some(source =>
    typeof source.sampleLowRgb !== 'function' || typeof source.sampleLowOriginal !== 'function')) {
    throw new TypeError('Detail fusion requires both registered Gaussian low-pass samplers on each source.');
  }
  const train: Pair[] = [], heldOut: Pair[] = [];
  let sampleCount = 0, rejectedSampleCount = 0;
  const columns = Math.min(reference.nativeWidth, settings.maxFitSamples,
    Math.max(1, Math.floor(Math.sqrt(settings.maxFitSamples * reference.nativeWidth / reference.nativeHeight))));
  const rows = Math.min(reference.nativeHeight, Math.floor(settings.maxFitSamples / columns));
  for (let row = 0; row < (settings.method === 'overlap' ? rows : 0); row++) for (let column = 0; column < columns; column++) {
    // Native pixel centres, stratified without allocating or reducing source images.
    const [x, y] = reference.pixelToSky(Math.floor((column + .5) * reference.nativeWidth / columns) + .5,
      Math.floor((row + .5) * reference.nativeHeight / rows) + .5);
    if (x < bounds.min[0] || x > bounds.max[0] || y < bounds.min[1] || y > bounds.max[1]) continue;
    const a: Rgb = [0, 0, 0], b: Rgb = [0, 0, 0], oa: Rgb = [0, 0, 0], ob: Rgb = [0, 0, 0];
    if (!reference.sampleRgb(x, y, a) || !wide.sampleRgb(x, y, b)) continue;
    const reliable = reference.sampleOriginal(x, y, oa) && wide.sampleOriginal(x, y, ob) && [a, b].every((rgb, s) =>
      rgb.every((v, c) => Number.isFinite(v) && v > settings.diffuseLimits[0] && v < settings.diffuseLimits[1] &&
        Number.isFinite([oa, ob][s]![c]!) && [oa, ob][s]![c]! < 250 && [oa, ob][s]![c]! >= 0 &&
        Math.abs([oa, ob][s]![c]! - v) <= settings.maxStarResidual));
    if (!reliable) { rejectedSampleCount++; continue; }
    (sampleCount++ % 5 === 0 ? heldOut : train).push({ reference: a, wide: b });
  }
  const gain: Rgb = [1, 1, 1], offset: Rgb = [0, 0, 0];
  let status: OpticalCompositeMetadata['status'] = settings.method === 'detail-fusion' ? 'detail-fusion' : 'insufficient-overlap';
  const before = rmse(heldOut, gain, offset);
  if (sampleCount >= settings.minFitSamples) {
    const fit = [0, 1, 2].map(c => fitChannel(train, c, settings));
    status = fit.some(v => v === null) ? 'insufficient-variation' : 'fitted';
    if (status === 'fitted') for (let c = 0; c < 3; c++) { gain[c] = fit[c]![0]; offset[c] = fit[c]![1]; }
    const after = rmse(heldOut, gain, offset);
    if (after !== null && before !== null && after > before + 1e-9) {
      status = 'held-out-regression'; gain.fill(1); offset.fill(0);
    }
  }
  const metadata: OpticalCompositeMetadata = { schema: 'cssearth-optical-composite@1', status, sampleCount,
    trainingSampleCount: train.length, heldOutSampleCount: heldOut.length, rejectedSampleCount,
    heldOutRmseBefore: before, heldOutRmseAfter: rmse(heldOut, gain, offset), correction: { gain: [...gain], offset: [...offset] },
    limits: structuredClone(settings), fitBoundsArcsec: structuredClone(bounds),
    interpretation: settings.method === 'detail-fusion' ?
      'Two-scale Gaussian/detail separation: wide RGB retains broad illumination and chromaticity; bounded reference log-luminance detail replaces wide detail within a physical edge feather. Both low-pass inputs must share one angular sigma. No affine correction, absolute photometry or depth calibration; missing low-pass coverage retains the available source.' :
      `Robust RGB display match from native diffuse overlap; no absolute photometric or depth calibration. ${settings.correctionScope === 'overlap' ?
      'Correction is feathered only within shared coverage; wide-only RGB remains unchanged.' :
      'Explicit comparison baseline: correction extends across the full wide footprint.'} Identity correction when fit is unsupported.` };
  const edges = corners[0]!.map((p, i) => {
    const q = corners[0]![(i + 1) % 4]!, dx = q[0] - p[0], dy = q[1] - p[1];
    return { x: p[0], y: p[1], dx, dy, length: Math.hypot(dx, dy) };
  });
  const sample = (original: boolean) => (x: number, y: number, out: Rgb): boolean => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const a: Rgb = [0, 0, 0], b: Rgb = [0, 0, 0], method = original ? 'sampleOriginal' : 'sampleRgb';
    const hasReference = reference[method](x, y, a), hasWide = wide[method](x, y, b);
    if (!hasReference && !hasWide) return false;
    let weight = hasReference ? 1 : 0;
    if (hasReference && hasWide) {
      let edgeDistance = Infinity;
      for (const edge of edges) edgeDistance = Math.min(edgeDistance, Math.abs(edge.dx * (y - edge.y) - edge.dy * (x - edge.x)) / edge.length);
      const t = clamp(edgeDistance / settings.featherArcsec, 0, 1); weight = t * t * (3 - 2 * t);
    }
    if (settings.method === 'detail-fusion') {
      let multiplier = 1;
      const lowA: Rgb = [0, 0, 0], lowB: Rgb = [0, 0, 0], lowMethod = original ? 'sampleLowOriginal' : 'sampleLowRgb';
      if (hasReference && hasWide && weight > 0 && reference[lowMethod]?.(x, y, lowA) && wide[lowMethod]?.(x, y, lowB) &&
          [a, b, lowA, lowB].every(rgb => rgb.every(v => Number.isFinite(v) && v >= 0 && v <= 255))) {
        // One Gaussian/detail split, following the frequency-band separation of Burt & Adelson (1983).
        // This display-luminance proxy is not linear radiance. A shared gain preserves the wide RGB ratios.
        const luminance = (rgb: Rgb) => Math.max(settings.detailLuminanceFloor, .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]);
        const detail = Math.log(luminance(a) / luminance(lowA)) - Math.log(luminance(b) / luminance(lowB));
        multiplier = Math.exp(weight * clamp(detail, Math.log(settings.detailRatioLimits[0]), Math.log(settings.detailRatioLimits[1])));
        multiplier = Math.min(multiplier, 255 / Math.max(1, ...b));
      }
      for (let c = 0; c < 3; c++) out[c] = clamp(hasWide ? b[c]! * multiplier : a[c]!, 0, 255);
      return true;
    }
    for (let c = 0; c < 3; c++) {
      const matchedWide = clamp(b[c]! * gain[c]! + offset[c]!, 0, 255);
      const correctedWide = settings.correctionScope === 'full' ? matchedWide : b[c]! + weight * (matchedWide - b[c]!);
      out[c] = a[c]! * weight + (hasWide ? correctedWide : 0) * (1 - weight);
    }
    return true;
  };
  return { sampleRgb: sample(false), sampleOriginal: sample(true), metadata };
}
