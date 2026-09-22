#!/usr/bin/env node
/** Build the shared-query ledger from committed Peppi+pdr archive-final programs and their exact records. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { parseProductRecord } from '../product-record.mts';
import { PDS_ARCHIVE_FINAL_SCHEMA, PDS_PROGRAMS } from './archive-final.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const PDS_LEDGER_SCHEMA = 'cssearth-pds-ledger@1';

export async function buildPdsLedger() {
  const names = (await readdir(PDS_PROGRAMS).catch(() => [])).filter(name => name.endsWith('.archive-final.json')).sort();
  const modes = new Map<string, { telescope: string; mode: string; programs: string[]; qualified: string[]; receipts: string[] }>();
  const objects = new Map<string, { id: string; observations: Record<string, unknown>[] }>();
  const searched = new Set<string>();
  const searchResults: { target: string; registryProducts: number; admittedProducts: number; rejected: { lidvid: string; reason: string }[]; scope: unknown }[] = [];
  const harvestDates: string[] = [];
  const discoveryPath = resolve(ROOT, 'data/pds/discovery.json');
  const discovery = await readFile(discoveryPath, 'utf8').then(text => requireRecord(JSON.parse(text) as unknown, 'PDS discovery')).catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  });
  if (discovery) {
    const searches = discovery.schema === 'cssearth-pds-discovery@2' ? requireArray(discovery.searches, 'PDS discovery searches')
      : discovery.schema === 'cssearth-pds-discovery@1' ? [discovery]
      : (() => { throw new TypeError('Unsupported PDS discovery schema.'); })();
    for (const rawSearch of searches) {
      const search = requireRecord(rawSearch, 'PDS discovery search');
      const target = requireRecord(search.target, 'PDS discovery target'), targetId = requireString(target.id, 'PDS target id');
      searched.add(targetId);
      harvestDates.push(requireString(search.searchedAt, 'PDS search date').slice(0, 10));
      const discoveredObservations = requireArray(search.observations, 'PDS discovered observations');
      const rejected = (search.rejected === undefined ? [] : requireArray(search.rejected, 'PDS rejected products')).map(raw => { const row = requireRecord(raw, 'PDS rejected product'); return {
        lidvid: requireString(row.lidvid, 'PDS rejected lidvid'), reason: requireString(row.reason, 'PDS rejection reason') }; });
      searchResults.push({ target: targetId, registryProducts: Number(search.registryProducts ?? discoveredObservations.length + rejected.length),
        admittedProducts: discoveredObservations.length, rejected, scope: search.scope });
      for (const raw of discoveredObservations) {
        const observation = requireRecord(raw, 'PDS discovered observation'), telescope = requireString(observation.telescope, 'PDS telescope'), mode = requireString(observation.mode, 'PDS mode');
        const key = `${telescope} :: ${mode}`;
        if (!modes.has(key)) modes.set(key, { telescope, mode, programs: [], qualified: [], receipts: [] });
        const object = objects.get(targetId) ?? { id: targetId, observations: [] };
        object.observations.push({ ...observation }); objects.set(targetId, object);
      }
    }
  }
  for (const name of names) {
    const program = requireRecord(JSON.parse(await readFile(resolve(PDS_PROGRAMS, name), 'utf8')) as unknown, name);
    if (program.schema !== PDS_ARCHIVE_FINAL_SCHEMA) throw new TypeError(`${name} has the wrong PDS program schema.`);
    const id = requireString(program.id, 'program id'), target = requireString(program.target, 'program target'), telescope = requireString(program.telescope, 'program telescope'),
      mode = requireString(program.mode, 'program mode'), files = requireArray(program.files, 'program files').map(entry => requireRecord(entry, 'program file')),
      observation = requireRecord(program.observation, 'program observation'), discovery = requireRecord(program.discovery, 'program discovery');
    harvestDates.push(requireString(discovery.harvestIso, 'registry harvest').slice(0, 10));
    const receipt = `tools/objects/pds/programs/${id}.archive-final.product.json`;
    const record = parseProductRecord(JSON.parse(await readFile(resolve(ROOT, receipt), 'utf8')) as unknown);
    const selection = requireRecord(record.parameters.selection, 'PDS selection'), science = files.find(file => file.role === 'science');
    const qualified = record.telescope === telescope && record.stage === 'archive-final' && selection.program === id && selection.target === target && selection.lidvid === program.lidvid
      && files.every(file => record.inputs.some(input => input.identity === file.uri && input.bytes === file.bytes)
        && record.outputs.some(output => output.path === file.name && output.bytes === file.bytes))
      && Boolean(science && record.evidence.some(evidence => evidence.kind === 'archive-origin' && evidence.receipt === receipt && evidence.product === science.name));
    const key = `${telescope} :: ${mode}`, modeEntry = modes.get(key) ?? { telescope, mode, programs: [], qualified: [], receipts: [] };
    if (!modeEntry.programs.includes(id)) modeEntry.programs.push(id); if (!modeEntry.receipts.includes(receipt)) modeEntry.receipts.push(receipt);
    if (qualified && !modeEntry.qualified.includes(id)) modeEntry.qualified.push(id); modes.set(key, modeEntry);
    const object = objects.get(target) ?? { id: target, observations: [] };
    const lidvid = requireString(program.lidvid, 'program lidvid');
    object.observations = object.observations.filter(existing => existing.lidvid !== lidvid);
    object.observations.push({ id: requireString(observation.id, 'observation id'), lidvid,
      targetLid: requireString(program.targetLid, 'program target lid'), targetName: requireString(program.targetName, 'program target name'), telescope, mode,
      observatory: requireString(program.archiveTelescope, 'program archive telescope'), instrument: requireString(program.instrument, 'program instrument'),
      startIso: requireString(observation.startIso, 'observation start'), endIso: requireString(observation.stopIso, 'observation stop'),
      filter: requireString(observation.filter, 'observation filter'), filters: requireArray(observation.filters ?? [observation.filter], 'observation filters'),
      wavelengthIntervalsMicrometres: requireArray(observation.wavelengthIntervalsMicrometres ?? [observation.wavelengthIntervalMicrometres], 'observation wavelength intervals'),
      ...(observation.wavelengthIntervalMicrometres === undefined ? {} : { wavelengthIntervalMicrometres: requireArray(observation.wavelengthIntervalMicrometres, 'observation wavelength interval') }),
      ...(observation.surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm: observation.surfaceResolutionKm }), kind: program.kind, use: program.use,
      units: observation.units, program: id });
    objects.set(target, object);
  }
  return { schema: PDS_LEDGER_SCHEMA, archiveDate: harvestDates.sort().at(-1) ?? 'unknown', searched: [...searched].sort(), searches: searchResults,
    modes: [...modes.values()], objects: [...objects.values()] } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ledger = await buildPdsLedger(), json = `${JSON.stringify(ledger, null, 2)}\n`;
  if (process.argv.includes('--write')) { await writeFile(resolve(ROOT, 'data/pds/ledger.json'), json); }
  else process.stdout.write(json);
}
