#!/usr/bin/env node
/** Install and locate the pinned Python environments the JWST tools run on, under output/toolchains/<id> (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/jwst/toolchain.mts install [eureka|klip]
 *   node packages/telescope-cli/src/archives/jwst/toolchain.mts verify [eureka|klip]
 *
 * eureka (toolchain.json) is the STScI jwst pipeline with Eureka! for time series, level-3 imaging and cubes. klip
 * (klip/toolchain.json) is spaceKLIP on the pipeline version a coronagraphy paper ran, for starlight subtraction by KLIP.
 * micromamba creates Python from conda-forge; pip installs the descriptor's lock, every package at its pinned version or commit,
 * without resolving further dependencies; the descriptor's patches are applied to the installed sources and each must match
 * exactly once, and its data archives are fetched and checked by size. The install keeps the descriptor and lock texts it was
 * built from, and the toolchain refuses an environment built from other pins. micromamba itself is taken from PATH (Homebrew's
 * `micromamba`). */
import { assertInstalledMarker, runToolchainProcess, WORKSPACE, writeInstalledMarker, type ToolchainPins } from '@cssearth/telescope/node';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const repository = WORKSPACE;
export type ToolchainId = 'eureka' | 'klip';
/** The toolchains' pins (descriptors and locks) sit beside this code and the programs they reduce. */
const PINS = resolve(WORKSPACE, 'packages/telescope-cli/src/archives/jwst');
const DESCRIPTORS: Record<ToolchainId, string> = { eureka: resolve(PINS, 'toolchain.json'), klip: resolve(PINS, 'klip/toolchain.json') };
const NAMES: Record<ToolchainId, string> = { eureka: 'Eureka!', klip: 'spaceKLIP' };
export const toolchainRoot = (id: ToolchainId) => resolve(repository, 'output/toolchains', id);
export const EUREKA_ROOT = toolchainRoot('eureka');

function requireToolchainId(value: string | undefined): ToolchainId {
  if (value === undefined) return 'eureka';
  if (value !== 'eureka' && value !== 'klip') throw new TypeError(`Unknown JWST toolchain ${value}; use eureka or klip.`);
  return value;
}

async function descriptor(id: ToolchainId): Promise<ToolchainPins & { readonly lock: string; readonly lockPath: string }> {
  const path = DESCRIPTORS[id], text = await readFile(path, 'utf8'), file = relative(WORKSPACE, path);
  const entry = requireRecord(JSON.parse(text) as unknown, file);
  const lockPath = resolve(path, '..', requireString(entry.requirements, `${file} requirements`));
  const lock = await readFile(lockPath, 'utf8');
  return { id, file, descriptor: text, lock, lockPath, entry };
}

/** Fetch one pinned data archive into the toolchain and unpack it where the descriptor says; the bytes must be its pinned size. */
async function installData(root: string, record: unknown) {
  const data = requireRecord(record, 'data'), url = requireString(data.url, 'data url'), size = requireFiniteNumber(data.bytes, `${url} bytes`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== size) throw new Error(`${url} is ${bytes.length} bytes, not the pinned ${size}.`);
  const archive = resolve(root, 'data.tar.gz'), target = resolve(root, requireString(data.directory));
  await mkdir(target, { recursive: true });
  await writeFile(archive, bytes);
  runToolchainProcess('tar', ['-xzf', archive, '-C', target]);
  await rm(archive);
}

export async function installToolchain(id: ToolchainId) {
  const pins = await descriptor(id), { entry, lockPath } = pins, root = toolchainRoot(id), prefix = resolve(root, 'env');
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
  writeInstalledMarker(root, pins);
  return root;
}

export const installEureka = () => installToolchain('eureka');

export interface JwstToolchain { readonly python: string; readonly env: NodeJS.ProcessEnv }
export type EurekaToolchain = JwstToolchain;

/** The installed environment's Python and the variables a reduction runs with: a CRDS cache of its own and the pinned context,
 * so reference files are the ones the recorded run used, plus each data archive's variable. Refuses a missing install or one
 * built from other pins. */
export async function jwstToolchain(id: ToolchainId, crdsContext: string): Promise<JwstToolchain> {
  const pins = await descriptor(id), { entry } = pins, root = toolchainRoot(id);
  assertInstalledMarker(root, pins, NAMES[id], `node packages/telescope-cli/src/archives/jwst/toolchain.mts install ${id}`);
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
