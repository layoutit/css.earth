// Preparation only: source-validated snapshots are never runtime propagators.
import { readBodyRecords, writeBodyRecord, prepareBodyRecords } from './body-records.mts';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBodyEpochEphemeris } from './body-epoch-ephemeris.mts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const epochJdTt = 2461286.5;
const bodyRecords = await readBodyRecords();
const sources = bodyRecords.filter(record => record.acquisition?.sceneSatellite);
const args = process.argv.slice(2);
const selected = new Set(args.flatMap(arg => {
  if (!/^--object=[a-z][a-z0-9-]*(?:,[a-z][a-z0-9-]*)*$/.test(arg)) throw new Error('Use --object=id[,id].');
  return arg.slice(9).split(',');
}));
for (const id of selected) if (!sources.some(record => record.id === id)) throw new Error(`Unknown source-state satellite: ${id}.`);
const prepared = [];
for (const record of sources.filter(record => !selected.size || selected.has(record.id))) {
  const bodyId = record.id, acquisition = record.acquisition?.sceneSatellite;
  if (!acquisition) throw new TypeError(`Missing source-state acquisition: ${bodyId}.`);
  const { parent: centerBodyId, target, center } = acquisition;
  const bodyRoot = resolve(root, 'src/objects', bodyId);
  const state = await loadBodyEpochEphemeris({ bodyRoot, bodyId, centerBodyId, target, center, epochJdTt });
  // Keep detailed validation receipts in the object source package.
  const provenance: Record<string, unknown> = { ...state.provenance };
  delete provenance.validation;
  prepared.push({ ...record, sceneSatellite: { ...state, provenance } });
}
// Validate the whole selection before replacing any retained record.
for (const record of prepared) await writeBodyRecord(record);
await prepareBodyRecords();
console.log(`Prepared ${prepared.length} source-state satellites at JD${epochJdTt}.`);
