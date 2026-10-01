import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import { readInventory, updateInventory } from '@cssearth/objects/node';
import { writeLossyWebp } from '../raster/index.ts';
import { WORLD_BILLBOARD_SIZE, worldBillboardFilename } from '../world-context/index.ts';

/** A body's world billboard: its own arrival photograph at `WORLD_BILLBOARD_SIZE` pixels, `/scenes/<id>/<id>-billboard.webp`,
 * recorded in its inventory. The world draws every body but its focus with it (`summary.ts`), so a body with an arrival
 * photograph and no billboard stops the deploy build ("No published asset hash"): the arrival bake writes both. Returns
 * what it did; a body without a photograph of its own has no billboard. */
export async function writeWorldBillboard(root: string, id: string): Promise<'written' | 'current' | 'none'> {
  const directory = resolve(root, 'public/scenes', id), objectDirectory = resolve(root, 'src/objects', id);
  const own = `${id}-arrival.webp`, filename = worldBillboardFilename(id), target = resolve(directory, filename);
  const inventory = await readInventory(id, objectDirectory);
  const photograph = inventory?.assets.find(asset => asset.location === 'public' && asset.filename === own);
  if (!inventory || !photograph) return 'none';
  const listed = inventory.assets.find(asset => asset.location === 'public' && asset.filename === filename);
  const current = await readFile(target).catch(() => null);
  if (listed && current && current.length === listed.bytes && sha256(current) === listed.sha256) return 'current';
  const source = resolve(directory, own);
  const bytes = await writeLossyWebp(sharp(await readFile(source).catch(() => {
    throw new Error(`${id}: its arrival photograph ${source} is missing; restore it with setup-assets before preparing its world billboard.`);
  })).resize(WORLD_BILLBOARD_SIZE, WORLD_BILLBOARD_SIZE, { kernel: 'lanczos3' }), target);
  const assets = inventory.assets.filter(asset => asset.location === 'public' && asset.filename !== filename);
  assets.push({ location: 'public', filename, bytes: bytes.length, sha256: sha256(bytes) });
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets });
  return 'written';
}
