#!/usr/bin/env node
/** What JWST coronagraphy the public archive holds: every public level-3 NIRCam coronagraph observation in MAST, by target,
 * with the band this toolkit would pin it as.
 *
 *   node tools/objects/jwst/imaging/coronagraphy-survey.mts [--associations] [--json <path>]
 *
 * Read only. Each observation's band is resolved the way archive.mts resolves it, from the filter list and the occulter in
 * the observation's name; an observation whose name carries no occulter (full-frame coronagraphy) is listed as unpinnable by
 * name. With --associations each observation's coron3 association is read too: how many science rolls and PSF reference
 * exposures it names and how many bytes they are, which is what coron3.mts would download. That is one archive request per
 * observation, six at a time. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { MAST_CACHE, mastFile, mastRequest, type MastFile } from '../mast.mts';
import { bandOfFilters } from './archive.mts';

export interface SurveyedObservation {
  readonly observation: string; readonly target: string; readonly programme: string; readonly filters: string;
  /** The band id, or why the observation cannot be pinned by name. */
  readonly band: string | null; readonly reason?: string;
  readonly science?: number; readonly references?: number; readonly bytes?: number;
}

export async function surveyCoronagraphy(options: { associations?: boolean } = {}): Promise<SurveyedObservation[]> {
  const rows = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'obsid,obs_id,target_name,filters,proposal_id,dataRights',
    filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'instrument_name', values: ['NIRCAM/CORON'] }, { paramName: 'calib_level', values: [3] }] } });
  const observations = rows.filter(row => row.dataRights === 'PUBLIC').map(row => {
    const observation = requireString(row.obs_id), filters = requireString(row.filters);
    let band: string | null = null, reason: string | undefined;
    try { band = bandOfFilters('NIRCAM', filters, observation).id; } catch (error) { reason = error instanceof Error ? error.message : String(error); }
    return { obsid: String(row.obsid), entry: { observation, target: requireString(row.target_name), programme: String(row.proposal_id), filters, band, ...(reason ? { reason } : {}) } };
  }).sort((a, b) => a.entry.observation.localeCompare(b.entry.observation, 'en'));
  if (!options.associations) return observations.map(({ entry }) => entry);
  const results: SurveyedObservation[] = new Array(observations.length), queue = observations.map((value, index) => ({ ...value, index }));
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const products = await mastRequest({ service: 'Mast.Caom.Products', format: 'json', params: { obsid: next.obsid } });
      const association = products.find(p => p.productSubGroupDescription === 'ASN' && p.calib_level === 3 && /_coron3_\d+_asn\.json$/u.test(requireString(p.productFilename)));
      if (!association) { results[next.index] = { ...next.entry, science: 0, references: 0, bytes: 0 }; continue; }
      const asnFile: MastFile = { name: requireString(association.productFilename), uri: requireString(association.dataURI), bytes: requireFiniteNumber(association.size) };
      const asn = requireRecord(JSON.parse(await readFile(await mastFile(asnFile, MAST_CACHE), 'utf8')) as unknown, 'Association');
      const members = requireArray(requireRecord(requireArray(asn.products)[0]).members).map(value => requireRecord(value));
      const named = new Set(members.filter(member => member.exptype === 'science' || member.exptype === 'psf').map(member => requireString(member.expname)));
      results[next.index] = { ...next.entry, science: members.filter(member => member.exptype === 'science').length, references: members.filter(member => member.exptype === 'psf').length,
        bytes: products.filter(p => named.has(requireString(p.productFilename))).reduce((total, p) => total + requireFiniteNumber(p.size), 0) };
    }
  }));
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), jsonIndex = args.indexOf('--json');
  const survey = await surveyCoronagraphy({ associations: args.includes('--associations') });
  const targets = new Map<string, SurveyedObservation[]>();
  for (const entry of survey) targets.set(entry.target, [...targets.get(entry.target) ?? [], entry]);
  for (const [target, entries] of [...targets].sort((a, b) => b[1].length - a[1].length))
    console.log(`${target.padEnd(28)} ${String(entries.length).padStart(3)}  ${[...new Set(entries.map(entry => entry.programme))].join(',').padEnd(10)} ${[...new Set(entries.map(entry => entry.band ?? `(${entry.filters})`))].join(' ')}`);
  const pinnable = survey.filter(entry => entry.band), bytes = survey.reduce((total, entry) => total + (entry.bytes ?? 0), 0);
  console.log(`CORONAGRAPHY_SURVEY ${JSON.stringify({ observations: survey.length, targets: targets.size, pinnableByName: pinnable.length, bands: new Set(pinnable.map(entry => entry.band)).size,
    ...(args.includes('--associations') ? { withReferences: survey.filter(entry => (entry.references ?? 0) > 0).length, gigabytes: +(bytes / 1e9).toFixed(1) } : {}) })}`);
  if (jsonIndex >= 0) await writeFile(resolve(args[jsonIndex + 1]!), `${JSON.stringify(survey, null, 1)}\n`);
}
