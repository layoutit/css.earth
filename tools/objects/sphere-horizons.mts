/**
 * Write the two JPL Horizons tables a ground-based lens's cameras are derived from, for exactly its frames.
 *
 *   node tools/objects/sphere-horizons.mts <object-id>          fetch both tables and report them without writing
 *   node tools/objects/sphere-horizons.mts <object-id> --write  write them where the observer-cameras record names them and pin them in the manifest
 *
 * The observer table is Paranal (code 309) at each frame's exposure start as the frame's own header states it, the
 * epoch the derivation matches rows by. Its quantities are right ascension and declination, angular diameter, range
 * and range rate, phase angle and phase-angle bisector. The heliocentric table is sampled when the light left the
 * body: the start less the light time over the observer range. Its epochs are read on Horizons' own time scale for
 * vectors, as the first pinned tables were. Horizons answers a time list longer than 25 epochs with an error, so the
 * epochs go in batches and one table is written with every row in order. The acquisition plan gets one refresh step per
 * table holding those exact queries, so the tables can be asked for again and their rows compared.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@cssearth/core/node';
import { readFitsHdu } from '@cssearth/fits';
import { requireArray, requireRecord } from '@cssearth/core';
import { BATCH, HORIZONS_API, horizonsCommand, horizonsRefreshOperations, horizonsTables, loadObserverCameraInputs, zimpolExposure } from '@cssearth/bake/objects/layers/terrestrial';

const ROOT = resolve(import.meta.dirname, '../..');
/** A lens's two refresh steps in its acquisition plan, replacing any it had for those paths. */
export async function writeHorizonsOperations(objectId: string, sourceDirectory: string) {
  const { record, frames } = await loadObserverCameraInputs(sourceDirectory);
  const command = horizonsCommand(JSON.parse(await readFile(resolve(ROOT, 'packages/astronomy/data/bodies', `${objectId}.json`), 'utf8')));
  const starts: number[] = [];
  for (const frame of frames) starts.push(zimpolExposure(readFitsHdu(await readFile(resolve(sourceDirectory, frame.path))).header).startJd);
  const operations = horizonsRefreshOperations(command, starts, await readFile(resolve(sourceDirectory, record.ephemeris.observer), 'utf8'), record.ephemeris);
  const planPath = resolve(sourceDirectory, 'preparation/acquisition.json'), plan = requireRecord(JSON.parse(await readFile(planPath, 'utf8')), 'acquisition plan');
  const paths = operations.map(operation => operation.path);
  plan.operations = [...requireArray(plan.operations, 'acquisition operations').filter(value => !paths.includes(String(requireRecord(value, 'acquisition operation').path))), ...operations];
  await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
  return operations;
}

const TABLES = {
  observer: { suffix: 'horizons-sphere-observer', coverage: 'observer table: right ascension, declination, angular diameter, distance and phase angle for Paranal at each exposure' },
  heliocentric: { suffix: 'horizons-sphere-heliocentric', coverage: 'heliocentric state vectors at the light-time corrected epochs, giving the direction to the Sun' },
} as const;
/** A manifest input for a table this tool wrote; `node tools/sources/author-source-records.mts` adds its source binding. */
export function tableInput(objectId: string, kind: keyof typeof TABLES, path: string, bytes: Uint8Array) {
  return { id: `${objectId}-${TABLES[kind].suffix}`, path, origin: HORIZONS_API, credit: 'NASA/JPL-Caltech, Solar System Dynamics: JPL Horizons',
    license: 'Public ephemeris service output; cite JPL Horizons.',
    acquisition: 'Response from the JPL Horizons API for this target and observer code 309, Paranal, written by tools/objects/sphere-horizons.mts.',
    redistribution: 'Public NASA/JPL output; retain the citation.', consumers: ['sphere-sighting-geometry'], coverage: TABLES[kind].coverage };
}

/** Write both tables; a table the manifest does not name yet is declared. */
export async function writeHorizonsTables(objectId: string, sourceDirectory: string, paths: { observer: string; heliocentric: string }, tables: { observer: string; heliocentric: string }) {
  const manifestPath = resolve(sourceDirectory, 'manifest.json'), manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const inputs = requireArray(manifest.inputs, 'manifest inputs'), declared: string[] = [];
  for (const kind of ['observer', 'heliocentric'] as const) {
    const bytes = Buffer.from(tables[kind]);
    await writeFile(resolve(sourceDirectory, paths[kind]), bytes);
    if (!inputs.map(value => requireRecord(value, 'manifest input')).some(input => input.path === paths[kind])) {
      inputs.push(tableInput(objectId, kind, paths[kind], bytes)); declared.push(paths[kind]);
    }
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return declared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [objectId, flag, ...rest] = process.argv.slice(2);
  if (!objectId || rest.length || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/sphere-horizons.mts <object-id> [--write]'); process.exit(2); }
  const sourceDirectory = resolve(ROOT, 'src/objects', objectId, 'source');
  const { record, frames } = await loadObserverCameraInputs(sourceDirectory);
  const command = horizonsCommand(JSON.parse(await readFile(resolve(ROOT, 'packages/astronomy/data/bodies', `${objectId}.json`), 'utf8')));
  const starts: number[] = [];
  for (const frame of frames) starts.push(zimpolExposure(readFitsHdu(await readFile(resolve(sourceDirectory, frame.path))).header).startJd);
  const tables = await horizonsTables(command, starts);
  console.log(`${objectId}: target '${command}', ${frames.length} frames, ${tables.epochs.length} exposure starts, ${Math.ceil(tables.epochs.length / BATCH)} request(s) per table.`);
  if (flag === '--write') {
    const declared = await writeHorizonsTables(objectId, sourceDirectory, record.ephemeris, tables);
    await writeHorizonsOperations(objectId, sourceDirectory);
    console.log(`Wrote ${record.ephemeris.observer} and ${record.ephemeris.heliocentric}, pinned them in the manifest and wrote their refresh steps; run node tools/sources/pin-object-documents.mts ${objectId}.`);
    if (declared.length) console.log(`Declared ${declared.join(' and ')} as new inputs; run node tools/sources/author-source-records.mts ${objectId} to bind them.`);
  }
}
