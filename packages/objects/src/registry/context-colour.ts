/** The colour an object's world-context marker, orbit and label take.
 *
 * A provenance-bearing swatch (src/objects/<id>/swatch.json) wins. Otherwise the object's catalogue colour is used, the one its
 * distant point already shows, unless it is achromatic: red, green and blue equal is the shared neutral gray of a body with no
 * measured colour, a display convention, so the context keeps its own default instead.
 *
 * The label is text on the black sky, drawn at the object's label opacity (contextAnnotationOpacity), so the colour as it reaches
 * the screen, each encoded channel times that opacity over black, must meet the WCAG 2.2 contrast minimum for text, 4.5:1 (success
 * criterion 1.4.3, https://www.w3.org/TR/WCAG22/#contrast-minimum). A colour that meets it is used as it is. The minimum, not the
 * gray default's higher contrast, is the target: lightening further washes distinct hues toward the same pastel. One that does not keeps its hue
 * and has only its Oklab lightness raised (Ottosson 2020, https://bottosson.github.io/posts/oklab/) to the first value that meets
 * it; a lighter colour outside sRGB has its chroma reduced, as CSS Color 4 gamut mapping does
 * (https://www.w3.org/TR/css-color-4/#gamut-mapping). The measured colour itself stays in the catalogue and on the body. */
export const SKY_BACKGROUND = '#000000';
export const TEXT_CONTRAST_MINIMUM = 4.5;
/** The world context's own marker, orbit and label colour for a body with no colour of its own. */
export const DEFAULT_CONTEXT_COLOUR = '#dfdfdf';

type Rgb = readonly [number, number, number];
const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;
const toLinear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toEncoded = (value: number) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const linearOf = (hex: string): Rgb => [toLinear(channel(hex, 1)), toLinear(channel(hex, 3)), toLinear(channel(hex, 5))];

/** WCAG 2.2 relative luminance of an sRGB colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = linearOf(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2.2 contrast ratio of two sRGB colours. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Oklab <-> linear sRGB, Ottosson (2020).
function toOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
const inGamut = (rgb: Rgb) => rgb.every(value => value >= -1e-6 && value <= 1 + 1e-6);
const hexOf = (rgb: Rgb) => `#${rgb.map(value => Math.round(toEncoded(Math.min(1, Math.max(0, value))) * 255).toString(16).padStart(2, '0')).join('')}`;

/** The colour at Oklab lightness L with the hue of (a, b), its chroma reduced only as far as sRGB requires. */
function atLightness(L: number, a: number, b: number): string {
  if (inGamut(fromOklab([L, a, b]))) return hexOf(fromOklab([L, a, b]));
  let low = 0, high = 1;
  for (let step = 0; step < 40; step++) { const mid = (low + high) / 2; if (inGamut(fromOklab([L, a * mid, b * mid]))) low = mid; else high = mid; }
  return hexOf(fromOklab([L, a * low, b * low]));
}

/** The colour as it reaches the screen at an opacity over the black sky: each sRGB-encoded channel times the opacity. */
export function composited(hex: string, opacity: number): string {
  return `#${[1, 3, 5].map(offset => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * opacity).toString(16).padStart(2, '0')).join('')}`;
}
const readable = (hex: string, opacity: number) => contrastRatio(composited(hex, opacity), SKY_BACKGROUND) >= TEXT_CONTRAST_MINIMUM;

/** The same hue, lightened only as far as the text contrast minimum against the sky requires at this label opacity. */
export function readableOnSky(hex: string, opacity: number): string {
  if (!(opacity > 0 && opacity <= 1)) throw new TypeError(`A label opacity is in (0, 1], not ${opacity}.`);
  if (readable(hex, opacity)) return hex.toLowerCase();
  if (!readable('#ffffff', opacity)) throw new TypeError(`No colour meets ${TEXT_CONTRAST_MINIMUM}:1 on the sky at label opacity ${opacity}.`);
  const [L, a, b] = toOklab(linearOf(hex));
  let low = L, high = 1;
  for (let step = 0; step < 40; step++) {
    const mid = (low + high) / 2;
    if (readable(atLightness(mid, a, b), opacity)) high = mid; else low = mid;
  }
  return atLightness(high, a, b);
}

export function contextColour(swatchHex: string | undefined, catalogueHex: string | undefined, labelOpacity: number): string | undefined {
  const hex = swatchHex ?? catalogueHex;
  if (hex === undefined) return undefined;
  if (!/^#[0-9a-f]{6}$/iu.test(hex)) throw new TypeError(`A context colour must be #rrggbb, not ${hex}.`);
  if (swatchHex === undefined) {
    const [red, green, blue] = [1, 3, 5].map(offset => hex.slice(offset, offset + 2).toLowerCase());
    if (red === green && green === blue) return undefined;
  }
  return readableOnSky(hex, labelOpacity);
}
