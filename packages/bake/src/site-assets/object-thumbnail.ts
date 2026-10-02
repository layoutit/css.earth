// The thumbnail of an object row: its default dataset's image, framed by one rule for every object. The object's light is
// measured in the image, the tile is cut to that extent inside a margin, and the light fades to nothing before the
// extent's edge and before the image's own frame, so no edge of the photograph shows on the panel. Colors are the
// image's: over black the thumbnail composites to the same pixels, less the fade.
import sharp from 'sharp';
import { DECORATIVE_WEBP } from '../raster/index.ts';

/** Tile edge in device pixels: the shared 40 CSS px result slot at 2x. */
export const OBJECT_THUMBNAIL_PIXELS = 80;
/** Transparent pixels kept on every side of the object. */
export const OBJECT_THUMBNAIL_MARGIN = 4;
/** Longer side of the copy the object's light is measured on. */
const MEASURE_PIXELS = 160;
/** The object's extent, in standard deviations of its light about its centre. */
const EXTENT_SIGMAS = 2.25;
/** Where the fade starts, as a fraction of the way from a centre to its ellipse. */
const FADE_START = 0.6;
/** Level below which a pixel is empty sky and lets the panel through in proportion. */
const SKY_LEVEL = 32;

const smoothstep = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
/** Full inside `FADE_START` of an ellipse, nothing at the ellipse. */
const fade = (reach: number) => 1 - smoothstep((reach - FADE_START) / (1 - FADE_START));

/** An ellipse as its centre and the inverse of its shape matrix: `reach` is 1 on the ellipse. */
interface Extent { cx: number; cy: number; halfWidth: number; halfHeight: number; reach(x: number, y: number): number; }

/** The ellipse of an image's light above its sky, in fractions of the image's width and height: the light's centroid and
 * `EXTENT_SIGMAS` of its second moments, measured twice so that field stars outside the first ellipse do not widen the
 * second. None when the image has no light above its median, a chart on a flat ground for one. */
async function measureExtent(image: Uint8Array): Promise<Extent | undefined> {
  const { data, info } = await sharp(image).ensureAlpha().resize(MEASURE_PIXELS, MEASURE_PIXELS, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, light = new Float64Array(width * height);
  for (let at = 0; at < light.length; at++)
    light[at] = Math.max(data[at * 4]!, data[at * 4 + 1]!, data[at * 4 + 2]!) * data[at * 4 + 3]! / 255;
  const sky = Float64Array.from(light).sort()[light.length >> 1]!;
  let extent: Extent | undefined;
  for (let pass = 0; pass < 2; pass++) {
    let sum = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const weight = Math.max(0, light[y * width + x]! - sky), px = (x + 0.5) / width, py = (y + 0.5) / height;
      if (weight === 0 || (extent && extent.reach(px, py) > 1)) continue;
      // Moments in pixels of the measured copy, so the ellipse keeps the image's aspect.
      const u = px * width, v = py * height;
      sum += weight; sx += weight * u; sy += weight * v; sxx += weight * u * u; sxy += weight * u * v; syy += weight * v * v;
    }
    if (sum === 0) return undefined;
    const mx = sx / sum, my = sy / sum, scale = EXTENT_SIGMAS ** 2;
    const a = scale * (sxx / sum - mx * mx), b = scale * (sxy / sum - mx * my), c = scale * (syy / sum - my * my);
    const determinant = a * c - b * b;
    if (!(determinant > 0) || !(a > 0) || !(c > 0)) return undefined;
    extent = { cx: mx / width, cy: my / height, halfWidth: Math.sqrt(a) / width, halfHeight: Math.sqrt(c) / height,
      reach: (x, y) => {
        const dx = x * width - mx, dy = y * height - my;
        return Math.sqrt((c * dx * dx - 2 * b * dx * dy + a * dy * dy) / determinant);
      } };
  }
  return extent;
}

/** The framed pixels of an image as straight RGBA, `OBJECT_THUMBNAIL_PIXELS` square. */
export async function frameObjectThumbnail(image: Uint8Array) {
  const full = await sharp(image).metadata(), extent = await measureExtent(image);
  // The part of the image the tile shows: the object's extent where it lies inside the frame, or the whole frame.
  const x0 = Math.max(0, extent ? extent.cx - extent.halfWidth : 0), x1 = Math.min(1, extent ? extent.cx + extent.halfWidth : 1);
  const y0 = Math.max(0, extent ? extent.cy - extent.halfHeight : 0), y1 = Math.min(1, extent ? extent.cy + extent.halfHeight : 1);
  const region = { left: Math.floor(x0 * full.width), top: Math.floor(y0 * full.height),
    width: Math.max(1, Math.ceil(x1 * full.width) - Math.floor(x0 * full.width)),
    height: Math.max(1, Math.ceil(y1 * full.height) - Math.floor(y0 * full.height)) };
  const box = OBJECT_THUMBNAIL_PIXELS - 2 * OBJECT_THUMBNAIL_MARGIN;
  const { data, info } = await sharp(image).ensureAlpha().extract(region).resize(box, box, { fit: 'inside', kernel: 'lanczos3' })
    .raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, size = OBJECT_THUMBNAIL_PIXELS;
  const tile = Buffer.alloc(size * size * 4);
  const left = Math.floor((size - width) / 2), top = Math.floor((size - height) / 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = (y * width + x) * 4, to = ((y + top) * size + x + left) * 4;
    // This pixel in fractions of the whole image.
    const u = (region.left + (x + 0.5) / width * region.width) / full.width, v = (region.top + (y + 0.5) / height * region.height) / full.height;
    // Two fades: toward the edge of the object's extent, and toward the ellipse inscribed in the image's frame.
    const window = fade(Math.hypot(2 * u - 1, 2 * v - 1)) * (extent ? fade(extent.reach(u, v)) : 1);
    // Empty sky becomes transparency; the color is divided back so the pixel over black is unchanged.
    const level = Math.max(data[from]!, data[from + 1]!, data[from + 2]!);
    const key = Math.min(1, level / SKY_LEVEL) * data[from + 3]! / 255;
    const alpha = Math.round(255 * window * key);
    if (alpha === 0) continue;
    const lift = level < SKY_LEVEL ? SKY_LEVEL / level : 1;
    for (let channel = 0; channel < 3; channel++) tile[to + channel] = Math.min(255, Math.round(data[from + channel]! * lift));
    tile[to + 3] = alpha;
  }
  return tile;
}

/** The object-row thumbnail of an image: decoration, so it takes the decorative encoding. */
export async function objectThumbnail(image: Uint8Array) {
  const size = OBJECT_THUMBNAIL_PIXELS;
  return sharp(await frameObjectThumbnail(image), { raw: { width: size, height: size, channels: 4 } }).webp(DECORATIVE_WEBP).toBuffer();
}
