#!/usr/bin/env node
/** Install and locate the pinned codes of toolchain.json under output/toolchains/zdi (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/espadons/toolchain.mts install|verify
 *
 * A Python environment with the pinned packages, ZDIpy checked out at its pinned commit beside it, and Julia from its
 * pinned archive (verified by size) with the environment of korg/ instantiated into the toolchain's own depot. An
 * installed toolchain keeps the text of its descriptor; `verify` and `toolchainPaths` refuse one built from another. */
import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { assertInstalledMarker, WORKSPACE, writeInstalledMarker, type ToolchainPins } from '@cssearth/telescope/node';

const FILE = 'packages/telescope-cli/src/archives/espadons/toolchain.json', ROOT = resolve(WORKSPACE, 'output/toolchains/zdi'), INSTALL = 'node packages/telescope-cli/src/archives/espadons/toolchain.mts install';
const exists = (path: string) => access(path).then(() => true, () => false);

export async function toolchainPins(): Promise<ToolchainPins> {
  const descriptor = await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8'), entry = requireRecord(JSON.parse(descriptor) as unknown, FILE);
  return { id: requireString(entry.id, 'id'), file: FILE, descriptor, lock: null, entry };
}
function run(command: string, args: readonly string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${cwd} (status ${result.status}).`);
}
const paths = (entry: Record<string, unknown>) => { const julia = requireRecord(entry.julia, 'julia');
  return { root: ROOT, python: resolve(ROOT, 'venv/bin/python'), zdipy: resolve(ROOT, 'ZDIpy'), julia: resolve(ROOT, requireString(julia.executable, 'julia executable')), juliaEnvironment: resolve(WORKSPACE, requireString(julia.environment, 'julia environment')), juliaDepot: resolve(ROOT, 'depot') }; };

export async function installToolchain() {
  const pins = await toolchainPins(), { entry } = pins, { python, zdipy, julia, juliaEnvironment, juliaDepot } = paths(entry), source = requireRecord(entry.zdipy, 'zdipy');
  await mkdir(ROOT, { recursive: true });
  if (!await exists(python)) run(requireString(entry.python, 'python'), ['-m', 'venv', resolve(ROOT, 'venv')], ROOT);
  run(resolve(ROOT, 'venv/bin/pip'), ['install', '--quiet', '--disable-pip-version-check', ...requireArray(entry.requirements).map(value => requireString(value))], ROOT);
  if (!await exists(zdipy)) run('git', ['clone', '--quiet', requireString(source.url, 'zdipy url'), zdipy], ROOT);
  run('git', ['checkout', '--quiet', '--detach', requireString(source.commit, 'zdipy commit')], zdipy);
  if (!await exists(julia)) { const download = requireRecord(requireRecord(entry.julia, 'julia').download, 'julia download'), archive = resolve(ROOT, requireString(download.path, 'julia archive')), bytes = requireFiniteNumber(download.bytes, 'julia bytes');
    const response = await fetch(requireString(download.url, 'julia url')); if (!response.ok || !response.body) throw new Error(`${String(download.url)} answered ${response.status}.`);
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(archive));
    if ((await stat(archive)).size !== bytes) throw new Error(`${archive} is not its pinned ${bytes} bytes.`);
    run('tar', ['-xzf', archive], ROOT); await rm(archive, { force: true }); }
  const instantiated = spawnSync(julia, [`--project=${juliaEnvironment}`, '-e', 'using Pkg; Pkg.instantiate(); using Korg'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, JULIA_DEPOT_PATH: juliaDepot } });
  if (instantiated.status !== 0) throw new Error(`Julia could not instantiate ${juliaEnvironment} (status ${instantiated.status}).`);
  writeInstalledMarker(ROOT, pins);
  return ROOT;
}

/** The installed interpreter and ZDIpy's directory, refusing a missing install or one built from other pins. */
export async function toolchainPaths() {
  const pins = await toolchainPins();
  assertInstalledMarker(ROOT, pins, 'magnetic mapping', INSTALL);
  return { ...paths(pins.entry), pins };
}

/** Run a Julia script in the toolchain's environment and return what it printed. */
export function runJulia(tools: { readonly julia: string; readonly juliaEnvironment: string; readonly juliaDepot: string }, args: readonly string[]) {
  const result = spawnSync(tools.julia, [`--project=${tools.juliaEnvironment}`, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, JULIA_DEPOT_PATH: tools.juliaDepot } });
  if (result.status !== 0) throw new Error(`${args[0]} failed (status ${result.status}): ${`${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-12).join('\n')}`);
  return result.stdout;
}

/** Run the toolchain's interpreter and return what it printed; a failure carries the end of what the code said. */
export function runPython(python: string, args: readonly string[], options: { readonly cwd?: string; readonly path?: string } = {}) {
  const result = spawnSync(python, ['-W', 'ignore', ...args], { cwd: options.cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, MPLBACKEND: 'Agg', ...(options.path ? { PYTHONPATH: options.path } : {}) } });
  if (result.status !== 0) throw new Error(`${args[0]} failed (status ${result.status}): ${`${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-12).join('\n')}`);
  return result.stdout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (mode === 'install') console.log(`installed at ${await installToolchain()}`);
  else if (mode === 'verify') console.log(`installed at ${(await toolchainPaths()).root}`);
  else throw new TypeError('Usage: toolchain.mts install|verify');
}
