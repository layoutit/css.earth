/** Materialize a pinned WWT TAN imageset as one static, CSS-preparation-ready PNG. */
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parseWwtCatalogLines, type WwtImageSet } from './wwt-catalog.mts';

const TILE_SIZE = 256;
export const WWT_IMAGE_MAX_LEVEL = 3; // 64 tiles, 2048 x 2048 pixels at most.
const MAX_TILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
};

function tileUrl(template: string, level: number, x: number, y: number): string {
  if (!/^https?:\/\//u.test(template) ||
      (template.match(/\{1\}/gu) ?? []).length !== 1 ||
      (template.match(/\{2\}/gu) ?? []).length !== 1 ||
      (template.match(/\{3\}/gu) ?? []).length !== 1 ||
      /\{[^}]*\}/u.test(template.replaceAll('{1}', '').replaceAll('{2}', '').replaceAll('{3}', '')))
    throw new TypeError('This WWT tile URL is not a supported level/x/y template.');
  const url = new URL(template.replace('{1}', String(level)).replace('{2}', String(x)).replace('{3}', String(y)));
  // The catalog contains historical HTTP templates; use the same host over HTTPS for acquisition.
  url.protocol = 'https:';
  return url.href;
}

async function boundedBytes(response: Response, url: string): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error(`WWT tile request failed (${response.status}): ${url}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_TILE_BYTES) throw new Error(`WWT tile exceeds the byte limit: ${url}`);
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > MAX_TILE_BYTES) { await response.body.cancel().catch(() => {}); throw new Error(`WWT tile exceeds the byte limit: ${url}`); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

export interface WwtImageReceipt {
  readonly schema: 'cssearth-wwt-image@1'; readonly catalogRevision: string;
  readonly target: string; readonly imageset: WwtImageSet; readonly level: number;
  readonly output: { readonly path: 'image.png'; readonly width: number; readonly height: number; readonly bytes: number; readonly sha256: string };
  readonly tiles: readonly { readonly x: number; readonly y: number; readonly url: string; readonly bytes: number; readonly sha256: string }[];
}

export async function exportWwtImage(root: string, explorationPath: string, pick: number, level: number, outputDirectory: string,
  request: (url: string) => Promise<Response> = url => fetch(url, { signal: AbortSignal.timeout(20_000) })):
  Promise<{ readonly image: string; readonly receipt: string; readonly value: WwtImageReceipt }> {
  if (!Number.isSafeInteger(pick) || pick < 1) throw new TypeError('--pick must be a positive WWT image number.');
  if (!Number.isSafeInteger(level) || level < 0 || level > WWT_IMAGE_MAX_LEVEL) throw new TypeError(`--level must be between 0 and ${WWT_IMAGE_MAX_LEVEL}.`);
  const saved = object(JSON.parse(await readFile(explorationPath, 'utf8')), 'saved exploration');
  if (saved.schema !== 'cssearth-telescope-exploration@1') throw new TypeError('Expected a saved Telescope exploration.');
  if (typeof saved.target !== 'string' || !saved.target) throw new TypeError('Saved exploration target is missing.');
  const answer = object(saved.answer, 'exploration answer');
  const curated = object(answer.curatedImagery, 'curated imagery');
  if (curated.state !== 'indexed' || !Array.isArray(curated.matches) || pick > curated.matches.length)
    throw new TypeError('The saved exploration has no WWT image at that number.');
  const selected = object(curated.matches[pick - 1], 'selected WWT image');
  const catalog = parseWwtCatalogLines(await readFile(resolve(root, 'data/wwt/core-imagesets.jsonl'), 'utf8'));
  if (curated.revision !== catalog.source.revision) throw new TypeError('The saved WWT catalog revision differs from this checkout.');
  const imageset = catalog.imagesets.find(row => row.sourceFile === selected.sourceFile && row.name === selected.name && row.urlTemplate === selected.urlTemplate);
  if (!imageset || JSON.stringify(imageset.position) !== JSON.stringify(selected.position)) throw new TypeError('The saved WWT image differs from the pinned catalog.');
  if (imageset.projection !== 'Tan' || imageset.position.bottomsUp || imageset.dataSetType !== 'Sky')
    throw new TypeError('Static WWT image export currently supports top-down TAN sky imagesets.');
  if (level > imageset.position.tileLevels) throw new TypeError('The requested level is beyond this WWT imageset.');
  const destination = resolve(outputDirectory), parent = dirname(destination);
  try { await lstat(destination); throw new TypeError('Output directory already exists; choose a new --out directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const side = 1 << level, width = side * TILE_SIZE;
  const tiles: WwtImageReceipt['tiles'][number][] = [], layers: { input: Buffer; left: number; top: number }[] = [];
  let total = 0;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const url = tileUrl(imageset.urlTemplate, level, x, y);
    const bytes = await boundedBytes(await request(url), url);
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new Error('WWT tile transfer exceeds the total byte limit.');
    const metadata = await sharp(bytes, { limitInputPixels: TILE_SIZE * TILE_SIZE }).metadata();
    if (metadata.format !== 'png' || metadata.width !== TILE_SIZE || metadata.height !== TILE_SIZE)
      throw new TypeError(`WWT tile must be a ${TILE_SIZE} × ${TILE_SIZE} PNG: ${url}`);
    tiles.push({ x, y, url, bytes: bytes.length, sha256: digest(bytes) });
    layers.push({ input: bytes, left: x * TILE_SIZE, top: y * TILE_SIZE });
  }
  const png = await sharp({ create: { width, height: width, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();
  const value: WwtImageReceipt = { schema: 'cssearth-wwt-image@1', catalogRevision: catalog.source.revision,
    target: saved.target, imageset, level,
    output: { path: 'image.png', width, height: width, bytes: png.length, sha256: digest(png) }, tiles };
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(resolve(parent, '.wwt-image-'));
  try {
    await writeFile(resolve(temporary, 'image.png'), png);
    await writeFile(resolve(temporary, 'source.json'), `${JSON.stringify(value, null, 2)}\n`);
    await rename(temporary, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return { image: resolve(destination, 'image.png'), receipt: resolve(destination, 'source.json'), value };
}
