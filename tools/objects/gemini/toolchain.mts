#!/usr/bin/env node
/** Install and locate the pinned DRAGONS environment of toolchain.json under output/toolchains/gemini (ignored by git).
 *
 *   node tools/objects/gemini/toolchain.mts install
 *   node tools/objects/gemini/toolchain.mts verify
 *
 * micromamba builds the environment for osx-64, because DRAGONS has no osx-arm64 build; on Apple silicon Rosetta 2 translates
 * it. `install` resolves the packages of toolchain.json when packages.lock is absent and writes the lock micromamba resolved,
 * and installs from that lock whenever it is there, so a second machine gets the same builds by URL and sha256.
 *
 * The install records the sha256 of toolchain.json and the lock together. `geminiToolchain` refuses an environment built from
 * other pins, and refuses one whose `reduce` or `caldb` is missing.
 *
 * Nothing here needs a display: DRAGONS' interactive tools are not used and MPLBACKEND is forced to Agg. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export const GEMINI_ROOT = resolve(repository, 'output/toolchains/gemini');
const DESCRIPTOR = resolve(import.meta.dirname, 'toolchain.json');

async function descriptor() {
  const text = await readFile(DESCRIPTOR, 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lockPath = resolve(import.meta.dirname, requireString(entry.lock, 'lock'));
  const lock = await readFile(lockPath, 'utf8').catch(() => '');
  return { entry, lock, lockPath, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 4).join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-4000)}`);
  return result.stdout;
}

/** The explicit list micromamba resolved: one package URL with its sha256 per line. That is the lock, and it is what a later
 * install uses, so the second machine gets these builds and not whatever the channels hold that day. */
const explicitList = (prefix: string, env: NodeJS.ProcessEnv) =>
  run('micromamba', ['list', '--explicit', '--md5', '-p', prefix], env);

export async function installGemini() {
  const { entry, lock, lockPath, digest } = await descriptor(), prefix = resolve(GEMINI_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  const platform = requireString(mamba.platform, 'platform');
  const channels = requireArray(mamba.channels, 'channels').flatMap(value => ['-c', requireString(value, 'channel')]);
  await rm(GEMINI_ROOT, { recursive: true, force: true });
  await mkdir(GEMINI_ROOT, { recursive: true });
  const env = { MAMBA_ROOT_PREFIX: resolve(GEMINI_ROOT, 'mamba'), CONDA_SUBDIR: platform };
  if (lock) {
    await writeFile(resolve(GEMINI_ROOT, 'packages.lock'), lock);
    run('micromamba', ['create', '-y', '-q', '-p', prefix, '--platform', platform, '-f', resolve(GEMINI_ROOT, 'packages.lock')], env);
  } else {
    run('micromamba', ['create', '-y', '-q', '-p', prefix, '--platform', platform, ...channels,
      ...requireArray(mamba.packages, 'packages').map(value => requireString(value, 'package'))], env);
    await writeFile(lockPath, explicitList(prefix, env));
  }
  await rm(resolve(GEMINI_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  const { digest: after } = await descriptor();
  await writeFile(resolve(GEMINI_ROOT, 'installed.json'), `${JSON.stringify({ id: 'gemini', platform, pinsSha256: lock ? digest : after }, null, 2)}\n`);
  return GEMINI_ROOT;
}

export interface GeminiToolchain {
  readonly python: string;
  readonly binaries: Readonly<Record<string, string>>;
  /** sha256 of toolchain.json and packages.lock together: what a product record carries so a later reader can tell which
   * pinned environment made it. */
  readonly digest: string;
  /** What a reduction runs with: DRAGONS' own home under this root, so its `dragonsrc` and calibration database never touch
   * the user's, and a non-interactive matplotlib. */
  readonly env: NodeJS.ProcessEnv;
}

export async function geminiToolchain(): Promise<GeminiToolchain> {
  const { entry, digest } = await descriptor(), bin = resolve(GEMINI_ROOT, 'env/bin');
  const marker = await readFile(resolve(GEMINI_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The Gemini toolchain is not installed: node tools/objects/gemini/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The Gemini toolchain was installed from other pins; reinstall it.');
  const binaries: Record<string, string> = {};
  for (const [name, file] of Object.entries(requireRecord(entry.binaries, 'binaries'))) {
    binaries[name] = resolve(bin, requireString(file, name));
    if (!await access(binaries[name]!).then(() => true, () => false)) throw new Error(`The Gemini toolchain has no ${name}.`);
  }
  return {
    python: resolve(bin, 'python'), binaries, digest,
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, MPLBACKEND: 'Agg', HOME: resolve(GEMINI_ROOT, 'home'),
      DRAGONS_HOME: resolve(GEMINI_ROOT, 'home') },
  };
}

/** What actually ran, asked of the environment rather than read from the pin: the pin says what was asked for, this says
 * what answered. DRAGONS' arithmetic is numpy's and its FITS reading is astropy's, so a product record that named only
 * DRAGONS would not say enough to tell two runs apart. */
export const SOFTWARE_PROBE = 'import astrodata, numpy, astropy, sys\n' +
  'print(astrodata.version()); print(numpy.__version__); print(astropy.__version__); print("%d.%d.%d" % sys.version_info[:3])';

export function dragonsToolchainVersions(toolchain: GeminiToolchain): { name: string; version: string }[] {
  const result = spawnSync(toolchain.python, ['-c', SOFTWARE_PROBE], { encoding: 'utf8', env: { ...process.env, ...toolchain.env } });
  if (result.status !== 0) throw new Error(`DRAGONS did not import: ${(result.stderr ?? '').slice(-2000)}`);
  const lines = result.stdout.trim().split('\n').map(line => line.trim());
  if (lines.length !== 4 || lines.some(line => !line)) throw new Error(`The environment did not state its versions: ${result.stdout}`);
  return [{ name: 'dragons', version: lines[0]! }, { name: 'numpy', version: lines[1]! },
    { name: 'astropy', version: lines[2]! }, { name: 'python', version: lines[3]! }];
}

export const dragonsVersion = (toolchain: GeminiToolchain) => dragonsToolchainVersions(toolchain)[0]!.version;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'install') console.log(`The Gemini toolchain is installed at ${await installGemini()}`);
  else if (mode === 'verify') {
    const toolchain = await geminiToolchain();
    const version = spawnSync(toolchain.python, ['-c', 'import astrodata, geminidr, gemini_instruments; print(astrodata.version())'],
      { encoding: 'utf8', env: { ...process.env, ...toolchain.env } });
    if (version.status !== 0) throw new Error(`DRAGONS did not import: ${(version.stderr ?? '').slice(-2000)}`);
    const reduce = spawnSync(toolchain.binaries.reduce!, ['--version'], { encoding: 'utf8', env: { ...process.env, ...toolchain.env } });
    console.log(`Gemini ready: DRAGONS ${version.stdout.trim()}; ${(reduce.stdout || reduce.stderr).trim()}`);
  } else throw new TypeError('Usage: toolchain <install|verify>');
}
