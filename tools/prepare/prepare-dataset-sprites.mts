import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DECORATIVE_WEBP } from '@cssearth/bake/raster';
import { sourceArray, sourceId, sourceObject, sourceText } from '../../src/platform/source-catalog.mts';

// Dataset icons occupy 14 CSS pixels. A 42-pixel tile stays sharp through 3x DPR.
const tile = 42;
const root = process.cwd();
const destination = resolve(root, 'public/navigation/dataset-sprites');
const sidebar = sourceObject(JSON.parse(await readFile(resolve(root, 'public/navigation/sidebar-thumbnails.json'), 'utf8')));
const sidebarImages = sourceObject(sidebar.images);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

let count = 0;
for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true }))
  .filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const id = sourceId(folder.name);
  let page: unknown;
  try { page = JSON.parse(await readFile(resolve(root, 'src/objects', id, 'prepared/page.json'), 'utf8')); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') continue;
    throw error;
  }
  const record = sourceObject(page);
  if (record.schema !== 'cssearth-object-page@1' || record.id !== id) throw new TypeError(`Invalid page data for ${id}`);
  const lenses = sourceArray(sourceObject(sourceObject(record.controls).lenses).controls, sourceObject);
  if (lenses.length < 2) continue;
  const columns = Math.ceil(Math.sqrt(lenses.length));
  const parts = await Promise.all(lenses.map(async (lens, index) => {
    const lensId = sourceId(lens.id);
    const sidebarEntry = sidebarImages[`${id}/${lensId}`];
    const url = sidebarEntry ? sourceText(sourceObject(sidebarEntry).url2x) : sourceText(lens.thumbnailUrl);
    if (!/^\/(?:scenes|navigation)\/[a-z0-9_@./-]+\.webp$/u.test(url) || url.includes('/../'))
      throw new TypeError(`Invalid dataset thumbnail URL for ${id}/${lensId}: ${url}`);
    const input = await readFile(resolve(root, 'public', url.slice(1)));
    // The old <img> used object-fit: cover; bake that same crop into the sprite.
    return { input: await sharp(input).resize(tile, tile, { fit: 'cover', kernel: 'lanczos3' }).png().toBuffer(),
      left: index % columns * tile, top: Math.floor(index / columns) * tile };
  }));
  const bytes = await sharp({ create: { width: columns * tile, height: columns * tile, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(parts).webp(DECORATIVE_WEBP).toBuffer();
  await writeFile(resolve(destination, `${id}.webp`), bytes);
  count++;
}
console.log(`Prepared ${count} object dataset sprites.`);
