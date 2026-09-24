#!/usr/bin/env node
/** Install and locate the one Peppi+pdr environment under output/toolchains/pds (ignored by git). */
import { createHash } from 'node:crypto';
import { runToolchainProcess } from '../toolchain-process.mts';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const PDS_TOOLCHAIN_ROOT = resolve(repository, 'output/toolchains/pds');

async function descriptor() {
  const text = await readFile(resolve(import.meta.dirname, 'pds-toolchain.json'), 'utf8');
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
  if (!marker) throw new Error('The PDS package toolchain is not installed: node tools/cli/run-typed-module.mjs tools/objects/astronomy-packages/pds-toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The PDS package toolchain was installed from other pins; reinstall it.');
  if (!await access(python).then(() => true, () => false)) throw new Error(`The PDS package toolchain has no python at ${python}.`);
  return { python, digest, peppiVersion: requireString(entry.peppi), pdrVersion: requireString(entry.pdr),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`PDS packages are installed at ${await installPdsToolchain()}`);
  else if (mode === 'verify') {
    const toolchain = await pdsToolchain();
    const found = runToolchainProcess(toolchain.python, ['-c', 'from importlib.metadata import version; import pdr, pds.peppi; print(version("pds.peppi"), version("pdr"))'], { env: toolchain.env }).trim();
    if (found !== `${toolchain.peppiVersion} ${toolchain.pdrVersion}`) throw new Error(`Expected Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion}, found ${found}.`);
    console.log(`Peppi ${toolchain.peppiVersion} and pdr ${toolchain.pdrVersion} ready; pins ${toolchain.digest.slice(0, 12)}`);
  } else throw new TypeError('Usage: pds-toolchain <install|verify>');
}
