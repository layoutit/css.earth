/** Validated comparison records shared by the build plugin, comparator and fixtures. */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected an object');
  return Object.fromEntries(Object.entries(value));
}
export function string(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Expected a string');
  return value;
}
export function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new TypeError('Expected an array');
  return value.map(string);
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Expected an array');
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite number');
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
  return value;
}
export type Moves = Record<string, string | null>;
export function parseMoves(value: unknown): Moves {
  const result: Moves = {};
  const valid = (path: string) => path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => part === '..' || part === '.' || part === '');
  for (const [old, next] of Object.entries(record(value))) {
    if (!valid(old) || (next !== null && (!valid(string(next)) || next === old))) throw new Error(`Invalid move: ${old}`);
    result[old] = next === null ? null : string(next);
  }
  const targets = Object.values(result).filter(value => value !== null);
  if (new Set(targets).size !== targets.length || targets.some(target => Object.hasOwn(result, target))) throw new Error('Moves must have unique destinations and no chains/cycles');
  return result;
}
export interface Module { id: string; code: string | null; codeDigest?: string; renderedLength: number; originalLength: number; importedIds: string[]; dynamicallyImportedIds: string[]; importers: string[]; importedCss: string[]; importedAssets: string[] }
export interface Chunk { rawCode?: string; emittedDigest?: string; fileName: string; name: string; isEntry: boolean; isDynamicEntry: boolean; facadeModuleId: string | null; imports: string[]; dynamicImports: string[]; modules: Module[]; importedCss: string[]; importedAssets: string[] }
export interface Asset { fileName: string; names: string[]; originalFileNames: string[] }
export interface Environment { emittedDigestStage?: string; environment: string; chunks: Chunk[]; assets: Asset[]; references?: Record<string, string>; addedMaps?: string[] }
export function parseEnvironment(raw: unknown): Environment {
  const root = record(raw);
  const chunks = array(root.chunks).map(raw => {
    const c = record(raw);
    const modules = array(c.modules).map(raw => {
      const m = record(raw);
      return { codeDigest: m.codeDigest === undefined ? undefined : string(m.codeDigest), id: string(m.id), code: m.code === null ? null : string(m.code), renderedLength: number(m.renderedLength), originalLength: number(m.originalLength), importedIds: strings(m.importedIds), dynamicallyImportedIds: strings(m.dynamicallyImportedIds), importers: strings(m.importers), importedCss: strings(m.importedCss), importedAssets: strings(m.importedAssets) };
    });
    return { rawCode: c.rawCode === undefined ? undefined : string(c.rawCode), emittedDigest: c.emittedDigest === undefined ? undefined : string(c.emittedDigest), fileName: string(c.fileName), name: string(c.name), isEntry: boolean(c.isEntry), isDynamicEntry: boolean(c.isDynamicEntry), facadeModuleId: c.facadeModuleId === null ? null : string(c.facadeModuleId), imports: strings(c.imports), dynamicImports: strings(c.dynamicImports), modules, importedCss: strings(c.importedCss), importedAssets: strings(c.importedAssets) };
  });
  const assets = array(root.assets).map(raw => { const a = record(raw); return { fileName: string(a.fileName), names: strings(a.names), originalFileNames: strings(a.originalFileNames) }; });
  const references = Object.fromEntries(Object.entries(record(root.references ?? {})).map(([key, value]) => [key, string(value)]));
  return { emittedDigestStage: root.emittedDigestStage === undefined ? undefined : string(root.emittedDigestStage), environment: string(root.environment), chunks, assets, references, addedMaps: strings(root.addedMaps ?? []) };
}
export async function files(root: string): Promise<string[]> {
  const output: string[] = [];
  async function visit(prefix: string): Promise<void> {
    for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in output: ${path}`);
      if (entry.isDirectory()) await visit(path); else if (entry.isFile()) output.push(path);
    }
  }
  await visit('');
  return output.sort();
}
export interface Build { environments: Environment[]; files: Map<string, Buffer | string>; inventories?: Map<string, Buffer | string> }
export async function loadBuild(root: string): Promise<Build> {
  const environments = await Promise.all((await files(join(root, 'metadata'))).filter(path => path.endsWith('.json')).map(async path => parseEnvironment(JSON.parse(await readFile(join(root, 'metadata', path), 'utf8')))));
  if (!environments.length) throw new Error('Missing module metadata');
  if (environments.some(env => env.emittedDigestStage !== 'final-dist')) throw new Error('Rebuild with final-dist chunk evidence');
  for (const env of environments) for (const chunk of env.chunks) {
    if (!chunk.emittedDigest || chunk.modules.some(module => !module.codeDigest)) throw new Error('Rebuild with current comparison evidence schema');
  }
  const addedMaps = new Set(environments.flatMap(env => env.addedMaps ?? []));
  return { environments, inventories: new Map((await files(join(root, 'inventories'))).map(path => [path.replace(/\.json$/u, ''), join(root, 'inventories', path)])), files: new Map((await files(join(root, 'dist'))).filter(path => !addedMaps.has(path)).map(path => [path, join(root, 'dist', path)])) };
}
export const bytes = async (value: Buffer | string): Promise<Buffer> => typeof value === 'string' ? readFile(value) : value;
export const isMain = (url: string): boolean => !!process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href;
export function args(allowed: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1];
    if (!key || !allowed.includes(key) || !value || value.startsWith('--') || result.has(key)) throw new Error(`Usage error: ${key}`);
    result.set(key, value);
  }
  return result;
}
