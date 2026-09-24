#!/usr/bin/env node
/** Install and locate the pinned CIAO environment of toolchain.json under output/toolchains/chandra (ignored by git).
 *
 *   node tools/objects/chandra/toolchain.mts solve     # re-resolve toolchain.json into packages.lock
 *   node tools/objects/chandra/toolchain.mts install
 *   node tools/objects/chandra/toolchain.mts verify
 *
 * micromamba creates the environment from packages.lock, an @EXPLICIT list of package URLs with their md5, so every install gets
 * the same 217 packages: the CXC channel's ciao, ciao-contrib and caldb_main, and their conda-forge dependencies. `solve`
 * re-resolves toolchain.json's package requests and rewrites the lock; nothing else resolves. The install records the sha256 of
 * the descriptor and the lock, and `chandraToolchain` refuses an environment built from other pins. micromamba itself is taken
 * from PATH (Homebrew's `micromamba`).
 *
 * CALDB is part of the environment, not fetched at run time: caldb_main unpacks under the prefix and the CALDB variable of the
 * returned toolchain points the CIAO tools at it. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findTable, tableColumn, text } from '../interferometry/fits-table.mts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const repository = resolve(import.meta.dirname, '../../..');
export const CHANDRA_ROOT = resolve(repository, 'output/toolchains/chandra');
const LOCK = resolve(import.meta.dirname, 'packages.lock');

async function descriptor() {
  const text = await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = await readFile(LOCK, 'utf8');
  return { entry, lock, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

function requests(entry: Readonly<Record<string, unknown>>) {
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  const channels = requireArray(mamba.channels, 'channels').flatMap(value => ['-c', requireString(value, 'channel')]);
  return { channels, packages: requireArray(mamba.packages, 'packages').map(value => requireString(value, 'package')) };
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 6).join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}

/** Re-resolve the descriptor's package requests and rewrite packages.lock as an @EXPLICIT list. Nothing downloads. */
export async function solveChandra() {
  const { entry } = await descriptor(), { channels, packages } = requests(entry);
  const root = { MAMBA_ROOT_PREFIX: resolve(CHANDRA_ROOT, 'mamba') };
  // A prefix that does not exist, so the solve is the one `install` performs and not an update of whatever is installed.
  const stdout = run('micromamba', ['create', '-y', '--dry-run', '--json', '-p', resolve(CHANDRA_ROOT, 'solve'), ...channels, ...packages], root);
  const links = requireArray(requireRecord(requireRecord(JSON.parse(stdout) as unknown, 'solution').actions, 'actions').LINK, 'LINK')
    .map(value => requireRecord(value, 'package'))
    .map(entry => ({ name: requireString(entry.name, 'name'), version: requireString(entry.version, 'version'), url: requireString(entry.url, 'url'), md5: requireString(entry.md5, 'md5') }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const head = ['# Solved by micromamba on osx-arm64 from toolchain.json (channels: cxc ciao, conda-forge).', '# Regenerate: node tools/objects/chandra/toolchain.mts solve', '@EXPLICIT'];
  await writeFile(LOCK, `${[...head, ...links.map(entry => `${entry.url}#${entry.md5}`)].join('\n')}\n`);
  return links.length;
}

export async function installChandra() {
  const { digest } = await descriptor(), prefix = resolve(CHANDRA_ROOT, 'env');
  await rm(CHANDRA_ROOT, { recursive: true, force: true });
  await mkdir(CHANDRA_ROOT, { recursive: true });
  run('micromamba', ['create', '-y', '-q', '-p', prefix, '-f', LOCK], { MAMBA_ROOT_PREFIX: resolve(CHANDRA_ROOT, 'mamba') });
  await rm(resolve(CHANDRA_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  await writeFile(resolve(CHANDRA_ROOT, 'installed.json'), `${JSON.stringify({ id: 'chandra', pinsSha256: digest }, null, 2)}\n`);
  return CHANDRA_ROOT;
}

export interface ChandraToolchain { readonly python: string; readonly binaries: Readonly<Record<string, string>>; readonly env: NodeJS.ProcessEnv }

/** What the installed environment calls itself: the CIAO release from the prefix's VERSION file and the CALDB release from the
 * last row of the calibration database's own version table. Both are recorded in every receipt. */
export async function chandraVersions(): Promise<{ ciao: string; caldb: string }> {
  const { entry } = await descriptor(), prefix = resolve(CHANDRA_ROOT, 'env');
  const files = requireRecord(entry.versionFiles, 'versionFiles');
  const ciao = (await readFile(resolve(prefix, requireString(files.ciao, 'ciao version file')), 'utf8')).trim();
  // CALDB releases are rows of the calibration database's own version table; the last one is what is installed.
  const bytes = await readFile(resolve(prefix, requireString(files.caldb, 'caldb version file')));
  const table = findTable(bytes, 'CALDBVER');
  const caldb = text(bytes, table, table.rows - 1, tableColumn(table, 'CALDB_VER')).trim();
  if (!ciao || !caldb) throw new Error('The Chandra toolchain does not state its CIAO and CALDB versions.');
  return { ciao, caldb };
}

/** The installed environment's Python, the CIAO executables a reprocessing run calls and the variables it runs with: ASCDS_INSTALL
 * and CALDB point at this prefix, `bin` is on PATH because chandra_repro spawns the other tools by name, and the parameter files
 * go to a directory of this root so concurrent runs do not share one. Refuses a missing install or one built from other pins. */
export async function chandraToolchain(): Promise<ChandraToolchain> {
  const { entry, digest } = await descriptor(), prefix = resolve(CHANDRA_ROOT, 'env'), bin = resolve(prefix, 'bin');
  const marker = await readFile(resolve(CHANDRA_ROOT, 'installed.json'), 'utf8').then(text => requireRecord(JSON.parse(text) as unknown), () => null);
  if (!marker) throw new Error('The Chandra toolchain is not installed: node tools/objects/chandra/toolchain.mts install');
  if (marker.pinsSha256 !== digest) throw new Error('The Chandra toolchain was installed from other pins; reinstall it.');
  const binaries: Record<string, string> = {};
  for (const [name, file] of Object.entries(requireRecord(entry.binaries, 'binaries'))) {
    binaries[name] = resolve(bin, requireString(file, name));
    if (!await access(binaries[name]!).then(() => true, () => false)) throw new Error(`The Chandra toolchain has no ${name} (${requireString(file, name)}).`);
  }
  const caldb = resolve(prefix, requireString(entry.caldbRelative, 'caldbRelative'));
  if (!await access(resolve(caldb, 'docs/chandra/caldb_version/caldb_version.fits')).then(() => true, () => false)) throw new Error(`The Chandra toolchain has no CALDB at ${caldb}.`);
  // What CIAO's own conda activation scripts export (env/etc/conda/activate.d/ciao_activate.sh and caldb_main_activate.sh),
  // resolved against this prefix rather than sourced: a run here is a child process, not an activated shell. ASCDS_CALIB is not
  // optional — pycrates reads the CXC standard header from it, and without it every tool fails on its first file.
  const system = resolve(prefix, 'param'), user = resolve(CHANDRA_ROOT, 'param'), work = resolve(CHANDRA_ROOT, 'work');
  return {
    python: resolve(bin, 'python'), binaries,
    env: { ASCDS_INSTALL: prefix, ASCDS_CONTRIB: prefix, ASCDS_CALIB: resolve(prefix, 'data'), ASCDS_BIN: bin,
      ASCDS_LIB: resolve(prefix, 'lib'), ASCDS_OTS: prefix, ASCDS_SYS_PARAM: system,
      ASCDS_PROP_DATE_DATA: resolve(prefix, 'config/jcm_data'), ASCDS_PROP_PREC_DATA: resolve(prefix, 'config/jcm_data'),
      ASCDS_WORK_PATH: work, ASCDS_TMP: work, OBSVIS_PKG_PATH: resolve(prefix, 'lib/tcltk/packages/obsvis'),
      CALDB: caldb, CALDBCONFIG: resolve(caldb, 'software/tools/caldb.config'), CALDBALIAS: resolve(caldb, 'software/tools/alias_config.fits'),
      PATH: `${bin}:${process.env.PATH ?? ''}`, PFILES: `${user};${system}`, LOCPFILES: user, IPYTHONDIR: resolve(CHANDRA_ROOT, 'ipython'),
      // No display and no window: XPA looks for a local ds9 and finds none, matplotlib draws to a file.
      XPA_METHOD: 'local', MPLBACKEND: 'Agg', PYTHONNOUSERSITE: '1' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2);
  if (mode === 'solve') console.log(`packages.lock holds ${await solveChandra()} packages`);
  else if (mode === 'install') console.log(`The Chandra toolchain is installed at ${await installChandra()}`);
  else if (mode === 'verify') {
    const toolchain = await chandraToolchain(), versions = await chandraVersions();
    for (const directory of ['param', 'work', 'ipython']) await mkdir(resolve(CHANDRA_ROOT, directory), { recursive: true });
    const probe = spawnSync(toolchain.python, ['-c', 'import pycrates, ciao_contrib.runtool; from ciao_contrib.caldb import check_caldb_version; print("caldb", check_caldb_version() or "current")'],
      { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
    if (probe.status !== 0) throw new Error(`The Chandra toolchain does not import: ${(probe.stderr ?? '').slice(-500)}`);
    console.log(`Chandra ready: ${versions.ciao}, CALDB ${versions.caldb}; ${probe.stdout.trim()}; ${Object.keys(toolchain.binaries).length} tools`);
  } else throw new TypeError('Usage: toolchain <solve|install|verify>');
}
