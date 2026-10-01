#!/usr/bin/env node
/** The world's billboard of each body: its arrival photograph at `WORLD_BILLBOARD_SIZE` pixels
 * (`/scenes/<id>/<id>-billboard.webp`). The world draws every body that is not its focus at a few to a hundred CSS pixels,
 * so the 1024-pixel arrival photograph cost 28 KB and 4 MB decoded per body (2026-10-01); the arrival keeps its own. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import { writeLossyWebp } from '@cssearth/bake/raster';
import { WORLD_BILLBOARD_SIZE, worldBillboardFilename } from '@cssearth/bake/world-context';
import { readInventory, readPreparedObjects, updateInventory } from '@cssearth/objects/node';

const root = resolve(import.meta.dirname, '../../..');
const objects = readPreparedObjects(root).sceneObjects.filter(object => object.discovery?.arrival?.billboard);
let written = 0, kept = 0, borrowed = 0;
for (const object of objects) {
  const directory = resolve(root, 'public/scenes', object.id), objectDirectory = resolve(root, 'src/objects', object.id);
  const filename = worldBillboardFilename(object.id), target = resolve(directory, filename);
  const inventory = await readInventory(object.id, objectDirectory);
  // Only a body's own photograph gets a world billboard; one that borrows another's draws that (summary.ts worldBillboardOf).
  const own = `${object.id}-arrival.webp`, source = resolve(directory, own);
  if (!inventory?.assets.some(asset => asset.location === 'public' && asset.filename === own)) { borrowed++; continue; }
  const listed = inventory.assets.find(asset => asset.location === 'public' && asset.filename === filename);
  const current = await readFile(target).catch(() => null);
  if (listed && current && current.length === listed.bytes && sha256(current) === listed.sha256) { kept++; continue; }
  const photograph = await readFile(source).catch(() => {
    throw new Error(`${object.id}: its arrival photograph ${source} is missing; restore it with setup-assets before preparing world billboards.`);
  });
  const bytes = await writeLossyWebp(sharp(photograph).resize(WORLD_BILLBOARD_SIZE, WORLD_BILLBOARD_SIZE, { kernel: 'lanczos3' }), target);
  const assets = inventory.assets.filter(asset => asset.location === 'public' && asset.filename !== filename);
  assets.push({ location: 'public', filename, bytes: bytes.length, sha256: sha256(bytes) });
  await updateInventory({ objectId: object.id, objectDirectory, location: 'public', assets });
  written++;
}
console.log(`World billboards: ${written} written, ${kept} current, ${borrowed} without a photograph of their own, of ${objects.length} bodies.`);
