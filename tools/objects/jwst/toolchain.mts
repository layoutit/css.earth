#!/usr/bin/env node
/** Install and locate the pinned Eureka! environment of toolchain.json under output/toolchains/eureka (ignored by git).
 *
 *   node tools/objects/jwst/toolchain.mts install
 *   node tools/objects/jwst/toolchain.mts verify
 *
 * micromamba creates Python from conda-forge; pip installs requirements.lock, every package at its pinned version or commit,
 * without resolving further dependencies; the descriptor's patches are applied to the installed sources and each must match
 * exactly once. The install records the sha256 of the descriptor and the lock, and `eurekaToolchain` refuses an environment
 * built from other pins. micromamba itself is taken from PATH (Homebrew's `micromamba`). */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const EUREKA_ROOT = resolve(repository, 'output/toolchains/eureka');

async function descriptor() {
  const text = await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = await readFile(resolve(import.meta.dirname, requireString(entry.requirements)), 'utf8');
  return { entry, lock, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}

export async function installEureka() {
  const { entry, digest } = await descriptor(), prefix = resolve(EUREKA_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(EUREKA_ROOT, { recursive: true, force: true });
  await mkdir(EUREKA_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(EUREKA_ROOT, 'mamba') };
  run('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], env);
  run(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-r', resolve(import.meta.dirname, requireString(entry.requirements))]);
  const sitePackages = run(resolve(prefix, 'bin/python'), ['-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])']).trim();
  for (const record of requireArray(entry.patches)) {
    const patch = requireRecord(record, 'patch'), path = resolve(sitePackages, requireString(patch.file));
    const source = await readFile(path, 'utf8'), find = requireString(patch.find);
    if (source.split(find).length !== 2) throw new Error(`${patch.file}: the patch target occurs ${source.split(find).length - 1} times, not once.`);
    await writeFile(path, source.replace(find, requireString(patch.replace)));
  }
  await rm(resolve(EUREKA_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(EUREKA_ROOT, 'installed.json'), `${JSON.stringify({ id: 'eureka', pinsSha256: digest }, null, 2)}\n`);
  return EUREKA_ROOT;
}

export interface EurekaToolchain { readonly python: string; readonly env: NodeJS.ProcessEnv }

/** The installed environment's Python and the variables a reduction runs with: a CRDS cache of its own and the pinned context,
 * so reference files are the ones the recorded run used. Refuses a missing install or one built from other pins. */
export async function eurekaToolchain(crdsContext: string): Promise<EurekaToolchain> {
  const { entry, digest } = await descriptor();
  const marker = await readFile(resolve(EUREKA_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('Eureka! is not installed: node tools/objects/jwst/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('Eureka! was installed from other pins; reinstall it.');
  return {
    python: resolve(EUREKA_ROOT, 'env/bin/python'),
    env: { CRDS_PATH: resolve(EUREKA_ROOT, 'crds'), CRDS_SERVER_URL: requireString(entry.crdsServer), CRDS_CONTEXT: crdsContext, MPLBACKEND: 'Agg' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`Eureka! installed at ${await installEureka()}`);
  else if (mode === 'verify') console.log(`Eureka! ready: ${(await eurekaToolchain('jwst_1535.pmap')).python}`);
  else throw new TypeError('Usage: toolchain <install|verify>');
}
