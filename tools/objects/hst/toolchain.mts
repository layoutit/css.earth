#!/usr/bin/env node
import { readToolchainDescriptor } from '../toolchain-descriptor.mts';
/** Install and locate the pinned HST calibration environment of toolchain.json under output/toolchains/hst (ignored by git).
 *
 *   node tools/objects/hst/toolchain.mts install
 *   node tools/objects/hst/toolchain.mts verify
 *
 * micromamba creates Python and hstcal from conda-forge; hstcal carries the instrument pipelines as the executables STScI ships
 * them (cs0.e is calstis, calwf3.e, calacs.e). pip then installs requirements.lock, every package at its pinned version, without
 * resolving further dependencies. The install records the sha256 of the descriptor and the lock, and `hstToolchain` refuses an
 * environment built from other pins. micromamba itself is taken from PATH (Homebrew's `micromamba`).
 *
 * Reference files are not part of the environment: CRDS fetches the ones a pinned context selects into the cache under this
 * root the first time a calibration runs (calibrate.mts). */
import { spawnSync } from 'node:child_process';
import { runToolchainProcess } from '../toolchain-process.mts';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export const HST_ROOT = resolve(repository, 'output/toolchains/hst');

export async function installHst() {
  const { entry, digest } = await readToolchainDescriptor(import.meta.dirname), prefix = resolve(HST_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(HST_ROOT, { recursive: true, force: true });
  await mkdir(HST_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(HST_ROOT, 'mamba') };
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
  runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-r', resolve(import.meta.dirname, requireString(entry.requirements))]);
  await rm(resolve(HST_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(HST_ROOT, 'installed.json'), `${JSON.stringify({ id: 'hst', pinsSha256: digest }, null, 2)}\n`);
  return HST_ROOT;
}

export interface HstToolchain { readonly python: string; readonly binaries: Readonly<Record<string, string>>; readonly env: NodeJS.ProcessEnv }

/** The installed environment's Python, the instrument pipeline executables and the variables a calibration runs with: a CRDS
 * cache of its own and the pinned context, so reference files are the ones that context selects. `bin` is on PATH because
 * stistools, wfc3tools and acstools spawn the executables by name. Refuses a missing install or one built from other pins. */
export async function hstToolchain(crdsContext: string): Promise<HstToolchain> {
  const { entry, digest } = await readToolchainDescriptor(import.meta.dirname), bin = resolve(HST_ROOT, 'env/bin');
  const marker = await readFile(resolve(HST_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The HST toolchain is not installed: node tools/objects/hst/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The HST toolchain was installed from other pins; reinstall it.');
  const binaries: Record<string, string> = {};
  for (const [name, file] of Object.entries(requireRecord(entry.binaries, 'binaries'))) {
    binaries[name] = resolve(bin, requireString(file, name));
    if (!await access(binaries[name]!).then(() => true, () => false)) throw new Error(`The HST toolchain has no ${name} (${requireString(file, name)}).`);
  }
  return {
    python: resolve(bin, 'python'), binaries,
    env: { CRDS_PATH: resolve(HST_ROOT, 'crds'), CRDS_SERVER_URL: requireString(entry.crdsServer), CRDS_CONTEXT: crdsContext,
      PATH: `${bin}:${process.env.PATH ?? ''}`, MPLBACKEND: 'Agg' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`The HST toolchain is installed at ${await installHst()}`);
  else if (mode === 'verify') {
    const toolchain = await hstToolchain('hst_1358.pmap');
    const version = (name: string) => spawnSync(toolchain.binaries[name]!, ['--version'], { encoding: 'utf8' }).stdout.trim();
    console.log(`HST ready: ${toolchain.python}; ${Object.keys(toolchain.binaries).map(name => `${name} ${version(name)}`).join(', ')}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
