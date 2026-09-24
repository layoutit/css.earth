/** A gallery picture made from a FITS sky image, for observations that resolve a body but cannot be laid onto its surface.
 *
 * The recipe states a pixel window, the two brightness values shown as black and white, and a whole-number enlargement. The
 * window is shown as the sky is seen from Earth, north up and east left, in a linear grey scale. Every source pixel becomes a
 * square of equal output pixels; nothing is smoothed, sharpened, interpolated or normalised. */
import sharp from 'sharp';
import { readFitsImage } from '@cssearth/fits';
import { skyDisplayRaster, skyImageAxes } from '../../fits/fits-sky.mts';

export interface FitsGalleryImageRecipe {
  /** The window's first column and first stored row, counted from 1 as FITS viewers do, and its size in source pixels. */
  readonly window: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** The header's BUNIT, stated so a recipe cannot be applied to an image in another unit. */
  readonly unit: string;
  /** The values shown as black and white, in `unit`. */
  readonly range: readonly [number, number];
  /** Output pixels per source pixel along each axis. */
  readonly enlarge: number;
}

const MAX_OUTPUT_EDGE = 4096;

export function parseFitsGalleryImageRecipe(value: unknown): FitsGalleryImageRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('A FITS gallery recipe must be an object.');
  const recipe = value as Record<string, unknown>, window = recipe.window as Record<string, unknown> | undefined;
  if (!window || typeof window !== 'object' || Array.isArray(window)) throw new TypeError('A FITS gallery recipe states its pixel window.');
  const whole = (n: unknown, label: string) => {
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1) throw new TypeError(`FITS gallery ${label} must be a whole number from 1.`);
    return n;
  };
  const [x, y, width, height] = [whole(window.x, 'window.x'), whole(window.y, 'window.y'), whole(window.width, 'window.width'), whole(window.height, 'window.height')];
  const enlarge = whole(recipe.enlarge, 'enlarge');
  if (width * enlarge > MAX_OUTPUT_EDGE || height * enlarge > MAX_OUTPUT_EDGE) throw new RangeError('A FITS gallery picture is larger than 4096 pixels on an edge.');
  if (typeof recipe.unit !== 'string' || !recipe.unit.trim()) throw new TypeError('A FITS gallery recipe states the image unit.');
  const range = recipe.range;
  if (!Array.isArray(range) || range.length !== 2 || range.some(n => typeof n !== 'number' || !Number.isFinite(n)) || !(range[0] < range[1]))
    throw new TypeError('A FITS gallery range is two finite values, black below white.');
  return { window: { x, y, width, height }, unit: recipe.unit.trim(), range: [range[0], range[1]], enlarge };
}

/** Eight-bit grey samples of the window in display order, before enlargement. A sample outside the range is clipped. */
export function fitsGalleryGreys(bytes: Buffer, recipe: FitsGalleryImageRecipe) {
  const image = readFitsImage(bytes);
  if (image.planes !== 1) throw new Error('A FITS gallery picture needs a single image plane.');
  if (String(image.header.BUNIT ?? '').trim() !== recipe.unit) throw new Error(`FITS gallery unit changed: the image states ${String(image.header.BUNIT)}, the recipe ${recipe.unit}.`);
  const { x, y, width, height } = recipe.window;
  if (x - 1 + width > image.width || y - 1 + height > image.height) throw new RangeError('A FITS gallery window leaves the image.');
  const stored = new Float64Array(width * height);
  for (let row = 0; row < height; row++)
    stored.set(image.values.subarray((y - 1 + row) * image.width + x - 1, (y - 1 + row) * image.width + x - 1 + width), row * width);
  if (stored.some(sample => !Number.isFinite(sample))) throw new Error('A FITS gallery window holds samples without a value.');
  const display = skyDisplayRaster(stored, width, height, skyImageAxes(image.header));
  const [black, white] = recipe.range, greys = new Uint8Array(display.length);
  for (let i = 0; i < display.length; i++) greys[i] = Math.round(255 * Math.min(1, Math.max(0, (display[i]! - black) / (white - black))));
  return { greys, width, height };
}

export async function renderFitsGalleryImage(bytes: Buffer, recipe: FitsGalleryImageRecipe) {
  const { greys, width, height } = fitsGalleryGreys(bytes, recipe), scale = recipe.enlarge;
  const pixels = new Uint8Array(width * scale * height * scale);
  for (let row = 0; row < height * scale; row++) {
    const source = Math.floor(row / scale) * width;
    for (let column = 0; column < width * scale; column++) pixels[row * width * scale + column] = greys[source + Math.floor(column / scale)]!;
  }
  const webp = await sharp(pixels, { raw: { width: width * scale, height: height * scale, channels: 1 } }).webp({ lossless: true }).toBuffer();
  return { bytes: webp, width: width * scale, height: height * scale };
}
