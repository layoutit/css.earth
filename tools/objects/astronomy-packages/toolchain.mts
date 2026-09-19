#!/usr/bin/env node
/** Install and locate the one pinned Astroquery archive client under output/toolchains/astroquery (ignored by git). */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const ASTROQUERY_ROOT = resolve(repository, 'output/toolchains/astroquery');

async function descriptor() {
  const text = await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = await readFile(resolve(import.meta.dirname, requireString(entry.requirements)), 'utf8');
  return { entry, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}

export async function installAstroquery() {
  const { entry, digest } = await descriptor(), prefix = resolve(ASTROQUERY_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(ASTROQUERY_ROOT, { recursive: true, force: true });
  await mkdir(ASTROQUERY_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(ASTROQUERY_ROOT, 'mamba') };
  run('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], env);
  run(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--require-hashes', '--no-deps', '-q', '-r', resolve(import.meta.dirname, requireString(entry.requirements))]);
  await rm(resolve(ASTROQUERY_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(ASTROQUERY_ROOT, 'installed.json'), `${JSON.stringify({ id: 'astroquery', pinsSha256: digest }, null, 2)}\n`);
  return ASTROQUERY_ROOT;
}

export interface AstroqueryToolchain { readonly python: string; readonly digest: string; readonly version: string; readonly pyvoVersion: string; readonly env: NodeJS.ProcessEnv }

export async function astroqueryToolchain(): Promise<AstroqueryToolchain> {
  const { entry, digest } = await descriptor(), bin = resolve(ASTROQUERY_ROOT, 'env/bin'), python = resolve(bin, 'python');
  const marker = await readFile(resolve(ASTROQUERY_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The Astroquery archive client is not installed: node tools/objects/astronomy-packages/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The Astroquery archive client was installed from other pins; reinstall it.');
  if (!await access(python).then(() => true, () => false)) throw new Error(`The Astroquery toolchain has no python at ${python}.`);
  return { python, digest, version: requireString(entry.astroquery), pyvoVersion: requireString(entry.pyvo), env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`Astroquery is installed at ${await installAstroquery()}`);
  else if (mode === 'verify') {
    const toolchain = await astroqueryToolchain();
    const found = run(toolchain.python, ['-c', 'import astroquery, pyvo; from astroquery import alma, mast, vizier; print(astroquery.__version__, pyvo.__version__)'], toolchain.env).trim();
    if (found !== `${toolchain.version} ${toolchain.pyvoVersion}`) throw new Error(`Expected Astroquery ${toolchain.version} and PyVO ${toolchain.pyvoVersion}, found ${found}.`);
    console.log(`Astroquery ${toolchain.version} and PyVO ${toolchain.pyvoVersion} ready; pins ${toolchain.digest.slice(0, 12)}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
