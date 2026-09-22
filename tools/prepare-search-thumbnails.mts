// `pnpm prepare:search-thumbnails`: small previews for search result rows, at
// `public/navigation/search/<id>@2x.webp`: 40 CSS px at the one prepared density. A body with a social card
// (`public/social/<id>.jpg`, its page's arrival view) previews from that card, so Saturn shows its rings rather than
// the edge-on ring plane of the scene's date; the card's dark sky becomes transparent. Every other scene object whose
// navigation marker has a context sprite (`public/navigation/<id>-context.webp`, up to about 1400 px) previews from the
// sprite. A search list decodes dozens of these; the full images would cost megabytes each.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { isRecord } from './source-values.mts';

const root = resolve(import.meta.dirname, '..');
/** Preview edge in device pixels: 40 CSS px at 2x. */
export const SEARCH_THUMBNAIL_PIXELS = 80;
/** The body's larger side, inside an even transparent margin. */
const MARGIN_PIXELS = 4, BODY_PIXELS = SEARCH_THUMBNAIL_PIXELS - 2 * MARGIN_PIXELS;

/** Levels at or below which a social card's sky is empty, and above which a pixel is fully the body. */
const SKY_LEVEL = 24, BODY_LEVEL = 64;
/** The body on a social card: cropped to its extent, with the dark sky around it made transparent. The extent is the
 * largest connected bright shape, found on a small copy: the planet, never a star or a moon beside it. */
const MASK_WIDTH = 240;
async function largestShape(card: Buffer) {
  const { data, info } = await sharp(card).resize({ width: MASK_WIDTH }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, label = new Int32Array(width * height).fill(-1);
  let best = { size: 0, left: 0, top: 0, right: 0, bottom: 0 };
  for (let seed = 0; seed < data.length; seed++) {
    if (label[seed] !== -1 || data[seed]! <= BODY_LEVEL) continue;
    const queue = [seed]; label[seed] = seed;
    const shape = { size: 0, left: width, top: height, right: 0, bottom: 0 };
    while (queue.length) {
      const at = queue.pop()!, x = at % width, y = (at - x) / width;
      shape.size++; shape.left = Math.min(shape.left, x); shape.right = Math.max(shape.right, x);
      shape.top = Math.min(shape.top, y); shape.bottom = Math.max(shape.bottom, y);
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1]) {
        if (next >= 0 && label[next] === -1 && data[next]! > BODY_LEVEL) { label[next] = seed; queue.push(next); }
      }
    }
    if (shape.size > best.size) best = shape;
  }
  if (!best.size) throw new TypeError('Social card shows no body.');
  const full = await sharp(card).metadata(), scale = full.width! / width, pad = 1;
  const left = Math.max(0, Math.floor((best.left - pad) * scale)), top = Math.max(0, Math.floor((best.top - pad) * scale));
  return { left, top, width: Math.min(full.width!, Math.ceil((best.right + 1 + pad) * scale)) - left,
    height: Math.min(full.height!, Math.ceil((best.bottom + 1 + pad) * scale)) - top };
}
async function cardBody(card: Buffer) {
  const region = await largestShape(card);
  const { data, info } = await sharp(card).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const level = Math.max(data[index]!, data[index + 1]!, data[index + 2]!);
    data[index + 3] = Math.round(255 * Math.min(1, Math.max(0, (level - SKY_LEVEL) / (BODY_LEVEL - SKY_LEVEL))));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

export async function prepareSearchThumbnails(projectRoot = root) {
  const { PREPARED_NAVIGATION_MARKERS } = await import(pathToFileURL(resolve(projectRoot, 'site/prepared-navigation-markers.mjs')).href) as
    { PREPARED_NAVIGATION_MARKERS: Record<string, { context?: { url: string } }> };
  const output = resolve(projectRoot, 'public/navigation/search');
  await mkdir(output, { recursive: true });
  let written = 0, unchanged = 0;
  for (const [id, marker] of Object.entries(PREPARED_NAVIGATION_MARKERS)) {
    if (!marker.context) continue;
    if (!/^\/navigation\/[a-z0-9-]+-context\.webp$/u.test(marker.context.url)) throw new TypeError(`${id}: unexpected context sprite ${marker.context.url}`);
    const social = await readFile(resolve(projectRoot, 'public/social', `${id}.jpg`)).catch((error: unknown) => {
      if (isRecord(error) && error.code === 'ENOENT') return null; throw error;
    });
    const source = social ? await cardBody(social) : sharp(await readFile(resolve(projectRoot, 'public', marker.context.url.slice(1))));
    // Every preview fills the same box: trimmed to the body's own extent, its larger side spans the box less a margin.
    const trimmed = await source.png().toBuffer().then(buffer => sharp(buffer).trim().png().toBuffer());
    const clear = { r: 0, g: 0, b: 0, alpha: 0 };
    const image = await sharp(trimmed)
      .resize(BODY_PIXELS, BODY_PIXELS, { fit: 'contain', background: clear })
      .extend({ top: MARGIN_PIXELS, bottom: MARGIN_PIXELS, left: MARGIN_PIXELS, right: MARGIN_PIXELS, background: clear })
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
