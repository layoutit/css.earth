#!/usr/bin/env node
/** Antares authored input: the navigation marker, the scaffold's flat disc in the shared neutral gray, because no image of
 * the photosphere is cast in this package (see the object's investigations.json).
 *
 *   node packages/bake/authoring/antares/author.mts [--check] */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { resolve } from 'node:path';
import { runAuthor } from '../authored-output.mts';
import { pathToFileURL } from 'node:url';
import { neutralDiscMarker } from '@cssearth/bake/navigation';

const root = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/antares/source');
export const CONTEXT_PATH = 'presentation/context.png';
export const CONTEXT_SIZE = 512;

export async function authorAntares({ check = false } = {}) {
  return runAuthor({
    root: root, check, readError: 'propagate-read-error', mkdir: 'none',
    compute: async () => {
      const marker = await neutralDiscMarker(CONTEXT_SIZE);
      return { outputs: [[CONTEXT_PATH, marker]], result: { size: CONTEXT_SIZE } };
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await authorAntares({ check: process.argv.includes('--check') });
  console.log('Antares: neutral disc navigation marker written.');
}
