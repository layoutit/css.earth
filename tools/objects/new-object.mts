#!/usr/bin/env node
/** Scaffold a placed-star object package from its astronomy record, instead of cloning another star by find-and-replace.
 *
 *   node tools/objects/new-object.mts --spec <stars.json> [--check | --bake]
 *   node tools/objects/new-object.mts --bake <id>...
 *
 * generates complete packages from a star spec (new-object/spec.mts): Gaia DR3 placement, the colour lens from the best archived
 * spectrum with its cross-check, the model limb law, the catalogue colour, marker, manifest, acquisition plan, source records and
 * credits (new-object/generate.mts). Only prose is left marked. The shape-only scaffold below stays for a star with no temperature
 * and for a black hole:
 *
 *   node tools/objects/new-object.mts <id> --name <display name> --system <system name, e.g. "Beta Pictoris system"> --temperature <K>
 *     --temperature-source <citation with URL> --description <catalogue line> --paper <url> --paper-credit <credit>
 *   node tools/objects/new-object.mts <id> --black-hole --shadow-source <citation> --name ... --system ... --description ... --paper ... --paper-credit ...
 *
 * Requires packages/astronomy/data/bodies/<id>.json with a `star` block and `physical.meanRadiusKm`. Every number here is
 * derived from that record: the world-frame origin, the catalogue distance, the radius facts and the sky-north display axis
 * (skyPlaneOrientation). The catalogue colour is the cited effective temperature through the star field's colour fit
 * (star-catalogue-color.mts). The package starts with the shape lens and stays off the map until a surface image is added.
 * Prose the scaffold cannot know (reader text, README, credits, ledger) is written with the marker TODO(new-object), which
 * tools/contract/object-package-consistency.test.mts refuses. Then run: node tools/prepare/prepare-object.mts <id> */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scaffoldStar, TODO } from './new-object/scaffold.mts';

export { neutralDiscMarker, scaffoldStar, scaffoldStarFiles, solarRadii, starStylesheet, TODO, type StarScaffold } from './new-object/scaffold.mts';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), option = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
  const specPath = option('spec'), handoff = option('hosted'), fromArchive = args.indexOf('--from-archive');
  if (fromArchive >= 0) {
    // A spec for planet hosts from the NASA Exoplanet Archive: `--from-archive HOST... --out spec.json`.
    const hosts = args.slice(fromArchive + 1).filter((argument, i, list) => !argument.startsWith('--') && !list[i - 1]?.startsWith('--')), out = option('out');
    if (!hosts.length || !out) throw new TypeError('Usage: new-object --from-archive HOST... --out spec.json');
    const { specFromArchive } = await import('./new-object/generate.mts'), result = await specFromArchive(hosts, out, { progress: line => process.stderr.write(`${line}\n`) });
    process.stdout.write(`${result.report.join('\n')}\n${result.entries} entries written to ${result.path}\n`);
  } else if (handoff) {
    // Phase two of a system run (new-object/generate.mts runNewObject), in a process that loads the rebuilt astronomy package.
    const { runHostedPhase } = await import('./new-object/generate.mts');
    process.stdout.write(JSON.stringify(await runHostedPhase(handoff)));
  } else if (args.includes('--bake') && !specPath) {
    // The bake of objects already in the tree: `--bake ID...` (tools/prepare/prepare-object.mts).
    const { prepareObjects } = await import('../prepare/prepare-object.mts');
    if (!await prepareObjects(args.filter(argument => argument !== '--bake'))) process.exitCode = 1;
  } else if (specPath) {
    // The full generator: every star in the spec file, from the archives (new-object/generate.mts); also `telescope new-object`.
    // `--check` runs the bake through the page data on what was generated, `--bake` the whole chain (tools/prepare/prepare-object.mts).
    const { formatNewObject, runNewObject } = await import('./new-object/generate.mts'), { prepareObjects } = await import('../prepare/prepare-object.mts');
    const results = await runNewObject(specPath, { progress: line => process.stderr.write(`${line}\n`), skipExisting: args.includes('--skip-existing') });
    process.stdout.write(formatNewObject(results));
    if ((args.includes('--check') || args.includes('--bake')) && results.length && !await prepareObjects(results.map(result => result.id), args.includes('--bake') ? {} : { to: 'page' })) process.exitCode = 1;
  } else {
    const id = args.find(argument => !argument.startsWith('--') && !args[args.indexOf(argument) - 1]?.startsWith('--'));
    const blackHole = args.includes('--black-hole');
    const required = blackHole ? ['name', 'system', 'shadow-source', 'description', 'paper', 'paper-credit'] as const : ['name', 'system', 'temperature', 'temperature-source', 'description', 'paper', 'paper-credit'] as const;
    const missing = required.filter(name => option(name) === undefined);
    if (!id || missing.length) throw new TypeError(`Usage: new-object --spec <stars.json>, or the shape-only scaffold: new-object <id> ${required.map(name => `--${name} <value>`).join(' ')} [--order <n>]; missing ${missing.join(', ') || 'id'}.`);
    const order = option('order');
    const written = await scaffoldStar({ id, name: option('name')!, system: option('system')!, ...blackHole ? { blackHole: { shadowSource: option('shadow-source')! } } : { temperatureK: Number(option('temperature')), temperatureSource: option('temperature-source')! }, description: option('description')!, paper: option('paper')!, paperCredit: option('paper-credit')!, ...(order ? { order: Number(order) } : {}) });
    console.log(`${written.length} files written. Replace every ${TODO}, then: node tools/prepare/prepare-object.mts ${id}`);
  }
}
