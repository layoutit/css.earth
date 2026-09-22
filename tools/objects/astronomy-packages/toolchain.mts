#!/usr/bin/env node
/** Install and locate the pinned shared astronomy packages under output/toolchains/astroquery (ignored by git). */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { accessSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const ASTROQUERY_ROOT = resolve(repository, 'output/toolchains/astroquery');

function descriptor() {
  const text = readFileSync(resolve(import.meta.dirname, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = readFileSync(resolve(import.meta.dirname, requireString(entry.requirements)), 'utf8');
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
  for (const value of requireArray(entry.sourcePackages, 'sourcePackages')) {
    const source = requireRecord(value, 'source package');
    if (source.build !== 'installed-numpy') throw new TypeError('A source package must state the installed-numpy build policy.');
    const requirement = `${requireString(source.name)} @ ${requireString(source.url)}#sha256=${requireString(source.sha256)}`;
    run(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-build-isolation', '--no-deps', '-q', requirement]);
  }
  await rm(resolve(ASTROQUERY_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(ASTROQUERY_ROOT, 'installed.json'), `${JSON.stringify({ id: 'astroquery', pinsSha256: digest }, null, 2)}\n`);
  return ASTROQUERY_ROOT;
}

export interface AstroqueryToolchain {
  readonly python: string; readonly digest: string; readonly version: string; readonly pyvoVersion: string;
  readonly scipyVersion: string; readonly batmanVersion: string; readonly cdflibVersion: string; readonly pyuvdataVersion: string; readonly astropyHealpixVersion:string; readonly env: NodeJS.ProcessEnv;
}

export function astroqueryToolchainSync(): AstroqueryToolchain {
  const { entry, digest } = descriptor(), bin = resolve(ASTROQUERY_ROOT, 'env/bin'), python = resolve(bin, 'python');
  let marker: Record<string, unknown> | null = null;
  try { marker = requireRecord(JSON.parse(readFileSync(resolve(ASTROQUERY_ROOT, 'installed.json'), 'utf8')) as unknown); } catch { /* reported below */ }
  if (!marker) throw new Error('The astronomy packages are not installed: node tools/objects/astronomy-packages/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The astronomy packages were installed from other pins; reinstall them.');
  try { accessSync(python); } catch { throw new Error(`The Astroquery toolchain has no python at ${python}.`); }
  return { python, digest, version: requireString(entry.astroquery), pyvoVersion: requireString(entry.pyvo), scipyVersion: requireString(entry.scipy),
    batmanVersion: requireString(entry.batman), cdflibVersion: requireString(entry.cdflib), pyuvdataVersion: requireString(entry.pyuvdata), astropyHealpixVersion:requireString(entry.astropyHealpix), env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

export async function astroqueryToolchain(): Promise<AstroqueryToolchain> { return astroqueryToolchainSync(); }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`Astronomy packages are installed at ${await installAstroquery()}`);
  else if (mode === 'verify') {
    const toolchain = await astroqueryToolchain();
    const code = "import astroquery, astropy_healpix, importlib.metadata, pyvo, scipy, cdflib, pyuvdata; from astroquery import alma, mast, vizier; print(astroquery.__version__, pyvo.__version__, scipy.__version__, importlib.metadata.version('batman-package'), cdflib.__version__, pyuvdata.__version__, astropy_healpix.__version__)";
    const found = run(toolchain.python, ['-c', code], toolchain.env).trim(), expected = `${toolchain.version} ${toolchain.pyvoVersion} ${toolchain.scipyVersion} ${toolchain.batmanVersion} ${toolchain.cdflibVersion} ${toolchain.pyuvdataVersion} ${toolchain.astropyHealpixVersion}`;
    if (found !== expected) throw new Error(`Expected ${expected}, found ${found}.`);
    console.log(`Astronomy packages ready: Astroquery ${toolchain.version}, PyVO ${toolchain.pyvoVersion}, SciPy ${toolchain.scipyVersion}, batman ${toolchain.batmanVersion}, cdflib ${toolchain.cdflibVersion}, pyuvdata ${toolchain.pyuvdataVersion}, astropy-healpix ${toolchain.astropyHealpixVersion}; pins ${toolchain.digest.slice(0, 12)}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
