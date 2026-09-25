/** Raw little-endian float32 samples, the byte layout the getsf benchmark and sampled-prior grids write beside their FITS
 * transport images. */
export function float32LittleEndian(values: Float32Array): Buffer {
  const bytes = Buffer.alloc(values.length * 4);
  for (let p = 0; p < values.length; p++) bytes.writeFloatLE(values[p]!, p * 4);
  return bytes;
}
