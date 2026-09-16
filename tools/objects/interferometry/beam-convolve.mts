/** Convolve a reconstructed image with the interferometric beam it was made under, and write it back as a FITS image that keeps
 * the reconstruction's own pixel scale and axis cards. A reconstruction carries structure below the beam that the visibilities never
 * constrained; convolving to the beam before display shows only what the data resolve, as the source paper does. */
import { headerBlock, padBlock, readFitsHdus } from './fits-table.mts';

export interface BeamImage { readonly width: number; readonly height: number; readonly values: Float64Array; readonly cards: readonly (readonly [string, string | number | boolean, string?])[] }

const KEEP = new Set(['SCALE', 'CDELT1', 'CDELT2', 'CRVAL1', 'CRVAL2', 'CRPIX1', 'CRPIX2', 'CTYPE1', 'CTYPE2']);

/** The first plane of a double-precision primary image and the coordinate cards worth keeping. */
export function readReconstruction(bytes: Buffer): BeamImage {
  const [primary] = readFitsHdus(bytes);
  if (!primary || Number(primary.header.BITPIX) !== -64 || ![2, 3].includes(Number(primary.header.NAXIS))) throw new Error('A reconstruction is a double-precision primary image.');
  const width = Number(primary.header.NAXIS1), height = Number(primary.header.NAXIS2), planes = Number(primary.header.NAXIS3 ?? 1);
  if (planes !== 1 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error('A reconstruction has one plane.');
  const values = new Float64Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = bytes.readDoubleBE(primary.dataOffset + i * 8);
  const cards = Object.entries(primary.header).filter(([key]) => KEEP.has(key)).map(([key, value]) => [key, value] as [string, string | number | boolean]);
  return { width, height, values, cards };
}

/** Gaussian convolution with a stated full width at half maximum in pixels, separable, edges renormalised so flux stays in the frame. */
export function convolveGaussian(image: Pick<BeamImage, 'width' | 'height' | 'values'>, fwhmPixels: number): Float64Array {
  if (!(fwhmPixels > 0)) throw new Error('A beam needs a positive width.');
  const sigma = fwhmPixels / (2 * Math.sqrt(2 * Math.log(2))), radius = Math.ceil(4 * sigma);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const pass = (source: Float64Array, stride: number, length: number, lines: number, lineStride: number) => {
    const out = new Float64Array(source.length);
    for (let line = 0; line < lines; line++) for (let i = 0; i < length; i++) {
      let sum = 0, weight = 0;
      for (let k = -radius; k <= radius; k++) { const j = i + k; if (j < 0 || j >= length) continue; const w = kernel[k + radius]!; sum += source[line * lineStride + j * stride]! * w; weight += w; }
      out[line * lineStride + i * stride] = sum / weight;
    }
    return out;
  };
  const rows = pass(image.values, 1, image.width, image.height, image.width);
  return pass(rows, image.width, image.height, image.width, 1);
}

/** A two-axis FITS primary image with the kept coordinate cards and a record of the beam. */
export function writeReconstruction(image: BeamImage, values: Float64Array, extra: readonly (readonly [string, string | number | boolean, string?])[]): Buffer {
  const data = Buffer.alloc(values.length * 8);
  values.forEach((value, i) => data.writeDoubleBE(value, i * 8));
  return Buffer.concat([headerBlock([['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', -64], ['NAXIS', 2], ['NAXIS1', image.width], ['NAXIS2', image.height], ...image.cards, ...extra]), padBlock(data)]);
}
