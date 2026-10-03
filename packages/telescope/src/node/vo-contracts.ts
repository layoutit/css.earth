import { requireFiniteNumber, requireRecord } from '@cssearth/core';
import { canonical, type DiscoverySnapshot, type Json } from '@cssearth/objects';

/** A file-system-safe name made of readable parts. */
export const plainName = (...parts: readonly string[]): string =>
  parts.map(part => part.replace(/[^A-Za-z0-9._-]+/gu, '_').replace(/^[_.]+|_+$/gu, '').slice(-80)).filter(Boolean).join('--');
export const DEFAULT_LIMITS = { scienceBytes: 1_073_741_824, metadataBytes: 33_554_432, nestedEdges: 3, metadataRequests: 32, expandedBytes: 1_073_741_824, packageMembers: 1024 } as const;
export interface TransferLimits { readonly scienceBytes: number; readonly metadataBytes: number; readonly nestedEdges: number; readonly metadataRequests: number; readonly expandedBytes: number; readonly packageMembers: number }
export function parseLimits(value: unknown = {}): TransferLimits {
  const raw = requireRecord(value);
  const read = (key: keyof TransferLimits): number => {
    const n = requireFiniteNumber(raw[key] === undefined ? DEFAULT_LIMITS[key] : raw[key], key);
    if (!Number.isSafeInteger(n) || n < (key === 'nestedEdges' ? 0 : 1)) throw new TypeError(`Invalid transfer limit ${key}.`);
    return n;
  };
  for (const key of Object.keys(raw)) if (!Object.hasOwn(DEFAULT_LIMITS, key)) throw new TypeError(`Unknown transfer limit ${key}.`);
  return { scienceBytes: read('scienceBytes'), metadataBytes: read('metadataBytes'), nestedEdges: read('nestedEdges'), metadataRequests: read('metadataRequests'), expandedBytes: read('expandedBytes'), packageMembers: read('packageMembers') };
}
/** A record's exact identity: its declared identity columns when they are present and unique, else its row in the saved
 * response it came from. The key is the canonical text itself, so two records share a key only when their identity is equal. */
export function recordKey(snapshot: DiscoverySnapshot, row: Readonly<Record<string, Json>>, identityColumns: readonly string[], rowIndex = snapshot.response.rows.indexOf(row)): string {
  const identity = identityColumns.map(column => row[column]);
  const unique = identity.length > 0 && identity.every(v => v !== undefined && v !== null && v !== '') &&
    snapshot.response.rows.filter(r => identityColumns.every(column => canonical(r[column]) === canonical(row[column]))).length === 1;
  return canonical(unique ? { service: snapshot.service, table: snapshot.table, identityColumns, identity }
    : { service: snapshot.service, table: snapshot.table, response: snapshot.response.raw.path, rowIndex, row });
}
/** One product of a record: the record's key and the binding that selects the product, as canonical text. */
export const productKey = (record: string, binding: Json): string => canonical({ record, binding });
