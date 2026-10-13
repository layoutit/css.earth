/** Install and locate the one Peppi+pdr environment under output/toolchains/pds (ignored by git). */
import { installManagedToolchain } from './environment.js';
import { resolveMicromamba, assertManagedPythonPlatform } from './micromamba.js';
import { resolveInstalledToolchain } from './resolver.js';
import { runToolchainProcess } from './process.js';
import { access, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { USER_ROOT } from '../paths/index.js';
import { assertInstalledMarker, readToolchainPins } from './marker.js';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

export const PDS_TOOLCHAIN_ROOT = resolve(USER_ROOT, 'output/toolchains/pds');

const INSTALL = 'telescope toolchain install pds';
const descriptor = () => readToolchainPins('pds-packages', 'pds-toolchain.json');

export async function installPdsToolchain() {
  assertManagedPythonPlatform();
  const prefix = resolve(PDS_TOOLCHAIN_ROOT, 'env');
  return installManagedToolchain(PDS_TOOLCHAIN_ROOT, descriptor, prefix, async pins => {
    const { entry } = pins, mamba = requireRecord(entry.micromamba, 'micromamba');

    const micromamba = await resolveMicromamba();
    await mkdir(PDS_TOOLCHAIN_ROOT, { recursive: true });
    const env = { MAMBA_ROOT_PREFIX: resolve(PDS_TOOLCHAIN_ROOT, 'mamba') };
    runToolchainProcess(micromamba, ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel),
      ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env });
    await rm(resolve(PDS_TOOLCHAIN_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  }, () => { runToolchainProcess(resolve(prefix, 'bin/python'), ['-I', '-c', 'import pdr, pds.peppi']); });
}

export interface PdsToolchain { readonly python: string; readonly peppiVersion: string; readonly pdrVersion: string; readonly env: NodeJS.ProcessEnv }

export async function pdsToolchain(): Promise<PdsToolchain> {
  const pins = descriptor(), { entry } = pins, root = resolveInstalledToolchain(PDS_TOOLCHAIN_ROOT, pins) ?? PDS_TOOLCHAIN_ROOT, bin = resolve(root, 'env/bin'), python = resolve(bin, 'python');
  assertInstalledMarker(root, pins, 'PDS package', INSTALL);
  if (!await access(python).then(() => true, () => false)) throw new Error(`The PDS package toolchain has no python at ${python}.`);
  return { python, peppiVersion: requireString(entry.peppi), pdrVersion: requireString(entry.pdr),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

/** Check the installed Peppi and pdr versions against the pins; the line `verify` prints. */
export async function verifyPdsToolchain(): Promise<string> {
  const toolchain = await pdsToolchain();
  const found = runToolchainProcess(toolchain.python, ['-c', 'from importlib.metadata import version; import pdr, pds.peppi; print(version("pds.peppi"), version("pdr"))'], { env: toolchain.env }).trim();
  if (found !== `${toolchain.peppiVersion} ${toolchain.pdrVersion}`) throw new Error(`Expected Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion}, found ${found}.`);
  return `Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion} ready`;
}
