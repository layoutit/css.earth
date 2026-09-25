/** Install and locate the one Peppi+pdr environment under output/toolchains/pds (ignored by git). */
import { createHash } from 'node:crypto';
import { runToolchainProcess } from './toolchain-process.js';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

export const PDS_TOOLCHAIN_ROOT = resolve(WORKSPACE, 'output/toolchains/pds');

async function descriptor() {
  const text = await readFile(resolve(TOOLCHAINS, 'pds-toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'pds-toolchain.json');
  return { entry, digest: createHash('sha256').update(text).digest('hex') };
}

export async function installPdsToolchain() {
  const { entry, digest } = await descriptor(), prefix = resolve(PDS_TOOLCHAIN_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(PDS_TOOLCHAIN_ROOT, { recursive: true, force: true });
  await mkdir(PDS_TOOLCHAIN_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(PDS_TOOLCHAIN_ROOT, 'mamba') };
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel),
    ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env });
  await rm(resolve(PDS_TOOLCHAIN_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(PDS_TOOLCHAIN_ROOT, 'installed.json'), `${JSON.stringify({ id: 'pds-packages', pinsSha256: digest }, null, 2)}\n`);
  return PDS_TOOLCHAIN_ROOT;
}

export interface PdsToolchain { readonly python: string; readonly digest: string; readonly peppiVersion: string; readonly pdrVersion: string; readonly env: NodeJS.ProcessEnv }

export async function pdsToolchain(): Promise<PdsToolchain> {
  const { entry, digest } = await descriptor(), bin = resolve(PDS_TOOLCHAIN_ROOT, 'env/bin'), python = resolve(bin, 'python');
  const marker = await readFile(resolve(PDS_TOOLCHAIN_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The PDS package toolchain is not installed: node tools/objects/astronomy-toolchains.mts pds install');
  if (marker.pinsSha256 !== digest) throw new Error('The PDS package toolchain was installed from other pins; reinstall it.');
  if (!await access(python).then(() => true, () => false)) throw new Error(`The PDS package toolchain has no python at ${python}.`);
  return { python, digest, peppiVersion: requireString(entry.peppi), pdrVersion: requireString(entry.pdr),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

/** Check the installed Peppi and pdr versions against the pins; the line `verify` prints. */
export async function verifyPdsToolchain(): Promise<string> {
  const toolchain = await pdsToolchain();
  const found = runToolchainProcess(toolchain.python, ['-c', 'from importlib.metadata import version; import pdr, pds.peppi; print(version("pds.peppi"), version("pdr"))'], { env: toolchain.env }).trim();
  if (found !== `${toolchain.peppiVersion} ${toolchain.pdrVersion}`) throw new Error(`Expected Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion}, found ${found}.`);
  return `Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion} ready; pins ${toolchain.digest.slice(0, 12)}`;
}
