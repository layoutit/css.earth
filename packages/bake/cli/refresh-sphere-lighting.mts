/** Rebake only a sphere's lighting atlas from its recipe, without the object's surfaces, geometry or scene: the path for a
 * change in `lighting` of source/preparation/terrestrial.json, such as naming the body's published photometric models.
 * `node packages/bake/cli/refresh-sphere-lighting.mts <body-id>...` rewrites public/scenes/<id>/<id>-lighting.webp and its
 * inventory row; the raw source maps are not read. It refuses a shape-model body, whose lighting is baked into its mesh
 * atlases, and a recipe whose frame layout differs from the prepared material, which needs the full preparation. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { projectRoot, sha256 } from '@cssearth/core/node';
import { parseSolidPreparationSource, prepareSolidLighting } from '@cssearth/bake/objects/layers/terrestrial';
import { readInventory, updateInventory } from '@cssearth/objects/node';

const root = projectRoot(import.meta.url), ids = process.argv.slice(2);
if (!ids.length || ids.some(id => id.startsWith('-'))) throw new TypeError('Usage: refresh-sphere-lighting <body-id>...');
for (const id of ids) {
  const objectDirectory = resolve(root, 'src/objects', id), publicDirectory = resolve(root, 'public/scenes', id), recipePath = resolve(objectDirectory, 'source/preparation/terrestrial.json');
  const config = parseSolidPreparationSource(JSON.parse(await readFile(recipePath, 'utf8')));
  if (config.geometry.radialTerrain) throw new TypeError(`${id}: ${recipePath} has geometry.radialTerrain; a shape-model body bakes its lighting into its mesh atlases and has no lighting atlas to refresh.`);
  const materialPath = resolve(objectDirectory, 'prepared/material.json'), material = requireRecord(JSON.parse(await readFile(materialPath, 'utf8')));
  // The published law's reference color is read from the default dataset's prepared surface, named by the prepared material.
  const surfaces = requireArray(material.surfaces).map(value => { const surface = requireRecord(value); return { id: requireString(surface.id), surface: { url: requireString(requireRecord(surface.surface).url) } }; });
  const lighting = await prepareSolidLighting({ surfaces: surfaces as unknown as Parameters<typeof prepareSolidLighting>[0]['surfaces'], sourceDirectory: resolve(objectDirectory, 'source'), publicDirectory, config });
  if (JSON.stringify(lighting) !== JSON.stringify(material.lighting)) throw new Error(`${id}: the frame layout of ${recipePath} differs from ${materialPath}; run the full preparation.`);
  const filename = `${config.namespace}-lighting.webp`, bytes = await readFile(resolve(publicDirectory, filename));
  const inventory = await readInventory(id, objectDirectory);
  if (!inventory) throw new Error(`${id}: ${objectDirectory}/inventory.json is missing; a body is published before its lighting is refreshed.`);
  const kept = inventory.assets.filter(asset => asset.location === 'public' && asset.filename !== filename).map(asset => ({ filename: asset.filename, bytes: asset.bytes, sha256: asset.sha256 }));
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets: [...kept, { filename, bytes: bytes.length, sha256: sha256(bytes) }] });
  console.log(`${id}: ${filename} ${bytes.length} bytes, ${'limb' in config.lighting ? 'published models' : 'authored sphere law'}.`);
}
