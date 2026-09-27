/**
 * Cite each uncited factsheet value from a record the body pins, when the displayed value equals it at the displayed
 * precision. The work is `citePinnedFacts` in `@cssearth/bake/sources`.
 *
 *   node packages/bake/cli/cite-pinned-facts.mts [<object-id>...] [--check] [--prune] [--fetch]
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPreparedObjects } from '@cssearth/objects/node';
import { citePinnedFacts, fetchSatelliteTables, type CitationRun } from '@cssearth/bake/sources';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flags = new Set(process.argv.slice(2).filter(argument => argument.startsWith('--'))), check = flags.has('--check'), prune = flags.has('--prune'), fetchRecords = flags.has('--fetch');
  const ids = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const satelliteTables: Awaited<ReturnType<typeof fetchSatelliteTables>> = fetchRecords ? await fetchSatelliteTables() : new Map();
  const results: Record<string, CitationRun> = {};
  for (const object of SCENE_OBJECTS) if (!ids.length || ids.includes(object.id)) {
    const run = await citePinnedFacts(resolve(import.meta.dirname, '../../../src/objects', object.id), { write: !check, prune, fetchRecords, satelliteTables, classification: object.classification, name: object.name });
    if (run.cited.length || run.pruned.length || run.fetched.length) results[object.id] = run;
  }
  const total = (key: keyof CitationRun) => Object.values(results).reduce((sum, run) => sum + run[key].length, 0);
  console.log(JSON.stringify({ check, prune, objects: Object.keys(results).length, cited: total('cited'), pruned: total('pruned'), fetched: total('fetched'), results }));
  if (check && (total('cited') || total('pruned'))) process.exitCode = 1;
}
