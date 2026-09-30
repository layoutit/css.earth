/**
 * Write the two JPL Horizons tables a ground-based dataset's cameras are derived from, for exactly its frames
 * (`packages/bake/cli/sphere-horizons.mts` fetches, reports and writes them).
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
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFitsHdu } from '@cssearth/fits';
import { requireArray, requireRecord } from '@cssearth/core';
import { HORIZONS_API, horizonsCommand, horizonsRefreshOperations } from './horizons-tables.ts';
import { loadObserverCameraInputs, zimpolExposure } from './observer-cameras.ts';

/** The checkout, found through this package's own name so the path holds from the sources and from `dist/`. */
const ROOT = resolve(dirname(createRequire(import.meta.url).resolve('@cssearth/bake/package.json')), '../..');
/** A dataset's two refresh steps in its acquisition plan, replacing any it had for those paths. */
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
/** A manifest input for a table this tool wrote; `node site/build/prepare/author-source-records.mts` adds its source binding. */
export function tableInput(objectId: string, kind: keyof typeof TABLES, path: string, bytes: Uint8Array) {
  return { id: `${objectId}-${TABLES[kind].suffix}`, path, origin: HORIZONS_API, credit: 'NASA/JPL-Caltech, Solar System Dynamics: JPL Horizons',
    license: 'Public ephemeris service output; cite JPL Horizons.',
    acquisition: 'Response from the JPL Horizons API for this target and observer code 309, Paranal, written by packages/bake/cli/sphere-horizons.mts.',
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
