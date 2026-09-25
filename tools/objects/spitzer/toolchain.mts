#!/usr/bin/env node
/** Install and locate the pinned Spitzer re-mosaic environment of toolchain.json under output/toolchains/spitzer (ignored by
 * git).
 *
 *   node tools/objects/spitzer/toolchain.mts install
 *   node tools/objects/spitzer/toolchain.mts verify
 *
 * This is not the observatory's software. Spitzer's own post-BCD mosaicker is MOPEX, and `toolchain.json`'s `official` block
 * records, as a measurement with its date and machine, that its macOS build could not be run here: the binaries are x86_64
 * Mach-O, Rosetta 2 is installed, and Gatekeeper still refused the unsigned quarantined distribution. So this environment
 * carries an open, pinned reprojection stack instead, and every product it makes says which it was.
 *
 * micromamba creates Python from conda-forge; pip then installs requirements.lock, every package at its pinned version, with
 * `--no-deps`, so the resolver never chooses anything. The install records the sha256 of the descriptor and the lock together,
 * and `spitzerToolchain` refuses an environment built from other pins. micromamba itself is taken from PATH. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runToolchainProcess } from '@cssearth/telescope/node';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export const SPITZER_ROOT = resolve(repository, 'output/toolchains/spitzer');
/** The packages a run imports; a verify that cannot import one of these is a broken environment, not a warning. */
export const REQUIRED_MODULES = ['numpy', 'astropy', 'reproject', 'scipy'] as const;

export async function spitzerDescriptor() {
  const path = resolve(import.meta.dirname, 'toolchain.json');
  const text = await readFile(path, 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = await readFile(resolve(import.meta.dirname, requireString(entry.requirements)), 'utf8');
  return { entry, lock, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

export async function installSpitzer() {
  const { entry, digest } = await spitzerDescriptor(), prefix = resolve(SPITZER_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(SPITZER_ROOT, { recursive: true, force: true });
  await mkdir(SPITZER_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(SPITZER_ROOT, 'mamba') };
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
  runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-q', '-r', resolve(import.meta.dirname, requireString(entry.requirements))]);
  await rm(resolve(SPITZER_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(SPITZER_ROOT, 'installed.json'), `${JSON.stringify({ id: 'spitzer', pinsSha256: digest }, null, 2)}\n`);
  return SPITZER_ROOT;
}

export interface SpitzerToolchain {
  readonly python: string;
  /** The digest of toolchain.json and requirements.lock together; a product record carries it, so a product made from other
   * pins is never mistaken for this one. */
  readonly digest: string;
  readonly env: NodeJS.ProcessEnv;
}

/** The installed environment's Python and the variables a run uses. Matplotlib is forced to a file backend and every threaded
 * numerical library to one thread: a mosaic must not open a window, and a coadd must give the same bytes on every machine.
 * Refuses a missing install or one built from other pins. */
export async function spitzerToolchain(): Promise<SpitzerToolchain> {
  const { digest } = await spitzerDescriptor(), bin = resolve(SPITZER_ROOT, 'env/bin'), python = resolve(bin, 'python');
  const marker = await readFile(resolve(SPITZER_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The Spitzer toolchain is not installed: node tools/objects/spitzer/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The Spitzer toolchain was installed from other pins; reinstall it.');
  if (!await access(python).then(() => true, () => false)) throw new Error(`The Spitzer toolchain has no python at ${python}.`);
  return {
    python, digest,
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, MPLBACKEND: 'Agg', PYTHONNOUSERSITE: '1',
      OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1' },
  };
}

/** The versions of the packages a product record names, read from the environment that will run, not from the lock: a lock
 * says what should be installed and this says what is. */
export async function spitzerSoftware(toolchain: SpitzerToolchain): Promise<{ name: string; version: string }[]> {
  const script = `import importlib\nfor name in ${JSON.stringify(REQUIRED_MODULES)}:\n    print(name, importlib.import_module(name).__version__)\n`;
  const result = spawnSync(toolchain.python, ['-c', script], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`The Spitzer toolchain cannot import its packages: ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout.trim().split('\n').map(line => {
    const [name, version] = line.trim().split(/\s+/u);
    if (!name || !version) throw new Error(`Unreadable package version line: ${line}`);
    return { name, version };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`The Spitzer toolchain is installed at ${await installSpitzer()}`);
  else if (mode === 'verify') {
    const toolchain = await spitzerToolchain();
    const software = await spitzerSoftware(toolchain);
    console.log(`Spitzer ready: ${toolchain.python}; ${software.map(entry => `${entry.name} ${entry.version}`).join(', ')}; pins ${toolchain.digest.slice(0, 12)}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
