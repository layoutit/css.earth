import { sha256 } from '../../src/platform/sha256.mts';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { parseDatasetLens } from '../../site/prepared-panel-content.mts';
import { sourceArray, sourceDigest, sourceId, sourceObject, sourcePath, sourceText } from '../../src/platform/source-catalog.mts';
import { hasErrorCode } from '../sources/source-values.mts';

const root = process.cwd();
const check = process.argv.includes('--check');

const inputs = new Map<string, { path: string; sha256: string; bytes: number }>();
const read = async (path: string, expected?: string) => {
  const bytes = await readFile(resolve(root, path));
  const digest = sha256(bytes);
  if (expected && digest !== expected) throw new Error(`Changed sidebar image input: ${path}`);
  inputs.set(path, { path, sha256: digest, bytes: bytes.length });
  return bytes;
};
const json = async (path: string): Promise<unknown> => JSON.parse((await read(path)).toString());
const output = async (path: string, bytes: Uint8Array | string) => {
  const data = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
  if (check) {
    if (sha256(await readFile(resolve(root, path))) !== sha256(data)) throw new Error(`Stale sidebar thumbnail: ${path}`);
  } else await writeFile(resolve(root, path), data);
};

interface Thumbnail { url: string; url2x: string; sha256: string; sha2562x: string; inputs: string[]; credit: string; sourceUrl: string; }
const images: Record<string, Thumbnail> = {}, defaults: Record<string, string> = {};
const makeThumbnail = async (id: string, lens: string, bytes: Buffer, evidence: Pick<Thumbnail, 'inputs' | 'credit' | 'sourceUrl'>) => {
  const generated = [];
  for (const density of [1, 2]) {
    const size = 16 * density;
    // Preserve the complete prepared image and its display color. Only resample;
    // transparent padding keeps rectangular photographs at their native aspect.
    const tile = await sharp(bytes).resize(size, size, { fit: 'contain', background: '#00000000', kernel: 'lanczos3' })
      .webp({ lossless: true, effort: 6 }).toBuffer();
    const url = `/navigation/focus-${id}-${lens}${density === 2 ? '@2x' : ''}.webp`;
    await output(`public${url}`, tile);
    generated.push({ url, sha256: sha256(tile) });
  }
  images[`${id}/${lens}`] = { url: generated[0].url, url2x: generated[1].url,
    sha256: generated[0].sha256, sha2562x: generated[1].sha256, ...evidence };
};

if (!check) await mkdir(resolve(root, 'public/navigation'), { recursive: true });
for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const path = `src/objects/${folder.name}/prepared/presentation.json`;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(resolve(root, path), 'utf8')); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
  const presentation = sourceObject(raw);
  if (presentation.schema !== 'cssearth-volume-presentation@1') continue;
  await read(path);
  const id = sourceId(presentation.objectId), defaultLens = sourceId(presentation.defaultLens);
  if (id !== folder.name) throw new Error(`Mismatched sidebar image owner: ${id}`);
  for (const lens of sourceArray(presentation.controls, parseDatasetLens)) {
    const match = lens.texture?.url.match(/^\/scenes\/([a-z0-9-]+)\/datasets\/([a-f0-9]{64})\.webp$/u);
    if (!match || match[1] !== id || !lens.texture) throw new Error(`Unpinned sidebar image: ${id}/${lens.id}`);
    const previewPath = `public${lens.texture.url}`;
    await makeThumbnail(id, lens.id, await read(previewPath, match[2]), { inputs: [path, previewPath],
      credit: lens.texture.attribution?.label ?? '', sourceUrl: lens.texture.attribution?.url ?? '' });
  }
  if (!images[`${id}/${defaultLens}`]) throw new Error(`Missing default sidebar image: ${id}`);
  defaults[id] = `${id}/${defaultLens}`;
}

// The Milky Way has a prepared simulation rather than a publisher photograph.
// Composite its existing z slabs face-on, preserving their positions and alpha.
const volumePath = 'src/objects/milky-way/prepared/volume-slices.json';
const volume = sourceObject(await json(volumePath));
const vector = (value: unknown) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(n => typeof n === 'number' && Number.isFinite(n))) throw new TypeError('Invalid prepared slab position');
  return value.map(Number);
};
const bounds = sourceObject(volume.boundsUnits), min = vector(bounds.min), max = vector(bounds.max);
const size = 256, layers: OverlayOptions[] = [], slabInputs = [volumePath];
for (const raw of sourceArray(volume.quads, sourceObject)) {
  if (raw.axis !== 'z' || raw.alphaCoverage === 0) continue;
  const vertices = sourceArray(raw.vertices, vector), upperLeft = vertices[0], lowerRight = vertices[2];
  if (!upperLeft || !lowerRight) throw new TypeError('Incomplete prepared slab');
  const x = (value: number) => Math.round((value - min[0]) / (max[0] - min[0]) * size);
  const y = (value: number) => Math.round((max[1] - value) / (max[1] - min[1]) * size);
  const left = x(upperLeft[0]), top = y(upperLeft[1]);
  const width = x(lowerRight[0]) - left, height = y(lowerRight[1]) - top;
  if (width <= 0 || height <= 0) continue;
  const path = `src/objects/milky-way/prepared/${sourcePath(raw.texturePath)}`;
  const bytes = await read(path, sourceDigest(raw.sha256)); slabInputs.push(path);
  layers.push({ input: await sharp(bytes).resize(width, height).png().toBuffer(), left, top });
}
const milkyWay = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
  .composite(layers).png().toBuffer();
const creditPath = 'src/objects/milky-way/source/provenance.json';
const provenance = sourceObject(await json(creditPath));
await makeThumbnail('milky-way', 'volume', milkyWay, { inputs: [...slabInputs, creditPath], credit: sourceText(provenance.title),
  sourceUrl: sourceText(sourceObject(provenance.license).dataLicenseDeclaration) });
defaults['milky-way'] = 'milky-way/volume';

// Catalogue IDs and detailed package IDs can differ (for example M 31).
const cataloguePath = 'src/objects/local-group/prepared/catalogue.json';
const catalogue = sourceObject(await json(cataloguePath));
for (const object of sourceArray(catalogue.objects, sourceObject)) {
  if (typeof object.detailedObjectId === 'string' && defaults[object.detailedObjectId])
    defaults[sourceText(object.id)] = defaults[object.detailedObjectId];
}
const manifest = { schema: 'cssearth-sidebar-thumbnails@1', method: 'Complete prepared dataset previews at 16/32 px; Milky Way is a face-on composite of prepared z slabs.',
  inputs: [...inputs.values()], images, defaults };
await output('public/navigation/sidebar-thumbnails.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`${check ? 'Verified' : 'Prepared'} ${Object.keys(images).length} sidebar images at 16 and 32 px.`);
