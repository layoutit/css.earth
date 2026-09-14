import { sourceObject, sourceId, sourceText } from './source-catalog.mts';

export type ContextAvailability = Readonly<Record<string,
  { available: true } | { available: false; reason: string }>>;

/** Installation state derived from object packages, never a destination registry. */
export function parseContextAvailability(input: unknown): ContextAvailability {
  return Object.fromEntries(Object.entries(sourceObject(input)).map(([id, entry]) => {
    sourceId(id);
    const value = sourceObject(entry, ['available', 'reason']);
    if (value.available === true && value.reason === undefined) return [id, { available: true }];
    if (value.available === false) return [id, { available: false, reason: sourceText(value.reason) }];
    throw new TypeError(`Invalid prepared availability: ${id}.`);
  }));
}
