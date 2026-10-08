import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DECORATIVE_WEBP } from '../raster/index.ts';
import { sourceArray, sourceId, sourceObject, sourceText } from '@cssearth/objects/sources';
import { readPreparedControls } from '@cssearth/objects/node';

// Dataset icons occupy 14 CSS pixels. A 42-pixel tile stays sharp through 3x DPR.
const tile = 42;

/** Bake each object's dataset thumbnails into one sprite under site/public/navigation/dataset-sprites; returns how many were written. */
export async function prepareDatasetSprites(root = checkoutProjectRoot(import.meta.url)) {
  const destination = resolve(root, 'site/public/navigation/dataset-sprites');
  const sidebar = sourceObject(JSON.parse(await readFile(resolve(root, 'site/public/navigation/sidebar-thumbnails.json'), 'utf8')));
  const sidebarImages = sourceObject(sidebar.images);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  // Each body's sprite is its own file, so the bodies are drawn 16 at a time: one after another, sharp's thread pool sat
  // idle and this step cost every dev start 8 s.
  const folders = (await readdir(resolve(root, 'src/objects'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort((a, b) => a.localeCompare(b));
  let next = 0, count = 0;
  const drawBody = async (name: string) => {
    const id = sourceId(name);
    // The runtime's controls; a folder without a runtime has no datasets to draw.
    let controls: unknown;
    try { controls = await readPreparedControls(resolve(root, 'src/objects', id, 'prepared')); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
    const datasets = sourceArray(sourceObject(sourceObject(controls).datasets).controls, sourceObject);
    if (datasets.length < 2) return;
    const columns = Math.ceil(Math.sqrt(datasets.length));
    const parts = await Promise.all(datasets.map(async (dataset, index) => {
      const datasetId = sourceId(dataset.id);
      const sidebarEntry = sidebarImages[`${id}/${datasetId}`];
      const url = sidebarEntry ? sourceText(sourceObject(sidebarEntry).url2x) : sourceText(dataset.thumbnailUrl);
      if (!/^\/(?:scenes|navigation)\/[a-z0-9_@./-]+\.webp$/u.test(url) || url.includes('/../'))
        throw new TypeError(`Invalid dataset thumbnail URL for ${id}/${datasetId}: ${url}`);
      const input = await readFile(resolve(root, 'site/public', url.slice(1)));
      // The old <img> used object-fit: cover; bake that same crop into the sprite.
      return { input: await sharp(input).resize(tile, tile, { fit: 'cover', kernel: 'lanczos3' }).png().toBuffer(),
        left: index % columns * tile, top: Math.floor(index / columns) * tile };
    }));
    const bytes = await sharp({ create: { width: columns * tile, height: columns * tile, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(parts).webp(DECORATIVE_WEBP).toBuffer();
    await writeFile(resolve(destination, `${id}.webp`), bytes);
    count++;
  };
  await Promise.all(Array.from({ length: 16 }, async () => { while (next < folders.length) await drawBody(folders[next++]!); }));
  return count;
}
