/** The same catalogue assertions run against published records on PRs and reproduced packages in authoring
 * audits. This selects real inputs, never suppresses assertions or invents prepared data. */
import { relative } from 'node:path';
import { prepareFacilities } from './prepare-facilities.mts';
import { prepareVolumeProvenance, readPreparedVolumeProvenance } from './prepare-volume-provenance.mts';
import { prepareContextProvenance } from './prepare-context-provenance.mts';
import { readPreparedContextProvenance } from './read-prepared-context-provenance.mts';

export function sourceCheckMode(value = process.env.CSSEARTH_SOURCE_CHECK_MODE): 'author' | 'published' {
  if (value === undefined || value === 'author') return 'author';
  if (value === 'published') return value;
  throw new TypeError(`Unknown source check mode: ${value}`);
}
export const sourceTestVolumes = () => sourceCheckMode() === 'published' ? readPreparedVolumeProvenance() : prepareVolumeProvenance();
export const sourceTestContexts = () => sourceCheckMode() === 'published' ? readPreparedContextProvenance() : prepareContextProvenance();
export const prepareTestFacilities = (options: Parameters<typeof prepareFacilities>[0] = {}) =>
  prepareFacilities({ ...options, packageMode: sourceCheckMode() });

export async function sourceTestGeneratedPaths(mode = sourceCheckMode()): Promise<string[]> {
  sourceCheckMode(mode);
  if (mode === 'published') {
    const packages = [...await readPreparedVolumeProvenance(), ...await readPreparedContextProvenance()];
    // These are the two metadata records consumed by each reader, not the object's whole asset inventory.
    // A newly introduced runtime, scene or image dependency must still fail the catalogue closure check.
    return packages.flatMap(({ base }) => ['provenance.json', 'presentation.json'].map(file => `${base}/prepared/${file}`));
  }
  return [...await prepareVolumeProvenance(), ...await prepareContextProvenance()].flatMap(volume =>
    volume.outputs.map(output => relative(process.cwd(), output.path)));
}
