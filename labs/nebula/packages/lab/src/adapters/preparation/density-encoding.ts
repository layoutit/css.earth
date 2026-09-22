import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
/** Explicit host boundary; source data and implementation remain with their canonical owner. */
export { encodeDensityKtx2 } from '../../../../../../../src/preparation/volume/acquisition.ts';

/** The encoder loaded from the checkout at run time, for a bundled caller that must keep the repository's own paths. */
export const densityEncoder = async (root: string) =>
  await import(pathToFileURL(resolve(root, 'src/preparation/volume/acquisition.ts')).href) as
    typeof import('../../../../../../../src/preparation/volume/acquisition.ts');
