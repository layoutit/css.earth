import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from './source-values.mts';

/**
 * Records where the subject sits inside each approved render. The renders are
 * a small spacecraft composited on a flat sidebar background, so the card can
 * show that region instead of a field of black. The image bytes are approved
 * artwork and are never rewritten; only the measurement is stored.
 */
const root = path.resolve(import.meta.dirname, '..');
const libraryPath = path.join(root, 'site/source/facilities/render-library.json');
const library = requireRecord(JSON.parse(await fs.readFile(libraryPath, 'utf8')));
const background = requireString(library.background);
const rgb = [1, 3, 5].map(index => Number.parseInt(background.slice(index, index + 2), 16));
const TOLERANCE = 8, PADDING = 6;

const entries = requireArray(library.entries).map(value => requireRecord(value));
for (const entry of entries) {
  const source = requireRecord(entry.source);
  // Published imagery already fills its frame; only composited renders have a field.
  if (requireString(source.kind).startsWith('published-')) { delete entry.subject; continue; }
  const file = path.join(root, 'public', requireString(entry.url));
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  let left = info.width, right = -1, top = info.height, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const n = (y * info.width + x) * info.channels;
    if (info.channels === 4 && data[n + 3] === 0) continue;
    if (rgb.every((channel, index) => Math.abs(data[n + index] - channel) <= TOLERANCE)) continue;
    if (x < left) left = x; if (x > right) right = x;
    if (y < top) top = y; if (y > bottom) bottom = y;
  }
  if (right < left || bottom < top) throw new Error(`Render is entirely background: ${String(entry.id)}`);
  const box = {
    left: Math.max(0, left - PADDING), top: Math.max(0, top - PADDING),
    width: Math.min(info.width, right + PADDING + 1) - Math.max(0, left - PADDING),
    height: Math.min(info.height, bottom + PADDING + 1) - Math.max(0, top - PADDING),
  };
  entry.subject = box;
  console.log(String(entry.id).padEnd(22), `${box.width}x${box.height} at ${box.left},${box.top}`,
    `(${Math.round((box.width * box.height * 100) / (info.width * info.height))}% of the frame)`);
}
await fs.writeFile(libraryPath, JSON.stringify(library, null, 2) + '\n');
