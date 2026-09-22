/** Reuse the source package's acquisition declaration for native-file transport. */
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { hasErrorCode, requireRecord, requireArray, requireString } from '../../sources/source-values.mts';
import type { SourceFile } from './source-products.mts';
export async function sourceHeaders(root: string, file: SourceFile): Promise<Record<string, string>> {
  const boundary = file.path.indexOf('/source/');
  if (boundary < 0) return {};
  const source = resolve(root, file.path.slice(0, boundary + 7));
  const plan = await readFile(resolve(source, 'preparation/acquisition.json'), 'utf8').then(text => requireRecord(JSON.parse(text), 'acquisition plan')).catch(error => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
  if (!plan) return {};
  if (plan.schema !== 'cssearth-acquisition-plan@1') throw new Error('Unsupported acquisition plan.');
  const operation = requireArray(plan.operations).map(value=>requireRecord(value)).find(step => step.kind === 'download' && step.path === relative(source, resolve(root, file.path)) && step.url === file.origin);
  if (!operation) return {};
  if (operation.encoding) throw new Error('Encoded acquisition requires the package acquisition operator.');
  return Object.fromEntries(Object.entries(requireRecord(operation.headers ?? {})).map(([key,value])=>[key,requireString(value,'acquisition header')]));
}
