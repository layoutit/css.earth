#!/usr/bin/env node
/** Scaffold a placed-star object package from its astronomy record, instead of cloning another star by find-and-replace.
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --spec <stars.json> [--skip-existing] [--check | --bake]
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --bake <id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --refresh <id>... [--check | --bake]
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --thermal <id>... | --thermal-entries entries.json | --expected-glow <id>... | --host-light <id>... | --photometry entries.json | --phase-curve entries.json
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --simulation entries.json | --rock-eclipse entries.json | --published-map entries.json
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --rename <star id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --retext <host id>... | --charts <host id>... | --retime <host id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --metadata --all | <star id>... [--periods [fresh]]
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --tess-light --all | <star id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --star-limb <id>... [--bake]
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --imaged-limb <id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --star-lit <id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --draft-photometry <id>[="name in the sheet"]... --out entries.json
 *
 * generates complete packages from a star spec (new-object/spec.mts): Gaia DR3 placement, the color dataset from the best archived
 * spectrum with its cross-check, the model limb law, the catalogue color, marker, manifest, acquisition plan, source records and
 * credits (new-object/generate.mts). Only prose is left marked. The shape-only scaffold below stays for a star with no temperature
 * and for a black hole:
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts <id> --name <display name> --system <system name, e.g. "Beta Pictoris system"> --temperature <K>
 *     --temperature-source <citation with URL> --description <catalogue line> --paper <url> --paper-credit <credit>
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts <id> --black-hole --shadow-source <citation> --name ... --system ... --description ... --paper ... --paper-credit ...
 *
 * Requires packages/astronomy/data/bodies/<id>.json with a `star` block and `physical.meanRadiusKm`. Every number here is
 * derived from that record: the world-frame origin, the catalogue distance, the radius facts and the sky-north display axis
 * (skyPlaneOrientation). The catalogue color is the cited effective temperature through the star field's color fit
 * (`@cssearth/bake/objects/color`, star-catalogue-color.ts). The package starts with the shape dataset and stays off the map until a surface image is added.
 * Prose the scaffold cannot know (reader text, README, credits, ledger) is written with the marker TODO(new-object), which
 * packages/telescope-cli/src/new-object/object-package-consistency.test.mts refuses. Then run: node packages/bake/cli/prepare-object.mts <id> */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scaffoldStar, TODO } from './scaffold.mts';
import { loadSolarEpoch } from './solar-epoch.mts';

export { scaffoldStar, scaffoldStarFiles, solarRadii, starStylesheet, TODO, type StarScaffold } from './scaffold.mts';

/** The standalone entry writes generated records in its checkout, even from another cwd. */
export function newObjectPath(...parts: string[]): string {
  return resolve(checkoutProjectRoot(import.meta.url), ...parts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2), option = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
  const specPath = option('spec'), handoff = option('hosted');
  if (args.some(argument => /^--from-[a-z0-9]+$/u.test(argument))) {
    throw new TypeError('Drafts have one path: pnpm telescope new-object --from-<route> NAME... --out SPEC.json (new-object/drafts.mts).');
  } else if (handoff) {
    // Phase two of a system run (new-object/generate.mts runNewObject), in a process that loads the rebuilt astronomy package.
    const { runHostedPhase } = await import('./generate.mts');
    process.stdout.write(JSON.stringify(await runHostedPhase(handoff, await loadSolarEpoch(checkoutProjectRoot(import.meta.url)))));
  } else if (args.includes('--draft-photometry')) {
    // Band photometry for imaged planets from the UltracoolSheet: `--draft-photometry ID... --out entries.json`, then `--photometry entries.json` (new-object/ultracool.mts).
    const { readFile, writeFile } = await import('node:fs/promises'), { draftUltracoolPhotometry } = await import('./archives/ultracool.mts'), { liveArchive } = await import('./archives/archives.mts');
    const out = option('out'), ids = args.filter((argument, i) => !argument.startsWith('--') && args[i - 1] !== '--out');
    if (!out || !ids.length) throw new TypeError('Usage: new-object --draft-photometry ID... --out entries.json');
    // `ID="name in the sheet"` names a planet the sheet lists another way (VHS 1256-1257 b is its "VHS J125601.92-125723.9 b").
    const planets = await Promise.all(ids.map(async token => { const [id, alias] = token.split('=') as [string, string | undefined];
      return { id, name: String((JSON.parse(await readFile(`src/objects/${id}/source/content/object.json`, 'utf8')) as { displayName: string }).displayName), aliases: alias ? [alias] : [] }; }));
    const { entries, notes } = await draftUltracoolPhotometry(liveArchive, planets);
    await writeFile(out, `${JSON.stringify(entries, null, 2)}\n`);
    process.stdout.write(`${entries.map(entry => `${entry.id}: ${entry.photometry.bands.map(band => `${band.band} ${band.value} µJy`).join(', ')}`).join('\n')}\n${notes.join('\n')}\n${entries.length} of ${ids.length} planets drafted to ${out}; apply with --photometry ${out}\n`);
  } else if (args.includes('--charts') && !specPath) {
    // Charts for the archive planets of hosts already in the tree: `--charts HOST_ID...` (new-object/planet-charts.mts).
    const { chartHosts } = await import('./planet-charts.mts'), { liveArchive } = await import('./archives/archives.mts');
    const lines = await chartHosts(checkoutProjectRoot(import.meta.url), args.filter(argument => !argument.startsWith('--')), liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} planet(s) charted. Bake them from the prepare step: node packages/bake/cli/prepare-object.mts <id>... --from prepare\n`);
  } else if (args.includes('--retime') && !specPath) {
    // Orbit timing of archive planets after the ephemeris rule changes: `--retime HOST_ID...` (new-object/retime.mts).
    const { retimeHosts } = await import('./retime.mts'), { liveArchive } = await import('./archives/archives.mts');
    const lines = await retimeHosts(checkoutProjectRoot(import.meta.url), args.filter(argument => !argument.startsWith('--')), liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} planet(s) considered. Rebuild the astronomy package, then bake the changed ones.\n`);
  } else if (args.includes('--rename') && !specPath) {
    // Names by the order of preference, for stars the tool made: `--rename STAR_ID...` (new-object/rename.mts), then `--refresh`.
    const { renameStars } = await import('./rename.mts'), { liveArchive } = await import('./archives/archives.mts');
    const { lines, refresh } = await renameStars(checkoutProjectRoot(import.meta.url), args.filter(argument => !argument.startsWith('--')), liveArchive);
    process.stdout.write(`${lines.join('\n')}\n${refresh.length ? `Regenerate: node packages/telescope-cli/src/new-object/new-object-cli.mts --refresh ${refresh.join(' ')} --bake\n` : ''}`);
  } else if (args.includes('--tess-light')) {
    // What the TESS reduction found of each star it looked at, into its measurements record: `--tess-light --all | STAR_ID...` (new-object/brightness/brightness.mts).
    const { writeTessLight } = await import('./brightness/brightness.mts'), ids = args.filter(argument => !argument.startsWith('--'));
    if (!ids.length && !args.includes('--all')) throw new TypeError('Usage: --tess-light --all | <star id>...');
    await writeTessLight(checkoutProjectRoot(import.meta.url), ids.length ? ids : 'all', line => process.stdout.write(`${line}\n`));
  } else if (args.includes('--metadata') && !specPath) {
    // What the catalogues print of stars already in the tree, into their measurements records: `--metadata --all | STAR_ID...` (new-object/metadata/metadata.mts).
    const { writeStarMetadata } = await import('./metadata/metadata.mts'), { liveArchive } = await import('./archives/archives.mts'), ids = args.filter(argument => !argument.startsWith('--'));
    if (!ids.filter(id => id !== 'fresh').length && !args.includes('--all')) throw new TypeError('Usage: --metadata --all | <star id>... [--periods [fresh]]');
    const lines = await writeStarMetadata(checkoutProjectRoot(import.meta.url), ids.filter(id => id !== 'fresh'), liveArchive, line => process.stdout.write(`${line}\n`), args.includes('--periods') ? ids.includes('fresh') ? 'fresh' : 'kept' : undefined);
    process.stdout.write(`${lines.at(-1)}\n${lines.length - 1} record(s) changed.\n`);
  } else if (args.includes('--retext') && !specPath) {
    // Drafted text and size facts of archive hosts and their planets, after a template change: `--retext HOST_ID...` (new-object/retext.mts).
    const { retextHosts } = await import('./retext.mts'), { liveArchive } = await import('./archives/archives.mts');
    const lines = await retextHosts(checkoutProjectRoot(import.meta.url), args.filter(argument => !argument.startsWith('--')), liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} package(s) considered. Bake the changed ones from the text step: node packages/bake/cli/prepare-object.mts <id>... --from catalogue\n`);
  } else if (option('phase-curve') !== undefined && !specPath) {
    // Heat maps from published phase-curve fits for planets already in the tree: `--phase-curve entries.json` (new-object/phase-curve-dataset.mts).
    const { readFile } = await import('node:fs/promises'), { parsePhaseCurveEntries } = await import('./phase-curve-dataset.mts'), { rebuildExistingDatasets } = await import('./planet-datasets.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parsePhaseCurveEntries(JSON.parse(await readFile(option('phase-curve')!, 'utf8')));
    const lines = await rebuildExistingDatasets(checkoutProjectRoot(import.meta.url), [...entries.keys()], 'phase-curve', liveArchive, line => process.stdout.write(`${line}\n`), new Map(), entries);
    process.stdout.write(`${lines.length} dataset(es) added. Bake the changed planets: node packages/bake/cli/prepare-object.mts <id>...\n`);
  } else if (option('simulation') !== undefined && !specPath) {
    // Published simulations for bodies already in the tree, each from an entry written after reading its paper: `--simulation entries.json` (new-object/simulation/simulation-dataset.mts).
    const { readFile } = await import('node:fs/promises'), { parseSimulationEntries } = await import('./simulation/simulation-dataset.mts'), { rebuildExistingDatasets } = await import('./planet-datasets.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parseSimulationEntries(JSON.parse(await readFile(option('simulation')!, 'utf8')));
    const lines = await rebuildExistingDatasets(newObjectPath(), [...entries.keys()], 'simulation', liveArchive, line => process.stdout.write(`${line}\n`), new Map(), new Map(), entries);
    process.stdout.write(`${lines.length} dataset${lines.length === 1 ? '' : 's'} written. Bake: node packages/bake/cli/prepare-object.mts ${[...entries.keys()].join(' ')}\n`);
  } else if (option('rock-eclipse') !== undefined && !specPath) {
    // Bare-rock models from published eclipse depths for rocky planets already in the tree: `--rock-eclipse entries.json` (new-object/rock/rock-eclipse-dataset.mts).
    const { readFile } = await import('node:fs/promises'), { addRockEclipseDatasets, parseRockEclipseEntries } = await import('./rock/rock-eclipse-dataset.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parseRockEclipseEntries(JSON.parse(await readFile(option('rock-eclipse')!, 'utf8')));
    const lines = await addRockEclipseDatasets(checkoutProjectRoot(import.meta.url), entries, liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} dataset${lines.length === 1 ? '' : 's'} written. Bake: node packages/bake/cli/prepare-object.mts ${[...entries.keys()].join(' ')}\n`);
  } else if (option('thermal-entries') !== undefined && !specPath) {
    // Measured day sides read from their papers, for planets the archives' tables lack: `--thermal-entries entries.json` (spec.mts parseThermalEntries).
    const { readFile } = await import('node:fs/promises'), { parseThermalEntries } = await import('./spec.mts'), { rebuildExistingDatasets } = await import('./planet-datasets.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parseThermalEntries(JSON.parse(await readFile(option('thermal-entries')!, 'utf8')));
    const lines = await rebuildExistingDatasets(checkoutProjectRoot(import.meta.url), [...entries.keys()], 'thermal', liveArchive, line => process.stdout.write(`${line}\n`), new Map(), new Map(), new Map(), fetch, entries);
    process.stdout.write(`${lines.length} planet(s) considered. Bake the changed ones: node packages/bake/cli/prepare-object.mts ${[...entries.keys()].join(' ')}\n`);
  } else if (option('published-map') !== undefined && !specPath) {
    // Eclipse maps their authors released, for planets already in the tree: `--published-map entries.json` (new-object/map/published-map-dataset.mts).
    const { readFile } = await import('node:fs/promises'), { addPublishedMapDatasets, parsePublishedMapEntries } = await import('./map/published-map-dataset.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parsePublishedMapEntries(JSON.parse(await readFile(option('published-map')!, 'utf8')));
    const lines = await addPublishedMapDatasets(checkoutProjectRoot(import.meta.url), entries, liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} dataset${lines.length === 1 ? '' : 's'} written. Bake: node packages/bake/cli/prepare-object.mts ${[...entries.keys()].join(' ')}\n`);
  } else if (option('photometry') !== undefined && !specPath) {
    // Band photometry for imaged planets already in the tree: `--photometry entries.json`, a list of { id, photometry } (spec.mts PhotometrySpec).
    const { readFile } = await import('node:fs/promises'), { parsePhotometryEntries } = await import('./spec.mts'), { rebuildExistingDatasets } = await import('./planet-datasets.mts'), { liveArchive } = await import('./archives/archives.mts');
    const entries = parsePhotometryEntries(JSON.parse(await readFile(option('photometry')!, 'utf8')));
    const lines = await rebuildExistingDatasets(checkoutProjectRoot(import.meta.url), [...entries.keys()], 'photometry', liveArchive, line => process.stdout.write(`${line}\n`), entries);
    process.stdout.write(`${lines.length} planet(s) considered. Bake the changed ones: node packages/bake/cli/prepare-object.mts <id>...\n`);
  } else if ((args.includes('--thermal') || args.includes('--expected-glow') || args.includes('--host-light')) && !specPath) {
    // Color for planets already in the tree, from what is measured: `--thermal ID...` or `--host-light ID...` (new-object/planet-datasets.mts).
    const mode = args.includes('--thermal') ? 'thermal' : args.includes('--expected-glow') ? 'expected-glow' : 'host-light', { rebuildExistingDatasets } = await import('./planet-datasets.mts'), { liveArchive } = await import('./archives/archives.mts');
    const lines = await rebuildExistingDatasets(checkoutProjectRoot(import.meta.url), args.filter(argument => !argument.startsWith('--')), mode, liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} planet(s) considered. Bake the changed ones: node packages/bake/cli/prepare-object.mts <id>...\n`);
  } else if (args.includes('--star-lit') && !specPath) {
    // A planet with a map that was built self-luminous, redrawn lit by its star as every other one is: `--star-lit ID...` (new-object/map/star-lit.mts).
    const { addStarLight } = await import('./map/star-lit.mts'), ids = args.filter(argument => !argument.startsWith('--'));
    const lines = await addStarLight(checkoutProjectRoot(import.meta.url), ids, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} planet(s) considered. Bake the changed ones: node packages/bake/cli/prepare-object.mts <id>...\n`);
  } else if (args.includes('--imaged-limb') && !specPath) {
    // Limb darkening for imaged planets with an infrared color, from a model grid in a band of that color: `--imaged-limb ID...` (new-object/imaged/imaged-limb.mts).
    const { addImagedLimbs } = await import('./imaged/imaged-limb.mts'), { liveArchive } = await import('./archives/archives.mts'), ids = args.filter(argument => !argument.startsWith('--'));
    const lines = await addImagedLimbs(checkoutProjectRoot(import.meta.url), ids, liveArchive, line => process.stdout.write(`${line}\n`));
    process.stdout.write(`${lines.length} planet(s) considered. Bake the changed ones: node packages/bake/cli/prepare-object.mts <id>...\n`);
  } else if (args.includes('--star-limb') && !specPath) {
    // Limb darkening for stars already in the tree, hand-made packages included: `--star-limb ID... [--bake]` (new-object/star-limb.mts).
    const { starLimb } = await import('./star-limb.mts'), { prepareObjects } = await import('@cssearth/bake/prepare-object');
    const ids = args.filter(argument => !argument.startsWith('--'));
    const results = await starLimb(checkoutProjectRoot(import.meta.url), ids, { progress: line => process.stderr.write(`${line}\n`) });
    process.stdout.write(`${results.map(result => `${result.id}: ${result.limb}${result.gravity ? `, log g ${result.gravity}` : ''}${result.color ? `, color ${result.color}` : ''}`).join('\n')}\n`);
    const changed = results.filter(result => !result.limb.startsWith('NONE')).map(result => result.id);
    if (changed.length !== results.length) process.exitCode = 1;
    // The navigation marker is the color dataset as a disc under its law, so a changed law redraws it: for the markers each manifest
    // says are that disc (context-markers.mts, or the measured-spectrum author, which draws the same disc). A marker made from a
    // reconstructed image is its own author's.
    const { readFile } = await import('node:fs/promises'), drawnHere: string[] = [];
    const DISC_AUTHORS = ['packages/telescope-cli/src/source-authoring/context-markers.mts', 'packages/telescope-cli/authoring/stellar-spectra/author.mts'];
    for (const id of changed) {
      const manifest = JSON.parse(await readFile(newObjectPath('src/objects', id, 'source/manifest.json'), 'utf8')) as { inputs?: { path?: string; generator?: string }[]; generatedIntermediates?: { path?: string; generator?: string }[] };
      const marker = [...manifest.generatedIntermediates ?? [], ...manifest.inputs ?? []].find(entry => entry.path === 'presentation/context.png');
      if (marker?.generator && DISC_AUTHORS.includes(marker.generator)) drawnHere.push(id);
    }
    if (drawnHere.length) { const { authorContextMarkers } = await import('../source-authoring/context-markers.mts'); await authorContextMarkers(drawnHere); }
    if (args.includes('--bake') && changed.length) {
      // A hand-made package's downloads may be missing from this checkout; restore them before the bake needs them.
      const { restoreSourceInputs } = await import('@cssearth/bake/asset-publication');
      const restored = await restoreSourceInputs(changed.map(id => `--object=${id}`)).then(() => true, error => { console.error(error); return false; });
      if (!restored || !await prepareObjects(changed)) process.exitCode = 1;
    }
  } else if (args.includes('--refresh') && !specPath) {
    // Regenerate bodies the tool made from their stored specs: `--refresh ID... [--check | --bake]` (new-object/refresh.mts).
    const { mkdir, writeFile } = await import('node:fs/promises'), { refreshSpec } = await import('./refresh.mts');
    const { formatNewObject, runNewObject } = await import('./generate.mts'), { prepareObjects } = await import('@cssearth/bake/prepare-object');
    const ids = args.filter(argument => !argument.startsWith('--')), path = newObjectPath('output/new-object/refresh.json');
    await mkdir(newObjectPath('output/new-object'), { recursive: true }); await writeFile(path, `${JSON.stringify(await refreshSpec(checkoutProjectRoot(import.meta.url), ids), null, 2)}\n`);
    const results = await runNewObject(path, { progress: line => process.stderr.write(`${line}\n`), refresh: true, solarEpoch: await loadSolarEpoch(checkoutProjectRoot(import.meta.url)) });
    process.stdout.write(formatNewObject(results));
    const good = results.filter(result => !result.failed).map(result => result.id);
    if (results.some(result => result.failed)) process.exitCode = 1;
    if ((args.includes('--check') || args.includes('--bake')) && good.length && !await prepareObjects(good, args.includes('--bake') ? {} : { to: 'page' })) process.exitCode = 1;
  } else if (args.includes('--bake') && !specPath) {
    // The bake of objects already in the tree: `--bake ID...` (packages/bake/cli/prepare-object.mts).
    const { prepareObjects } = await import('@cssearth/bake/prepare-object');
    if (!await prepareObjects(args.filter(argument => argument !== '--bake'))) process.exitCode = 1;
  } else if (specPath) {
    // The full generator: every star in the spec file, from the archives (new-object/generate.mts); also `telescope new-object`.
    // `--check` runs the bake through the page data on what was generated, `--bake` the whole chain (packages/bake/cli/prepare-object.mts).
    const { formatNewObject, runNewObject } = await import('./generate.mts'), { prepareObjects } = await import('@cssearth/bake/prepare-object');
    const results = await runNewObject(specPath, { progress: line => process.stderr.write(`${line}\n`), skipExisting: args.includes('--skip-existing'), solarEpoch: await loadSolarEpoch(checkoutProjectRoot(import.meta.url)) });
    process.stdout.write(formatNewObject(results));
    // A body that failed is reported and not written; the rest are checked or baked.
    const good = results.filter(result => !result.failed).map(result => result.id);
    if (results.some(result => result.failed)) process.exitCode = 1;
    if ((args.includes('--check') || args.includes('--bake')) && good.length && !await prepareObjects(good, args.includes('--bake') ? {} : { to: 'page' })) process.exitCode = 1;
  } else {
    const id = args.find(argument => !argument.startsWith('--') && !args[args.indexOf(argument) - 1]?.startsWith('--'));
    const blackHole = args.includes('--black-hole');
    const required = blackHole ? ['name', 'system', 'shadow-source', 'description', 'paper', 'paper-credit'] as const : ['name', 'system', 'temperature', 'temperature-source', 'description', 'paper', 'paper-credit'] as const;
    const missing = required.filter(name => option(name) === undefined);
    if (!id || missing.length) throw new TypeError(`Usage: new-object --spec <stars.json>, or the shape-only scaffold: new-object <id> ${required.map(name => `--${name} <value>`).join(' ')} [--order <n>]; missing ${missing.join(', ') || 'id'}.`);
    const order = option('order');
    const written = await scaffoldStar({ id, name: option('name')!, system: option('system')!, ...blackHole ? { blackHole: { shadowSource: option('shadow-source')! } } : { temperatureK: Number(option('temperature')), temperatureSource: option('temperature-source')! }, description: option('description')!, paper: option('paper')!, paperCredit: option('paper-credit')!, ...(order ? { order: Number(order) } : {}) }, await loadSolarEpoch(checkoutProjectRoot(import.meta.url)));
    console.log(`${written.length} files written. Replace every ${TODO}, then: node packages/bake/cli/prepare-object.mts ${id}`);
  }
}
