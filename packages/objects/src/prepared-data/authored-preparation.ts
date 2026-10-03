import { readNonArrayRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import type { SourceReference } from '../authored.js';

export const AUTHORED_PREPARATION_SCHEMA = 'cssearth-authored-preparation@1';
export interface AuthoredPreparationReceipt {
  readonly schema: typeof AUTHORED_PREPARATION_SCHEMA;
  readonly id: string;
  readonly sources: readonly SourceReference[];
  readonly lanes: Readonly<Record<string, boolean>>;
}

/** Historical redraw admission accepts untagged receipts and treats absent source lists as unpublished. */
export function readAuthoredPreparationSources(value: unknown, path: string): readonly SourceReference[] | undefined {
  const listed = value !== null && typeof value === 'object' && 'sources' in value ? value.sources : undefined;
  if (!Array.isArray(listed)) return undefined;
  return listed.map((entry: unknown, index) => {
    const at = `${path} sources[${index}]`;
    const source = readNonArrayRecord(entry, at, () => { throw new TypeError(`${at} must be an object.`); });
    if (typeof source.id !== 'string' || typeof source.path !== 'string') throw new TypeError(`${path}: sources[${index}] needs a string id and path; got ${JSON.stringify(entry)}.`);
    return { id: source.id, path: source.path };
  });
}

/** Published replay compares complete source records, including any historical extra fields; it checks only ids. */
export function readPublishedPreparationSources(value: unknown): ReadonlyMap<string, string> {
  const receipt = requireRecord(value, 'published authored-preparation');
  return new Map(requireArray(receipt.sources, 'published sources').map(source => requireRecord(source, 'published source'))
    .map(source => [requireString(source.id, 'source id'), JSON.stringify(source)] as const));
}
