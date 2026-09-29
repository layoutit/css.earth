/** The same catalogue assertions run against published records on PRs and reproduced packages in authoring
 * audits. This selects real inputs, never suppresses assertions or invents prepared data. */
import { relative, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { prepareFacilities } from '../../site/build/prepare/prepare-facilities.mts';
import { prepareVolumeProvenance, readPreparedVolumeProvenance } from '../../site/build/prepare/prepare-volume-provenance.mts';
import { prepareContextProvenance, readPreparedContextProvenance } from '@cssearth/bake/sources';
import { CONTEXT_ROUTE } from '../../src/platform/dataset-destination.mts';
import { readPreparedObjects } from '@cssearth/objects/node';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../..')).sceneObjects;

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
export const sourceTestContexts = () => sourceCheckMode() === 'published' ? readPreparedContextProvenance({ route: CONTEXT_ROUTE }) : prepareContextProvenance({ route: CONTEXT_ROUTE });
export const prepareTestFacilities = (options: Parameters<typeof prepareFacilities>[0] = {}) =>
  prepareFacilities({ ...options, packageMode: sourceCheckMode() });

export async function sourceTestGeneratedPaths(mode = sourceCheckMode()): Promise<string[]> {
  sourceCheckMode(mode);
  if (mode === 'published') {
    const packages = [...await readPreparedVolumeProvenance(), ...await readPreparedContextProvenance({ route: CONTEXT_ROUTE })];
    // These are the two metadata records consumed by each reader, not the object's whole asset inventory.
    // A newly introduced runtime, scene or image dependency must still fail the catalogue closure check.
    return [...bodyPages(), ...packages.flatMap(({ base }) => ['provenance.json', 'presentation.json'].map(file => `${base}/prepared/${file}`))];
  }
  return [...bodyPages(), ...[...await prepareVolumeProvenance(), ...await prepareContextProvenance({ route: CONTEXT_ROUTE })].flatMap(volume =>
    volume.outputs.map(output => relative(process.cwd(), output.path)))];
}
