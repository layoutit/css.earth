#!/usr/bin/env node
/** Antares authored input: the navigation marker, the scaffold's flat disc in the shared neutral gray, because no image of
 * the photosphere is cast in this package (see the object's investigations.json).
 *
 *   node tools/objects/source-authoring/antares/author.mts [--check] */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neutralDiscMarker } from '../../new-object/scaffold.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/antares/source');
export const CONTEXT_PATH = 'presentation/context.png';
export const CONTEXT_SIZE = 512;

export async function authorAntares({ check = false } = {}) {
  const marker = await neutralDiscMarker(CONTEXT_SIZE);
  const target = resolve(root, CONTEXT_PATH);
  if (check) { if (!(await readFile(target)).equals(marker)) throw new Error(`${CONTEXT_PATH} differs from its authored recomputation.`); }
  else await writeFile(target, marker);
  return { size: CONTEXT_SIZE };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await authorAntares({ check: process.argv.includes('--check') });
  console.log('Antares: neutral disc navigation marker written.');
}
