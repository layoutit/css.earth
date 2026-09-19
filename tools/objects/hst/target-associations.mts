#!/usr/bin/env node
/** Verify the HST side of source-backed target-in-field associations against current MAST rows. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireFiniteNumber, requireString } from '../../source-values.mts';
import { parseTargetAssociations, type TargetAssociation } from '../telescopes/target-associations.mts';
import { mastRequest } from '../jwst/mast.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const TARGET_ASSOCIATIONS = resolve(ROOT, 'data/telescopes/target-associations.json');
const MJD_UNIX_EPOCH = 40_587;
const mjdIso = (value: unknown, label: string) => new Date((requireFiniteNumber(value, label) - MJD_UNIX_EPOCH) * 86_400_000).toISOString();

export function verifyHstAssociationRows(association: TargetAssociation, rows: readonly Record<string, unknown>[]) {
  if (association.archive !== 'hst' || association.telescope !== 'Hubble') throw new TypeError(`${association.target}: this is not an HST association.`);
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = requireString(row.obs_id, 'MAST observation id');
    if (byId.has(id)) throw new TypeError(`${id}: MAST returned the observation twice.`);
    byId.set(id, row);
  }
  const expected = new Set(association.observations.map(observation => observation.id));
  for (const id of byId.keys()) if (!expected.has(id)) throw new TypeError(`${association.target}: MAST returned unrequested observation ${id}.`);
  for (const observation of association.observations) {
    const row = byId.get(observation.id);
    if (!row) throw new Error(`${association.target}: MAST did not return ${observation.id}.`);
    const facts = { archiveTarget: requireString(row.target_name, `${observation.id} target`), programme: String(row.proposal_id),
      mode: requireString(row.instrument_name, `${observation.id} mode`), filter: requireString(row.filters, `${observation.id} filter`),
      startIso: mjdIso(row.t_min, `${observation.id} start`), endIso: mjdIso(row.t_max, `${observation.id} end`) };
    const stated = { archiveTarget: association.archiveTarget, programme: association.programme, mode: association.mode,
      filter: observation.filter, startIso: observation.startIso, endIso: observation.endIso };
    for (const key of Object.keys(facts) as (keyof typeof facts)[]) if (facts[key] !== stated[key])
      throw new Error(`${observation.id}: MAST ${key} is ${String(facts[key])}, association states ${String(stated[key])}.`);
  }
  return association.observations.length;
}

export async function verifyHstTargetAssociations(associations: readonly TargetAssociation[]) {
  let verified = 0;
  for (const association of associations.filter(entry => entry.archive === 'hst')) {
    const rows = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: {
      columns: 'obs_id,target_name,proposal_id,instrument_name,filters,t_min,t_max',
      filters: [{ paramName: 'obs_collection', values: ['HST'] }, { paramName: 'dataRights', values: ['PUBLIC'] },
        { paramName: 'obs_id', values: association.observations.map(observation => observation.id) }],
    } });
    verified += verifyHstAssociationRows(association, rows);
  }
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const associations = parseTargetAssociations(JSON.parse(await readFile(TARGET_ASSOCIATIONS, 'utf8')) as unknown);
  console.log(`TARGET_ASSOCIATIONS ${await verifyHstTargetAssociations(associations)} HST observation(s) verified against MAST.`);
}
