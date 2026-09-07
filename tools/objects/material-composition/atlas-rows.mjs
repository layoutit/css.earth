import { resolve, basename } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Preserve the existing material frames exactly. Only their transport changes:
// the shared residency owner can retain the current row and warm its neighbor.
export async function prepareAtlasRows({ variant, resource, publicDirectory }) {
  const sourceUrl = variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl;
  const sourcePath = resolve(publicDirectory, basename(sourceUrl));
  const { width, height } = await sharp(sourcePath).metadata();
  const pixels = value => value.split(' ').map(x => Number.parseFloat(x));
  const frames = variant.presentations;
  const [logicalWidth, logicalHeight] = pixels(frames[0].backgroundSize);
  const scaleX = logicalWidth / width, scaleY = logicalHeight / height;
  const first = frames.filter(p => p.rowIndex === 0);
  const next = frames.find(p => p.rowIndex === 1);
  if (first.length < 2 || !next || !(scaleX > 0 && scaleY > 0)) throw new Error('Material atlas has no regular prepared rows.');
  const strideX = (pixels(first[0].backgroundPosition)[0] - pixels(first[1].backgroundPosition)[0]) / scaleX;
  const rowHeight = (pixels(first[0].backgroundPosition)[1] - pixels(next.backgroundPosition)[1]) / scaleY;
  const rowWidth = strideX * first.length;
  if (![rowWidth, rowHeight].every(v => Number.isSafeInteger(v) && v > 0) || rowWidth > width) throw new Error('Material row bounds are invalid.');
  const rows = [];
  const decoded = await sharp(sourcePath).ensureAlpha().raw().toBuffer();
  await mkdir(publicDirectory, { recursive: true });
  for (const row of [...new Set(frames.map(p => p.rowIndex))]) {
    if (!Number.isSafeInteger(row) || row < 0 || (row + 1) * rowHeight > height) throw new Error('Material frame exceeds its atlas.');
    const url = sourceUrl.replace(/\.webp$/, `-stream-row-${String(row).padStart(2, '0')}.webp`);
    await sharp(decoded, { raw: { width, height, channels: 4 } }).extract({ left: 0, top: row * rowHeight, width: rowWidth, height: rowHeight })
      .webp({ lossless: true, effort: 6 }).toFile(resolve(publicDirectory, basename(url)));
    rows.push({ row, resource: `${resource}:row:${row}`, url });
  }
  return {
    entries: rows.map(({ resource: key, url }) => ({ key, url })),
    rows: rows.map(({ row, resource }) => ({ row, resource,
      firstFrame: frames.findIndex(p => p.rowIndex === row),
      lastFrame: frames.findLastIndex(p => p.rowIndex === row) })),
    frames: frames.map(p => {
      const [x, y] = pixels(p.backgroundPosition);
      return { resource: `${resource}:row:${p.rowIndex}`, frame: p.frameIndex, row: p.rowIndex,
        backgroundPosition: `${x}px ${y + p.rowIndex * rowHeight * scaleY}px`,
        backgroundSize: `${rowWidth * scaleX}px ${rowHeight * scaleY}px` };
    }),
  };
}
