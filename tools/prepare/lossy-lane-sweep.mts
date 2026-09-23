// Measure the lossy lane against the files it replaces: for each image, its size today and, at qualities around the lane's,
// the encoded size and the pixels pixelmatch flags at threshold 0.1. The table in docs/surface-preparation.md is its output.
// node tools/prepare/lossy-lane-sweep.mts <image>...
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { LOSSY_WEBP } from '../../src/preparation/raster/lossy-lane.ts';

const qualities = [LOSSY_WEBP.quality - 5, LOSSY_WEBP.quality, LOSSY_WEBP.quality + 5];
const files = process.argv.slice(2);
if (!files.length) throw new Error('Usage: node tools/prepare/lossy-lane-sweep.mts <image>...');
const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;
for (const file of files) {
  const { data, info } = await sharp(file, { limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = [basename(file), `${info.width}×${info.height}`, megabytes((await stat(file)).size)];
  for (const quality of qualities) {
    const encoded = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 }, limitInputPixels: false })
      .webp({ alphaQuality: 100, ...LOSSY_WEBP, quality }).toBuffer();
    const decoded = await sharp(encoded, { limitInputPixels: false }).ensureAlpha().raw().toBuffer();
    cells.push(`q${quality} ${megabytes(encoded.length)}, ${pixelmatch(data, decoded, undefined, info.width, info.height, { threshold: 0.1 })}`);
  }
  console.log(cells.join(' | '));
}
