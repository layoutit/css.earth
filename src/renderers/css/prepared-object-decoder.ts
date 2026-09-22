import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { parsePreparedObjectRuntime } from './validation/index.js';
import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';
import { record } from './validation/guards.js';
import { parsePreparedAssetOrigin } from './rendering/prepared-asset-origin.js';

export const PREPARED_CSS_OBJECT_FORMAT = 'cssearth-css-object@5';

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

/** Identical validation in the browser worker and Node tools. */
export async function decodePreparedCssObject(descriptorInput: unknown, bytes: ArrayBuffer): Promise<ObjectRuntimeDefinition> {
  const descriptor = requirePreparedCssDescriptor(descriptorInput);
  const value = parseJson(bytes, `Prepared object ${descriptor.id}`);
  const prepared = readPreparedObject(value, descriptor, input => {
    if (record(input, 'runtime plan').id !== descriptor.id) throw new TypeError(`Prepared CSS definition does not match object ${descriptor.id}.`);
    return parsePreparedObjectRuntime(input, { parsedJson: true });
  });
  // Origin resolution is carried by the descriptor, never the transport itself:
  // a rebake is never required to move an object's assets onto `assetOrigin`.
  const assetOrigin = parsePreparedAssetOrigin(descriptor.properties.assetOrigin);
  return assetOrigin ? { ...prepared.data, assetOrigin } : prepared.data;
}
