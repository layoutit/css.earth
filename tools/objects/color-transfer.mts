import { requireArray, requireFiniteNumber } from '../source-values.mts';

/** IEC 61966-2-1 as published by the ICC. This is a display encoding, not an
 * instrument calibration or a transformation from spectral bands to human vision. */
export const SRGB_REFERENCE = 'https://registry.color.org/rgb-registry/files/sRGB.pdf';

export interface BandColorDisplay {
  readonly kind: 'band-composite';
  readonly inputQuantity: 'radiance-factor' | 'derived-band-value';
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
