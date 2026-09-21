import type { InputRole } from '../../src/platform/product-input-evidence.mts';
import {requireArray, requireRecord, requireString, requireFiniteNumber} from '../source-values.mts';
import { parseCapture } from '../../src/platform/exploration-catalog.mts';
import { parseSourceBinding } from '../../src/platform/source-catalog.mts';

export {requireRecord as record, requireString as text};
export const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
export const maybeRecord = (value: unknown) => value == null ? undefined : requireRecord(value);
export const optionalText = (value: unknown) => value == null ? undefined : requireString(value);
export const texts = (value: unknown) => requireArray(value).map(item => requireString(item));
export const numbers = (value: unknown) => requireArray(value).map(item => requireFiniteNumber(item));
export const namedRecords = (value: unknown) => records(value).map(item => Object.assign({}, item, {id: requireString(item.id)}));
export const textValues = (value: unknown) => Object.values(requireRecord(value)).map(item => requireString(item));

export function identity(value: unknown) {
  const input = requireRecord(value);
  return {bytes: requireFiniteNumber(input.bytes), sha256: requireString(input.sha256)};
}
export function sourceEntry(value: unknown) {
  const input = requireRecord(value);
  // Only bytes git does not hold are pinned; an authored file is identified from disk when the record is written.
  return Object.assign({}, input, {path: requireString(input.path)},
    input.expectedSha256 === undefined ? {} : {expectedBytes: requireFiniteNumber(input.expectedBytes), expectedSha256: requireString(input.expectedSha256)},
    input.capture === undefined ? {} : { capture: parseCapture(input.capture) },
    input.sourceBinding === undefined ? {} : { sourceBinding: parseSourceBinding(input.sourceBinding) });
}
export function provenanceManifest(value: unknown) {
  const input = requireRecord(value);
  if (!/^css[a-z][a-z0-9-]*-authoritative-sources@2$/.test(requireString(input.schema))) throw new TypeError('Unsupported source manifest schema.');
  return {...input, inputs: requireArray(input.inputs).map(value => {
    const entry = sourceEntry(value);
    return Object.assign({}, entry, {id: requireString(entry.id), consumers: texts(entry.consumers), sourceBinding: parseSourceBinding(entry.sourceBinding)});
  }), documents: requireArray(input.documents ?? []).map(sourceEntry), generatedIntermediates: requireArray(input.generatedIntermediates ?? []).map(sourceEntry)};
}
export interface ProvenanceRecipeSource {id: string; path: string; sha256: string; parameters: Record<string, unknown>;}
export interface ProductBinding {
  inputRoles?: Readonly<Record<string, { role: InputRole; evidence: string }>>;
  observationAttribution: 'source-lineage' | 'none';
  id: string; label: string; recipe: string; selector: string; inputPaths: string[]; parents: string[]; urls: string[];
  process: string; limitations: string[]; lensIds: string[]; recipeDependencies: string[]; interpretation?: Record<string, unknown>;
}
export interface ProvenanceGap {product: string; output?: string; reason: string;}
export interface GeographicProvenance {noise?: {pin: Record<string, unknown>; prepared: Record<string, unknown>; directory: string};}
