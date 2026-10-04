/** Cited authored and prepared object text. Citations preserve reviewable source evidence;
 * editorial budgets and source transport remain with the host. */
import { sourceArray, sourceDate, sourceId, sourceObject, sourceText, sourceUrl } from '../../sources/catalog.js';
export const OBJECT_TEXT_SCHEMA = 'cssearth-object-text@1';
export const PREPARED_TEXT_SCHEMA = 'cssearth-prepared-text@1';

export interface TextCitation {
  readonly catalogueId: string; readonly url: string; readonly label: string; readonly checked: string; readonly locator?: string;
  /** A short excerpt a reviewer can find at the URL. */
  readonly quote?: string;
}
export interface CitedText { readonly text: string; readonly sources: readonly TextCitation[] }
export interface ObjectTextDataset {
  readonly title: string; readonly detail?: string; readonly summary: string;
  /** Omitted when the dataset's prepared product already names the sources its summary describes. */
  readonly sources?: readonly TextCitation[];
}
export interface ObjectText {
  readonly schema: typeof OBJECT_TEXT_SCHEMA; readonly objectId: string;
  readonly card: CitedText; readonly introduction: CitedText;
  readonly datasets: Readonly<Record<string, ObjectTextDataset>>;
}
export interface PreparedObjectText extends Omit<ObjectText, 'schema'> {
  readonly schema: typeof PREPARED_TEXT_SCHEMA;
}

function citation(raw: unknown): TextCitation {
  const value = sourceObject(raw, ['catalogueId', 'url', 'label', 'checked', 'locator', 'quote']);
  const quote = value.quote === undefined ? undefined : sourceText(value.quote);
  if (quote !== undefined && quote.length > 300) throw new TypeError('A text citation quote is limited to 300 characters.');
  return Object.freeze({
    catalogueId: sourceId(value.catalogueId), url: sourceUrl(value.url), label: sourceText(value.label),
    checked: sourceDate(value.checked, true),
    ...(value.locator === undefined ? {} : { locator: sourceText(value.locator) }),
    ...(quote === undefined ? {} : { quote }),
  });
}

export function parseCitedText(raw: unknown, label: string): CitedText {
  const value = sourceObject(raw, ['text', 'sources']);
  const sources = sourceArray(value.sources, citation);
  if (!sources.length) throw new TypeError(`${label} needs at least one source.`);
  return Object.freeze({ text: sourceText(value.text), sources });
}

function dataset(raw: unknown): ObjectTextDataset {
  const value = sourceObject(raw, ['title', 'detail', 'summary', 'sources']);
  return Object.freeze({
    title: sourceText(value.title),
    ...(value.detail === undefined ? {} : { detail: sourceText(value.detail) }),
    summary: sourceText(value.summary),
    ...(value.sources === undefined ? {} : { sources: sourceArray(value.sources, citation) }),
  });
}

function blocks(value: Record<string, unknown>, objectId: string) {
  const datasets = Object.entries(sourceObject(value.datasets)).map(([datasetId, raw]) => [sourceId(datasetId), dataset(raw)] as const);
  return {
    objectId, card: parseCitedText(value.card, `${objectId} card`), introduction: parseCitedText(value.introduction, `${objectId} introduction`),
    datasets: Object.freeze(Object.fromEntries(datasets)),
  };
}

function identity(value: Record<string, unknown>, objectId: string | undefined, label: string) {
  const id = sourceId(value.objectId);
  if (objectId !== undefined && id !== objectId) throw new TypeError(`${label} belongs to ${id}, not ${objectId}.`);
  return id;
}

export function parseObjectText(input: unknown, objectId?: string): ObjectText {
  const value = sourceObject(input, ['schema', 'objectId', 'card', 'introduction', 'datasets']);
  if (value.schema !== OBJECT_TEXT_SCHEMA) throw new TypeError('Unsupported object text schema.');
  return Object.freeze({ schema: OBJECT_TEXT_SCHEMA, ...blocks(value, identity(value, objectId, 'Object text')) });
}

export function parsePreparedText(input: unknown, objectId?: string): PreparedObjectText {
  // A body whose bake stopped before its text step has no file; say which body and which step, not only that a record is missing.
  if (input === undefined) throw new TypeError(`${objectId ?? 'An object'}: prepared/text.json is missing; run the bake's text step (node packages/bake/cli/prepare-object.mts ${objectId ?? '<id>'} --from text).`);
  const value = sourceObject(input, ['schema', 'objectId', 'card', 'introduction', 'datasets']);
  if (value.schema !== PREPARED_TEXT_SCHEMA) throw new TypeError('Unsupported prepared text schema.');
  const id = identity(value, objectId, 'Prepared text');
  return Object.freeze({ schema: PREPARED_TEXT_SCHEMA, ...blocks(value, id) });
}
