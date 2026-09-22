import {validateSourceManifest} from '../../../src/platform/source-manifest.mts';
import {array, number, object, optional, parse, record, string} from '../material-composition/data-schema.mts';
import {readJsonSource} from '../../sources/source-values.mts';
type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? {-readonly [Key in keyof T]: Mutable<T[Key]>} : T;
// The source validators may freeze accepted records. A refresh owns a fresh,
// mutable JSON copy while retaining every unconsumed provenance field.
function mutable<T>(value: T): Mutable<T> { return structuredClone(value) as Mutable<T>; }
const maps = object({surface: object({maps: array(object({name: string, path: string, scientific: optional(record)}))})});
export const readMapConfiguration = async (path: string) => mutable(parse(await readJsonSource(path), maps, 'map configuration'));
const content = object({lenses: object({controls: array(object({id: string}))}), resources: array(object({href: string}))});
export const readRefreshContent = async (path: string) => mutable(parse(await readJsonSource(path), content, 'ENSO content'));
const bindings = object({controls: array(object({id: string, qualification: optional(string)}))});
export const readRefreshBindings = async (path: string) => mutable(parse(await readJsonSource(path), bindings, 'ENSO bindings'));
const entry = {path: string, expectedBytes: number, expectedSha256: string};
const manifest = object({inputs: array(object({...entry, id: string})), documents: array(object(entry)), generatedIntermediates: array(object({...entry, id: optional(string)}))});
export async function readRefreshManifest(path: string) {
  const value = await readJsonSource(path); validateSourceManifest('earth', value);
  return mutable(parse(value, manifest, 'source manifest to update'));
}
export function requireUpdateBytes(updates: ReadonlyMap<string, Buffer>, path: string): Buffer {
  const bytes = updates.get(path); if (!bytes) throw new Error(`Source update is missing ${path}.`); return bytes;
}
