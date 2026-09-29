#!/usr/bin/env node
/** Install and locate the pinned ESO VLT/NACO pipeline under output/toolchains/naco (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/naco/toolchain.mts install [--cache <dir> ...]
 *   node packages/telescope-cli/src/archives/naco/toolchain.mts verify
 *   node packages/telescope-cli/src/archives/naco/toolchain.mts recipes
 *
 * The kit is ESO's own, downloaded from ftp.eso.org and checked against the byte count the pin records. Its `install_pipeline`
 * builds erfa, fftw, cpl,
 * cfitsio, wcslib, gsl, esorex and the naco recipes into `pipeline`, and unpacks the static calibration into `calib`.
 *
 * The interferometry toolchains install the same way, but that installer reads its own descriptor and its own list of ids
 * (packages/telescope-cli/src/archives/interferometry/toolchain.mts), and NACO is not an interferometer. What is shared is what runs the result:
 * `esoEnvironment` and `runRecipe` from `@cssearth/telescope/node` (`eso-pipeline.ts`), which this module does not repeat.
 *
 * An installed toolchain keeps the text of toolchain.json; `verify` and `nacoToolchainPath` refuse one built from another
 * pin. The downloaded archive is deleted after the build. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, copyFile, link, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { assertInstalledMarker, WORKSPACE, writeInstalledMarker, type ToolchainPins } from '@cssearth/telescope/node';

const repository = WORKSPACE;
/** The toolchain pin sits beside this code and the programs it reduces. */
export const DESCRIPTOR = resolve(WORKSPACE, 'packages/telescope-cli/src/archives/naco/toolchain.json');
export const TOOLCHAIN_ROOT = resolve(repository, 'output/toolchains/naco');

const exists = (path: string) => access(path).then(() => true, () => false);

/** The pinned descriptor, whose text an install keeps, so a changed pin invalidates the build. */
export async function nacoToolchainDescriptor(): Promise<ToolchainPins> {
  const text = await readFile(DESCRIPTOR, 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'packages/telescope-cli/src/archives/naco/toolchain.json');
  return { id: 'naco', file: 'packages/telescope-cli/src/archives/naco/toolchain.json', descriptor: text, lock: null, entry };
}

/** The recipes this toolkit runs, as the descriptor names them. */
export async function nacoRecipes(): Promise<readonly string[]> {
  const { entry } = await nacoToolchainDescriptor();
  return requireArray(entry.recipes, 'recipes').map(value => requireString(value, 'recipe'));
}

function run(command: string, args: readonly string[], options: { cwd: string; env?: NodeJS.ProcessEnv; input?: string }) {
  const result = spawnSync(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env },
    ...(options.input === undefined ? { stdio: 'inherit' } : { input: options.input, stdio: ['pipe', 'inherit', 'inherit'] }) });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${options.cwd} (status ${String(result.status)}).`);
}

/** The pinned kit, from a cache directory that already holds it or from ESO, checked by the size the pin records. */
async function fetchKit(record: Record<string, unknown>, directory: string, caches: readonly string[]) {
  const name = requireString(record.path, 'download path'), size = requireFiniteNumber(record.bytes, `${name} bytes`);
  const target = resolve(directory, name);
  const good = async (path: string) => (await stat(path).catch(() => null))?.size === size;
  if (!await good(target)) {
    let linked = false;
    for (const cache of caches) {
      const candidate = resolve(cache, name);
      if (await good(candidate)) { await rm(target, { force: true }); await link(candidate, target).catch(() => copyFile(candidate, target)); linked = true; break; }
    }
    if (!linked) {
      const url = requireString(record.url, 'download url');
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`${url} answered ${response.status}.`);
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target));
    }
    if (!await good(target)) throw new Error(`${name} (${String(record.url)}) is not its pinned ${size} bytes.`);
  }
  return target;
}

export async function installNacoToolchain(caches: readonly string[] = []) {
  const pins = await nacoToolchainDescriptor(), { entry } = pins, root = TOOLCHAIN_ROOT, downloads = resolve(root, 'downloads');
  if (await nacoToolchainPath().then(() => true, () => false)) return root;
  await mkdir(downloads, { recursive: true });
  const kitArchive = requireString(entry.kit, 'kit');
  const archives = await Promise.all(requireArray(entry.downloads, 'downloads').map(record => fetchKit(requireRecord(record, 'download'), downloads, caches)));
  const build = resolve(root, 'build');
  await mkdir(build, { recursive: true });
  run('tar', ['-xzf', archives.find(path => path.endsWith(kitArchive))!], { cwd: build });
  const kit = resolve(build, kitArchive.replace(/\.tar\.gz$/u, ''));
  // ESO's installer asks for confirmation when a target directory is missing and refuses to ask without a terminal: both
  // exist before it runs, and it reads an empty answer. It writes its own configuration into HOME, which is the kit's own.
  const home = resolve(root, 'home');
  for (const directory of [home, resolve(root, 'pipeline'), resolve(root, 'calib')]) await mkdir(directory, { recursive: true });
  run('./install_pipeline', [resolve(root, 'pipeline'), resolve(root, 'calib')], { cwd: kit, input: '', env: { HOME: home } });
  const esorex = resolve(root, 'pipeline/bin/esorex');
  if (!await exists(esorex)) throw new Error(`install_pipeline wrote no esorex at ${esorex}.`);
  const plugins = resolve(root, 'pipeline/lib/esopipes-plugins');
  const installed = (await readdir(plugins).catch(() => [])).filter(name => name.startsWith('naco-'));
  if (installed.length !== 1) throw new Error(`${installed.length} naco plugin directories in ${plugins}.`);
  // The build tree is not needed at run time, and neither is the downloaded archive; the disk is kept for data.
  await rm(kit, { recursive: true, force: true });
  await rm(downloads, { recursive: true, force: true });
  writeInstalledMarker(root, pins);
  return root;
}

/** The installed toolchain's root, refusing a missing install or one built from a different pin. */
export async function nacoToolchainPath() {
  assertInstalledMarker(TOOLCHAIN_ROOT, await nacoToolchainDescriptor(), 'NACO', 'node packages/telescope-cli/src/archives/naco/toolchain.mts install');
  return TOOLCHAIN_ROOT;
}

/** The recipes the installed pipeline actually offers, from esorex itself. */
export async function installedRecipes() {
  const root = await nacoToolchainPath();
  // esorex writes an esorex.log into its working directory, so it is given one inside the toolchain: without a cwd it
  // inherits this process's and drops the file in the repository root.
  const logs = resolve(root, 'logs');
  await mkdir(logs, { recursive: true });
  const result = spawnSync(resolve(root, 'pipeline/bin/esorex'), [`--recipe-dir=${resolve(root, 'pipeline/lib/esopipes-plugins')}`, '--recipes'],
    { cwd: logs, env: { ...process.env, HOME: resolve(root, 'home'), DYLD_LIBRARY_PATH: resolve(root, 'pipeline/lib') }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`esorex --recipes failed (status ${String(result.status)}): ${result.stderr}`);
  return [...`${result.stdout}`.matchAll(/^\s{2}(naco_\w+)\s/gmu)].map(match => match[1]!);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, ...rest] = process.argv.slice(2);
  const caches = rest.flatMap((value, index) => rest[index - 1] === '--cache' ? [resolve(value)] : []);
  if (mode === 'install') console.log(`naco installed at ${await installNacoToolchain(caches)}`);
  else if (mode === 'verify') console.log(`naco installed at ${await nacoToolchainPath()}`);
  else if (mode === 'recipes') console.log((await installedRecipes()).join('\n'));
  else throw new TypeError('Usage: toolchain install [--cache <dir> ...] | verify | recipes');
}
