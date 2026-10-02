import { containedPath } from '@cssearth/core/node';
import { spawn } from 'node:child_process';
import { writeAtomic } from '@cssearth/bake/volume/node';
import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseLabModelJson, resolveLabModelPath } from '../../../resources/model-paths.ts';

export interface Pin { path: string }
export const json = async (path: string) => parseLabModelJson(await readFile(path, 'utf8'));
export function localPath(root: string, path: string) {
  const full = resolve(root, resolveLabModelPath(path));
  if (isAbsolute(path) || containedPath(root, full, { policy: 'lexical', rootPath: 'reject',
    parentSeparator: 'posix', absoluteOffset: 'allow' }) === undefined) throw new Error(`Invalid recipe path: ${path}`);
  return full;
}
export async function pinned(root: string, pin: Pin) {
  return readFile(localPath(root, pin.path));
}
export async function acquire(root: string, pin: Pin & { url: string }) {
  const path = localPath(root, pin.path);
  const existing = await readFile(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existing) return;
  if (!pin.url.startsWith('https://')) throw new Error('Source requires an HTTPS URL.');
  console.log(`DOWNLOAD ${pin.path}`);
  const response = await fetch(pin.url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${pin.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeAtomic(path, bytes);
}
/** Record every staged artifact before its manifest is written. Paths remain relative to that stage. */
export async function collectArtifacts(root: string): Promise<Record<string, { bytes: number }>> {
  const artifacts: Record<string, { bytes: number }> = {};
  async function collect(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else artifacts[relative(root, path)] = { bytes: (await stat(path)).size };
    }
  }
  await collect(root);
  return artifacts;
}

export async function run(command: string, args: string[], root: string, onLine: (line: string) => void = console.log) {
  await new Promise<void>((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    let pending = '';
    const abort = () => child.kill('SIGTERM');
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30 * 60 * 1000);
    child.stdout.on('data', bytes => {
      const lines = (pending + bytes.toString()).split('\n'); pending = lines.pop()!;
      for (const line of lines) onLine(line);
    });
    const cleanup = () => { clearTimeout(timeout); process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => { cleanup(); if (pending) onLine(pending); code === 0 ? done() : reject(new Error(`${command} failed (${code}).`)); });
  });
}
