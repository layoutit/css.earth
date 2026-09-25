/**
 * Pure pieces of the lens tone fit: paired pixels, the monotone correction they imply, and its composition
 * onto the lens's current tone curve. `lens-tone-fit.ts` owns the loop, bakes and measurements.
 *
 * The curve maps the analytic render level a channel has without it to the level wanted. One step fits
 * C_k = median(target | current render) from paired pixels (never histogram matching, so a knot stays a knot),
 * forces it monotone, and composes LUT_{k+1} = C_k ∘ LUT_k; smoothing and gain bounds keep it a gentle curve.
 *
 * The render can never exceed the projection byte (the shared opacity), so a curve alone cannot lift a core
 * that rides the opacity shoulder. Exposure is solved jointly: the projection is re-exposed analytically from
 * the exposure-free integral, the curve re-fitted, and the whole range (p99, p99.9, core) scored.
 */
import { lensToneRender, lensToneValue, type LensToneCurve } from '@cssearth/bake/volume';
import { lensLevelPairs, lensLevelStatistics, untonedRender, type LensLevelGrid, type LensLevelMaterial } from '../../server/services/lens-levels.ts';

/** Largest and smallest gain one knot may take against its input: past these a parameter is pinned. */
export const TONE_GAIN_LIMITS = [.25, 4] as const;
const BIN = 8, MINIMUM = 12;

export function identityToneCurve(step = 16): LensToneCurve {
  const knots: number[] = [];
  for (let k = 0; k < 255; k += step) knots.push(k);
  knots.push(255);
  return { schema: 'cssearth-lens-tone-curve@1', knots, channels: [knots.slice(), knots.slice(), knots.slice()] };
}

/** Pool-adjacent-violators: the weighted least-squares nondecreasing sequence. */
export function monotone(values: readonly number[], weights: readonly number[]): number[] {
  const blocks: { value: number; weight: number; count: number }[] = [];
  values.forEach((value, i) => {
    blocks.push({ value, weight: weights[i]!, count: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2]!.value > blocks[blocks.length - 1]!.value) {
      const b = blocks.pop()!, a = blocks.pop()!, weight = a.weight + b.weight;
      blocks.push({ value: (a.value * a.weight + b.value * b.weight) / weight, weight, count: a.count + b.count });
    }
  });
  return blocks.flatMap(block => new Array<number>(block.count).fill(block.value));
}

/** Checkerboard of square blocks: one colour fits, the other is held out. */
export function splitFootprint(mask: Uint8Array, width: number, height: number, block = 16) {
  const fit = new Uint8Array(mask.length), heldOut = new Uint8Array(mask.length);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const p = j * width + i;
    if (!mask[p]) continue;
    (((i / block | 0) + (j / block | 0)) % 2 ? heldOut : fit)[p] = 1;
  }
  return { fit, heldOut };
}

export interface ChannelPairs { input: number[]; current: number[]; target: number[]; level: number[] }
/**
 * Per channel, for every masked pixel: the curve's input (render without the curve), the render the lens
 * has now, and the target — this lens's own sky-removed image times `targetScale` (the delivery-loss
 * compensation), exactly as the levels measurement forms both sides.
 */
export function pairedPixels(grid: LensLevelGrid, material: LensLevelMaterial, mask: Uint8Array, targetScale: number): ChannelPairs[] {
  const covered: number[] = [];
  for (let p = 0; p < mask.length; p++) if (mask[p]) covered.push(p);
  const sky = [0, 1, 2].map(c => {
    const values = covered.map(p => grid.source[p * 3 + c]!).sort((a, b) => a - b);
    return values.length ? values[Math.min(values.length - 1, Math.floor(values.length * .05))]! : 0;
  });
  const pairs = [0, 1, 2].map(() => ({ input: [], current: [], target: [], level: [] } as ChannelPairs));
  for (const p of covered) {
    const level = grid.projection[p]!, raw = [0, 1, 2].map(c => grid.source[p * 3 + c]!), peak = Math.max(...raw);
    for (let c = 0; c < 3; c++) {
      const input = untonedRender(level, raw[c]!, peak, material.channelGain?.[c]), pair = pairs[c]!;
      pair.input.push(input); pair.current.push(lensToneRender(material.toneCurve, c, level, input));
      pair.target.push(targetScale * Math.max(0, raw[c]! - sky[c]!)); pair.level.push(level);
    }
  }
  return pairs;
}

/** Monotone map current render → median target, from paired pixels, as a piecewise-linear function. */
export function fitCorrection(pair: ChannelPairs): (value: number) => number {
  const bins = Array.from({ length: 256 / BIN }, () => ({ current: [] as number[], target: [] as number[] }));
  pair.current.forEach((value, i) => {
    const bin = bins[Math.min(bins.length - 1, Math.floor(value / BIN))]!;
    bin.current.push(value); bin.target.push(pair.target[i]!);
  });
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]!;
  const used = bins.filter(bin => bin.current.length >= MINIMUM);
  if (!used.length) return value => value;
  const xs = used.map(bin => median(bin.current)), ys = monotone(used.map(bin => median(bin.target)), used.map(bin => bin.current.length));
  return value => {
    if (value <= xs[0]!) return xs[0]! > 0 ? value * ys[0]! / xs[0]! : ys[0]!;
    for (let i = 1; i < xs.length; i++) if (value <= xs[i]!) {
      const t = xs[i]! > xs[i - 1]! ? (value - xs[i - 1]!) / (xs[i]! - xs[i - 1]!) : 1;
      return ys[i - 1]! + (ys[i]! - ys[i - 1]!) * t;
    }
    return value * ys[ys.length - 1]! / xs[xs.length - 1]!;
  };
}

/**
 * LUT_{k+1} = C ∘ LUT_k at every knot, bounded to TONE_GAIN_LIMITS, smoothed [1,2,1] and forced monotone.
 * Returns the knots whose gain hit a limit per channel.
 */
export function composeToneCurve(current: LensToneCurve, corrections: readonly ((value: number) => number)[]) {
  const pinned: number[][] = [[], [], []];
  const channels = [0, 1, 2].map(c => {
    const raw = current.knots.map((knot, k) => {
      if (k === 0) return 0;
      const wanted = corrections[c]!(lensToneValue(current, c, knot)), low = knot * TONE_GAIN_LIMITS[0], high = knot * TONE_GAIN_LIMITS[1];
      if (wanted < low || wanted > high) pinned[c]!.push(knot);
      return Math.min(high, Math.max(low, wanted));
    });
    const smooth = raw.map((value, k) => k === 0 || k === raw.length - 1 ? value : (raw[k - 1]! + 2 * value + raw[k + 1]!) / 4);
    const values = [0];
    for (let k = 1; k < smooth.length; k++) values.push(Math.min(1020, Math.max(values[k - 1]!, smooth[k]!)));
    return values.map(value => Math.round(value * 1000) / 1000);
  }) as [number[], number[], number[]];
  return { curve: { schema: 'cssearth-lens-tone-curve@1' as const, knots: current.knots.slice(), channels }, pinned };
}

/** Share of target light the shared opacity cannot carry: a render level never exceeds its projection byte. */
export function ceilingShare(pairs: readonly ChannelPairs[]): number {
  let lost = 0, total = 0;
  for (const pair of pairs) pair.target.forEach((target, i) => { total += target; lost += Math.max(0, target - pair.level[i]!); });
  return total > 0 ? lost / total : 0;
}

/** Share of pixels whose curve input lies on a segment next to a pinned knot. */
export function pinnedShare(pairs: readonly ChannelPairs[], curve: LensToneCurve, pinned: readonly number[][]): number {
  let hit = 0, total = 0;
  pairs.forEach((pair, c) => {
    const knots = new Set(pinned[c]);
    for (const input of pair.input) {
      total++;
      let k = 1;
      while (k < curve.knots.length - 1 && curve.knots[k]! < input) k++;
      if (knots.has(curve.knots[k - 1]!) || knots.has(curve.knots[k]!)) hit++;
    }
  });
  return total ? hit / total : 0;
}


/**
 * Stated before running. Measured on the footprint against the loss-compensated target. The highlight terms
 * cover the whole range of the nebula: p99 and the core mean carry the bright bar, p99.9 (a few dozen pixels)
 * gets a wider band. Every term is divided by its tolerance, so a score at or below 1 is inside.
 */
export const TOLERANCE = { fluxPercent: 3, ratio: .05, highlightRatio: .05, peakRatio: .08, coreRatio: .05, signedMeanDelta: 2, hueDegrees: 3 } as const;
/** Core disc radius in projection-grid pixels, about the source's own light centroid. */
export const CORE_RADIUS = 24;

export interface CoreDisc { x: number; y: number; radius: number }
/** The core disc: centred on the sky-removed source's peak-channel light centroid over the whole footprint. */
export function coreDisc(grid: LensLevelGrid, radius = CORE_RADIUS): CoreDisc {
  const { covered, source } = lensLevelPairs(grid);
  let x = 0, y = 0, sum = 0;
  covered.forEach((p, k) => {
    const light = Math.max(source[k * 3]!, source[k * 3 + 1]!, source[k * 3 + 2]!);
    x += (p % grid.width) * light; y += Math.floor(p / grid.width) * light; sum += light;
  });
  if (!(sum > 0)) throw new TypeError('The footprint carries no source light to centre the core on.');
  return { x: x / sum, y: y / sum, radius };
}

const quantileOf = (sorted: Float64Array, fraction: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]! : 0;
export interface ToneChannelScore { p50: number; p90: number; p99: number; p999: number; core: number; delta: number }
export interface ToneScore { flux: number; hue: number; channels: ToneChannelScore[]; score: number; worst: string; inside: boolean }

/**
 * The fit objective over one mask: flux, per-channel p50/p90/p99/p99.9 ratios (render quantile over target
 * quantile, as the levels measurement forms them), the core-disc mean ratio, the signed mean delta and the
 * chroma angle. Target = sky-removed source × `targetScale` (the delivery-loss compensation). Score = the
 * largest term over its tolerance; `worst` names it; inside means every term is within tolerance.
 */
export function toneScore(grid: LensLevelGrid, material: LensLevelMaterial, mask: Uint8Array, targetScale: number, core: CoreDisc): ToneScore {
  const masked = { ...grid, mask }, { covered, source, render } = lensLevelPairs(masked, material), n = covered.length;
  const hue = lensLevelStatistics(masked, material).hueErrorDegrees;
  let fluxTarget = 0, fluxRender = 0;
  for (let k = 0; k < n; k++) {
    fluxTarget += targetScale * Math.max(source[k * 3]!, source[k * 3 + 1]!, source[k * 3 + 2]!);
    fluxRender += Math.max(render[k * 3]!, render[k * 3 + 1]!, render[k * 3 + 2]!);
  }
  const inCore = covered.map(p => (p % grid.width - core.x) ** 2 + (Math.floor(p / grid.width) - core.y) ** 2 < core.radius ** 2);
  const ratio = (a: number, b: number) => b > 0 ? a / b : 0;
  const channels = [0, 1, 2].map((c): ToneChannelScore => {
    const t = new Float64Array(n), r = new Float64Array(n);
    let delta = 0, coreT = 0, coreR = 0;
    for (let k = 0; k < n; k++) {
      t[k] = targetScale * source[k * 3 + c]!; r[k] = render[k * 3 + c]!; delta += r[k]! - t[k]!;
      if (inCore[k]) { coreT += t[k]!; coreR += r[k]!; }
    }
    t.sort(); r.sort();
    const q = (f: number) => +ratio(quantileOf(r, f), quantileOf(t, f)).toFixed(3);
    return { p50: q(.5), p90: q(.9), p99: q(.99), p999: q(.999), core: +ratio(coreR, coreT).toFixed(3), delta: +(delta / Math.max(1, n)).toFixed(2) };
  });
  const flux = fluxTarget > 0 ? (fluxRender / fluxTarget - 1) * 100 : 0;
  const terms: [string, number][] = [['flux', Math.abs(flux) / TOLERANCE.fluxPercent]];
  channels.forEach((ch, c) => terms.push(
    [`${'RGB'[c]} p50`, Math.abs(ch.p50 - 1) / TOLERANCE.ratio], [`${'RGB'[c]} p90`, Math.abs(ch.p90 - 1) / TOLERANCE.ratio],
    [`${'RGB'[c]} p99`, Math.abs(ch.p99 - 1) / TOLERANCE.highlightRatio], [`${'RGB'[c]} p99.9`, Math.abs(ch.p999 - 1) / TOLERANCE.peakRatio],
    [`${'RGB'[c]} core`, Math.abs(ch.core - 1) / TOLERANCE.coreRatio]));
  terms.push(['hue', hue / TOLERANCE.hueDegrees], ...channels.map((ch, c): [string, number] => [`${'RGB'[c]} delta`, Math.abs(ch.delta) / TOLERANCE.signedMeanDelta]));
  const [worst, score] = terms.reduce((a, b) => (b[1] > a[1] ? b : a));
  const inside = score <= 1;
  return { flux: +flux.toFixed(2), hue: +hue.toFixed(2), channels, score: +score.toFixed(4), worst, inside };
}

/**
 * Re-expose a front-projection byte grid analytically. The projection is 255·(1 − e^(−E·I)) of the
 * exposure-free emission integral I, so at E' = k·E: 1 − P'/255 = (1 − P/255)^k. Rounded like the bake's raster.
 */
export function reexposeProjection(projection: Uint8Array, ratio: number): Uint8Array {
  if (!(ratio > 0) || !Number.isFinite(ratio)) throw new TypeError('Exposure ratio must be positive.');
  return projection.map(level => Math.round(255 * (1 - Math.pow(1 - Math.min(255, level) / 255, ratio))));
}

/** The analytic fixed point of the curve fit on one grid: identity, then fit steps until nothing moves (no bakes). */
export function predictToneCurve(grid: LensLevelGrid, channelGain: LensLevelMaterial['channelGain'], fitMask: Uint8Array, targetScale: number, rounds = 6, start: LensToneCurve = identityToneCurve()) {
  let curve = start, pinned: number[][] = [[], [], []], ceiling = 0;
  for (let round = 0; round < rounds; round++) {
    const pairs = pairedPixels(grid, { channelGain, toneCurve: curve }, fitMask, targetScale);
    ceiling = ceilingShare(pairs);
    const next = composeToneCurve(curve, pairs.map(fitCorrection));
    const moved = Math.max(...next.curve.channels.flatMap((ch, c) => ch.map((v, k) => Math.abs(v - curve.channels[c]![k]!))));
    curve = next.curve; pinned = next.pinned;
    if (moved < .5) break;
  }
  const pins = pinnedShare(pairedPixels(grid, { channelGain, toneCurve: curve }, fitMask, targetScale), curve, pinned);
  return { curve, pinned, ceilingShare: ceiling, pinnedShare: pins };
}

/**
 * Closed-form lower bound on the exposure ratio the highlights need: per highlight pixel (source peak at or
 * above its p99), the ratio k at which its projection byte first reaches the target less the highlight
 * tolerance, from (1 − L/255) = (1 − P/255)^k. The median over those pixels. Below it the core rides the
 * opacity ceiling whatever the curve does.
 */
export function highlightExposureBound(grid: LensLevelGrid, targetScale: number): number {
  const { covered, source } = lensLevelPairs(grid);
  const peaks = covered.map((_, k) => Math.max(source[k * 3]!, source[k * 3 + 1]!, source[k * 3 + 2]!));
  const cut = [...peaks].sort((a, b) => a - b)[Math.floor(peaks.length * .99)] ?? Infinity;
  const needed: number[] = [];
  covered.forEach((p, k) => {
    const level = grid.projection[p]!;
    if (peaks[k]! < cut || level <= 0 || level >= 255) return;
    const wanted = Math.min(254, targetScale * peaks[k]! * (1 - TOLERANCE.highlightRatio));
    needed.push(Math.log(1 - wanted / 255) / Math.log(1 - level / 255));
  });
  needed.sort((a, b) => a - b);
  return needed.length ? needed[needed.length >> 1]! : 1;
}

/**
 * Exposure jointly with the curve, on the exposure-free integral: every candidate ratio k re-exposes the
 * projection analytically and re-fits the curve to its fixed point, so the only free variable is k. The
 * predicted score (full footprint, curve fitted on the fit half) is minimised by golden section over
 * [lower, upper] — a one-dimensional solve of an analytic prediction; nothing is baked.
 */
export function solveExposure(grid: LensLevelGrid, channelGain: LensLevelMaterial['channelGain'], halves: { fit: Uint8Array; heldOut: Uint8Array },
  targetScale: number, core: CoreDisc, lower: number, upper: number, iterations = 24) {
  const evaluate = (k: number) => {
    const exposed = { ...grid, projection: reexposeProjection(grid.projection, k) };
    const fit = predictToneCurve(exposed, channelGain, halves.fit, targetScale, 6, identityToneCurve(8)), material = { channelGain, toneCurve: fit.curve };
    return { k, ...fit, full: toneScore(exposed, material, grid.mask, targetScale, core), heldOut: toneScore(exposed, material, halves.heldOut, targetScale, core) };
  };
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lower, b = upper, c = b - phi * (b - a), d = a + phi * (b - a), fc = evaluate(c), fd = evaluate(d);
  for (let i = 0; i < iterations && b - a > 1e-3; i++) {
    if (fc.full.score <= fd.full.score) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = evaluate(c); }
    else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = evaluate(d); }
  }
  return fc.full.score <= fd.full.score ? fc : fd;
}
