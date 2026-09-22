/** Explicit host boundary; the circumstellar author remains with its canonical owner. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type { EdgeOnReconstruction, EdgeOnSolveInputs } from '../../../../../../../tools/objects/circumstellar/author.mts';

/** The author as the checkout holds it. The lab runner bundles its callers; this loads it unbundled at run time, so the
 * paths it resolves from its own location stay the repository's. */
export const circumstellarAuthor = async (root: string) =>
  await import(pathToFileURL(resolve(root, 'tools/objects/circumstellar/author.mts')).href) as
    typeof import('../../../../../../../tools/objects/circumstellar/author.mts');
