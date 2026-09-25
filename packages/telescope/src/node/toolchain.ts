/** Install one pinned astronomy environment per user; read legacy checkout-local environments when valid. */
import { createHash } from 'node:crypto';
import { runToolchainProcess } from './toolchain-process.js';
import { accessSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

export const ASTROQUERY_ROOT = resolve(WORKSPACE, 'output/toolchains/astroquery');
export const ASTROQUERY_CACHE = resolve(process.env.CSS_EARTH_ASTROQUERY_CACHE ?? resolve(homedir(), '.cache/css-earth/astroquery'));

function descriptor() {
  const text = readFileSync(resolve(TOOLCHAINS, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = readFileSync(resolve(TOOLCHAINS, requireString(entry.requirements)), 'utf8');
  return { entry, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}

export function installedToolchain(root: string, digest: string): boolean {
  try {
    const marker = requireRecord(JSON.parse(readFileSync(resolve(root, 'installed.json'), 'utf8')) as unknown);
    if (marker.id !== 'astroquery' || marker.pinsSha256 !== digest) return false;
    accessSync(resolve(root, 'env/bin/python'));
    return true;
  } catch { return false; }
}

/** One installer owns a pin at a time. The final marker is written only after package verification. */
async function withInstallLock<T>(root: string, work: () => Promise<T>): Promise<T> {
  const lock = `${root}.installing`;
  await mkdir(dirname(root), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try { await mkdir(lock); break; }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      if (attempt >= 900) throw new Error(`Astronomy toolchain install is still locked at ${lock}.`);
      const details = await stat(lock).catch(() => null);
      if (!details) continue;
      const age = Date.now() - details.mtimeMs;
      const owner = await readFile(resolve(lock, 'owner'), 'utf8').catch(() => '');
      const pid = Number(owner);
      let alive = false;
      if (Number.isSafeInteger(pid) && pid > 0) {
        try { process.kill(pid, 0); alive = true; }
        catch (failure) { alive = !(failure instanceof Error && 'code' in failure && failure.code === 'ESRCH'); }
      }
      if (age > (owner ? 60_000 : 30_000) && !alive) { await rm(lock, { recursive: true, force: true }); continue; }
      await new Promise(done => setTimeout(done, 2_000));
    }
  }
  try { await writeFile(resolve(lock, 'owner'), String(process.pid)); return await work(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

function expectedVersions(entry: Record<string, unknown>): string {
  return `${entry.astroquery} ${entry.pyvo} ${entry.scipy} ${entry.batman} ${entry.orbitize} ${entry.whereistheplanet} ${entry.cdflib} ${entry.pyuvdata} ${entry.astropyHealpix}`;
}
const versionProbe = "import astroquery, astropy_healpix, importlib.metadata, pyvo, scipy, cdflib, pyuvdata, orbitize, whereistheplanet; from astroquery import alma, mast, vizier; print(astroquery.__version__, pyvo.__version__, scipy.__version__, importlib.metadata.version('batman-package'), importlib.metadata.version('orbitize'), importlib.metadata.version('whereistheplanet'), cdflib.__version__, pyuvdata.__version__, astropy_healpix.__version__)";
function verifyPackages(root: string, entry: Record<string, unknown>): void {
  const found = runToolchainProcess(resolve(root, 'env/bin/python'), ['-c', versionProbe], { env: { PATH: `${resolve(root, 'env/bin')}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } }).trim();
  if (found !== expectedVersions(entry)) throw new Error(`Expected ${expectedVersions(entry)}, found ${found}.`);
}

export async function installAstroquery() {
  const { entry, digest } = descriptor(), root = resolve(ASTROQUERY_CACHE, digest), prefix = resolve(root, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  return withInstallLock(root, async () => {
    if (installedToolchain(root, digest)) {
      try { verifyPackages(root, entry); return root; }
      catch { /* A marked but broken environment is rebuilt under the install lock. */ }
    }
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    const env = { MAMBA_ROOT_PREFIX: resolve(root, 'mamba') };
    runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
    runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--require-hashes', '--no-deps', '-q', '-r', resolve(TOOLCHAINS, requireString(entry.requirements))]);
    for (const value of requireArray(entry.sourcePackages, 'sourcePackages')) {
      const source = requireRecord(value, 'source package');
      if (source.build !== 'installed-numpy') throw new TypeError('A source package must state the installed-numpy build policy.');
      const requirement = `${requireString(source.name)} @ ${requireString(source.url)}`;
      runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-build-isolation', '--no-deps', '-q', requirement]);
    }
    verifyPackages(root, entry);
    await rm(resolve(root, 'mamba/pkgs'), { recursive: true, force: true });
    await writeFile(resolve(root, 'installed.json'), `${JSON.stringify({ id: 'astroquery', pinsSha256: digest }, null, 2)}\n`);
    return root;
  });
}

export interface AstroqueryToolchain {
  readonly python: string; readonly digest: string; readonly version: string; readonly pyvoVersion: string;
  readonly scipyVersion: string; readonly batmanVersion: string; readonly cdflibVersion: string; readonly pyuvdataVersion: string; readonly orbitizeVersion: string; readonly whereIsThePlanetVersion: string; readonly astropyHealpixVersion:string; readonly env: NodeJS.ProcessEnv;
}

export function toolchainRootIssue(root: string): string | null {
  const link = lstatSync(root, { throwIfNoEntry: false });
  if (!link?.isSymbolicLink()) return null;
  try { realpathSync(root); return null; }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    const target = resolve(dirname(root), readlinkSync(root));
    return `The astronomy package link ${root} points to missing ${target}. Run the pinned astronomy toolchain install to restore a shared copy.`;
  }
}

export function astroqueryToolchainSync(): AstroqueryToolchain {
  const { entry, digest } = descriptor(), shared = resolve(ASTROQUERY_CACHE, digest);
  const root = findInstalledRoot(ASTROQUERY_ROOT, shared, digest);
  if (!root) {
    const rootIssue = toolchainRootIssue(ASTROQUERY_ROOT);
    throw new Error(rootIssue ?? 'The astronomy packages are not installed: node tools/objects/astronomy-toolchains.mts astroquery install');
  }
  const bin = resolve(root, 'env/bin'), python = resolve(bin, 'python');
  return { python, digest, version: requireString(entry.astroquery), pyvoVersion: requireString(entry.pyvo), scipyVersion: requireString(entry.scipy),
    batmanVersion: requireString(entry.batman), cdflibVersion: requireString(entry.cdflib), pyuvdataVersion: requireString(entry.pyuvdata), orbitizeVersion: requireString(entry.orbitize), whereIsThePlanetVersion: requireString(entry.whereistheplanet), astropyHealpixVersion:requireString(entry.astropyHealpix), env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1' } };
}

export async function astroqueryToolchain(): Promise<AstroqueryToolchain> { return astroqueryToolchainSync(); }

export function findInstalledRoot(local: string, shared: string, digest: string): string | null {
  return installedToolchain(shared, digest) ? shared : installedToolchain(local, digest) ? local : null;
}

/** Check the installed environment's imports and versions against the pins; the line `verify` prints. */
export async function verifyAstroqueryToolchain(): Promise<string> {
  const toolchain = await astroqueryToolchain();
  verifyPackages(dirname(dirname(dirname(toolchain.python))), descriptor().entry);
  return `Astronomy packages ready: Astroquery ${toolchain.version}, PyVO ${toolchain.pyvoVersion}, SciPy ${toolchain.scipyVersion}, batman ${toolchain.batmanVersion}, orbitize ${toolchain.orbitizeVersion}, whereistheplanet ${toolchain.whereIsThePlanetVersion}, cdflib ${toolchain.cdflibVersion}, pyuvdata ${toolchain.pyuvdataVersion}, astropy-healpix ${toolchain.astropyHealpixVersion}; pins ${toolchain.digest.slice(0, 12)}`;
}
