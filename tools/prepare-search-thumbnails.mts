// `pnpm prepare:search-thumbnails`: small previews for search result rows. Every scene object whose navigation marker
// has a context sprite (`public/navigation/<id>-context.webp`, up to about 1400 px) gets an 80 px copy at
// `public/navigation/search/<id>@2x.webp`: a 40 CSS px preview at the one prepared density. A search list decodes
// dozens of these; the full sprites would cost megabytes each.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { isRecord } from './source-values.mts';

const root = resolve(import.meta.dirname, '..');
/** Preview edge in device pixels: 40 CSS px at 2x. */
export const SEARCH_THUMBNAIL_PIXELS = 80;

export async function prepareSearchThumbnails(projectRoot = root) {
  const { PREPARED_NAVIGATION_MARKERS } = await import(pathToFileURL(resolve(projectRoot, 'site/prepared-navigation-markers.mjs')).href) as
    { PREPARED_NAVIGATION_MARKERS: Record<string, { context?: { url: string } }> };
  const output = resolve(projectRoot, 'public/navigation/search');
  await mkdir(output, { recursive: true });
  let written = 0, unchanged = 0;
  for (const [id, marker] of Object.entries(PREPARED_NAVIGATION_MARKERS)) {
    if (!marker.context) continue;
    if (!/^\/navigation\/[a-z0-9-]+-context\.webp$/u.test(marker.context.url)) throw new TypeError(`${id}: unexpected context sprite ${marker.context.url}`);
    const image = await sharp(await readFile(resolve(projectRoot, 'public', marker.context.url.slice(1))))
      .resize(SEARCH_THUMBNAIL_PIXELS, SEARCH_THUMBNAIL_PIXELS, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
    const path = resolve(output, `${id}@2x.webp`);
    try { if (Buffer.compare(await readFile(path), image) === 0) { unchanged++; continue; } }
    catch (error) { if (!isRecord(error) || error.code !== 'ENOENT') throw error; }
    await writeFile(path, image);
    written++;
  }
  return { written, unchanged };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(await prepareSearchThumbnails());
