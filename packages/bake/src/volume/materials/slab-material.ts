type Vector3 = [number, number, number];

type Sample = (x: number, y: number, z: number, out: Vector3) => void;
type MaterialSample = (x: number, y: number, z: number, out: Vector3) => boolean;
export interface SlabMaterialSampling {
  axis: 'x' | 'y' | 'z'; pitch: number; samples: number;
  /** Reference-grid sample positions relative to the quad plane, in the caller's physical units. */
  sampleOffsets?: readonly number[];
  /** Reference quadrature step; required with sampleOffsets. */
  sampleSpacing?: number;
}
function validateOffsets(slab: SlabMaterialSampling) {
  if (slab.sampleOffsets === undefined && slab.sampleSpacing === undefined) return;
  if (!slab.sampleOffsets || slab.sampleOffsets.length !== slab.samples || slab.samples < 1 || slab.samples > 4096 ||
      !Number.isFinite(slab.sampleSpacing) || !(slab.sampleSpacing! > 0))
    throw new TypeError('Explicit slab samples require matching offsets and a finite positive quadrature step.');
}
const sampleOffset = (slab: SlabMaterialSampling, i: number) => {
  if (!slab.sampleOffsets) return slab.pitch * ((i + .5) / slab.samples - .5);
  const offset = slab.sampleOffsets[i]!;
  if (!Number.isFinite(offset)) throw new TypeError('Slab sample offsets must be finite.');
  return offset;
};
/** Color follows the same emitting sub-samples as neutral alpha, not an empty slab midpoint. */
export function compilerSlabMaterial(sampleEmission: Sample, sampleMaterial: MaterialSample) {
  const emission: Vector3 = [0, 0, 0], color: Vector3 = [0, 0, 0];
  return (x: number, y: number, z: number, out: Vector3, slab: SlabMaterialSampling): boolean => {
    validateOffsets(slab);
    let weight = 0, covered = 0;
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < slab.samples; i++) {
      const offset = sampleOffset(slab, i);
      const sx = x + (slab.axis === 'x' ? offset : 0), sy = y + (slab.axis === 'y' ? offset : 0), sz = z + (slab.axis === 'z' ? offset : 0);
      sampleEmission(sx, sy, sz, emission); const light = emission[0];
      if (!(light > 0)) continue;
      weight += light;
      const observed = sampleMaterial(sx, sy, sz, color);
      if (observed && color.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255))
        throw new TypeError('Compiler 3D material must return finite RGB chromaticity in 0..255.');
      if (observed) covered += light;
      // Missing/black source material retains the same neutral contribution as other lab lenses.
      // Component colors are already normalized. Renormalizing their local mixture would alter them.
      for (let c = 0; c < 3; c++) out[c] += light * (observed ? color[c]! / 255 : 1);
    }
    if (!(weight > 0) || !(covered > 0)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, 255 * out[c]! / weight));
    return true;
  };
}

type SlabMaterial = ReturnType<typeof compilerSlabMaterial>;
/**
 * Fade chromaticity toward neutral where the delivered texel alpha is too small to carry it.
 * Browsers composite premultiplied 8-bit colour: at alpha 1–3 each channel rounds to a few levels,
 * and stacked slabs turn that rounding into strong false tints. Alpha is computed exactly as the
 * emission bake does (1 − exp(−exposure · ∫emission)); colour reaches full strength at `fullChromaAlphaByte`.
 */
export function alphaLimitedSlabMaterial(material: SlabMaterial, sampleEmission: Sample, exposureGain: number, fullChromaAlphaByte: number): SlabMaterial {
  if (!(exposureGain > 0) || !Number.isFinite(exposureGain) || !(fullChromaAlphaByte >= 1) || fullChromaAlphaByte > 255)
    throw new TypeError('Alpha-limited material requires positive exposure and a full-chroma alpha byte in 1..255.');
  const emission: Vector3 = [0, 0, 0];
  return (x, y, z, out, slab) => {
    validateOffsets(slab);
    if (!material(x, y, z, out, slab)) return false;
    let integrated = 0;
    for (let i = 0; i < slab.samples; i++) {
      const offset = sampleOffset(slab, i);
      sampleEmission(x + (slab.axis === 'x' ? offset : 0), y + (slab.axis === 'y' ? offset : 0), z + (slab.axis === 'z' ? offset : 0), emission);
      integrated += slab.sampleSpacing === undefined ? Math.max(0, emission[0]) * slab.pitch / slab.samples
        : Math.max(0, emission[0]) * slab.sampleSpacing;
    }
    const trust = Math.min(1, 255 * -Math.expm1(-exposureGain * integrated) / fullChromaAlphaByte);
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, 255 - (255 - out[c]!) * trust));
    return true;
  };
}

/** One lens's per-channel material gain: the common factor is its exposure, the ratios its white balance. */
export type ChannelGain = readonly [number, number, number];

export function validateChannelGain(value: unknown): ChannelGain {
  if (!Array.isArray(value) || value.length !== 3 ||
    value.some(channel => typeof channel !== 'number' || !Number.isFinite(channel) || channel <= 0 || channel > 4))
    throw new TypeError('A lens channel gain must be three finite multipliers in (0,4].');
  return [value[0] as number, value[1] as number, value[2] as number];
}

/**
 * Split one lens gain into the two parts that must straddle the alpha chroma limit.
 *
 * The limit fades chromaticity to neutral 255 where the delivered alpha is too small to carry colour,
 * because browsers composite premultiplied 8-bit. A gain applied wholly after it multiplies that neutral
 * 255 by three different numbers and so paints a constant false tint over exactly the texels the limit
 * had just protected — measured at 0.09 and 0.21 mean saturation in the alpha 1..3 band on two LMC lenses.
 * A gain applied wholly before it is undone by the fade, which pulls every channel back toward 255.
 *
 * So the white balance (the ratios, at most 1 so nothing clips) belongs BEFORE the limit, where the fade
 * then neutralizes the corrected colour, and the exposure (the common factor) belongs AFTER it, where it
 * scales a neutral texel without tinting it. At full trust the two orders agree exactly; at zero trust only
 * this one stays neutral.
 */
export function splitChannelGain(gain: ChannelGain): { whiteBalance: ChannelGain; exposure: number } {
  validateChannelGain(gain as unknown);
  const exposure = Math.max(...gain);
  return { whiteBalance: [gain[0]! / exposure, gain[1]! / exposure, gain[2]! / exposure], exposure };
}

/**
 * Scale one lens's chromaticity per channel.
 *
 * The material a lens paints is peak-normalized, so every lens of a shared finite geometry is displayed at
 * the one exposure that geometry's alpha carries, wearing only its own hue. This gain is the per-lens
 * correction that the shared alpha cannot express: the common factor is the lens's own exposure against
 * its own source image, and the ratios between the three are its white balance. A channel that reaches 255
 * is already at the alpha's own level and simply clips.
 *
 * Use `splitChannelGain` and `lensChannelGainMaterial` rather than calling this once around the finished
 * material: where it is applied relative to the alpha chroma limit decides whether the faint zone stays
 * neutral. This is a relative display correction against each source image, not photometry.
 */
export function channelGainSlabMaterial(material: SlabMaterial, gain: ChannelGain): SlabMaterial {
  validateChannelGain(gain as unknown);
  return (x, y, z, out, slab) => {
    if (!material(x, y, z, out, slab)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, out[c]! * gain[c]!));
    return true;
  };
}

/**
 * One lens's finished slab material: its chromaticity, optionally alpha-limited, optionally corrected by
 * its own channel gain with the white balance inside the limit and the exposure outside it.
 *
 * `fullChromaAlphaByte` undefined means the accepted models that predate the limit; `gain` null means a
 * lens displayed at the shared model exposure with its own hue only. With both absent this is exactly
 * `compilerSlabMaterial`, so an uncorrected lens keeps its accepted bytes.
 *
 * `tone` (a fitted `LensToneCurve`) splits the same way: its per-texel channel ratios are white balance and
 * go inside the limit, its common factor (which absorbs the gain's exposure) goes after it, so the faint
 * zone stays neutral. Absent, the composition is exactly the one without it.
 */
export function lensChannelGainMaterial(base: SlabMaterial, sampleEmission: Sample,
  exposureGain: number, fullChromaAlphaByte: number | undefined, gain: ChannelGain | null, tone?: LensTone | null): SlabMaterial {
  const split = gain ? splitChannelGain(gain) : null;
  const balanced = split ? channelGainSlabMaterial(base, split.whiteBalance) : base;
  if (!tone) {
    const limited = fullChromaAlphaByte === undefined ? balanced
      : alphaLimitedSlabMaterial(balanced, sampleEmission, exposureGain, fullChromaAlphaByte);
    return split ? channelGainSlabMaterial(limited, [split.exposure, split.exposure, split.exposure]) : limited;
  }
  validateLensToneCurve(tone.curve as unknown);
  const exposure = split ? split.exposure : 1, gains: Vector3 = [1, 1, 1];
  // The alpha limit calls `toned` synchronously for the same texel, so `common` always belongs to it.
  let common = 1;
  const toned: SlabMaterial = (x, y, z, out, slab) => {
    if (!balanced(x, y, z, out, slab)) return false;
    common = lensToneGains(tone.curve, tone.levelAt(x, y, z), out, exposure, gains);
    // The curve's channel ratios are a white balance, so they go inside the limit (never above 1: no clip).
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, out[c]! * gains[c]! / common));
    return true;
  };
  const limited = fullChromaAlphaByte === undefined ? toned
    : alphaLimitedSlabMaterial(toned, sampleEmission, exposureGain, fullChromaAlphaByte);
  return (x, y, z, out, slab) => {
    if (!limited(x, y, z, out, slab)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, out[c]! * common));
    return true;
  };
}

/**
 * One lens's fitted tone curve: per channel, a monotone piecewise-linear map from the analytic render level
 * that channel would have without it (front-projection byte × material chromaticity / 255, after any channel
 * gain) to the render level wanted. It is fitted from paired pixels against the lens's own image
 * (`lens-tone-fit`) and applied at bake time only. The material cannot exceed its alpha, so where the curve
 * asks for more light than the shared opacity carries the channel clips at 255: that loss is reported by the
 * fit, never hidden.
 */
export interface LensToneCurve {
  schema: 'cssearth-lens-tone-curve@1';
  /** Strictly increasing input render levels from 0 to 255. */
  knots: readonly number[];
  /** Per channel R, G, B: output render level at each knot; starts at 0 and never decreases. */
  channels: readonly [readonly number[], readonly number[], readonly number[]];
}
export interface LensTone { curve: LensToneCurve; levelAt: (x: number, y: number, z: number) => number }

export function validateLensToneCurve(value: unknown): LensToneCurve {
  const v = value as LensToneCurve | null;
  if (!v || typeof v !== 'object' || v.schema !== 'cssearth-lens-tone-curve@1' || !Array.isArray(v.knots) ||
    v.knots.length < 2 || v.knots.length > 257 || v.knots[0] !== 0 || v.knots[v.knots.length - 1] !== 255 ||
    v.knots.some((k, i) => typeof k !== 'number' || !Number.isFinite(k) || (i > 0 && !(k > v.knots[i - 1]!))) ||
    !Array.isArray(v.channels) || v.channels.length !== 3 ||
    v.channels.some(values => !Array.isArray(values) || values.length !== v.knots.length || values[0] !== 0 ||
      values.some((y, i) => typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > 1020 || (i > 0 && y < values[i - 1]!))))
    throw new TypeError('A lens tone curve must be monotone per-channel knots from 0 to 255 starting at 0.');
  return v;
}

/** The curve's value for one channel at one analytic render level. */
export function lensToneValue(curve: LensToneCurve, channel: number, level: number): number {
  const knots = curve.knots, values = curve.channels[channel]!;
  const r = Math.min(255, Math.max(0, level));
  let i = 1;
  while (i < knots.length - 1 && knots[i]! < r) i++;
  const t = (r - knots[i - 1]!) / (knots[i]! - knots[i - 1]!);
  return values[i - 1]! + (values[i]! - values[i - 1]!) * t;
}

/**
 * Per-channel multipliers that move a texel of chromaticity `rgb` under projection byte `level` onto the
 * curve, folding in the channel-gain exposure; returns their common (largest) factor. The render such a
 * texel reaches is min(level, curve(level · min(255, rgb · exposure) / 255)) — `lensToneRender`.
 */
export function lensToneGains(curve: LensToneCurve, level: number, rgb: Vector3, exposure: number, out: Vector3): number {
  let common = 0;
  for (let c = 0; c < 3; c++) {
    const chroma = Math.min(255, rgb[c]! * exposure), render = level * chroma / 255;
    out[c] = level > 0 && rgb[c]! > 0 && render > 1e-9 ? 255 * lensToneValue(curve, c, render) / (level * rgb[c]!) : exposure;
    common = Math.max(common, out[c]!);
  }
  return common > 0 ? common : 1;
}

/** Analytic render level of one channel under the curve: the level the bake paints where alpha carries colour. */
export function lensToneRender(curve: LensToneCurve | null, channel: number, level: number, render: number): number {
  return curve ? Math.min(level, lensToneValue(curve, channel, render)) : render;
}
