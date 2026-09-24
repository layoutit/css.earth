/** The reading half of the float32 transport image that `encodeFits` (the node entry) writes: one primary 2D HDU returned
 * as top-down (DOM row order) Float32 samples. Row order is converted here, not in the shared decoder. */
import { readFitsImage } from './fits.js';

/** Returns DOM/top-down samples; retains signed values and rejects invalid/truncated data. */
export function decodeFits(bytes: Uint8Array) {
  const { header, width, height, dimensions, values: native } = readFitsImage(bytes);
  if (header.SIMPLE !== true || header.XTENSION !== undefined || dimensions.length !== 2) throw new TypeError('Unsupported FITS transport image.');
  const values = new Float32Array(native.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (height - y - 1) * width + x;
    values[target] = native[y * width + x]!;
    if (!Number.isFinite(values[target])) throw new TypeError('Nonfinite FITS pixel.');
  }
  return { width, height, header, values };
}
