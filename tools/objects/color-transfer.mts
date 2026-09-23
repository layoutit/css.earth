import { requireArray, requireFiniteNumber, requireRecord } from '../sources/source-values.mts';

/** IEC 61966-2-1 as published by the ICC. This is a display encoding, not an
 * instrument calibration or a transformation from spectral bands to human vision. */
export const SRGB_REFERENCE = 'https://registry.color.org/rgb-registry/files/sRGB.pdf';

export interface BandColorDisplay {
  readonly kind: 'band-composite';
  readonly inputQuantity: 'radiance-factor' | 'derived-band-value' | 'radiance' | 'flux-density';
  readonly bands: readonly string[];
  readonly displayRange: readonly [number, number];
  readonly outputEncoding: 'srgb';
}

/** Calibrated bands are not RGB primaries: a band composite is always a scientific visualization. The route names the
 * source bands, in display order, and their quantity from the product it reads, so a recipe declares only the common
 * range and has no place for channel gains, white balance or natural color. Natural-color reconstruction needs a
 * separately qualified instrument-specific method. */
export function bandColorDisplay(bands: readonly string[], inputQuantity: BandColorDisplay['inputQuantity'], displayRange: unknown): BandColorDisplay {
  const range = requireArray(displayRange).map(value => requireFiniteNumber(value));
  if (bands.length !== 3 || new Set(bands).size !== 3 || bands.some(band => !band) || range.length !== 2 || !(range[1] > range[0])) {
    throw new TypeError('The color display must bind three distinct source bands, in order, and one common finite range.');
  }
  return { kind: 'band-composite', inputQuantity, bands: [...bands], displayRange: [range[0], range[1]], outputEncoding: 'srgb' };
}

/** A normalized linear display channel -> sRGB code value. Clamp only at the
 * final display boundary, after interpolation, photometry and mosaic blending. */
/** Interpolate an authored hex palette at a fraction; endpoints clamp. */
export function interpolatePalette(colors: readonly string[], fraction: number): number[] {
  const t = Math.max(0, Math.min(1, fraction)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(t)), remainder = t - i;
  const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const a = rgb(colors[i]), b = rgb(colors[i + 1]);
  return a.map((v, c) => Math.round(v + (b[c] - v) * remainder));
}

export function linearToSrgb(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('A display channel must be finite.');
  const bounded = Math.max(0, Math.min(1, value));
  return bounded <= 0.0031308 ? 12.92 * bounded : 1.055 * bounded ** (1 / 2.4) - 0.055;
}

/** This inverse is only for known sRGB display bytes, never raw band values. */
export function srgbToLinear(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeError('An sRGB code value must be in [0, 1].');
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function bandColorByte(value: number, display: BandColorDisplay): number {
  const [low, high] = display.displayRange;
  return Math.round(255 * linearToSrgb((value - low) / (high - low)));
}

/** One final encoding. This function deliberately refuses already quantized
 * images: provider RGB and scientific palettes must preserve their source
 * display interpretation rather than receiving a second transfer. */
export function encodeBandColor(values: Float32Array | Float64Array, missing: Uint8Array, display: BandColorDisplay): Buffer {
  if (!(values instanceof Float32Array || values instanceof Float64Array) || values.length !== missing.length * 3) {
    throw new TypeError('Band color encoding requires three floating source values per pixel, not encoded RGB bytes.');
  }
  const result = Buffer.alloc(values.length);
  for (let pixel = 0; pixel < missing.length; pixel++) if (!missing[pixel]) {
    for (let channel = 0; channel < 3; channel++) result[pixel * 3 + channel] = bandColorByte(values[pixel * 3 + channel], display);
  }
  return result;
}

export function bandColorEvidence(display: BandColorDisplay) {
  return { ...display, interpretation: 'false-color', transferReference: SRGB_REFERENCE,
    processing: 'Source values remain floating point through interpolation, photometry and compositing. One common range maps the selected bands to linear display channels; IEC sRGB encoding and 8-bit quantization happen once, at output. This does not reconstruct natural color.' };
}

/** Lupton, Blanton, Fekete et al. (2004), PASP 116, 133: one asinh curve on the mean
 * of the bands, as implemented by Astropy `make_lupton_rgb`. */
export const LUPTON_ASINH_REFERENCE = 'https://doi.org/10.1086/382245';

export interface AsinhBandDisplay {
  readonly kind: 'band-asinh';
  readonly inputQuantity: 'band-normalized-surface-brightness';
  readonly bands: readonly string[];
  readonly minimum: number;
  readonly stretch: number;
  readonly softening: number;
  readonly outputEncoding: 'lupton-asinh';
}

/** Calibrated sky bands, each already divided by its own measured range, share one black level,
 * one linear stretch and one softening. The route names one band (monochrome), two distinct bands in
 * red, blue order, or three distinct bands in red, green, blue order. Two bands take green from their
 * mean, the convention of the CDS DSS2 colour survey. The display has no gains of its own; hue shows
 * where each band is bright relative to its own range, not physical band ratios. */
export const TWO_BAND_GREEN_REFERENCE = 'https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FDSS2%2Fcolor&get=record&fmt=json';
export function asinhBandDisplay(bands: readonly string[], value: unknown): AsinhBandDisplay {
  const row = requireRecord(value, 'Asinh display');
  const keys = Object.keys(row).sort().join();
  if (keys !== 'minimum,softening,stretch') throw new TypeError('An asinh display declares only minimum, stretch and softening.');
  const minimum = requireFiniteNumber(row.minimum, 'Asinh minimum'), stretch = requireFiniteNumber(row.stretch, 'Asinh stretch');
  const softening = requireFiniteNumber(row.softening, 'Asinh softening');
  if (![1, 2, 3].includes(bands.length) || new Set(bands).size !== bands.length || bands.some(band => !band) || !(stretch > 0) || !(softening > 0))
    throw new TypeError('An asinh display binds one band, two or three distinct bands with a positive stretch and softening.');
  return { kind: 'band-asinh', inputQuantity: 'band-normalized-surface-brightness', bands: [...bands], minimum, stretch, softening, outputEncoding: 'lupton-asinh' };
}

/** One floating value per band per pixel -> RGB bytes. Missing pixels stay black. */
export function encodeAsinhBands(values: Float32Array | Float64Array, missing: Uint8Array, display: AsinhBandDisplay): Buffer {
  const count = display.bands.length;
  if (!(values instanceof Float32Array || values instanceof Float64Array) || values.length !== missing.length * count)
    throw new TypeError('Asinh encoding requires one floating source value per band per pixel, not encoded RGB bytes.');
  const slope = 0.1 / Math.asinh(0.1 * display.softening), soften = display.softening / display.stretch;
  const result = Buffer.alloc(missing.length * 3), channel = [0, 0, 0];
  for (let pixel = 0; pixel < missing.length; pixel++) if (!missing[pixel]) {
    for (let c = 0; c < 3; c++) {
      // One band fills every channel; two bands are red and blue with their mean as green.
      const value = count === 3 ? values[pixel * 3 + c] : count === 1 ? values[pixel] : c === 1 ? (values[pixel * 2]! + values[pixel * 2 + 1]!) / 2 : values[pixel * 2 + c / 2];
      if (!Number.isFinite(value)) throw new TypeError('A display band value must be finite.');
      channel[c] = value! - display.minimum;
    }
    const intensity = (channel[0] + channel[1] + channel[2]) / 3;
    const ratio = intensity <= 0 ? 0 : Math.asinh(intensity * soften) * slope / intensity;
    for (let c = 0; c < 3; c++) channel[c] = Math.max(0, channel[c] * ratio);
    const maximum = Math.max(channel[0], channel[1], channel[2]);
    // Scale the brightest channel down to 1 so hue survives saturation; truncate like Astropy's uint8 cast.
    for (let c = 0; c < 3; c++) result[pixel * 3 + c] = Math.trunc((maximum > 1 ? channel[c] / maximum : channel[c]) * 255);
  }
  return result;
}

export function asinhBandEvidence(display: AsinhBandDisplay) {
  return { ...display, interpretation: display.bands.length === 1 ? 'monochrome' : 'false-color', transferReference: LUPTON_ASINH_REFERENCE,
    ...(display.bands.length === 2 ? { channels: 'Red is the first band, blue the second, green their mean (the CDS DSS2 colour survey convention).', channelReference: TWO_BAND_GREEN_REFERENCE } : {}),
    processing: 'Each band is calibrated to MJy/sr and divided by its own measured range, so hue shows where a band is bright relative to itself, not physical band ratios. One common minimum is subtracted; one asinh curve maps the mean of the bands and scales every band by the same factor. Pixels brighter than the display are scaled down as a whole, then quantized once to 8 bits. This does not reconstruct natural color.' };
}
