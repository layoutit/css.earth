/** Bake the shared lighting banks (`lighting-banks.ts`) into `public/lighting/<bank>/`, or check the tracked files against a
 * fresh bake; `packages/bake/cli/prepare-lighting-bank.mts` is the command.
 *
 * A body whose raster recipe names a bank copies these files at its own bake instead of encoding them, so this check is what
 * makes the copy honest: the tracked bytes are the bytes the bank's law encodes today. Every bank by default. */
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { LIGHTING_BANKS, LIGHTING_BANK_PRESENTATION_SIZE, LIGHTING_BANK_ROOT } from './lighting-banks.ts';
import { prepareLighting } from './lighting.ts';

/** Encode bank `id` into `directory`: its sheet and its flood-lit frame, from the bank's law and the sheet's layout. */
export async function bakeLightingBank(id: string, directory: string) {
  const bank = LIGHTING_BANKS[id];
  if (!bank) throw new TypeError(`Unknown lighting bank ${id}; banks are ${Object.keys(LIGHTING_BANKS).join(', ')}.`);
  await mkdir(directory, { recursive: true });
  await prepareLighting({ publicBase: `/lighting/${id}/` }, { ...bank, presentationSize: LIGHTING_BANK_PRESENTATION_SIZE }, directory);
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
