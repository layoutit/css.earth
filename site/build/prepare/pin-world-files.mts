/**
 * Pins the world's per-object files into each object's inventory. The world step writes them into many packages: each
 * object's bodies (`prepared/members.json`), the places of its children's systems (`prepared/places.json`) and its system
 * views (`prepared/views/`). Each package's inventory rows for those files are replaced by what the bake left on disk; every
 * other row stays as it is.
 *
 * Usage: node site/build/prepare/pin-world-files.mts
 */
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inventoryPreparedSubset, readInventory } from '@cssearth/objects/node';

const objects = resolve(import.meta.dirname, '../../../src/objects');
const worldFile = (name: string) => name === 'members.json' || name === 'places.json' || name.startsWith('views/');
let changed = 0, held = 0;
for (const entry of await readdir(objects, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const objectId = entry.name, objectDirectory = resolve(objects, objectId);
  const before = JSON.stringify(((await readInventory(objectId, objectDirectory))?.assets ?? []).filter(asset => asset.location === 'prepared' && worldFile(asset.filename)));
  const after = JSON.stringify(((await inventoryPreparedSubset({ objectId, objectDirectory, owns: worldFile }))?.assets ?? []).filter(asset => asset.location === 'prepared' && worldFile(asset.filename)));
  if (after !== '[]') held++;
  if (before !== after) changed++;
}
console.log(`Pinned the world files of ${held} packages; ${changed} inventories changed.`);
