import { setupBakeOracleInputs } from '../../../../cameras/oracle-inputs.mts';
await setupBakeOracleInputs();
import { existsSync } from 'node:fs';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
import { ORACLE_ROOT } from '@cssearth/core/oracle';
import { javaBridge, call, construct } from './java.mts';

export const base = resolve(ORACLE_ROOT, '.local/oracles/sbmt');
export const lockPath = resolve(import.meta.dirname, 'runtime.lock.json');
/** A file's size; a missing file names its path. */
export async function fileBytes(path: string) {
  try { return { bytes: (await stat(path)).size }; }
  catch (error) { throw new Error(`SBMT file is missing: ${path}`, { cause: error }); }
}
export function pin(value: unknown) {
  const p = requireRecord(value), path = requireString(p.path);
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new Error('Unsafe SBMT pin path');
  const bytes = requireFiniteNumber(p.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid SBMT pin');
  return { path, bytes };
}
export async function runtimeLock() {
  const lock = requireRecord(JSON.parse(await readFile(lockPath, 'utf8')));
  if (lock.schema !== 'cssearth-sbmt-runtime@1') throw new Error('Unknown SBMT runtime lock');
  return { lock,
    files: requireArray(lock.files).map(pin), nativeFiles: requireArray(lock.nativeFiles).map(pin), bridgeFiles: requireArray(lock.bridgeFiles).map(pin) };
}
export async function verifyFiles(directory: string, files: readonly ReturnType<typeof pin>[]) {
  for (const file of files) {
    const actual = await fileBytes(resolve(directory, file.path));
    if (actual.bytes !== file.bytes) throw new Error(`SBMT runtime file ${file.path} holds ${actual.bytes} bytes; runtime.lock.json records ${file.bytes}.`);
  }
}
/** This runs in a bounded child process. It never opens a render window. */
export async function startNative() {
  const { lock, files, nativeFiles, bridgeFiles } = await runtimeLock();
  if (`${process.platform}-${process.arch}` !== lock.platform) throw new Error(`Native regeneration is qualified for ${lock.platform}; fixture comparisons are portable.`);
  await verifyFiles(base, files);
  await verifyFiles(base, bridgeFiles);
  // A reused extraction must be verified before any native library is loaded.
  if (existsSync(resolve(base, 'native'))) await verifyFiles(base, nativeFiles);
  const jvm = files.find(p => p.path.endsWith('/libjvm.dylib'));
  if (!jvm) throw new Error('Pinned bundled JVM is missing');
  await mkdir(resolve(base, 'home'), { recursive: true });
  const java = javaBridge(ORACLE_ROOT);
  java.start(resolve(base, jvm.path), files.filter(p => p.path.endsWith('.jar')).map(p => resolve(base, p.path)),
    ['-Xms32m', '-Xmx512m', '-XX:ActiveProcessorCount=2', '-Djava.awt.headless=true', `-Duser.home=${resolve(base, 'home')}`]);
  const version = call(java.type('java.lang.System'), 'getPropertySync', 'java.version');
  if (version !== lock.java) throw new Error('Bundled Java version changed');
  call(java.type('edu.jhuapl.saavtk.util.Configuration'), 'setAppNameSync', 'cssearth-sbmt-oracle');
  const loader = java.type('edu.jhuapl.saavtk.util.NativeLibraryLoader');
  call(loader, 'initializeSync', construct(java.type('java.io.File'), resolve(base, 'native')));
  call(loader, 'loadHeadlessVtkLibrariesSync');
  await verifyFiles(base, nativeFiles);
  return { java, tool: { sbmt: requireString(lock.sbmt), release: requireString(lock.release), java: requireString(lock.java),
    'java-bridge': requireString(lock.bridge) } };
}
