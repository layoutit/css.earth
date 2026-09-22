/**
 * Re-measure a body's camera lenses and rewrite only their registration in the prepared report. The stage runs during
 * preparation; this runs it alone, through the same loaders and the same measurement, so a changed rule or a
 * re-derived camera is re-measured in the time it takes to load the frames rather than the time it takes to pack an
 * atlas. The atlas, the transfer counts and everything else in the report are left as preparation wrote them.
 *
 *   node tools/objects/registration-stage.mts <object-id>          measure and print
 *   node tools/objects/registration-stage.mts <object-id> --write  measure, rewrite the report in both prepared intermediates and the README block
 *   node tools/objects/registration-stage.mts --all --write         the same for every body with a camera lens
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';
import { loadRadialModels, radialModelForLens } from './terrestrial-layers/radial-models.mts';
import { requireTerrainMesh } from './terrestrial-layers/radial-terrain.mts';
import { loadSurfaceObservation } from './surface-observations/index.mts';
import { registrationBlockFor, withRegistrationBlock } from './report-registration.mts';

const ROOT = resolve(import.meta.dirname, '../..');
const [selector, flag] = process.argv.slice(2);
if (!selector || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/registration-stage.mts <object-id>|--all [--write]'); process.exit(2); }

if (selector === '--all') {
  // Every body with a camera lens, one after another; a rule change in the stage is re-measured across the set this way.
  const bodies = readdirSync(resolve(ROOT, 'src/objects')).filter(id => existsSync(resolve(ROOT, 'src/objects', id, 'source/preparation/terrestrial.json')) && existsSync(resolve(ROOT, 'src/objects', id, 'prepared/surfaces.json')))
    .filter(id => { const recipe = JSON.parse(readFileSync(resolve(ROOT, 'src/objects', id, 'source/preparation/terrestrial.json'), 'utf8')) as { raster?: { surfaceObservations?: unknown[] } }; return (recipe.raster?.surfaceObservations?.length ?? 0) > 0; });
  // Bodies are independent, so a few run at once; each is its own process with its own memory.
  const { execFile } = await import('node:child_process'), workers = Math.max(1, Math.min(4, (await import('node:os')).availableParallelism() - 1));
  const failures: string[] = [], queue = [...bodies];
  const run = (id: string) => new Promise<void>(done => execFile(process.execPath, [process.argv[1], id, ...(flag ? [flag] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
    process.stdout.write(stdout);
    if (error) { failures.push(id); console.error(`${id}: ${String(stderr).split('\n').find(line => /Error/.test(line)) ?? 'failed'}`); }
    done();
  }));
  await Promise.all(Array.from({ length: workers }, async () => { for (let id = queue.shift(); id !== undefined; id = queue.shift()) await run(id); }));
  console.log(`${bodies.length - failures.length} of ${bodies.length} bodies measured${failures.length ? `; failed: ${failures.join(', ')}` : ''}.`);
  process.exit(failures.length ? 1 : 0);
}
const objectId = selector, objectDirectory = resolve(ROOT, 'src/objects', objectId), sourceDirectory = resolve(objectDirectory, 'source');
const config = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8')));
const lenses = requireArray(requireRecord(config.raster).surfaceObservations ?? []).map(value => requireRecord(value));
if (!lenses.length) { console.log(`${objectId}: no surface observation lens.`); process.exit(0); }
const source = await createSourceManifest({ objectId: objectId, objectName: requireString(config.displayName), sourceRoot: sourceDirectory });
await source.verify();
const models = await loadRadialModels({ config: config as unknown as Parameters<typeof loadRadialModels>[0]['config'], sourceDirectory, source });

// Preparation writes the observation report into two intermediates; both are rewritten so neither disagrees with the other.
const documents = await Promise.all(['prepared/surfaces.json', 'prepared/material.json'].map(async path => {
  const file = resolve(objectDirectory, path), document = requireRecord(JSON.parse(await readFile(file, 'utf8')));
  return { file, document, lenses: requireArray(document.surfaces).map(value => requireRecord(value)) };
}));
let changed = 0;
for (const recipe of lenses) {
  const id = requireString(recipe.id), model = radialModelForLens(models, id);
  const observation = await loadSurfaceObservation({ sourceDirectory, source, recipe,
    radial: { ...model.radial, grid: requireTerrainMesh(model.radial.grid) },
    config: { geometry: model.config.geometry as Parameters<typeof loadSurfaceObservation>[0]['config']['geometry'], raster: config.raster as Parameters<typeof loadSurfaceObservation>[0]['config']['raster'] } });
  const registration = observation.report.registration, after = JSON.stringify(registration ?? null);
  let differs = false;
  for (const { file, lenses: prepared } of documents) {
    const target = prepared.find(lens => lens.id === id);
    if (!target) throw new Error(`${file} states no lens ${id}; prepare the body first.`);
    const report = requireRecord(target.observation);
    if (JSON.stringify(report.registration ?? null) === after) continue;
    differs = true;
    if (registration === undefined) delete report.registration; else report.registration = registration;
  }
  if (differs) changed++;
  console.log(`${id}: ${differs ? 'registration re-measured' : 'registration unchanged'}`);
}
if (flag === '--write') {
  if (changed) for (const { file, document } of documents) await writeFile(file, JSON.stringify(document) + '\n');
  const block = await registrationBlockFor(objectDirectory), readmePath = resolve(objectDirectory, 'README.md');
  const { readme, replaced } = withRegistrationBlock(await readFile(readmePath, 'utf8'), block);
  if (replaced) await writeFile(readmePath, readme);
  console.log(`${objectId}: ${changed ? `${changed} lens report(s) rewritten` : 'reports unchanged'}${replaced ? ', README block written' : ''}.`);
}
