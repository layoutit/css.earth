#!/usr/bin/env node
/** Install and locate the pinned HST calibration environment of toolchain.json under output/toolchains/hst (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/hst/toolchain.mts install
 *   node packages/telescope-cli/src/archives/hst/toolchain.mts verify
 *
 * micromamba creates Python and hstcal from conda-forge; hstcal carries the instrument pipelines as the executables STScI ships
 * them (cs0.e is calstis, calwf3.e, calacs.e). pip then installs requirements.lock, every package at its pinned version, without
 * resolving further dependencies. The install keeps the descriptor and lock texts it was built from, and `hstToolchain` refuses an
 * environment built from other pins. micromamba itself is resolved by the shared telescope owner.
 *
 * Reference files are not part of the environment: CRDS fetches the ones a pinned context selects into the cache under this
 * root the first time a calibration runs (calibrate.mts). */
import { verifyToolchainExecutables, installManagedToolchain, assertManagedPythonPlatform, resolveMicromamba, resolveInstalledToolchain, assertInstalledMarker, runToolchainProcessAsync, USER_ROOT } from '@cssearth/telescope-core/node';
import { packagePath } from '../../paths.mts';
import { readToolchainDescriptor } from '../toolchain-descriptor.mts';
import { spawnSync } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = USER_ROOT;
/** The toolchain's pins (descriptor and lock) sit beside this code and the programs they reduce. */
const PINS = packagePath('packages/telescope-cli/src/archives/hst');
export const HST_ROOT = resolve(repository, 'output/toolchains/hst');

export async function installHst() {
  assertManagedPythonPlatform();
  const prefix = resolve(HST_ROOT, 'env');
  return installManagedToolchain(HST_ROOT, () => readToolchainDescriptor(PINS, 'hst'), prefix, async pins => {
    const { entry } = pins, mamba = requireRecord(entry.micromamba, 'micromamba');
    const micromamba = await resolveMicromamba();
    await mkdir(HST_ROOT, { recursive: true });
    const env = { MAMBA_ROOT_PREFIX: resolve(HST_ROOT, 'mamba') };
    await runToolchainProcessAsync(micromamba, ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
    await runToolchainProcessAsync(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-r', resolve(PINS, requireString(entry.requirements))]);
    await rm(resolve(HST_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  }, async ({ entry }) => verifyToolchainExecutables(Object.values(requireRecord(entry.binaries, 'binaries')).map(file => resolve(prefix, 'bin', requireString(file)))));
}

export interface HstToolchain { readonly python: string; readonly binaries: Readonly<Record<string, string>>; readonly env: NodeJS.ProcessEnv }

/** The installed environment's Python, the instrument pipeline executables and the variables a calibration runs with: a CRDS
 * cache of its own and the pinned context, so reference files are the ones that context selects. `bin` is on PATH because
 * stistools, wfc3tools and acstools spawn the executables by name. Refuses a missing install or one built from other pins. */
export async function hstToolchain(crdsContext: string): Promise<HstToolchain> {
  const pins = await readToolchainDescriptor(PINS, 'hst'), { entry } = pins, root = resolveInstalledToolchain(HST_ROOT, pins) ?? HST_ROOT, bin = resolve(root, 'env/bin');
  assertInstalledMarker(root, pins, 'HST', 'node packages/telescope-cli/src/archives/hst/toolchain.mts install');
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
