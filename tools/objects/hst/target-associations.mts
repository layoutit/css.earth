#!/usr/bin/env node
/** Resolve the HST target-in-field claims from current MAST observation rows through the pinned Astroquery client. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTargetAssociations, parseTargetAssociationSources, type TargetAssociationSource } from '../telescopes/target-associations.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const TARGET_ASSOCIATIONS = resolve(ROOT, 'data/telescopes/target-associations.json');

export async function verifyHstTargetAssociations(sources: readonly TargetAssociationSource[]) {
  const hst = sources.filter(entry => entry.collection === 'HST');
  const associations = await loadTargetAssociations(hst);
  return { observations: associations.reduce((total, association) => total + association.observations.length, 0),
    astroquery: associations[0]?.astroquery ?? 'not invoked' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sources = parseTargetAssociationSources(JSON.parse(await readFile(TARGET_ASSOCIATIONS, 'utf8')) as unknown);
  const result = await verifyHstTargetAssociations(sources);
  console.log(`TARGET_ASSOCIATIONS ${result.observations} HST observation(s) loaded live from MAST through Astroquery ${result.astroquery}.`);
}
