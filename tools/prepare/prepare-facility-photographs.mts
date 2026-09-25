import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';
import { encodeLossyWebp, LOSSY_WEBP } from '../../src/preparation/raster/lossy-lane.ts';

/**
 * Prepares the published imagery that stands in for a facility: photographs,
 * and official spacecraft artwork with a transparent background. Acquisition
 * and preparation are explicit maintenance operations; normal builds reuse the
 * committed WebP files. `--only=a,b` limits the run to those records.
 */
const root = path.resolve(import.meta.dirname, '../..');
const records = path.join(root, 'site/source/facilities/photograph-records.json');
const output = path.join(root, 'public/shell/facility-renders');
const cache = process.env.CSSEARTH_PHOTO_CACHE ?? path.join(root, 'output/facility-photos');
const only = (process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length) ?? '').split(',').filter(Boolean);
const WIDTH = 592, HEIGHT = 296, BACKGROUND = '#0d0d0d';
/** Artwork fits the same box as the retired model renders: 88% of the width, 86% of the height. */
const ARTWORK_BOX = [Math.round(WIDTH * .88), Math.round(HEIGHT * .86)] as const, SUBJECT_PADDING = 6;
const ARTWORK = 'official-prerendered-artwork', MATTE_ALPHA = 32, MATTE_RGB = 8;
/** Both routes encode in the lossy lane. Measured 2026-09-25 with pixelmatch (threshold 0.1) against lossless
 * encodes, artwork composited on the card's rgb(20, 20, 20): the 21 distinct artwork files take 263 KB at alpha
 * quality 40 and flag 176 edge and 69 smooth-area pixels, fewer than the previous quality 90 with exact alpha
 * (427 KB; 259 and 87). Alpha quality 20 adds edge hits (188). The 11 photographs take 315 KB and flag 197 pixels,
 * against 485 KB and 679 at quality 90. */
const ARTWORK_ALPHA_QUALITY = 40;

interface Pinned {
  readonly id: string; readonly url: string; readonly sourcePage: string;
  readonly credit: string; readonly license: string;
  readonly kind: string; readonly flipX: boolean; readonly bytes: number;
}
const optionalBoolean = (value: unknown, label: string): boolean => {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean.`);
  return value;
};
const pinned: readonly Pinned[] = requireArray(JSON.parse(await fs.readFile(records, 'utf8')))
  .map(value => {
    const entry = requireRecord(value);
    return { id: requireString(entry.id), url: requireString(entry.url), sourcePage: requireString(entry.sourcePage),
      credit: requireString(entry.credit), license: requireString(entry.license),
      kind: entry.kind === undefined ? 'published-photograph' : requireString(entry.kind),
      flipX: optionalBoolean(entry.flipX, 'flipX'), bytes: requireFiniteNumber(entry.bytes) };
  });
const unknown = only.filter(id => !pinned.some(entry => entry.id === id));
if (unknown.length) throw new Error(`--only names no photograph record: ${unknown.join(', ')}`);
const selected = pinned.filter(entry => !only.length || only.includes(entry.id));

async function original(entry: Pinned): Promise<Buffer> {
  const local = path.join(cache, `${entry.id}${path.extname(new URL(entry.url).pathname) || '.jpg'}`);
  const bytes = await fs.readFile(local).catch(async (error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const response = await fetch(entry.url, { headers: { 'User-Agent': 'cssEarth-provenance/1.0 (https://css.earth)' } });
    if (!response.ok) throw new Error(`Could not acquire ${entry.id}: ${response.status}`);
    const downloaded = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(cache, { recursive: true });
    await fs.writeFile(local, downloaded);
    return downloaded;
  });
  if (bytes.length !== entry.bytes) throw new Error(`Source byte count mismatch: ${entry.id} (${entry.url}) has ${bytes.length}, photograph-records.json declares ${entry.bytes}`);
  return bytes;
}

/** Cover the frame from the centre. A photograph has no transparent margin to
 * trim, so it is never upscaled and never letterboxed onto the sidebar. */
async function photograph(entry: Pinned, source: Buffer) {
  const probe = await sharp(source).metadata();
  if (!probe.width || !probe.height || probe.width < WIDTH || probe.height < HEIGHT) throw new Error(`Photograph is smaller than the frame: ${entry.id} is ${probe.width}x${probe.height}, frame ${WIDTH}x${HEIGHT}`);
  const resized = sharp(source).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' });
  return { webp: await encodeLossyWebp((entry.flipX ? resized.flop() : resized).flatten({ background: BACKGROUND })),
    preparation: `Centre-cover to ${WIDTH}x${HEIGHT} without upscaling${entry.flipX ? ', mirror horizontally' : ''}, flatten onto sidebar ${BACKGROUND}, encode WebP quality ${LOSSY_WEBP.quality} (lossy lane).` };
}

/** Keep the published angle, colours and transparency: clear the dark matte,
 * trim the transparent margin, fit the box without upscaling, centre it, and
 * record the subject bounds the sidebar crops to. */
async function artwork(entry: Pinned, source: Buffer) {
  const probe = await sharp(source).metadata();
  if (!probe.hasAlpha) throw new Error(`Artwork has no transparency: ${entry.id} (${entry.url})`);
  // Several NASA icons (Cassini, Dawn, Hubble, Rosetta, SDO, Terra) sit on a near-black
  // matte below 12% opacity that shows as a box on the card and defeats the trim.
  // Measured over all 22 files, near-black pixels are either below alpha 32 or above 224.
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] < MATTE_ALPHA && Math.max(data[i], data[i + 1], data[i + 2]) <= MATTE_RGB) data[i + 3] = 0;
  const cleared = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const fitted = await sharp(await sharp(cleared).trim().toBuffer())
    .resize(ARTWORK_BOX[0], ARTWORK_BOX[1], { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const size = await sharp(fitted).metadata();
  if (!size.width || !size.height || Math.max(size.width / ARTWORK_BOX[0], size.height / ARTWORK_BOX[1]) < .75) throw new Error(`Artwork is too small for the frame: ${entry.id} trims to ${size.width}x${size.height}, box ${ARTWORK_BOX.join('x')}`);
  const left = Math.round((WIDTH - size.width) / 2), top = Math.round((HEIGHT - size.height) / 2);
  const webp = await encodeLossyWebp(sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, left, top }]), { alphaQuality: ARTWORK_ALPHA_QUALITY });
  const x = Math.max(0, left - SUBJECT_PADDING), y = Math.max(0, top - SUBJECT_PADDING);
  return { webp, subject: { left: x, top: y, width: Math.min(WIDTH, left + size.width + SUBJECT_PADDING) - x, height: Math.min(HEIGHT, top + size.height + SUBJECT_PADDING) - y },
    preparation: `Clear the near-black matte (alpha below ${MATTE_ALPHA}, RGB at most ${MATTE_RGB}), trim the transparent margin, fit inside ${ARTWORK_BOX.join('x')} without upscaling, centre on a transparent ${WIDTH}x${HEIGHT} frame, encode WebP quality ${LOSSY_WEBP.quality} (lossy lane) with alpha quality ${ARTWORK_ALPHA_QUALITY}.` };
}

await fs.mkdir(output, { recursive: true });
const entries = [];
for (const entry of selected) {
  const source = await original(entry);
  const prepared = entry.kind === ARTWORK ? await artwork(entry, source) : await photograph(entry, source);
  const check = await sharp(prepared.webp).metadata();
  if (check.width !== WIDTH || check.height !== HEIGHT) throw new Error(`Prepared image is the wrong size: ${entry.id} is ${check.width}x${check.height}, frame ${WIDTH}x${HEIGHT}`);
  await fs.writeFile(path.join(output, `${entry.id}.webp`), prepared.webp);
  entries.push({ id: entry.id, path: `images/${entry.id}.webp`, url: `/shell/facility-renders/${entry.id}.webp`,
    width: WIDTH, height: HEIGHT, displayWidth: WIDTH / 2, displayHeight: HEIGHT / 2,
    composition: { scale: 1, offsetXCssPixels: 0 }, bytes: prepared.webp.length,
    ...('subject' in prepared ? { subject: prepared.subject } : {}),
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: `artwork-photo-${entry.id}`, role: 'artwork',
      evidence: `site/source/facilities/photograph-records.json#/${pinned.indexOf(entry)}` }] },
    source: { id: entry.id, url: entry.url, sourcePage: entry.sourcePage, credit: entry.credit,
      license: entry.license, bytes: entry.bytes, kind: entry.kind, preparation: prepared.preparation } });
  console.log(entry.id, prepared.webp.length, 'bytes');
}
// Photographs live in the one facility render library, so `imageId` resolves the
// same way whether a facility was rendered from a model or photographed.
const libraryPath = path.join(root, 'site/source/facilities/render-library.json');
const library = JSON.parse(await fs.readFile(libraryPath, 'utf8')) as { entries: { id: string }[] };
const prepared = new Map(entries.map(entry => [entry.id, entry]));
library.entries = [...library.entries.filter(entry => !prepared.has(entry.id)), ...entries]
  .sort((a, b) => a.id.localeCompare(b.id));
await fs.writeFile(libraryPath, JSON.stringify(library, null, 2) + '\n');
console.log(`Library now holds ${library.entries.length} facility images.`);
