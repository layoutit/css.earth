import { readVolumePresentationPreviews, readGalaxyBackingSource, parsePreparedGalaxyCatalog, parseObjectDescriptor } from '@cssearth/objects';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { parseDatasetControl } from '../../content/prepared-panel-content.mts';
import { sourceArray, sourceId, sourceObject, sourcePath, sourceText } from '@cssearth/objects/sources';
import { hasErrorCode } from '@cssearth/core';
import { objectThumbnail } from '@cssearth/bake/site-assets';

const root = process.cwd();
const check = process.argv.includes('--check');

const inputs = new Map<string, { path: string; bytes: number }>();
const read = async (path: string) => {
  const bytes = await readFile(resolve(root, path));
  inputs.set(path, { path, bytes: bytes.length });
  return bytes;
};
const json = async (path: string): Promise<unknown> => JSON.parse((await read(path)).toString());
const output = async (path: string, bytes: Uint8Array | string) => {
  const data = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
  if (check) {
    if (!Buffer.from(data).equals(await readFile(resolve(root, path)))) throw new Error(`Stale sidebar thumbnail: ${path}`);
  } else await writeFile(resolve(root, path), data);
};

interface Thumbnail { url2x: string; inputs: string[]; credit: string; sourceUrl: string; }
const images: Record<string, Thumbnail> = {}, defaults: Record<string, string> = {};
// 2x only: every screen reads the 80 px tile for the shared 40 CSS px result slot (no 1x rasters).
const makeThumbnail = async (id: string, dataset: string, bytes: Buffer, evidence: Pick<Thumbnail, 'inputs' | 'credit' | 'sourceUrl'>) => {
  // Preserve the complete prepared image and its display color. Only resample;
  // transparent padding keeps rectangular photographs at their native aspect.
  const tile = await sharp(bytes).resize(80, 80, { fit: 'contain', background: '#00000000', kernel: 'lanczos3' })
    .webp({ lossless: true, effort: 6 }).toBuffer();
  const url2x = `/navigation/focus-${id}-${dataset}@2x.webp`;
  await output(`public${url2x}`, tile);
  images[`${id}/${dataset}`] = { url2x, ...evidence };
};
// An object's own row shows its default dataset's image under the shared framing rule (`@cssearth/bake/site-assets`): the whole
// image inside a margin, faded out before its frame. Dataset rows keep the complete tile above for their round crop.
const makeObjectThumbnail = async (id: string, dataset: string, bytes: Buffer) => {
  const { inputs, credit, sourceUrl } = images[`${id}/${dataset}`]!;
  const url2x = `/navigation/focus-object-${id}@2x.webp`;
  await output(`public${url2x}`, await objectThumbnail(bytes));
  images[id] = { url2x, inputs, credit, sourceUrl };
  defaults[id] = id;
};

if (!check) await mkdir(resolve(root, 'public/navigation'), { recursive: true });
for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const path = `src/objects/${folder.name}/prepared/presentation.json`;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(resolve(root, path), 'utf8')); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
  const presentation = readVolumePresentationPreviews(raw, 'candidate');
  if (presentation === null) continue;
  await read(path);
  const id = sourceId(presentation.objectId), defaultDataset = sourceId(presentation.defaultDataset);
  if (id !== folder.name) throw new Error(`Mismatched sidebar image owner: ${id}`);
  let defaultBytes: Buffer | undefined;
  for (const dataset of sourceArray(presentation.controls, parseDatasetControl)) {
    const expected = `/scenes/${id}/datasets/${dataset.id}.webp`;
    if (!dataset.texture || dataset.texture.url !== expected)
      throw new Error(`${path}: dataset ${dataset.id} texture.url is ${JSON.stringify(dataset.texture?.url ?? null)}; expected ${expected}.`);
    const previewPath = `public${dataset.texture.url}`, bytes = await read(previewPath);
    if (dataset.id === defaultDataset) defaultBytes = bytes;
    await makeThumbnail(id, dataset.id, bytes, { inputs: [path, previewPath],
      credit: dataset.texture.attribution?.label ?? '', sourceUrl: dataset.texture.attribution?.url ?? '' });
  }
  if (!defaultBytes) throw new Error(`Missing default sidebar image: ${id}`);
  await makeObjectThumbnail(id, defaultDataset, defaultBytes);
}

const galaxyCatalogues: string[] = [];
// A galaxy volume's navigation image is its published face-on backing. The old slab textures are no longer
// delivered; using the same backing as the map preserves its existing artwork qualification and source record.
for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const descriptorPath = `src/objects/${folder.name}/object.json`;
  let descriptor: unknown;
  try { descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'))); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
  // The galaxy catalogue is found by what it is; its rows are read below.
  if (sourceObject(descriptor).type === 'galaxy-catalog') galaxyCatalogues.push(folder.name);
  if (sourceObject(descriptor).type !== 'density-volume') continue;
  await read(descriptorPath);
  const id = folder.name, backingPath = `src/objects/${id}/prepared/backing.json`;
  const backing = readGalaxyBackingSource(await json(backingPath));
  const texturePath = `src/objects/${id}/prepared/${sourcePath(sourceObject(backing.leaf).texturePath)}`;
  const recipePath = `src/objects/${id}/source/backing/recipe.json`, recipe = sourceObject(await json(recipePath));
  if (sourceText(backing.source) !== sourceText(recipe.source)) throw new TypeError(`${backingPath}: source differs from its recipe.`);
  const texture = await read(texturePath);
  await makeThumbnail(id, 'volume', texture, { inputs: [descriptorPath, backingPath, texturePath, recipePath],
    credit: sourceText(recipe.meaning), sourceUrl: sourceText(sourceObject(recipe.image).origin) });
  await makeObjectThumbnail(id, 'volume', texture);
}

// Catalogue IDs and detailed package IDs can differ (for example M 31).
for (const id of galaxyCatalogues) {
  const catalogue = parsePreparedGalaxyCatalog(await json(`src/objects/${id}/prepared/catalogue.json`));
  for (const object of sourceArray(catalogue.objects, sourceObject)) {
    if (typeof object.detailedObjectId === 'string' && defaults[object.detailedObjectId])
      defaults[sourceText(object.id)] = defaults[object.detailedObjectId];
  }
}
const manifest = { schema: 'cssearth-sidebar-thumbnails@1', method: 'Complete prepared dataset previews at 80 px for 40 CSS px; Galaxy volumes use their published face-on backing, preserving existing source qualifications. Each object row shows its default image inside a margin, faded out before the image frame.',
  inputs: [...inputs.values()], images, defaults };
await output('public/navigation/sidebar-thumbnails.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`${check ? 'Verified' : 'Prepared'} ${Object.keys(images).length} sidebar images at 80 px.`);
