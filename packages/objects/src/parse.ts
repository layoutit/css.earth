import type { JsonRecord, JsonValue, ObjectDescriptor, PreparedAssetReference } from './descriptor.js';

const identifier = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const schema = 'cssearth-object@1';

function record(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${location} must be a JSON object.`);
  }
  // The prototype check above establishes plain record semantics, not its values.
  return value as Record<string, unknown>;
}
function named(value: unknown, location: string): string {
  if (typeof value !== 'string' || !identifier.test(value)) throw new TypeError(`${location} must be a stable identifier.`);
  return value;
}
function allowedKeys(value: Record<string, unknown>, keys: readonly string[], location: string) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new TypeError(`${location}.${key} is not supported by this schema.`);
}
function jsonValue(value: unknown, location: string, ancestors: Set<object>, depth: number): JsonValue {
  if (depth > 64) throw new RangeError(`${location} exceeds the JSON nesting limit.`);
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || !value) throw new TypeError(`${location} must contain finite JSON values.`);
  if (ancestors.has(value)) throw new TypeError(`${location} contains a cycle.`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index++) result.push(jsonValue(value[index], `${location}[${index}]`, ancestors, depth + 1));
      return Object.freeze(result);
    }
    const input = record(value, location);
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(input)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError(`${location}.${key} is not a data field.`);
      result[key] = jsonValue(item, `${location}.${key}`, ancestors, depth + 1);
    }
    return Object.freeze(result);
  } finally { ancestors.delete(value); }
}
function properties(value: unknown): JsonRecord {
  const input = record(value, 'object.properties');
  const output: Record<string, JsonValue> = {};
  const ancestors = new Set<object>([input]);
  for (const [key, item] of Object.entries(input)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError(`object.properties.${key} is not a data field.`);
    output[key] = jsonValue(item, `object.properties.${key}`, ancestors, 1);
  }
  return Object.freeze(output);
}
function preparedReference(value: unknown): PreparedAssetReference {
  const input = record(value, 'object.prepared');
  allowedKeys(input, ['format', 'url'], 'object.prepared');
  if (typeof input.format !== 'string' || !/^[a-z][a-z0-9.-]*@[1-9][0-9]*$/.test(input.format)) {
    throw new TypeError('object.prepared.format must identify a versioned prepared format.');
  }
  if (typeof input.url !== 'string' || !input.url.trim() || /[\u0000-\u0020]/.test(input.url)) {
    throw new TypeError('object.prepared.url must be a nonempty asset reference.');
  }
  return Object.freeze({ format: input.format, url: input.url });
}

/** Parse once at the configuration boundary; returns a validated immutable copy. */
export function parseObjectDescriptor(value: unknown): ObjectDescriptor {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); }
    catch { throw new TypeError('Object descriptor is not valid JSON.'); }
  }
  const input = record(parsed, 'object');
  allowedKeys(input, ['schema', 'id', 'type', 'properties', 'prepared'], 'object');
  if (input.schema !== schema) throw new TypeError(`Unsupported object schema: ${String(input.schema)}.`);
  return Object.freeze({ schema, id: named(input.id, 'object.id'), type: named(input.type, 'object.type'),
    properties: properties(input.properties),
    ...(input.prepared === undefined ? {} : { prepared: preparedReference(input.prepared) }),
  });
}
