// Shared anchor tables replace one stamped test file per body. Each table maps an
// object id to independently published anchors; one runner per contract registers
// a test per entry. CSSEARTH_TEST_OBJECTS=<id>[,<id>] limits a run to those bodies,
// which is how the per-object runner exercises a single body.
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export interface AnchorEntry<T> { readonly id: string; readonly claim: string; readonly anchors: T; }

export function selectedObjectIds(ids: readonly string[], selection = process.env.CSSEARTH_TEST_OBJECTS): string[] {
  const requested = (selection ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (requested.length === 0 || requested.includes('all')) return [...ids];
  return ids.filter(id => requested.includes(id));
}

/** Validate a checked-in table: an object keyed by object id whose entries carry a claim. */
export function anchorTable<T>(value: unknown, label: string, parse: (entry: Record<string, unknown>, id: string) => T): AnchorEntry<T>[] {
  const table = requireRecord(value, label);
  return Object.keys(table).sort().map(id => {
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${label}: invalid object id ${id}`);
    const entry = requireRecord(table[id], `${label} ${id}`);
    return { id, claim: requireString(entry.claim, `${label} ${id} claim`), anchors: parse(entry, id) };
  });
}

export const numberList = (value: unknown, label: string): number[] =>
  requireArray(value, label).map((entry, index) => requireFiniteNumber(entry, `${label}[${index}]`));
export const stringList = (value: unknown, label: string): string[] =>
  requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
