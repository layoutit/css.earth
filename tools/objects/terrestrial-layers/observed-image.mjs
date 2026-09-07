import sharp from 'sharp';
import { blackFillCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';

/** Byte maps declare an exact missing code, or null when no validity mask is supplied. */
export async function prepareByteObservation(path, entry, policy, width, height) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height ||
      metadata.depth !== 'uchar' || metadata.hasAlpha || !['b-w', 'srgb'].includes(metadata.space) ||
      (policy.kind === 'image-monochrome-no-data' && metadata.space !== 'b-w')) {
    throw new Error(`Byte observation format differs from its source: ${entry.id}`);
  }
  const source = await sharp(path).toColourspace('srgb').raw().toBuffer();
  if (policy.connectedEdge !== undefined &&
      (!['north', 'south'].includes(policy.connectedEdge) || policy.noData !== 0)) {
    throw new Error('Connected coverage requires a north/south edge and exact black fill.');
  }
  const connected = policy.connectedEdge === undefined ? null : blackFillCoverage(source,
    { width: entry.width, height: entry.height, channels: 3 },
    { northConnected: policy.connectedEdge === 'north', southConnected: policy.connectedEdge === 'south' });
  const rgba = Buffer.alloc(entry.width * entry.height * 4);
  let sourceMissingPixels = 0;
  for (let i = 0; i < rgba.length / 4; i++) {
    const color = source.subarray(i * 3, i * 3 + 3);
    const missing = connected ? Boolean(connected[i]) :
      policy.noData !== null && color.every(value => value === policy.noData);
    rgba.set(color, i * 4);
    rgba[i * 4 + 3] = missing ? 0 : 255;
    sourceMissingPixels += Number(missing);
  }
  const data = await sharp(rgba, { raw: { width: entry.width, height: entry.height, channels: 4 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('srgb').raw().toBuffer();
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const roll = (180 - policy.centerLongitude) / 360 * width;
  if (!Number.isInteger(roll)) throw new Error('Observed longitude roll must align with prepared texels.');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, j = y * width + (x + roll + width) % width;
    rgb.set(data.subarray(j * 4, j * 4 + 3), i * 3);
    missing[i] = data[j * 4 + 3] < 255 ? 1 : 0;
  }
  return { rgb, missing, sourceMissingPixels };
}
