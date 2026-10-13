import { SourceBuildPrerequisiteError } from './source-build.js';
import { installManagedToolchain } from './environment.js';
import { resolveMicromamba, assertManagedPythonPlatform } from './micromamba.js';
/** Install one pinned astronomy environment per user; keep every installed copy beneath the user root. */
import { resolveInstalledToolchain } from './resolver.js';
import { telescopePythonEnvironment } from '../paths.js';
import { runToolchainProcess } from './process.js';
import { accessSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { TOOLCHAINS, USER_ROOT } from '../paths.js';
import { installedMarkerIssue, readToolchainPins, type ToolchainPins } from './marker.js';
import { requireArray, requireRecord, requireString, MissingSourceInputError } from '@cssearth/core';

export const ASTROQUERY_ROOT = resolve(USER_ROOT, 'output/toolchains/astroquery');
export const ASTROQUERY_CACHE = resolve(USER_ROOT, 'astroquery');

const descriptor = (): ToolchainPins => readToolchainPins('astroquery', 'toolchain.json');

/** The shared per-user environment is named by the package versions it pins; its marker holds the exact descriptor and lock. */
const sharedRoot = (entry: Record<string, unknown>): string => resolve(ASTROQUERY_CACHE, `packages-${expectedVersions(entry).replaceAll(' ', '_')}`);

export function installedToolchain(root: string, pins: ToolchainPins): boolean {
  if (installedMarkerIssue(root, pins) !== null) return false;
  try { accessSync(resolve(root, 'env/bin/python')); return true; } catch { return false; }
}

function expectedVersions(entry: Record<string, unknown>): string {
  return `${entry.astroquery} ${entry.pyvo} ${entry.scipy} ${entry.batman} ${entry.orbitize} ${entry.whereistheplanet} ${entry.cdflib} ${entry.pyuvdata} ${entry.astropyHealpix}`;
}
const versionProbe = "import astroquery, astropy_healpix, importlib.metadata, pyvo, scipy, cdflib, pyuvdata, orbitize, whereistheplanet; from astroquery import alma, mast, vizier; print(astroquery.__version__, pyvo.__version__, scipy.__version__, importlib.metadata.version('batman-package'), importlib.metadata.version('orbitize'), importlib.metadata.version('whereistheplanet'), cdflib.__version__, pyuvdata.__version__, astropy_healpix.__version__)";
function verifyPackages(root: string, entry: Record<string, unknown>): void {
  const found = runToolchainProcess(resolve(root, 'env/bin/python'), ['-c', versionProbe], { env: telescopePythonEnvironment({ PATH: `${resolve(root, 'env/bin')}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1', XDG_CACHE_HOME: resolve(USER_ROOT, 'python-cache'), MPLCONFIGDIR: resolve(USER_ROOT, 'python-cache/matplotlib') }) }).trim();
  if (found !== expectedVersions(entry)) throw new Error(`Expected ${expectedVersions(entry)}, found ${found}.`);
}

export async function installAstroquery() {
  assertManagedPythonPlatform();
  const root = sharedRoot(descriptor().entry), prefix = resolve(root, 'env');
  return installManagedToolchain(root, descriptor, prefix, async pins => {
    const { entry } = pins, mamba = requireRecord(entry.micromamba, 'micromamba');

    const micromamba = await resolveMicromamba();
    await mkdir(root, { recursive: true });
    const env = { MAMBA_ROOT_PREFIX: resolve(root, 'mamba') };
    runToolchainProcess(micromamba, ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel), ...requireArray(mamba.packages).map(value => requireString(value))], { env });
    runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '-q', '-r', resolve(TOOLCHAINS, requireString(entry.requirements))]);
    for (const value of requireArray(entry.sourcePackages, 'sourcePackages')) {
      const source = requireRecord(value, 'source package');
      if (source.build !== 'installed-numpy') throw new TypeError('A source package must state the installed-numpy build policy.');
      const requirement = `${requireString(source.name)} @ ${requireString(source.url)}`;
      runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-build-isolation', '--no-deps', '-q', requirement]);
    }
    await rm(resolve(root, 'mamba/pkgs'), { recursive: true, force: true });
    return root;
  }, ({ entry }) => verifyPackages(root, entry));
}

export interface AstroqueryToolchain {
  readonly python: string; readonly version: string; readonly pyvoVersion: string;
  readonly scipyVersion: string; readonly batmanVersion: string; readonly cdflibVersion: string; readonly pyuvdataVersion: string; readonly orbitizeVersion: string; readonly whereIsThePlanetVersion: string; readonly astropyHealpixVersion:string; readonly env: NodeJS.ProcessEnv;
}

export function toolchainRootIssue(root: string): string | null {
  const link = lstatSync(root, { throwIfNoEntry: false });
  if (!link?.isSymbolicLink()) return null;
  try { realpathSync(root); return null; }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    const target = resolve(dirname(root), readlinkSync(root));
    return `The astronomy package link ${root} points to missing ${target}. Run telescope toolchain install astroquery to restore a shared copy.`;
  }
}

export function astroqueryToolchainSync(): AstroqueryToolchain {
  const pins = descriptor(), { entry } = pins;
  const root = findInstalledRoot(ASTROQUERY_ROOT, sharedRoot(entry), pins);
  if (!root) {
    const rootIssue = toolchainRootIssue(ASTROQUERY_ROOT);
    throw new MissingSourceInputError(rootIssue ?? 'The astronomy packages are not installed: telescope toolchain install astroquery');
  }
  const bin = resolve(root, 'env/bin'), python = resolve(bin, 'python');
  return { python, version: requireString(entry.astroquery), pyvoVersion: requireString(entry.pyvo), scipyVersion: requireString(entry.scipy),
    batmanVersion: requireString(entry.batman), cdflibVersion: requireString(entry.cdflib), pyuvdataVersion: requireString(entry.pyuvdata), orbitizeVersion: requireString(entry.orbitize), whereIsThePlanetVersion: requireString(entry.whereistheplanet), astropyHealpixVersion:requireString(entry.astropyHealpix), env: telescopePythonEnvironment({ PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1', XDG_CACHE_HOME: resolve(USER_ROOT, 'python-cache'), MPLCONFIGDIR: resolve(USER_ROOT, 'python-cache/matplotlib') }) };
}

/** Async consumers provision missing pins on first use; synchronous preparation keeps its explicit install boundary. */
let firstInstall: Promise<string> | undefined;
export async function astroqueryToolchain(): Promise<AstroqueryToolchain> {
  try { return astroqueryToolchainSync(); }
  catch (error) {
    if (!(error instanceof MissingSourceInputError)) throw error;
    firstInstall ??= installAstroquery().catch(error => {
      if (!(error instanceof SourceBuildPrerequisiteError)) firstInstall = undefined;
      throw error;
    });
    await firstInstall;
    return astroqueryToolchainSync();
  }
}

export function findInstalledRoot(local: string, shared: string, pins: ToolchainPins): string | null {
  return resolveInstalledToolchain(local, pins, [shared], {}, 'env/bin/python');
}

/** Check the installed environment's imports and versions against the pins; the line `verify` prints. */
export async function verifyAstroqueryToolchain(): Promise<string> {
  const toolchain = await astroqueryToolchain();
  verifyPackages(dirname(dirname(dirname(toolchain.python))), descriptor().entry);
  return `Astronomy packages ready: Astroquery ${toolchain.version}, PyVO ${toolchain.pyvoVersion}, SciPy ${toolchain.scipyVersion}, batman ${toolchain.batmanVersion}, orbitize ${toolchain.orbitizeVersion}, whereistheplanet ${toolchain.whereIsThePlanetVersion}, cdflib ${toolchain.cdflibVersion}, pyuvdata ${toolchain.pyuvdataVersion}, astropy-healpix ${toolchain.astropyHealpixVersion}`;
}
