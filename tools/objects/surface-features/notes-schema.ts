import { isRecord } from '../../../src/platform/records.mts';
const requireRecord = (value: unknown, label = 'Source value'): Record<string, unknown> => { if (!isRecord(value)) throw new TypeError(`${label} must be an object.`); return value; };
const requireArray = (value: unknown, label = 'Source value'): unknown[] => { if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`); return value; };
const requireString = (value: unknown, label = 'Source value'): string => { if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`); return value; };
// The pinned notes document: Wikipedia lead summaries joined to Gazetteer feature ids through Wikidata.
export const FEATURE_NOTES_SCHEMA = 'cssearth-surface-feature-notes@1';
export const MAXIMUM_NOTE_CHARACTERS = 320;

export interface FeatureNote { readonly id: string; readonly item: string; readonly title: string; readonly url: string; readonly revision: string; readonly extract: string; }
export interface FeatureNotes {
  readonly schema: typeof FEATURE_NOTES_SCHEMA; readonly source: string; readonly retrievedAt: string; readonly license: string; readonly licenseUrl: string;
  readonly wikidataQuery: string; readonly entries: readonly FeatureNote[];
}

/** Validate a pinned notes document. */
export function parseFeatureNotes(value: unknown): FeatureNotes {
  const input = requireRecord(value);
  if (input.schema !== FEATURE_NOTES_SCHEMA) throw new TypeError('Unsupported surface feature notes schema.');
  const retrievedAt = requireString(input.retrievedAt);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(retrievedAt)) throw new TypeError('Feature notes retrievedAt must be an ISO date.');
  const ids = new Set<string>();
  const entries = requireArray(input.entries).map(item => {
    const entry = requireRecord(item);
    const note = { id: requireString(entry.id), item: requireString(entry.item), title: requireString(entry.title), url: requireString(entry.url), revision: requireString(entry.revision), extract: requireString(entry.extract) };
    if (!/^[0-9]+$/u.test(note.id) || ids.has(note.id) || !/^Q[0-9]+$/u.test(note.item) || !note.url.startsWith('https://en.wikipedia.org/wiki/') || !note.extract.trim() || note.extract.length > MAXIMUM_NOTE_CHARACTERS + 1) throw new TypeError(`Feature note ${note.id} is invalid.`);
    ids.add(note.id);
    return Object.freeze(note);
  });
  return Object.freeze({ schema: FEATURE_NOTES_SCHEMA, source: requireString(input.source), retrievedAt, license: requireString(input.license), licenseUrl: requireString(input.licenseUrl), wikidataQuery: requireString(input.wikidataQuery), entries: Object.freeze(entries) });
}

/** The first sentences of a lead summary, cut at a sentence end within the character budget. */
export function trimExtract(extract: string): string {
  const text = extract.replace(/\s+/gu, ' ').trim();
  if (text.length <= MAXIMUM_NOTE_CHARACTERS) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)/gu) ?? [text];
  let out = '';
  for (const sentence of sentences) { if ((out + sentence).trim().length > MAXIMUM_NOTE_CHARACTERS) break; out += sentence; }
  return (out.trim() || text.slice(0, MAXIMUM_NOTE_CHARACTERS - 1).trim() + '…');
}

