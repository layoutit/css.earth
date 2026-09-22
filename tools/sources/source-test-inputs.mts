/** The same catalogue assertions run against published records on PRs and reproduced packages in authoring
 * audits. This selects real inputs, never suppresses assertions or invents prepared data. */
import { relative, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { prepareFacilities } from '../prepare/prepare-facilities.mts';
import { prepareVolumeProvenance, readPreparedVolumeProvenance } from '../prepare/prepare-volume-provenance.mts';
import { prepareContextProvenance } from '../prepare/prepare-context-provenance.mts';
import { readPreparedContextProvenance } from '../prepared/read-prepared-context-provenance.mts';
import { SCENE_OBJECTS } from '../../site/objects.mts';

/** Every prepared file an inventory restores from R2 (`src/objects/<id>/prepared/<filename>`): nothing under prepared/ is tracked. */
export async function inventoriedPreparedPaths(root = process.cwd()): Promise<string[]> {
  const paths: string[] = [];
  for (const folder of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const text = await readFile(resolve(root, 'src/objects', folder.name, 'inventory.json'), 'utf8').catch(() => null);
    if (text === null) continue;
    const inventory = JSON.parse(text) as { assets?: { location: string; filename: string }[] };
    for (const asset of inventory.assets ?? []) if (asset.location === 'prepared') paths.push(`src/objects/${folder.name}/prepared/${asset.filename}`);
  }
  return paths;
}

/** Each body's page.json is written from its restored runtime by prepare:object-json and is never tracked. */
const bodyPages = () => SCENE_OBJECTS.map(object => `src/objects/${object.id}/prepared/page.json`);

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
    return [...bodyPages(), ...packages.flatMap(({ base }) => ['provenance.json', 'presentation.json'].map(file => `${base}/prepared/${file}`))];
  }
  return [...bodyPages(), ...[...await prepareVolumeProvenance(), ...await prepareContextProvenance()].flatMap(volume =>
    volume.outputs.map(output => relative(process.cwd(), output.path)))];
}
