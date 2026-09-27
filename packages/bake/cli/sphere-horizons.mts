/**
 * Write the two JPL Horizons tables a ground-based lens's cameras are derived from, for exactly its frames. The queries
 * and the writers are in `@cssearth/bake/objects/layers/terrestrial`.
 *
 *   node packages/bake/cli/sphere-horizons.mts <object-id>          fetch both tables and report them without writing
 *   node packages/bake/cli/sphere-horizons.mts <object-id> --write  write them where the observer-cameras record names them and pin them in the manifest
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHdu } from '@cssearth/fits';
import { BATCH, horizonsCommand, horizonsTables, loadObserverCameraInputs, writeHorizonsOperations, writeHorizonsTables, zimpolExposure } from '@cssearth/bake/objects/layers/terrestrial';

const ROOT = resolve(import.meta.dirname, '../../..');

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [objectId, flag, ...rest] = process.argv.slice(2);
  if (!objectId || rest.length || (flag !== undefined && flag !== '--write')) { console.error('usage: node packages/bake/cli/sphere-horizons.mts <object-id> [--write]'); process.exit(2); }
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
