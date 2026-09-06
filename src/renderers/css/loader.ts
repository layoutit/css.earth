import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { parsePreparedObjectRuntime } from './validation/index.js';
import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { record } from './validation/guards.js';

export const PREPARED_CSS_OBJECT_FORMAT = 'cssearth-css-object@4';
export interface PreparedCssTransport {
  /** Return the exact bytes addressed by the descriptor's prepared reference. */
  read(url: string): Promise<ArrayBuffer>;
}

/** Decode a pinned artifact. Runtime never bakes a missing or stale payload. */
export async function loadPreparedCssObject(
  descriptorInput: unknown,
  transport: PreparedCssTransport,
): Promise<ObjectRuntimeDefinition> {
  const descriptor = parseObjectDescriptor(descriptorInput);
  if (descriptor.type !== 'layered-body') throw new TypeError(`The CSS renderer does not support object type ${descriptor.type}.`);
  const reference = descriptor.prepared;
  if (!reference || reference.format !== PREPARED_CSS_OBJECT_FORMAT) {
    throw new TypeError(`Object ${descriptor.id} requires its ${PREPARED_CSS_OBJECT_FORMAT} prepared artifact.`);
  }
  const bytes = await transport.read(reference.url);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digest = [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== reference.sha256) throw new Error(`Prepared object ${descriptor.id} failed its SHA-256 identity check.`);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (cause) { throw new TypeError(`Prepared object ${descriptor.id} is not valid UTF-8 JSON.`, { cause }); }
  const prepared = readPreparedObject(value, descriptor, input => {
    if (record(input, 'runtime plan').id !== descriptor.id) throw new TypeError(`Prepared CSS definition does not match object ${descriptor.id}.`);
    return parsePreparedObjectRuntime(input);
  });
  return prepared.data;
}
