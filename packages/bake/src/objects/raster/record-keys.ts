import { requireRecord } from '@cssearth/core';

/** Refuse keys a format does not declare, and require the ones it must have. */
export function checkKeys(value: unknown, required: readonly string[], allowed: readonly string[], context: string) {
  const record = requireRecord(value), keys = Object.keys(record);
  const unknown = keys.filter(key => !required.includes(key) && !allowed.includes(key)), missing = required.filter(key => record[key] === undefined);
  if (unknown.length || missing.length) throw new TypeError(`Invalid source-bound ${context}: ${[...unknown.map(key => `unknown ${key}`), ...missing.map(key => `missing ${key}`)].join(', ')}.`);
}
