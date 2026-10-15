/** One owner for complete, pinned environments and their installation lifecycle. */
import { assertSourceBuildPrerequisites } from './source-build.js';
import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { resolveMicromamba, assertManagedPythonPlatform } from './micromamba.js';
import { assertToolchainInstallActive, reportToolchainProgress } from './progress.js';
import { runToolchainProcess, runToolchainProcessAsync } from './process.js';
import { installedMarkerIssue, writeInstalledMarker, type ToolchainPins } from './marker.js';

/** One installer owns a prefix at a time. Publish a nonempty lock directory atomically so there is no ownerless gap.
 * Owner filenames are unique: stale recovery removes only the dead generation it inspected, never a successor's lock. */
export async function withInstallLock<T>(root: string, work: () => Promise<T>, options: { readonly wait?: boolean } = {}): Promise<T> {
  const lock = `${root}.installing`;
  await mkdir(dirname(root), { recursive: true });
  const staging = await mkdtemp(`${lock}-`), owner = `owner-${process.pid}-${randomUUID()}`;
  const alive = (pid: number): boolean => {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; }
    catch (error) { return !(error instanceof Error && 'code' in error && error.code === 'ESRCH'); }
  };
  const removeEmptyLock = async () => {
    await rmdir(lock).catch(error => {
      if (!(error instanceof Error && 'code' in error && ['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(String(error.code)))) throw error;
    });
  };
  try {
    await writeFile(resolve(staging, owner), String(process.pid));
    for (let attempt = 0; ; attempt++) {
      assertToolchainInstallActive();
      try { await rename(staging, lock); break; }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && ['EEXIST', 'ENOTEMPTY'].includes(String(error.code)))) throw error;
        if (options.wait === false) throw new Error(`Managed toolchain is locked at ${lock}; wait for its owner to finish.`);
        if (attempt >= 18_000) throw new Error(`Managed toolchain install is still locked at ${lock}.`);
        const names = await readdir(lock).catch(() => []);
        for (const name of names.filter(name => name === 'owner' || /^owner-\d+-[\w-]+$/u.test(name))) {
          const path = resolve(lock, name), details = await stat(path).catch(() => null);
          const pid = Number(await readFile(path, 'utf8').catch(() => ''));
          if (details && Date.now() - details.mtimeMs > 60_000 && !alive(pid)) await rm(path, { force: true });
        }
        await removeEmptyLock();
        await new Promise(done => setTimeout(done, 100));
      }
    }
    try { return await work(); }
    finally { await rm(resolve(lock, owner), { force: true }); await removeEmptyLock(); }
  } finally { await rm(staging, { recursive: true, force: true }); }
}

/** The descriptor already owns the Python request; no second version pin is kept. */
function pythonVersion(pins: ToolchainPins): string {
  const request = pins.entry.python ?? requireArray(requireRecord(pins.entry.micromamba, 'micromamba').packages)
    .map(value => requireString(value)).find(value => value.startsWith('python='));
  const version = /^(?:python=|python)(3\.\d+(?:\.\d+)?)$/u.exec(requireString(request, 'pinned Python'))?.[1];
  if (!version) throw new TypeError(`Unsupported pinned Python request ${String(request)}.`);
  return version;
}

export function verifyToolchainPython(prefix: string, pins: ToolchainPins): void {
  const expected = pythonVersion(pins), python = resolve(prefix, 'bin/python');
  const found = runToolchainProcess(python, ['-I', '-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))']).trim();
  if (!/^3\.\d+\.\d+$/u.test(found) || found.split('.').slice(0, expected.split('.').length).join('.') !== expected) throw new Error(`Expected Python ${expected}, found ${found}.`);
  // Pip is required when this descriptor installs Python packages outside conda.
  if (pins.entry.requirements !== undefined) runToolchainProcess(python, ['-I', '-m', 'pip', '--version']);
}

/** Installation awaits the same version and pip probes without blocking the screen clock. */
async function verifyInstalledPython(prefix: string, pins: ToolchainPins): Promise<void> {
  const expected = pythonVersion(pins), python = resolve(prefix, 'bin/python');
  const found = (await runToolchainProcessAsync(python, ['-I', '-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))'])).trim();
  if (!/^3\.\d+\.\d+$/u.test(found) || found.split('.').slice(0, expected.split('.').length).join('.') !== expected) throw new Error(`Expected Python ${expected}, found ${found}.`);
  if (pins.entry.requirements !== undefined) await runToolchainProcessAsync(python, ['-I', '-m', 'pip', '--version']);
}

/** Check the actual executable files, including execute permission, before accepting or publishing an install. */
export async function verifyToolchainExecutables(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) throw new TypeError('Toolchain verification requires at least one executable.');
  for (const path of paths) {
    try {
      if (!(await stat(path)).isFile()) throw new Error('not a file');
      await access(path, constants.X_OK);
    } catch { throw new Error(`The toolchain executable is missing or not executable: ${path}.`); }
  }
}

/** Hold the lock from the reuse decision through creation, dependency installation, verification and the final marker.
 * Only the incomplete prefix is discarded: caches and other tools beside it remain owned by their archive. */
export async function installManagedToolchain<T extends ToolchainPins>(root: string, readPins: () => T | Promise<T>, prefix: string | null,
  install: (pins: T) => Promise<unknown>, verify: (pins: T) => void | Promise<void>): Promise<string> {
  assertManagedPythonPlatform();
  if (typeof readPins !== 'function' || typeof verify !== 'function') throw new TypeError('Toolchain installation requires a pins reader and a verifier.');
  return withInstallLock(prefix ?? root, async () => {
    assertToolchainInstallActive();
    const pins = await readPins();
    if (prefix) reportToolchainProgress({ type: 'step', step: 'python', status: 'waiting', label: `Python ${pythonVersion(pins)}` });
    if (installedMarkerIssue(root, pins) === null) {
      try { if (prefix) await verifyInstalledPython(prefix, pins); await verify(pins); reportToolchainProgress({ type: 'installed' }); return root; }
      catch { /* A marked but broken prefix must be rebuilt under the same lock. */ }
    }
    assertToolchainInstallActive();
    assertSourceBuildPrerequisites(pins);
    await rm(resolve(root, 'installed.json'), { force: true });
    if (prefix) await rm(prefix, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    await install(pins);
    assertToolchainInstallActive();
    reportToolchainProgress({ type: 'step', step: 'packages', status: 'finished' });
    reportToolchainProgress({ type: 'step', step: 'check', status: 'started' });
    const completedPins = await readPins();
    if (prefix) await verifyInstalledPython(prefix, completedPins);
    await verify(completedPins);
    assertToolchainInstallActive();
    writeInstalledMarker(root, completedPins);
    reportToolchainProgress({ type: 'step', step: 'check', status: 'finished' });
    reportToolchainProgress({ type: 'installed' });
    return root;
  });
}

/** The older archive descriptors name Python executables; conda supplies that same major/minor version.
 * The caller's dependency installer is part of this transaction, never a step after an interpreter-only reuse check. */
export async function ensureToolchainPython<T extends ToolchainPins>(prefix: string, readPins: () => T | Promise<T>,
  install: (pins: T) => Promise<void>, verify: (pins: T) => void | Promise<void> = pins => verifyToolchainPython(prefix, pins)): Promise<string> {
  assertManagedPythonPlatform();
  return installManagedToolchain(dirname(prefix), readPins, prefix, async pins => {
    const request = requireString(pins.entry.python, 'python'), version = /^python(3\.\d+)$/u.exec(request)?.[1];
    if (!version || version !== pythonVersion(pins)) throw new TypeError(`Unsupported pinned Python executable ${request}; expected the descriptor's python3.MINOR.`);
    const micromamba = await resolveMicromamba();
    await runToolchainProcessAsync(micromamba, ['create', '-y', '-q', '-p', prefix, '-c', 'conda-forge', `python=${version}`, 'pip'],
      { env: { MAMBA_ROOT_PREFIX: resolve(dirname(prefix), 'mamba') } });
    await install(pins);
  }, verify);
}
