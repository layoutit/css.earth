#!/usr/bin/env node
/** Install and locate the pinned Keck reduction environment of toolchain.json under output/toolchains/keck (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/keck/toolchain.mts install
 *   node packages/telescope-cli/src/archives/keck/toolchain.mts verify
 *
 * micromamba creates Python from conda-forge; pip then installs requirements.lock, every package at the version the KCWI DRP's
 * own pip-compile output pins, without resolving further dependencies, so this environment is that file and nothing else. The
 * install keeps the descriptor and lock texts it was built from, and `keckToolchain` refuses an environment built from other pins.
 * micromamba itself is taken from PATH.
 *
 * Only the KCWI pipeline is installed. The OSIRIS DRP is IDL and does not run here; toolchain.json says so, and archive.mts
 * pins KOA's own OSIRIS products instead of re-running them. */
import { readToolchainDescriptor } from '../toolchain-descriptor.mts';
import { spawnSync } from 'node:child_process';
import { assertInstalledMarker, runToolchainProcess, WORKSPACE, writeInstalledMarker } from '@cssearth/telescope/node';
import { access, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = WORKSPACE;
/** The toolchain's pins (descriptor and lock) sit beside this code and the programs they reduce. */
const PINS = resolve(WORKSPACE, 'packages/telescope-cli/src/archives/keck');
export const KECK_ROOT = resolve(repository, 'output/toolchains/keck');

export async function installKeck() {
  const pins = await readToolchainDescriptor(PINS, 'keck'), { entry } = pins, prefix = resolve(KECK_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(KECK_ROOT, { recursive: true, force: true });
  await mkdir(KECK_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(KECK_ROOT, 'mamba') };
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
  runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-r', resolve(PINS, requireString(entry.requirements))]);
  await rm(resolve(KECK_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  writeInstalledMarker(KECK_ROOT, pins);
  return KECK_ROOT;
}

export interface KeckToolchain { readonly python: string; readonly sitePackages: string; readonly binaries: Readonly<Record<string, string>>; readonly env: NodeJS.ProcessEnv }

/** The installed environment's Python, the directory its packages live in (which is where the pipeline's own shipped
 * configuration is read from), the pipeline executables, and the variables a reduction runs with. The environment is headless:
 * matplotlib draws to Agg, the home directory is inside the toolchain, and the reduction turns the DRP's bokeh plotting off in
 * the configuration it passes, so no plot server is started. Refuses a missing install or one built from other pins. */
export async function keckToolchain(): Promise<KeckToolchain> {
  const pins = await readToolchainDescriptor(PINS, 'keck'), { entry } = pins, bin = resolve(KECK_ROOT, 'env/bin');
  assertInstalledMarker(KECK_ROOT, pins, 'Keck', 'node packages/telescope-cli/src/archives/keck/toolchain.mts install');
  const binaries: Record<string, string> = {};
  for (const [name, file] of Object.entries(requireRecord(entry.binaries, 'binaries'))) {
    binaries[name] = resolve(bin, requireString(file, name));
    if (!await access(binaries[name]!).then(() => true, () => false)) throw new Error(`The Keck toolchain has no ${name} (${requireString(file, name)}).`);
  }
  const python = resolve(bin, 'python');
  const env = { PATH: `${bin}:${process.env.PATH ?? ''}`, MPLBACKEND: 'Agg', HOME: resolve(KECK_ROOT, 'home'), BOKEH_RESOURCES: 'inline' };
  // Where the installed packages are is asked of the environment itself rather than built from a Python version in a path.
  const site = spawnSync(python, ['-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], { env: { ...process.env, ...env }, encoding: 'utf8' });
  if (site.status !== 0) throw new Error(`The Keck toolchain does not state where its packages are: ${(site.stderr ?? '').slice(-2000)}`);
  return { python, sitePackages: site.stdout.trim(), binaries, env };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`The Keck toolchain is installed at ${await installKeck()}`);
  else if (mode === 'verify') {
    const toolchain = await keckToolchain();
    const version = spawnSync(toolchain.python, ['-c',
      'import kcwidrp, keckdrpframework; from importlib.metadata import version as v; print(v("kcwidrp"), "on keckdrpframework", v("keckdrpframework"))'],
      { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
    if (version.status !== 0) throw new Error(`The Keck toolchain does not import: ${(version.stderr ?? '').slice(-2000)}`);
    console.log(`Keck ready: ${toolchain.python}; kcwidrp ${version.stdout.trim()}; ${Object.keys(toolchain.binaries).join(', ')}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
