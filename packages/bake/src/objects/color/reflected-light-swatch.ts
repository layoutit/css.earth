// A body's world swatch (src/objects/<id>/swatch.json) from a reflectance spectrum, by the method the Solar System swatches
// record: reflectance times the light the body is seen in, through the CIE 1931 2° observer; Bradford adaptation from that
// light's white to the sRGB D65 white; brightest linear channel 1. A swatch keeps hue only: it says nothing about how bright
// one body is beside another, and no map or variation is implied.
import { linearToSrgb } from './color-transfer.ts';

type Triple = readonly [number, number, number];
type Matrix = readonly [Triple, Triple, Triple];

// IEC 61966-2-1 XYZ (D65) -> linear sRGB.
const XYZ_TO_LINEAR_SRGB: Matrix = [[3.2404542, -1.5371385, -0.4985314], [-0.969266, 1.8760108, 0.041556], [0.0556434, -0.2040259, 1.0572252]];
// The Bradford cone response matrix (Lam 1985), as ICC.1 Annex E and http://www.brucelindbloom.com/Eqn_ChromAdapt.html print it.
const BRADFORD: Matrix = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
/** The sRGB white, D65 at x = 0.3127, y = 0.3290 (IEC 61966-2-1). */
export const SRGB_WHITE_XY = [0.3127, 0.329] as const;

const apply = (matrix: Matrix, [x, y, z]: Triple): Triple => matrix.map(row => row[0] * x + row[1] * y + row[2] * z) as unknown as Triple;
function inverse([[a, b, c], [d, e, f], [g, h, i]]: Matrix): Matrix {
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [[(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
    [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
    [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant]];
}
const BRADFORD_INVERSE = inverse(BRADFORD);
const whiteOf = ([x, y]: readonly [number, number]): Triple => [x / y, 1, (1 - x - y) / y];

/** XYZ seen under a white at chromaticity `fromXy`, as the same surface appears under the sRGB D65 white (Bradford). */
export function adaptToSrgbWhite(xyz: Triple, fromXy: readonly [number, number]): Triple {
  const source = apply(BRADFORD, whiteOf(fromXy)), target = apply(BRADFORD, whiteOf(SRGB_WHITE_XY)), cone = apply(BRADFORD, xyz);
  return apply(BRADFORD_INVERSE, [cone[0] * target[0] / source[0], cone[1] * target[1] / source[1], cone[2] * target[2] / source[2]]);
}

export interface ReflectedLightSwatch {
  readonly hex: string;
  readonly rgb: Triple;
  /** The light's own chromaticity, the white the surface is adapted from. */
  readonly lightWhiteXy: readonly [number, number];
  /** XYZ of the reflected light with the light's own Y at 1, before adaptation: its Y is the luminous reflectance. */
  readonly xyzLightWhiteY1: Triple;
  /** Linear sRGB after adaptation to D65, before the brightness normalization. */
  readonly linearSrgbD65: Triple;
}

/** The swatch of a surface with this reflectance in this light. Both are read at every wavelength of `wavelengthsNm`, which the
 * color-matching table must cover; the light may be zero at a wavelength but not everywhere, and the reflectance is never negative. */
export function reflectedLightSwatch(wavelengthsNm: readonly number[], reflectance: (wavelengthNm: number) => number, light: (wavelengthNm: number) => number,
  colorMatching: Map<number, readonly number[]>): ReflectedLightSwatch {
  const reflected = [0, 0, 0], white = [0, 0, 0];
  for (const wavelength of wavelengthsNm) {
    const observer = colorMatching.get(wavelength), power = light(wavelength), fraction = reflectance(wavelength);
    if (!observer) throw new TypeError(`The CIE table must cover ${wavelength} nm.`);
    if (!(power >= 0) || !(fraction >= 0)) throw new TypeError(`The light and the reflectance must be zero or more at ${wavelength} nm.`);
    for (let channel = 0; channel < 3; channel++) { white[channel]! += power * observer[channel]!; reflected[channel]! += fraction * power * observer[channel]!; }
  }
  if (!(white[1]! > 0)) throw new TypeError('The light has no visible power.');
  const sum = white[0]! + white[1]! + white[2]!, lightWhiteXy = [white[0]! / sum, white[1]! / sum] as const;
  const xyzLightWhiteY1 = reflected.map(value => value / white[1]!) as unknown as Triple;
  const linearSrgbD65 = apply(XYZ_TO_LINEAR_SRGB, adaptToSrgbWhite(xyzLightWhiteY1, lightWhiteXy));
  const peak = Math.max(...linearSrgbD65);
  if (linearSrgbD65.some(value => value < 0) || !(peak > 0)) throw new TypeError(`The reflected color falls outside the sRGB gamut: ${linearSrgbD65.join(', ')}.`);
  const rgb = linearSrgbD65.map(value => Math.round(255 * linearToSrgb(value / peak))) as unknown as Triple;
  return { hex: `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`, rgb, lightWhiteXy, xyzLightWhiteY1, linearSrgbD65 };
}
