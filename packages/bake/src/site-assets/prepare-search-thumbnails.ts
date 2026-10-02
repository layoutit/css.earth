import { discoverRoot } from '@cssearth/core/node';
// `pnpm prepare:search-thumbnails`: small previews for search result rows, at
// `public/navigation/search/<id>@2x.webp`: 40 CSS px at the one prepared density. Every scene object whose navigation
// marker has a context sprite (`public/navigation/<id>-context.webp`, up to about 1400 px) previews from that sprite. An
// opaque sprite is a photograph of a galaxy, cluster or nebula on its sky: it has no outline to cut along, so its preview
// takes the object-row framing (`object-thumbnail.ts`). A search list decodes dozens of these; the full
// images would cost megabytes each. Featured stars reuse their published arrival images, including prepared limb shading.
// The previews are committed beside their sprites: `prepare-navigation` and the shape-material refresh remake them
// after drawing a sprite, so no build or deploy decodes a sprite.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { isRecord } from '@cssearth/core';
import { parseObjectDiscovery } from '@cssearth/objects';
import { objectThumbnail } from './object-thumbnail.ts';

/** The checkout, found through this package's own name so the path holds from the sources and from `dist/`. */
const ROOT = discoverRoot({ strategy: 'package-location', fromUrl: import.meta.url, packageSpecifier: '@cssearth/bake/package.json', rootOffset: '../..', missing: { behavior: 'throw' } });
const root = ROOT;
/** Preview edge in device pixels: 40 CSS px at 2x. */
export const SEARCH_THUMBNAIL_PIXELS = 80;
/** The body's larger side, inside an even transparent margin. */
const MARGIN_PIXELS = 4, BODY_PIXELS = SEARCH_THUMBNAIL_PIXELS - 2 * MARGIN_PIXELS;

/** The complete picture an object's marker is drawn from, when the object authors one (`source/preparation/navigation.json`).
 * The context sprite is that picture cut to a square, which crops a wide object; the preview frames the whole picture. */
async function markerPicture(projectRoot: string, id: string): Promise<Buffer | undefined> {
  const directory = resolve(projectRoot, 'src/objects', id, 'source'), recipePath = resolve(directory, 'preparation/navigation.json');
  let recipe: unknown;
  try { recipe = JSON.parse(await readFile(recipePath, 'utf8')); }
  catch (error) { if (isRecord(error) && error.code === 'ENOENT') return undefined; throw error; }
  const path = isRecord(recipe) && isRecord(recipe.source) ? recipe.source.path : undefined;
  if (typeof path !== 'string' || !/^[a-z0-9][a-z0-9_./-]*\.(?:png|webp|jpg)$/u.test(path) || path.includes('..'))
    throw new TypeError(`${recipePath}: source.path is ${JSON.stringify(path)}; expected an image under the object's source directory.`);
  return readFile(resolve(directory, path));
}

/** Featured stars already publish an arrival image with their prepared photospheric color and limb law.
 * Reuse those pixels for the sidebar and search, rather than the flat catalogue context disc. */
async function featuredStarPreviews(projectRoot: string): Promise<ReadonlyMap<string, string>> {
  const module: unknown = await import(pathToFileURL(resolve(projectRoot, 'site/prepared-catalogue.mjs')).href);
  if (!isRecord(module) || !Array.isArray(module.CATALOGUE_ENTRIES)) throw new TypeError('Invalid prepared catalogue.');
  const previews = new Map<string, string>();
  for (const entry of module.CATALOGUE_ENTRIES) {
    if (!isRecord(entry)) throw new TypeError('Invalid prepared catalogue entry.');
    if (!isRecord(entry.descriptor) || !isRecord(entry.descriptor.properties) || !isRecord(entry.descriptor.properties.catalog))
      throw new TypeError('Invalid scene catalogue descriptor.');
    if (entry.descriptor.properties.catalog.classification !== 'star') continue;
    const discovery = parseObjectDiscovery(entry.discovery), arrival = discovery.arrival?.billboard;
    if (!discovery.featured || !arrival) continue;
    const id = entry.descriptor.id;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/u.test(id) || !arrival.url.startsWith(`/scenes/${id}/`))
      throw new TypeError('Invalid local stellar arrival image.');
    previews.set(id, arrival.url);
  }
  return previews;
}

export async function prepareSearchThumbnails(projectRoot = root) {
  const stellarPreviews = await featuredStarPreviews(projectRoot);
  const { PREPARED_NAVIGATION_MARKERS } = await import(pathToFileURL(resolve(projectRoot, 'site/prepared-navigation-markers.mjs')).href) as
    { PREPARED_NAVIGATION_MARKERS: Record<string, { context?: { url: string } }> };
  const output = resolve(projectRoot, 'public/navigation/search');
  await mkdir(output, { recursive: true });
  let written = 0, unchanged = 0, current = 0, next = 0;
  // Each preview reads only its own sprite, so they are made in parallel.
  const markers = Object.entries(PREPARED_NAVIGATION_MARKERS);
  await Promise.all(Array.from({ length: availableParallelism() }, async () => { while (next < markers.length) {
    const [id, marker] = markers[next++]!;
    if (!marker.context) continue;
    if (!/^\/navigation\/[a-z0-9-]+-context\.webp$/u.test(marker.context.url)) throw new TypeError(`${id}: unexpected context sprite ${marker.context.url}`);
    const stellarPreview = stellarPreviews.get(id);
    const spritePath = resolve(projectRoot, 'public', (stellarPreview ?? marker.context.url).slice(1)), path = resolve(output, `${id}@2x.webp`);
    // Context previews newer than their sprite are current. The small featured-star set compares arrival-derived bytes
    // each time, so an older restored arrival can replace a newer flat-disc preview without a stale cache hit.
    const [spriteStat, previewStat] = await Promise.all([stat(spritePath), stat(path).catch(() => null)]);
    if (!stellarPreview && previewStat && previewStat.mtimeMs >= spriteStat.mtimeMs) { current++; continue; }
    const sprite = await readFile(spritePath);
    const { data: corner } = await sharp(sprite).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    // A body's preview fills the box: trimmed to its own extent, its larger side spans the box less a margin.
    const clear = { r: 0, g: 0, b: 0, alpha: 0 };
    const image = corner[3] === 255 ? await objectThumbnail(await markerPicture(projectRoot, id) ?? sprite)
      : await sharp(await sharp(sprite).trim().png().toBuffer())
        .resize(BODY_PIXELS, BODY_PIXELS, { fit: 'contain', background: clear })
        .extend({ top: MARGIN_PIXELS, bottom: MARGIN_PIXELS, left: MARGIN_PIXELS, right: MARGIN_PIXELS, background: clear })
        .webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
    try { if (Buffer.compare(await readFile(path), image) === 0) { unchanged++; continue; } }
    catch (error) { if (!isRecord(error) || error.code !== 'ENOENT') throw error; }
    await writeFile(path, image);
    written++;
  } }));
  return { written, unchanged, current };
}
