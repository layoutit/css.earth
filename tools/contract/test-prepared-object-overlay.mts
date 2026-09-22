import { sha256 } from '../../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from '../sources/source-values.mts';

/** Mutate the actual transported payload and its pin together for adversarial tests. */
export async function preparedObjectOverlay(id: string, mutate: (runtime: Record<string, unknown>) => unknown, root = process.cwd()) {
  const base = resolve(root, 'src/objects', id), descriptorPath = resolve(base, 'object.json');
  const runtimePath = resolve(base, 'prepared/runtime.json'), payloadPath = resolve(base, 'prepared/object.json');
  const descriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')));
  const runtime = requireRecord(JSON.parse(await readFile(runtimePath, 'utf8')));
  const payload = requireRecord(JSON.parse(await readFile(payloadPath, 'utf8')));
  const changed = mutate(runtime);
  payload.data = runtime;
  const bytes = JSON.stringify(payload);
  requireRecord(descriptor.prepared).sha256 = sha256(bytes);
  const overlays = new Map([[descriptorPath, JSON.stringify(descriptor)], [runtimePath, JSON.stringify(runtime)], [payloadPath, bytes]]);
  return { changed, runtime, readText: (path: string) => overlays.get(path) ?? readFile(path, 'utf8') };
}
