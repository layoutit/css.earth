import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
/** Explicit host boundary; source data and implementation remain with their canonical owner. */
export { encodeDensityKtx2 } from '@cssearth/bake/density';

/** The encoder loaded from the checkout at run time, for a bundled caller that must keep the repository's own paths. */
export const densityEncoder = async (root: string) =>
  await import(pathToFileURL(resolve(root, 'src/preparation/volume/acquisition.ts')).href) as
    typeof import('@cssearth/bake/density');
