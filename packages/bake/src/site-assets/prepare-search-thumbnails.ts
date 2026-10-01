// `pnpm prepare:search-thumbnails`: small previews for search result rows, at
// `public/navigation/search/<id>@2x.webp`: 40 CSS px at the one prepared density. Every scene object whose navigation
// marker has a context sprite (`public/navigation/<id>-context.webp`, up to about 1400 px) previews from that sprite; a
// sprite photographed on black sky is cut out along the body's outline. A search list decodes dozens of these; the full
// images would cost megabytes each. Featured stars reuse their published arrival images, including prepared limb shading.
// The previews are committed beside their sprites: `prepare-navigation` and the shape-material refresh remake them
// after drawing a sprite, so no build or deploy decodes a sprite.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { isRecord } from '@cssearth/core';
import { parseObjectDiscovery } from '@cssearth/objects';

/** The checkout, found through this package's own name so the path holds from the sources and from `dist/`. */
const ROOT = resolve(dirname(createRequire(import.meta.url).resolve('@cssearth/bake/package.json')), '../..');
const root = ROOT;
/** Preview edge in device pixels: 40 CSS px at 2x. */
export const SEARCH_THUMBNAIL_PIXELS = 80;
/** The body's larger side, inside an even transparent margin. */
const MARGIN_PIXELS = 4, BODY_PIXELS = SEARCH_THUMBNAIL_PIXELS - 2 * MARGIN_PIXELS;

/** Level above which a pixel is not empty sky. */
const SKY_LEVEL = 24;
/** Width of the small copy on which the body is found. */
const MASK_WIDTH = 300;
/** The body on an image with opaque sky, cut out along its outline: the largest connected shape brighter than the sky,
 * with its holes filled, so dark oceans and shadows stay opaque and a star or a moon beside it is left out. */
async function cutOut(image: Buffer) {
  const full = await sharp(image).metadata();
  const { data, info } = await sharp(image).resize({ width: MASK_WIDTH }).median(3).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, label = new Int32Array(width * height).fill(-1);
  const neighbours = (at: number) => {
    const x = at % width, y = (at - x) / width;
    return [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1];
  };
  let best = -1, bestSize = 0;
  for (let seed = 0; seed < data.length; seed++) {
    if (label[seed] !== -1 || data[seed]! <= SKY_LEVEL) continue;
    const queue = [seed]; label[seed] = seed; let size = 0;
    while (queue.length) {
      size++;
      for (const next of neighbours(queue.pop()!)) if (next >= 0 && label[next] === -1 && data[next]! > SKY_LEVEL) { label[next] = seed; queue.push(next); }
    }
    if (size > bestSize) { best = seed; bestSize = size; }
  }
  if (best < 0) throw new TypeError('Image shows no body.');
  // Sky is whatever the image's border reaches without crossing the body; everything else is the body.
  const sky = new Uint8Array(width * height), queue: number[] = [];
  for (let at = 0; at < sky.length; at++) {
    const x = at % width, y = (at - x) / width;
    if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && label[at] !== best) { sky[at] = 1; queue.push(at); }
  }
  while (queue.length) for (const next of neighbours(queue.pop()!)) if (next >= 0 && !sky[next] && label[next] !== best) { sky[next] = 1; queue.push(next); }
  const mask = Buffer.alloc(width * height);
  let left = width, top = height, right = 0, bottom = 0;
  for (let at = 0; at < mask.length; at++) {
    if (sky[at]) continue;
    mask[at] = 255;
    const x = at % width, y = (at - x) / width;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const alpha = await sharp(mask, { raw: { width, height, channels: 1 } }).resize(full.width!, full.height!, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const scale = full.width! / width;
  const region = { left: Math.floor(left * scale), top: Math.floor(top * scale),
    width: Math.min(full.width!, Math.ceil((right + 1) * scale)) - Math.floor(left * scale),
    height: Math.min(full.height!, Math.ceil((bottom + 1) * scale)) - Math.floor(top * scale) };
  // Built by hand: sharp runs removeAlpha after joinChannel in one pipeline, which drops the joined alpha.
  const rgb = await sharp(image).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(alpha.length * 4);
  for (let at = 0; at < alpha.length; at++) rgb.copy(rgba, at * 4, at * 3, at * 3 + 3), rgba[at * 4 + 3] = alpha[at]!;
  return sharp(rgba, { raw: { width: full.width!, height: full.height!, channels: 4 } }).extract(region);
}

/** Featured stars already publish an arrival image with their prepared photospheric colour and limb law.
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
    const source = corner[3] === 255 ? await cutOut(sprite) : sharp(sprite);
    // Every preview fills the same box: trimmed to the body's own extent, its larger side spans the box less a margin.
    const trimmed = await source.png().toBuffer().then(buffer => sharp(buffer).trim().png().toBuffer());
    const clear = { r: 0, g: 0, b: 0, alpha: 0 };
    const image = await sharp(trimmed)
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

