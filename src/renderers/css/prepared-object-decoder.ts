import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { parsePreparedObjectRuntime } from './validation/index.js';
import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { record } from './validation/guards.js';
import { collectSharedReferences, inlineSharedReferences, readSharedBankValue, sharedReferenceKey } from '../../platform/prepared-shared.mts';
import type { SharedReference } from '../../platform/prepared-shared.mts';

export const PREPARED_CSS_OBJECT_FORMAT = 'cssearth-css-object@5';
export type { SharedReference };
/** Resolve one shared bank to its decoded, digest-checked value. */
export type SharedBankReader = (reference: SharedReference) => Promise<unknown>;

export function requirePreparedCssDescriptor(input: unknown) {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'layered-body') throw new TypeError(`The CSS renderer does not support object type ${descriptor.type}.`);
  if (!descriptor.prepared || descriptor.prepared.format !== PREPARED_CSS_OBJECT_FORMAT) {
    throw new TypeError(`Object ${descriptor.id} requires its ${PREPARED_CSS_OBJECT_FORMAT} prepared artifact.`);
  }
  return descriptor;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
function parseJson(bytes: ArrayBuffer, label: string): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (cause) { throw new TypeError(`${label} is not valid UTF-8 JSON.`, { cause }); }
}

/** A shared bank is content-addressed: its bytes must reproduce the reference before its value is used. */
export async function decodeSharedBank(reference: SharedReference, bytes: ArrayBuffer): Promise<unknown> {
  if (await sha256(bytes) !== reference.sha256) throw new Error(`Prepared shared bank ${sharedReferenceKey(reference)} failed its SHA-256 identity check.`);
  return readSharedBankValue(reference, parseJson(bytes, `Prepared shared bank ${sharedReferenceKey(reference)}`));
}

/** Identical authentication and validation in the browser worker and Node tools. */
export async function decodePreparedCssObject(descriptorInput: unknown, bytes: ArrayBuffer, { readSharedBank }: { readSharedBank?: SharedBankReader } = {}): Promise<ObjectRuntimeDefinition> {
  const descriptor = requirePreparedCssDescriptor(descriptorInput);
  if (await sha256(bytes) !== descriptor.prepared!.sha256) throw new Error(`Prepared object ${descriptor.id} failed its SHA-256 identity check.`);
  let value = parseJson(bytes, `Prepared object ${descriptor.id}`);
  const references = collectSharedReferences(value);
  if (references.length) {
    if (!readSharedBank) throw new TypeError(`Prepared object ${descriptor.id} references shared banks but no bank reader is available.`);
    const banks = new Map(await Promise.all(references.map(async reference => [sharedReferenceKey(reference), await readSharedBank(reference)] as const)));
    value = inlineSharedReferences(value, banks);
  }
  const prepared = readPreparedObject(value, descriptor, input => {
    if (record(input, 'runtime plan').id !== descriptor.id) throw new TypeError(`Prepared CSS definition does not match object ${descriptor.id}.`);
    return parsePreparedObjectRuntime(input, { parsedJson: true });
  });
  return prepared.data;
}
