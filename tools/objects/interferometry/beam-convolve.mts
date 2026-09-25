/** Convolve a reconstructed image with the interferometric beam it was made under, and write it back as a FITS image that keeps
 * the reconstruction's own pixel scale and axis cards. A reconstruction carries structure below the beam that the visibilities never
 * constrained; convolving to the beam before display shows only what the data resolve, as the source paper does. */
import { readFitsImage, type FitsHeader, skyImageAxes, type SkyImageAxes } from '@cssearth/fits';
import { headerBlock, padBlock } from './fits-table.mts';

export interface BeamImage { readonly width: number; readonly height: number; readonly values: Float64Array; readonly cards: readonly (readonly [string, string | number | boolean, string?])[] }
export interface Reconstruction extends BeamImage { readonly header: FitsHeader; readonly axes: SkyImageAxes }

const KEEP = new Set(['SCALE', 'CDELT1', 'CDELT2', 'CRVAL1', 'CRVAL2', 'CRPIX1', 'CRPIX2', 'CTYPE1', 'CTYPE2']);

/** The first plane of a double-precision primary sky image, its stated axes and the coordinate cards worth keeping. The axes are
 * read before any card is dropped, so a rotated reconstruction is refused instead of being rewritten without its rotation. */
export function readReconstruction(bytes: Buffer): Reconstruction {
  const image = readFitsImage(bytes);
  if (image.header.XTENSION !== undefined || image.bitpix !== -64 || image.planes !== 1) throw new Error('A reconstruction is a one-plane double-precision primary image.');
  const axes = skyImageAxes(image.header);
  const cards = Object.entries(image.header).filter((entry): entry is [string, string | number | boolean] => KEEP.has(entry[0]) && entry[1] !== undefined);
  return { width: image.width, height: image.height, values: image.values, cards, header: image.header, axes };
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
