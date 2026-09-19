#!/usr/bin/env node
/** Build the shared-query ledger from committed Peppi+pdr archive-final programs and their exact records. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { parseProductRecord } from '../product-record.mts';
import { PDS_ARCHIVE_FINAL_SCHEMA, PDS_PROGRAMS } from './archive-final.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const PDS_LEDGER_SCHEMA = 'cssearth-pds-ledger@1';

export async function buildPdsLedger() {
  const names = (await readdir(PDS_PROGRAMS).catch(() => [])).filter(name => name.endsWith('.archive-final.json')).sort();
  const modes = new Map<string, { telescope: string; mode: string; programs: string[]; qualified: string[]; receipts: string[] }>();
  const objects = new Map<string, { id: string; observations: Record<string, unknown>[] }>();
  const harvestDates: string[] = [];
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
      && files.every(file => record.inputs.some(input => input.identity === file.uri && input.bytes === file.bytes && input.sha256 === file.sha256)
        && record.outputs.some(output => output.path === file.name && output.bytes === file.bytes && output.sha256 === file.sha256))
      && Boolean(science && record.evidence.some(evidence => evidence.kind === 'archive-origin' && evidence.receipt === receipt && evidence.product === science.name));
    const key = `${telescope} :: ${mode}`, modeEntry = modes.get(key) ?? { telescope, mode, programs: [], qualified: [], receipts: [] };
    modeEntry.programs.push(id); modeEntry.receipts.push(receipt); if (qualified) modeEntry.qualified.push(id); modes.set(key, modeEntry);
    const object = objects.get(target) ?? { id: target, observations: [] };
    object.observations.push({ id: requireString(observation.id, 'observation id'), lidvid: requireString(program.lidvid, 'program lidvid'),
      targetLid: requireString(program.targetLid, 'program target lid'), targetName: requireString(program.targetName, 'program target name'), telescope, mode,
      instrument: requireString(program.instrument, 'program instrument'), startIso: requireString(observation.startIso, 'observation start'),
      endIso: requireString(observation.stopIso, 'observation stop'), filter: requireString(observation.filter, 'observation filter'),
      wavelengthIntervalMicrometres: requireArray(observation.wavelengthIntervalMicrometres, 'observation wavelength interval'), program: id });
    objects.set(target, object);
  }
  return { schema: PDS_LEDGER_SCHEMA, archiveDate: harvestDates.sort().at(-1) ?? 'unknown', modes: [...modes.values()], objects: [...objects.values()] } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ledger = await buildPdsLedger(), json = `${JSON.stringify(ledger, null, 2)}\n`;
  if (process.argv.includes('--write')) { await writeFile(resolve(ROOT, 'data/pds/ledger.json'), json); }
  else process.stdout.write(json);
}
