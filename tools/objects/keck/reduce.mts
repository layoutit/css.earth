#!/usr/bin/env node
/** Re-run the archive's own pipeline over a pinned Keck observation.
 *
 *   node tools/objects/keck/reduce.mts <program id> <koaid> [<run directory>]
 *
 * The frames the program pins are staged into the run directory under the names the observatory wrote them with, because the
 * KCWI DRP reads a night by that convention (`kb<yymmdd>_<frame>.fits`) and KOA stores them under its own ids. Every staged
 * file is then checked against the program's pin, through the shared `assertInputPins`, before the pipeline is started: a run
 * that would read other bytes does not start.
 *
 * The pipeline is run in group mode, which is how it is meant to be driven over a night's files: it sorts them by image type
 * and reduces them in the order the instrument requires (bias, then continuum bars, then arcs, then flats, then the science
 * frame), writing its products into `redux` beside the staged frames. Nothing here chooses a calibration or a science
 * parameter; the pipeline's own grouping and its shipped configuration decide, which is what makes the result comparable with
 * the archive's.
 *
 * Two things are chosen, and both are recorded in the product record beside every product:
 *
 *   the channel. KOA associates BOTH KCWI channels with one science frame, and the DRP reduces one channel at a time, so the
 *     run takes the science frame's own channel (`KB` blue, `KR` red) and the calibrations of that channel.
 *   no plots. The shipped configuration has `enable_bokeh = True`, and the pipeline then starts a detached `bokeh serve`
 *     process and opens plots in a browser. This route has no display and starts no server, so the run is given the shipped
 *     configuration with exactly the two plotting settings in PLOTS_OFF replaced, and refuses to finish if a plot server was
 *     started after all. Every other line of the file is the pipeline's own.
 *
 * Only KCWI is re-run. toolchain.json says why: the OSIRIS DRP is IDL, and no other Keck pipeline is installed here. A program
 * of another instrument is refused rather than reduced by something that is not that instrument's pipeline. */
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@cssearth/core/node';
import { positionalArguments } from '@cssearth/core';
import { assertInputPins, productRecordPath, readProductRecord, sameRun, writeProductRecord,
  type ProductInput, type ProductRun, type ProductSoftware } from '../product-record.mts';
import { DOWNLOADS, readKeckProgram, type KeckFile, type KeckObservation, type KeckProgram } from './archive.mts';
import { keckToolchain, keckToolchainDigest, type KeckToolchain } from './toolchain.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** The instruments this toolkit can re-run: the pipeline's executable, the channel a frame belongs to, the arguments that
 * reduce that channel, and the configuration file the pipeline ships and this run edits only to turn plotting off. */
export const REDUCIBLE: Readonly<Record<string, { readonly binary: string; readonly channel: (name: string) => string; readonly args: (channel: string) => readonly string[]; readonly config: string }>> = {
  KCWI: { binary: 'kcwiReduce', channel: name => name.slice(0, 2), args: channel => ['-g', channel === 'KR' ? '-r' : '-b'], config: 'kcwidrp/configs/kcwi.cfg' },
};

/** The only settings this route changes in the pipeline's shipped configuration, and the only reason it changes any: the DRP
 * draws through a bokeh server it starts itself with `subprocess.Popen('bokeh serve')`, which outlives the run and opens a
 * browser window. Neither value is a science parameter: `enable_bokeh` decides whether that server is started at all and
 * `plot_level` how much is drawn. Both are recorded with every product. */
export const PLOTS_OFF: Readonly<Record<string, string>> = { enable_bokeh: 'False', plot_level: '0' };

export const stagedName = (file: KeckFile) => file.observatoryName ?? file.name;

/** The pipeline's own configuration with plotting off. Every line the pipeline ships is kept; each key of PLOTS_OFF must
 * appear in it, or the file is not the one this rule was written against and the run is refused rather than run with plots. */
export function configureWithoutPlots(shipped: string, settings: Readonly<Record<string, string>> = PLOTS_OFF) {
  const changed: Record<string, { readonly shipped: string; readonly used: string }> = {};
  let text = shipped;
  for (const [key, value] of Object.entries(settings)) {
    const line = new RegExp(`^([ \\t]*)${key}[ \\t]*=[ \\t]*(.*)$`, 'mu');
    const found = line.exec(text);
    if (!found) throw new Error(`The pipeline's configuration states no ${key}, so this run cannot turn plotting off in it.`);
    changed[key] = { shipped: found[2]!.trim(), used: value };
    text = text.replace(line, `$1${key} = ${value}`);
  }
  return { text, changed };
}

/** The configuration this run gives the pipeline, and what was changed in it. */
export async function runConfiguration(toolchain: KeckToolchain, how: { readonly config: string }) {
  const shipped = resolve(toolchain.sitePackages, how.config);
  const { text, changed } = configureWithoutPlots(await readFile(shipped, 'utf8'));
  return { source: relative(toolchain.sitePackages, shipped), text, changed, sha256: sha256(text) };
}

/** The versions of everything that decides what the pipeline writes, read from the installed environment itself. */
export async function keckSoftware(toolchain: KeckToolchain): Promise<ProductSoftware[]> {
  const names = ['kcwidrp', 'keckdrpframework', 'astropy', 'numpy', 'scipy', 'ccdproc', 'astroscrappy'];
  const result = spawnSync(toolchain.python, ['-c',
    `import platform, json; from importlib.metadata import version as v; print(json.dumps({"python": platform.python_version(), **{n: v(n) for n in ${JSON.stringify(names)}}}))`],
    { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`The Keck toolchain does not state its versions: ${(result.stderr ?? '').slice(-2000)}`);
  return Object.entries(JSON.parse(result.stdout.trim()) as Record<string, string>).map(([name, version]) => ({ name, version }));
}

/** Put the pinned frames of one observation in `directory`, each under the name the observatory wrote it with. Returns the
 * staged names in the order the pipeline is given them, and where each pinned input landed, for `assertInputPins`. */
export async function stageFrames(program: KeckProgram, observation: KeckObservation, directory: string, channel?: (name: string) => string) {
  await mkdir(directory, { recursive: true });
  const staged: string[] = [], files = new Map<string, string>();
  const wanted = channel ? observation.calibrations.filter(file => channel(file.name) === channel(observation.science.name)) : observation.calibrations;
  if (channel && !wanted.length) throw new Error(`${observation.koaid}: the program pins no calibration of its own channel.`);
  for (const file of [...wanted, observation.science]) {
    const source = resolve(DOWNLOADS, program.id, 'lev0', file.name);
    if (!await stat(source).then(() => true, () => false)) throw new Error(`${file.name} is not downloaded: node tools/objects/keck/archive.mts ${program.id} ${program.instrument} ${observation.koaid}`);
    const name = stagedName(file);
    await copyFile(source, resolve(directory, name));
    staged.push(name);
    files.set(file.name, resolve(directory, name));
  }
  return { staged, files, inputs: [...wanted, observation.science].map(pinnedInput) };
}

export const pinnedInput = (file: KeckFile): ProductInput => ({ role: file.imageType ?? 'frame', identity: file.name, bytes: file.bytes });

/** What identifies one reduction: the pinned frames it read, the channel and configuration it ran with, and the installed
 * pipeline. The same frames through the same pipeline at the same settings are the same run. */
export function reductionRun(program: KeckProgram, observation: KeckObservation, inputs: readonly ProductInput[],
  settings: { readonly channel: string; readonly command: readonly string[]; readonly configuration: { readonly source: string; readonly sha256: string; readonly changed: Record<string, { readonly shipped: string; readonly used: string }> } },
  software: readonly ProductSoftware[], toolchainDigest: string): ProductRun {
  return {
    telescope: 'Keck', stage: `${program.instrument.toLowerCase()}-drp-group`,
    inputs: [...inputs].sort((a, b) => a.identity < b.identity ? -1 : 1),
    parameters: { instrument: program.instrument, koaid: observation.koaid, channel: settings.channel, groupMode: true,
      configuration: settings.configuration, command: settings.command, observatoryNames: true },
    software, toolchainDigest,
  };
}

/** Run the pipeline over the staged frames, with its output written to `log`. The pipeline is chatty and long-running, so its
 * output is streamed to the file rather than held. */
export async function runPipeline(binary: string, args: readonly string[], cwd: string, log: string, env: NodeJS.ProcessEnv) {
  const out = createWriteStream(log);
  const code = await new Promise<number>((ok, fail) => {
    // The pipeline asks a question at the terminal when a run looks wrong to it; with no stdin it takes the default and the
    // run never blocks. A run that needed an answer is a run whose inputs were chosen wrongly here.
    const child = spawn(binary, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on('error', fail);
    child.on('close', status => ok(status ?? -1));
  });
  await new Promise<void>(ok => out.end(ok));
  return code;
}

/** What the run's own log says about plotting. The DRP writes one line when it starts its server and another when the server
 * is already up, so the log is the record of whether this run started one; nothing is killed on the strength of a guess about
 * a process someone else may own. */
export const PLOT_SERVER_LINES = /Enabling BOKEH plots|Starting bokeh server|Config requests bokeh server/u;

export async function assertNoPlotServer(log: string) {
  const text = await readFile(log, 'utf8').catch(() => '');
  const started = text.split('\n').filter(line => PLOT_SERVER_LINES.test(line));
  if (started.length) throw new Error(`The run started a plot server although plotting is off: ${started[0]!.trim()}`);
  return { startedByThisRun: false as const, lines: started.length };
}

export interface KeckRun { readonly directory: string; readonly redux: string; readonly log: string; readonly staged: readonly string[]; readonly products: readonly string[]; readonly records: readonly string[]; readonly reused: boolean }

/** True when every product the last run wrote is still on disk and its record says this same run made it. */
async function reusable(redux: string, listing: readonly string[], made: ProductRun) {
  if (!listing.length) return false;
  for (const name of listing) {
    const record = await readProductRecord(productRecordPath(resolve(redux, name)));
    if (!await sameRun(record, made, path => resolve(redux, path))) return false;
  }
  return true;
}

export async function reduceObservation(id: string, koaid: string, run: string): Promise<KeckRun> {
  const program = await readKeckProgram(id);
  const observation = program.observations.find(entry => entry.koaid === koaid);
  if (!observation) throw new Error(`${id} pins no observation ${koaid}.`);
  const how = REDUCIBLE[program.instrument];
  if (!how) throw new Error(`No pipeline for ${program.instrument} is installed here; see tools/objects/keck/toolchain.json.`);
  const toolchain = await keckToolchain();
  const channel = how.channel(observation.science.name);
  const configuration = await runConfiguration(toolchain, how);
  const software = await keckSoftware(toolchain);
  const redux = resolve(run, 'redux'), log = resolve(run, 'reduce.log');
  const command = [how.binary, ...how.args(channel), '-c', 'kcwi.cfg', '-f'];
  const inputs = [...observation.calibrations.filter(file => how.channel(file.name) === channel), observation.science].map(pinnedInput);
  const made = reductionRun(program, observation, inputs, { channel, command, configuration: { source: configuration.source, sha256: configuration.sha256, changed: configuration.changed } },
    software, await keckToolchainDigest());
  const previous = await readFile(resolve(run, 'run.json'), 'utf8').then(text => (JSON.parse(text) as { products?: string[] }).products ?? [], () => [] as string[]);
  if (await reusable(redux, previous, made))
    return { directory: run, redux, log, staged: [], products: previous, records: previous.map(name => productRecordPath(name)), reused: true };

  await rm(run, { recursive: true, force: true });
  const { staged, files } = await stageFrames(program, observation, run, how.channel);
  // Nothing is read by the pipeline until the bytes it will read are the bytes the program pins.
  await assertInputPins(inputs, files);
  await writeFile(resolve(run, 'kcwi.cfg'), configuration.text);
  const args = [...how.args(channel), '-c', 'kcwi.cfg', '-f', ...staged];
  const code = await runPipeline(toolchain.binaries[how.binary]!, args, run, log, toolchain.env);
  const written = (await readdir(redux).catch(() => [] as string[])).filter(name => name.endsWith('.fits')).sort();
  await writeFile(resolve(run, 'run.json'), `${JSON.stringify({ program: id, koaid, instrument: program.instrument,
    command: [how.binary, ...args], exitCode: code, products: written }, null, 2)}\n`);
  if (code !== 0) throw new Error(`The ${program.instrument} pipeline exited ${code}; see ${log}.`);
  await assertNoPlotServer(log);
  // The record of this run, beside each product it made, with nothing checked yet: compare.mts adds what it establishes.
  for (const name of written) await writeProductRecord(productRecordPath(resolve(redux, name)), made,
    [{ path: name, file: resolve(redux, name), units: 'electrons, as the pipeline\'s own header states for the stage',
      conventions: { grid: 'the instrument samples the pipeline wrote, as the product\'s own header states them',
        names: 'the observatory\'s own frame names, which is what the pipeline writes its products under' } }]);
  return { directory: run, redux, log, staged, products: written, records: written.map(name => productRecordPath(name)), reused: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, koaid, directory] = positionalArguments(process.argv.slice(2));
  if (!id || !koaid) throw new TypeError('Usage: reduce <program id> <koaid> [<run directory>]');
  const run = resolve(directory ?? resolve(REPOSITORY, 'output/keck', id, koaid.replace(/\.fits$/u, '')));
  const result = await reduceObservation(id, koaid, run);
  console.log(`KECK_RUN ${result.redux} (${result.products.length} products, ${result.staged.length} frames staged${result.reused ? ', reused' : ''})`);
}
