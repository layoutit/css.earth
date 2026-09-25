#!/usr/bin/env node
/** Install and locate the pinned Python environments the JWST tools run on, under output/toolchains/<id> (ignored by git).
 *
 *   node tools/objects/jwst/toolchain.mts install [eureka|klip]
 *   node tools/objects/jwst/toolchain.mts verify [eureka|klip]
 *
 * eureka (toolchain.json) is the STScI jwst pipeline with Eureka! for time series, level-3 imaging and cubes. klip
 * (klip/toolchain.json) is spaceKLIP on the pipeline version a coronagraphy paper ran, for starlight subtraction by KLIP.
 * micromamba creates Python from conda-forge; pip installs the descriptor's lock, every package at its pinned version or commit,
 * without resolving further dependencies; the descriptor's patches are applied to the installed sources and each must match
 * exactly once, and its data archives are fetched and checked by sha256. The install records the sha256 of the descriptor and
 * the lock, and the toolchain refuses an environment built from other pins. micromamba itself is taken from PATH (Homebrew's
 * `micromamba`). */
import { createHash } from 'node:crypto';
import { runToolchainProcess } from '@cssearth/telescope/node';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export type ToolchainId = 'eureka' | 'klip';
const DESCRIPTORS: Record<ToolchainId, string> = { eureka: resolve(import.meta.dirname, 'toolchain.json'), klip: resolve(import.meta.dirname, 'klip/toolchain.json') };
const NAMES: Record<ToolchainId, string> = { eureka: 'Eureka!', klip: 'spaceKLIP' };
export const toolchainRoot = (id: ToolchainId) => resolve(repository, 'output/toolchains', id);
export const EUREKA_ROOT = toolchainRoot('eureka');

function requireToolchainId(value: string | undefined): ToolchainId {
  if (value === undefined) return 'eureka';
  if (value !== 'eureka' && value !== 'klip') throw new TypeError(`Unknown JWST toolchain ${value}; use eureka or klip.`);
  return value;
}

async function descriptor(id: ToolchainId) {
  const path = DESCRIPTORS[id], text = await readFile(path, 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, path);
  const lockPath = resolve(path, '..', requireString(entry.requirements));
  const lock = await readFile(lockPath, 'utf8');
  return { entry, lockPath, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

/** Fetch one pinned data archive into the toolchain and unpack it where the descriptor says; the bytes must match its sha256. */
async function installData(root: string, record: unknown) {
  const data = requireRecord(record, 'data'), url = requireString(data.url), sha256 = requireString(data.sha256);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer()), digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== sha256) throw new Error(`${url} has sha256 ${digest}, not the pinned ${sha256}.`);
  const archive = resolve(root, 'data.tar.gz'), target = resolve(root, requireString(data.directory));
  await mkdir(target, { recursive: true });
  await writeFile(archive, bytes);
  runToolchainProcess('tar', ['-xzf', archive, '-C', target]);
  await rm(archive);
}

export async function installToolchain(id: ToolchainId) {
  const { entry, lockPath, digest } = await descriptor(id), root = toolchainRoot(id), prefix = resolve(root, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(root, 'mamba') };
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
  runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-r', lockPath]);
  const sitePackages = runToolchainProcess(resolve(prefix, 'bin/python'), ['-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])']).trim();
  for (const record of requireArray(entry.patches ?? [])) {
    const patch = requireRecord(record, 'patch'), path = resolve(sitePackages, requireString(patch.file));
    const source = await readFile(path, 'utf8'), find = requireString(patch.find);
    if (source.split(find).length !== 2) throw new Error(`${patch.file}: the patch target occurs ${source.split(find).length - 1} times, not once.`);
    await writeFile(path, source.replace(find, requireString(patch.replace)));
  }
  for (const record of requireArray(entry.data ?? [])) await installData(root, record);
  for (const record of requireArray(entry.caches ?? [])) await mkdir(resolve(root, requireString(requireRecord(record, 'cache').directory)), { recursive: true });
  await rm(resolve(root, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(root, 'installed.json'), `${JSON.stringify({ id, pinsSha256: digest }, null, 2)}\n`);
  return root;
}

export const installEureka = () => installToolchain('eureka');

export interface JwstToolchain { readonly python: string; readonly env: NodeJS.ProcessEnv }
export type EurekaToolchain = JwstToolchain;

/** The installed environment's Python and the variables a reduction runs with: a CRDS cache of its own and the pinned context,
 * so reference files are the ones the recorded run used, plus each data archive's variable. Refuses a missing install or one
 * built from other pins. */
export async function jwstToolchain(id: ToolchainId, crdsContext: string): Promise<JwstToolchain> {
  const { entry, digest } = await descriptor(id), root = toolchainRoot(id);
  const marker = await readFile(resolve(root, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error(`${NAMES[id]} is not installed: node tools/objects/jwst/toolchain.mts install ${id}`);
  if (marker.pinsSha256 !== digest) throw new Error(`${NAMES[id]} was installed from other pins; reinstall it.`);
  const dataEnv = Object.fromEntries([
    ...requireArray(entry.data ?? []).map(record => {
      const data = requireRecord(record, 'data');
      return [requireString(data.variable), resolve(root, requireString(data.directory), requireString(data.root))];
    }),
    ...requireArray(entry.caches ?? []).map(record => {
      const cache = requireRecord(record, 'cache');
      return [requireString(cache.variable), resolve(root, requireString(cache.directory))];
    }),
  ]);
  return {
    python: resolve(root, 'env/bin/python'),
    env: { CRDS_PATH: resolve(root, 'crds'), CRDS_SERVER_URL: requireString(entry.crdsServer), CRDS_CONTEXT: crdsContext, MPLBACKEND: 'Agg', ...dataEnv },
  };
}

export const eurekaToolchain = (crdsContext: string) => jwstToolchain('eureka', crdsContext);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, name] = process.argv.slice(2), id = requireToolchainId(name);
  const context = id === 'eureka' ? 'jwst_1535.pmap' : requireString((await descriptor(id)).entry.crdsContext);
  if (mode === 'install') console.log(`${NAMES[id]} installed at ${await installToolchain(id)}`);
  else if (mode === 'verify') console.log(`${NAMES[id]} ready: ${(await jwstToolchain(id, context)).python}`);
  else throw new TypeError('Usage: toolchain <install|verify> [eureka|klip]');
}
