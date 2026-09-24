#!/usr/bin/env node
/** Install and locate the pinned ESO VLT/NACO pipeline under output/toolchains/naco (ignored by git).
 *
 *   node tools/objects/naco/toolchain.mts install [--cache <dir> ...]
 *   node tools/objects/naco/toolchain.mts verify
 *   node tools/objects/naco/toolchain.mts recipes
 *
 * The kit is ESO's own, downloaded from ftp.eso.org and verified against both digests this repository can state for it: the
 * sha256 measured here, and the BSD `cksum` value ESO publishes beside the kit. Its `install_pipeline` builds erfa, fftw, cpl,
 * cfitsio, wcslib, gsl, esorex and the naco recipes into `pipeline`, and unpacks the static calibration into `calib`.
 *
 * The interferometry toolchains install the same way, but that installer reads its own descriptor and its own list of ids
 * (tools/objects/interferometry/toolchain.mts), and NACO is not an interferometer. What is shared is what runs the result:
 * `esoEnvironment` and `runRecipe` from eso-pipeline.mts, which this module does not repeat.
 *
 * An installed toolchain records the sha256 of toolchain.json; `verify` and `nacoToolchainPath` refuse one built from another
 * pin. The verified archive is deleted after the build. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, copyFile, link, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export const DESCRIPTOR = resolve(import.meta.dirname, 'toolchain.json');
export const TOOLCHAIN_ROOT = resolve(repository, 'output/toolchains/naco');

const exists = (path: string) => access(path).then(() => true, () => false);

/** The pinned descriptor and the digest an install records, so a changed pin invalidates the build. */
export async function nacoToolchainDescriptor() {
  const entry = requireRecord(JSON.parse(await readFile(DESCRIPTOR, 'utf8')) as unknown, 'toolchain.json');
  return { entry, digest: sha256(JSON.stringify(entry)) };
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

/** BSD cksum of a file: the CRC ESO publishes beside each kit, and the only digest it states for one. */
export function cksum(bytes: Uint8Array) {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index << 24;
    for (let bit = 0; bit < 8; bit++) value = value & 0x80000000 ? ((value << 1) ^ 0x04c11db7) >>> 0 : (value << 1) >>> 0;
    table[index] = value >>> 0;
  }
  let crc = 0;
  for (const byte of bytes) crc = ((crc << 8) ^ table[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  for (let length = bytes.length; length > 0; length >>>= 8) crc = ((crc << 8) ^ table[((crc >>> 24) ^ (length & 0xff)) & 0xff]!) >>> 0;
  return { crc: (~crc >>> 0), bytes: bytes.length };
}

/** The pinned kit, from a cache directory that already holds it or from ESO, verified by size, sha256 and ESO's own cksum. */
async function fetchKit(record: Record<string, unknown>, directory: string, caches: readonly string[]) {
  const name = requireString(record.path, 'download path'), digest = requireString(record.sha256, 'download sha256');
  const size = requireFiniteNumber(record.bytes, 'download bytes'), stated = requireString(record.cksum, 'download cksum');
  const target = resolve(directory, name);
  const good = async (path: string) => await exists(path) && await sha256File(path).then(result => result.sha256 === digest && result.bytes === size, () => false);
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
    if (!await good(target)) throw new Error(`${name} does not match its pinned sha256 (${size} bytes expected).`);
  }
  const measured = cksum(await readFile(target));
  if (`${measured.crc} ${measured.bytes} ${name}` !== stated) throw new Error(`${name}: cksum is "${measured.crc} ${measured.bytes} ${name}", not ESO's "${stated}".`);
  return target;
}

export async function installNacoToolchain(caches: readonly string[] = []) {
  const { entry, digest } = await nacoToolchainDescriptor(), root = TOOLCHAIN_ROOT, downloads = resolve(root, 'downloads');
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
  // The build tree is not needed at run time, and neither is the verified archive; the disk is kept for data.
  await rm(kit, { recursive: true, force: true });
  await rm(downloads, { recursive: true, force: true });
  await writeFile(resolve(root, 'installed.json'), `${JSON.stringify({ id: 'naco', descriptorSha256: digest, plugins: installed[0] }, null, 2)}\n`);
  return root;
}

/** The installed toolchain's root, refusing a missing install or one built from a different pin. */
export async function nacoToolchainPath() {
  const { digest } = await nacoToolchainDescriptor();
  const marker = await readFile(resolve(TOOLCHAIN_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown, 'installed.json'), () => null);
  if (!marker) throw new Error('The NACO toolchain is not installed: node tools/objects/naco/toolchain.mts install');
  if (marker.descriptorSha256 !== digest) throw new Error('The NACO toolchain was built from another toolchain.json; reinstall it.');
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
