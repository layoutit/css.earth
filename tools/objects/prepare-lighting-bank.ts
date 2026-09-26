/** Bake the shared lighting banks (packages/bake/src/raster/lighting-banks.ts) into `public/lighting/<bank>/`, or check the
 * tracked files against a fresh bake.
 *
 *   node tools/objects/dist/prepare-lighting-bank.js [--check] [<bank>...]
 *
 * A body whose raster recipe names a bank copies these files at its own bake instead of encoding them, so this check is what
 * makes the copy honest: the tracked bytes are the bytes the recipe encodes today. Every bank by default. */
import './thread-pool.js';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RasterRecipe } from '@cssearth/bake/raster';
import { LIGHTING_BANKS, LIGHTING_BANK_ROOT, prepareLighting } from '@cssearth/bake/raster';

/** Encode bank `id` into `directory`: its rows and billboard. The presentation fields only shape the returned JSON, which a
 * bank has no use for; the bytes come from the bank's own fields. */
export async function bakeLightingBank(id: string, directory: string) {
  const bank = LIGHTING_BANKS[id];
  if (!bank) throw new TypeError(`Unknown lighting bank ${id}; banks are ${Object.keys(LIGHTING_BANKS).join(', ')}.`);
  await mkdir(directory, { recursive: true });
  await prepareLighting({ publicBase: `/lighting/${id}/` } as RasterRecipe,
    { ...bank, presentationSize: bank.frameSize, defaultFrame: 0, bankSchema: `cssearth-lighting-bank-${id}@1`, billboardSchema: `cssearth-lighting-bank-${id}-billboard@1`, metadata: {} }, directory);
  return (await readdir(directory)).filter(name => name.endsWith('.webp')).sort();
}

/** Bake bank `id` afresh and compare it file by file with the tracked bank under `root`. */
export async function checkLightingBank(id: string, root: string) {
  const tracked = resolve(root, LIGHTING_BANK_ROOT, id), scratch = await mkdtemp(resolve(tmpdir(), `cssearth-lighting-${id}-`));
  try {
    const files = await bakeLightingBank(id, scratch), differing: string[] = [];
    for (const file of files) {
      const fresh = await readFile(resolve(scratch, file)), kept = await readFile(resolve(tracked, file)).catch(() => null);
      if (kept === null || !fresh.equals(kept)) differing.push(file);
    }
    const extra = (await readdir(tracked).catch(() => [] as string[])).filter(name => name.endsWith('.webp') && !files.includes(name));
    return { files: files.length, differing: [...differing, ...extra] };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), check = args.includes('--check'), ids = args.filter(arg => arg !== '--check');
  const root = process.cwd();
  for (const id of ids.length ? ids : Object.keys(LIGHTING_BANKS)) {
    if (check) {
      const result = await checkLightingBank(id, root);
      console.log(`${id}: ${result.files} files${result.differing.length ? `, differing: ${result.differing.join(', ')}` : ', tracked bank matches a fresh bake'}`);
      if (result.differing.length) process.exitCode = 1;
    } else {
      const files = await bakeLightingBank(id, resolve(root, LIGHTING_BANK_ROOT, id));
      console.log(`${id}: ${files.length} files baked under ${LIGHTING_BANK_ROOT}/${id}`);
    }
  }
}
