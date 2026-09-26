import { resolve, basename } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Preserve the existing material frames exactly. Only their transport changes:
// the shared residency owner can retain the current row and warm its neighbor.
export interface AtlasRowVariant {
  runtimeAtlas: {assetUrl: string; asset2xUrl?: string};
  presentations: readonly {rowIndex: number; frameIndex: number; backgroundPosition: string; backgroundSize: string}[];
}
/** The atlas's regular grid: every frame sits in a stride-wide cell of a row, inside its gutter. */
async function atlasGrid(variant: AtlasRowVariant, publicDirectory: string) {
  const sourceUrl = variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl;
  const sourcePath = resolve(publicDirectory, basename(sourceUrl));
  const { width, height } = await sharp(sourcePath).metadata();
  if (width === undefined || height === undefined) throw new Error('Material atlas dimensions are missing.');
  const pixels = (value: string) => value.split(' ').map(x => Number.parseFloat(x));
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
  return { sourceUrl, sourcePath, width, height, pixels, frames, scaleX, scaleY, strideX, rowHeight, rowWidth };
}

/** One frame alone, for a bank that only ever shows that frame (a lens with shadows off, flood lit): its whole cell,
 * gutter included, so the frame samples the same pixels it did inside its row. */
export async function prepareAtlasStill({ variant, resource, publicDirectory, frame, native = false }: {variant: AtlasRowVariant; resource: string; publicDirectory: string; frame: number; native?: boolean}) {
  const grid = await atlasGrid(variant, publicDirectory), { sourceUrl, sourcePath, width, height, pixels, frames, strideX, rowHeight } = grid;
  const [scaleX, scaleY] = native ? [1, 1] : [grid.scaleX, grid.scaleY];
  const presentation = frames.find(p => p.frameIndex === frame);
  if (!presentation) throw new Error(`Material frame ${frame} is not in ${sourceUrl}.`);
  const [x, y] = pixels(presentation.backgroundPosition);
  const tileX = -x / grid.scaleX, tileY = -y / grid.scaleY, cellX = Math.floor(tileX / strideX) * strideX, cellY = presentation.rowIndex * rowHeight;
  if (!(cellX >= 0 && cellX + strideX <= width && cellY + rowHeight <= height && tileY >= cellY)) throw new Error(`Material frame ${frame} of ${sourceUrl} is outside its atlas.`);
  const url = sourceUrl.replace(/\.webp$/, '-shadowless.webp');
  await mkdir(publicDirectory, { recursive: true });
  await sharp(sourcePath).ensureAlpha().extract({ left: cellX, top: cellY, width: strideX, height: rowHeight })
    .webp({ lossless: true, effort: 6 }).toFile(resolve(publicDirectory, basename(url)));
  const key = `${resource}:shadowless`;
  return { entry: { key, url }, presentationScale: grid.scaleX, fixed: { resource: key, frame, row: null,
    backgroundPosition: `${-(tileX - cellX) * scaleX}px ${-(tileY - cellY) * scaleY}px`,
    backgroundSize: `${strideX * scaleX}px ${rowHeight * scaleY}px` } };
}

export async function prepareAtlasRows({ variant, resource, publicDirectory, native = false }: {variant: AtlasRowVariant; resource: string; publicDirectory: string; native?: boolean}) {
  const grid = await atlasGrid(variant, publicDirectory), { sourceUrl, sourcePath, width, height, pixels, frames, rowHeight, rowWidth } = grid;
  // `native` addresses each frame at the atlas's own pixels, for a leaf whose box is one tile; `presentationScale` is the
  // factor the declared addresses drew it at.
  const [scaleX, scaleY] = native ? [1, 1] : [grid.scaleX, grid.scaleY];
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
    presentationScale: grid.scaleX,
    entries: rows.map(({ resource: key, url }) => ({ key, url })),
    rows: rows.map(({ row, resource }) => ({ row, resource,
      firstFrame: frames.findIndex(p => p.rowIndex === row),
      lastFrame: frames.findLastIndex(p => p.rowIndex === row) })),
    frames: frames.map(p => {
      const [declaredX, declaredY] = pixels(p.backgroundPosition);
      const [x, y] = native ? [declaredX / grid.scaleX, declaredY / grid.scaleY] : [declaredX, declaredY];
      return { resource: `${resource}:row:${p.rowIndex}`, frame: p.frameIndex, row: p.rowIndex,
        backgroundPosition: `${x}px ${y + p.rowIndex * rowHeight * scaleY}px`,
        backgroundSize: `${rowWidth * scaleX}px ${rowHeight * scaleY}px` };
    }),
  };
}
