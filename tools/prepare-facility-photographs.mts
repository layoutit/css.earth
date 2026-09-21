import { sha256 } from '../src/platform/sha256.mts';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from './source-values.mts';

/**
 * Prepares the published imagery that stands in for facilities which have no
 * 3D model to render. Acquisition and preparation are explicit
 * maintenance operations; normal builds reuse the committed WebP files.
 */
const root = path.resolve(import.meta.dirname, '..');
const records = path.join(root, 'site/source/facilities/photograph-records.json');
const output = path.join(root, 'public/shell/facility-renders');
const cache = process.env.CSSEARTH_PHOTO_CACHE ?? path.join(root, 'output/facility-photos');
const WIDTH = 592, HEIGHT = 296, BACKGROUND = '#0d0d0d';

interface Pinned {
  readonly id: string; readonly url: string; readonly sourcePage: string;
  readonly credit: string; readonly license: string;
  readonly kind: string; readonly flipX: boolean;
  readonly sha256: string; readonly bytes: number;
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
      flipX: optionalBoolean(entry.flipX, 'flipX'),
      sha256: requireString(entry.sha256), bytes: requireFiniteNumber(entry.bytes) };
  });

async function original(entry: Pinned): Promise<Buffer> {
  const local = path.join(cache, `${entry.id}.jpg`);
  const bytes = await fs.readFile(local).catch(async (error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const response = await fetch(entry.url, { headers: { 'User-Agent': 'cssEarth-provenance/1.0 (https://css.earth)' } });
    if (!response.ok) throw new Error(`Could not acquire ${entry.id}: ${response.status}`);
    const downloaded = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(cache, { recursive: true });
    await fs.writeFile(local, downloaded);
    return downloaded;
  });
  if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Pinned photograph changed: ${entry.id}`);
  return bytes;
}

await fs.mkdir(output, { recursive: true });
const entries = [];
for (const entry of pinned) {
  const source = await original(entry);
  const probe = await sharp(source).metadata();
  if (!probe.width || !probe.height || probe.width < WIDTH || probe.height < HEIGHT) throw new Error(`Photograph is smaller than the frame: ${entry.id}`);
  // Cover the frame from the centre. A photograph has no transparent margin to
  // trim, so it is never upscaled and never letterboxed onto the sidebar.
  const resized = sharp(source).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' });
  const webp = await (entry.flipX ? resized.flop() : resized)
    .flatten({ background: BACKGROUND }).webp({ quality: 90 }).toBuffer();
  const check = await sharp(webp).metadata();
  if (check.width !== WIDTH || check.height !== HEIGHT) throw new Error(`Prepared photograph is the wrong size: ${entry.id}`);
  await fs.writeFile(path.join(output, `${entry.id}.webp`), webp);
  entries.push({ id: entry.id, path: `images/${entry.id}.webp`, url: `/shell/facility-renders/${entry.id}.webp`,
    width: WIDTH, height: HEIGHT, displayWidth: WIDTH / 2, displayHeight: HEIGHT / 2,
    composition: { scale: 1, offsetXCssPixels: 0 }, bytes: webp.length, sha256: sha256(webp),
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: `artwork-photo-${entry.id}`, role: 'artwork',
      evidence: `site/source/facilities/photograph-records.json#/${pinned.indexOf(entry)}` }] },
    source: { id: entry.id, url: entry.url, sourcePage: entry.sourcePage, credit: entry.credit,
      license: entry.license, sha256: entry.sha256, bytes: entry.bytes, kind: entry.kind,
      preparation: `Centre-cover to ${WIDTH}x${HEIGHT} without upscaling${entry.flipX ? ', mirror horizontally' : ''}, flatten onto sidebar ${BACKGROUND}, encode WebP quality 90.` } });
  console.log(entry.id, webp.length, 'bytes');
}
if (entries.length !== pinned.length) throw new Error('Expected one prepared photograph per pinned record.');
// Photographs live in the one facility render library, so `imageId` resolves the
// same way whether a facility was rendered from a model or photographed.
const libraryPath = path.join(root, 'site/source/facilities/render-library.json');
const library = JSON.parse(await fs.readFile(libraryPath, 'utf8')) as { entries: { id: string }[] };
const prepared = new Map(entries.map(entry => [entry.id, entry]));
library.entries = [...library.entries.filter(entry => !prepared.has(entry.id)), ...entries]
  .sort((a, b) => a.id.localeCompare(b.id));
await fs.writeFile(libraryPath, JSON.stringify(library, null, 2) + '\n');
console.log(`Library now holds ${library.entries.length} facility images.`);
