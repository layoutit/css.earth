/** Rebake only a sphere's lighting from its recipe, without the object's surfaces, geometry or scene: the path for a change
 * in `lighting` of source/preparation/terrestrial.json, such as naming the body's published photometric models.
 * `node packages/bake/cli/refresh-sphere-lighting.mts <body-id>...` rewrites the sheet and the flood-lit frame under
 * site/public/scenes/<id>/, the lighting record of prepared/material.json and their inventory rows; the raw source maps are not
 * read. It refuses a shape-model body, whose lighting is baked into its mesh atlases, and a recipe whose frame addresses
 * differ from the prepared material, which needs the full preparation. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { projectRoot, sha256 } from '@cssearth/core/node';
import { refreshPreparedInventory } from '@cssearth/bake/contract';
import { parseSolidPreparationSource, prepareSolidLighting } from '@cssearth/bake/objects/layers/terrestrial';
import { LIGHTING_SHEET } from '@cssearth/bake/raster';
import { readInventory, updateInventory } from '@cssearth/objects/node';

const root = projectRoot(import.meta.url), ids = process.argv.slice(2);
if (!ids.length || ids.some(id => id.startsWith('-'))) throw new TypeError('Usage: refresh-sphere-lighting <body-id>...');
/** What the prepared presentation was compiled from: each frame's address, and the flood-lit frame's. */
const addresses = (value: unknown) => { const lighting = requireRecord(value), shadowless = requireRecord(lighting.shadowless);
  return JSON.stringify([requireRecord(lighting.sheet).presentations, shadowless.backgroundPosition, shadowless.backgroundSize]); };
for (const id of ids) {
  const objectDirectory = resolve(root, 'src/objects', id), publicDirectory = resolve(root, 'site/public/scenes', id), recipePath = resolve(objectDirectory, 'source/preparation/terrestrial.json');
  const config = parseSolidPreparationSource(JSON.parse(await readFile(recipePath, 'utf8')));
  if (config.geometry.radialTerrain) throw new TypeError(`${id}: ${recipePath} has geometry.radialTerrain; a shape-model body bakes its lighting into its mesh atlases and has no lighting to refresh.`);
  const materialPath = resolve(objectDirectory, 'prepared/material.json'), material = requireRecord(JSON.parse(await readFile(materialPath, 'utf8')));
  // The published law's reference color is read from the default dataset's prepared surface, named by the prepared material.
  const surfaces = requireArray(material.surfaces).map(value => { const surface = requireRecord(value); return { id: requireString(surface.id), surface: { url: requireString(requireRecord(surface.surface).url) } }; });
  const lighting = await prepareSolidLighting({ surfaces: surfaces as unknown as Parameters<typeof prepareSolidLighting>[0]['surfaces'], sourceDirectory: resolve(objectDirectory, 'source'), publicDirectory, config });
  if (addresses(lighting) !== addresses(material.lighting)) throw new Error(`${id}: the frame addresses of ${recipePath} differ from ${materialPath}; run the full preparation.`);
  await writeFile(materialPath, `${JSON.stringify({ ...material, lighting })}\n`);
  const inventory = await readInventory(id, objectDirectory);
  if (!inventory) throw new Error(`${id}: ${objectDirectory}/inventory.json is missing; a body is published before its lighting is refreshed.`);
  const files: readonly string[] = [LIGHTING_SHEET.sheetFile, LIGHTING_SHEET.shadowlessFile];
  const kept = inventory.assets.filter(asset => asset.location === 'public' && !files.includes(asset.filename)).map(asset => ({ filename: asset.filename, bytes: asset.bytes, sha256: asset.sha256 }));
  const baked = await Promise.all(files.map(async filename => { const bytes = await readFile(resolve(publicDirectory, filename)); return { filename, bytes: bytes.length, sha256: sha256(bytes) }; }));
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets: [...kept, ...baked] });
  await refreshPreparedInventory(id, root);
  console.log(`${id}: ${baked.map(file => `${file.filename} ${file.bytes} bytes`).join(', ')}, ${config.lighting?.limb ? 'published models' : `bank ${config.lighting?.bank}`}.`);
}
