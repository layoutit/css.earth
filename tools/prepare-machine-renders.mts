import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from './source-values.mts';

/**
 * Lifts the flat sidebar background out of each approved render so the machine
 * sits on the card itself rather than in a black box. Only edge-connected
 * background pixels are cleared and the artwork's RGB is never touched, the
 * same rule the emblem preparation uses.
 */
const root = path.resolve(import.meta.dirname, '..');
const libraryPath = path.join(root, 'site/source/machines/render-library.json');
const library = requireRecord(JSON.parse(await fs.readFile(libraryPath, 'utf8')));
const background = requireString(library.background);
const rgb = [1, 3, 5].map(index => Number.parseInt(background.slice(index, index + 2), 16));
const TOLERANCE = 10;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

for (const value of requireArray(library.entries)) {
  const entry = requireRecord(value);
  const source = requireRecord(entry.source);
  if (source.kind === 'published-photograph') continue;
  const id = requireString(entry.id);
  const file = path.join(root, 'public', requireString(entry.url));
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const original = Buffer.from(data);
  const { width, height } = info;
  const isBackground = (n: number) => rgb.every((channel, index) => Math.abs(data[n * 4 + index] - channel) <= TOLERANCE);
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 0, cleared = 0;
  const push = (n: number) => { if (!seen[n] && (data[n * 4 + 3] === 0 || isBackground(n))) { seen[n] = 1; queue[tail++] = n; } };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const n = queue[head++], x = n % width, y = Math.floor(n / width);
    if (data[n * 4 + 3]) cleared++;
    data[n * 4 + 3] = 0;
    if (x) push(n - 1);
    if (x + 1 < width) push(n + 1);
    if (y) push(n - width);
    if (y + 1 < height) push(n + width);
  }
  for (let n = 0; n < width * height; n++) for (let c = 0; c < 3; c++) {
    if (data[n * 4 + c] !== original[n * 4 + c]) throw new Error(`Render RGB changed: ${id}`);
  }
  const share = Math.round((cleared * 100) / (width * height));
  if (!cleared) throw new Error(`Render has no background to lift: ${id}`);
  if (share > 97) throw new Error(`Render is almost entirely background: ${id}`);
  const webp = await sharp(data, { raw: { width, height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  await fs.writeFile(file, webp);
  entry.bytes = webp.length;
  entry.sha256 = sha(webp);
  console.log(id.padEnd(22), `${share}% background lifted`, webp.length, 'bytes');
}
await fs.writeFile(libraryPath, JSON.stringify(library, null, 2) + '\n');
