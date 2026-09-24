import { sourceArray, sourceDate, sourceDigest, sourceId, sourceObject, sourceText, sourceUrl } from '../src/platform/source-catalog.mts';
import { validateDatasetText } from './dataset-content.mts';

/**
 * Reader text for one object: the card line, the introduction and each dataset's
 * title, chooser detail and summary, each with the sources a reviewer checks it
 * against. Authors keep it in the package's `text.json`, outside the scientific
 * source tree, so a wording change never touches recipes, pins or provenance.
 * `pnpm prepare:text` checks every object, then publishes `prepared/text.json`.
 */
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

export type TextSlot = 'card' | 'introduction' | 'title' | 'detail' | 'summary';
export interface TextBudget { readonly characters: number; readonly sentences?: number; readonly lines: number }

/**
 * Budgets for the 300 px text column of the docked card, the narrowest the shell
 * lays out. Characters and sentences are checked while preparing; the reader-text
 * browser suite measures the lines in the rendered shell at desktop and phone widths.
 * The summary fits the three lines the dataset card reserves, so switching
 * datasets never resizes the card.
 */
export const TEXT_BUDGETS: Readonly<Record<TextSlot, TextBudget>> = Object.freeze({
  card: Object.freeze({ characters: 110, sentences: 1, lines: 3 }),
  introduction: Object.freeze({ characters: 180, sentences: 2, lines: 5 }),
  title: Object.freeze({ characters: 40, lines: 1 }),
  detail: Object.freeze({ characters: 28, lines: 1 }),
  summary: Object.freeze({ characters: 125, sentences: 2, lines: 3 }),
});

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

function cited(raw: unknown, label: string): CitedText {
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
  const datasets = Object.entries(sourceObject(value.datasets)).map(([lensId, raw]) => [sourceId(lensId), dataset(raw)] as const);
  return {
    objectId, card: cited(value.card, `${objectId} card`), introduction: cited(value.introduction, `${objectId} introduction`),
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
  const value = sourceObject(input, ['schema', 'objectId', 'card', 'introduction', 'datasets']);
  if (value.schema !== PREPARED_TEXT_SCHEMA) throw new TypeError('Unsupported prepared text schema.');
  const id = identity(value, objectId, 'Prepared text');
  return Object.freeze({ schema: PREPARED_TEXT_SCHEMA, ...blocks(value, id) });
}

export interface TextFinding { readonly objectId: string; readonly slot: string; readonly rule: string; readonly detail: string }

export interface TextContext {
  /** Registry name, used to recognise copies that only swap the object name. */
  readonly name: string;
  /** Dataset identities and chooser labels, in order. */
  readonly lenses: readonly { readonly id: string; readonly label: string }[];
  /** Source catalogue record ids a citation may name. */
  readonly catalogue: ReadonlySet<string>;
  /** Datasets whose prepared product names its inputs; their summaries may rely on those sources. */
  readonly evidencedDatasets: ReadonlySet<string>;
}

/** What makes text unpublishable: a dataset without text, a block over its budget, or a claim without catalogued sources. */
export function readerTextErrors(text: ObjectText, context: TextContext): TextFinding[] {
  const errors: TextFinding[] = [];
  const add = (slot: string, rule: string, detail: string) => errors.push({ objectId: text.objectId, slot, rule, detail });
  const budget = (slot: string, kind: TextSlot, value: string) => {
    const limit = TEXT_BUDGETS[kind];
    if (value.length > limit.characters) add(slot, 'length', `${value.length} characters; the ${kind} budget is ${limit.characters}`);
    if (limit.sentences === undefined) {
      if (/[.!?]$/u.test(value)) add(slot, 'punctuation', 'labels end without a full stop');
      return;
    }
    const count = sentences(value).length;
    if (count > limit.sentences) add(slot, 'sentences', `${count} sentences; the ${kind} budget is ${limit.sentences}`);
    if (!/[.!?]$/u.test(value)) add(slot, 'punctuation', 'ends without a full stop');
  };
  const cite = (slot: string, sources: readonly TextCitation[]) => {
    for (const source of sources) if (!context.catalogue.has(source.catalogueId)) add(slot, 'citation', `${source.catalogueId} is not a source catalogue record`);
  };
  budget('card', 'card', text.card.text);
  cite('card', text.card.sources);
  budget('introduction', 'introduction', text.introduction.text);
  cite('introduction', text.introduction.sources);
  const lensIds = context.lenses.map(lens => lens.id);
  for (const id of lensIds.filter(id => !text.datasets[id])) add(`datasets.${id}`, 'coverage', 'the dataset has no reader text');
  for (const [id, dataset] of Object.entries(text.datasets)) {
    if (!lensIds.includes(id)) add(`datasets.${id}`, 'coverage', 'no dataset has this id');
    budget(`datasets.${id}.title`, 'title', dataset.title);
    // The page refuses a dataset whose title repeats its lens label or its summary (dataset-content.mts); refuse it here first.
    const lens = context.lenses.find(entry => entry.id === id);
    try { validateDatasetText({ id, title: dataset.title, label: lens?.label, summary: dataset.summary }); } catch (error) { add(`datasets.${id}.title`, 'identity', (error as Error).message.replace(`${id}: `, '')); }
    if (dataset.detail !== undefined) budget(`datasets.${id}.detail`, 'detail', dataset.detail);
    budget(`datasets.${id}.summary`, 'summary', dataset.summary);
    if (dataset.sources?.length) cite(`datasets.${id}`, dataset.sources);
    else if (!context.evidencedDatasets.has(id)) add(`datasets.${id}`, 'citation', 'cite the sources this summary describes; its prepared product names none');
  }
  return errors;
}

/** Words that describe how the project works, not the object. */
const PROCESS_WORDS: readonly RegExp[] = [
  /\bsource-(?:backed|derived|constrained)\b/iu, /\b(?:observation|lightcurve|light-curve|dimension|occultation)-constrained\b/iu,
  /\bprepared\b/iu, /\bcanonical\b/iu, /\bvendored\b/iu, /\bprovenance\b/iu, /\bpipeline\b/iu, /\bfixture\b/iu,
  /\bvalidated\b/iu, /\bfaithful(?:ly)?\b/iu, /\bhonest(?:ly)?\b/iu, /\bclearly label(?:l)?ed\b/iu, /\bexplicit(?:ly)?\b/iu,
];
/** Invitations and self-reference that fill space without saying anything. */
const EMPTY_WORDS: readonly RegExp[] = [
  /\bexplore\b/iu, /\binspect\b/iu, /\bdiscover\b/iu, /\bdelve\b/iu, /\bdive into\b/iu, /\bjourney\b/iu, /\bembark\b/iu,
  /\bunveil/iu, /\bin 3D\b/iu, /\bcssEarth\b/iu, /\bthis (?:view|lens|card|page)\b/iu,
];
const HYPE_WORDS: readonly RegExp[] = [
  /\bremarkabl[ey]\b/iu, /\bstriking(?:ly)?\b/iu, /\bstunning\b/iu, /\bfascinating\b/iu, /\bcaptivating\b/iu,
  /\bbreathtaking\b/iu, /\biconic\b/iu, /\btestament\b/iu, /\btapestry\b/iu, /\bshowcases?\b/iu, /\bboasts?\b/iu,
  /\bmajestic\b/iu, /\bspectacular\b/iu, /\benigmatic\b/iu, /\bmysterious\b/iu, /\bit is worth noting\b/iu,
  /\bnote that\b/iu, /\bkeep in mind\b/iu,
];
/** Card and introduction talk about the object; how its display is made belongs to the dataset. */
const DISPLAY_WORDS: readonly RegExp[] = [
  /\bmodel(?:s|l?ed)?\b/iu, /\breconstruct(?:ion|ions|ed)\b/iu, /\bmesh(?:es)?\b/iu, /\btextures?\b/iu,
  /\billustrat(?:ive|es?|ion)\b/iu, /\bdisplay(?:s|ed)?\b/iu, /\bapproximations?\b/iu, /\bellipsoids?\b/iu,
  /\bradial heights?\b/iu, /\bdatasets?\b/iu, /\bDAMIT\b/u, /\bADAM\b/u, /\bworlds?\b/iu, /\blandscapes?\b/iu,
];

/** Filler, process and hype phrasing, for reviewers of any shipped string. */
export function phraseViolations(text: string): string[] {
  return [...PROCESS_WORDS, ...EMPTY_WORDS, ...HYPE_WORDS].flatMap(pattern => {
    const match = pattern.exec(text);
    return match ? [match[0]] : [];
  });
}

const ABBREVIATION = /(?:\b(?:[A-Z]|St|Mt|Dr|Mr|Mrs|Ms|Jr|Sr|No|vs|ca|approx|al|e\.g|i\.e|U\.S))\.$/u;
/** Sentences, keeping initials and common abbreviations inside their sentence. */
export function sentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/u);
  const result: string[] = [];
  for (const part of parts) {
    const previous = result.at(-1);
    if (previous !== undefined && ABBREVIATION.test(previous)) result[result.length - 1] = `${previous} ${part}`;
    else result.push(part);
  }
  return result.filter(Boolean);
}

/** Editorial checks for a reviewer to read. They flag likely filler and repetition but never block publication. */
export function readerTextWarnings(text: ObjectText, context: TextContext): TextFinding[] {
  const warnings: TextFinding[] = [];
  const add = (slot: string, rule: string, detail: string) => warnings.push({ objectId: text.objectId, slot, rule, detail });
  const values: [string, string][] = [['card', text.card.text], ['introduction', text.introduction.text],
    ...Object.entries(text.datasets).flatMap(([id, dataset]): [string, string][] => [[`datasets.${id}.title`, dataset.title],
      ...(dataset.detail === undefined ? [] : [[`datasets.${id}.detail`, dataset.detail] as [string, string]]), [`datasets.${id}.summary`, dataset.summary]])];
  for (const [slot, value] of values) {
    for (const phrase of phraseViolations(value)) add(slot, 'phrasing', `“${phrase}”`);
    if (/\bgrid\b/iu.test(value)) add(slot, 'grid', 'the dataset legend explains the no-data grid');
  }
  for (const slot of ['card', 'introduction'] as const) {
    for (const pattern of DISPLAY_WORDS) {
      const match = pattern.exec(text[slot].text);
      if (match) add(slot, 'about-the-object', `“${match[0]}” describes the display; say it in a dataset summary`);
    }
  }
  for (const lens of context.lenses) {
    const dataset = text.datasets[lens.id];
    if (dataset && dataset.title.toLocaleLowerCase('en') === lens.label.toLocaleLowerCase('en')) add(`datasets.${lens.id}.title`, 'specific-title', 'the title repeats the chooser label');
  }
  const seen = new Map<string, string>();
  const prose: [string, string][] = [['card', text.card.text], ['introduction', text.introduction.text],
    ...Object.entries(text.datasets).map(([id, dataset]): [string, string] => [`datasets.${id}.summary`, dataset.summary])];
  for (const [slot, value] of prose) {
    for (const sentence of sentences(value)) {
      const key = normalize(sentence, context.name), first = seen.get(key);
      if (first !== undefined && first !== slot) add(slot, 'repetition', `repeats a sentence from ${first}`);
      else seen.set(key, slot);
    }
  }
  if (normalize(text.introduction.text, context.name).includes(normalize(text.card.text, context.name))) add('introduction', 'repetition', 'contains the card line');
  return warnings;
}

function normalize(value: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return value.replace(new RegExp(escaped, 'giu'), '{name}').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}{}]+/gu, ' ').trim();
}

export interface TextBlock {
  /** Where the words come from, such as `introduction`, `datasets.shape.summary` or `mission:cassini`. One source listed twice is one block. */
  readonly source: string;
  readonly text: string;
}

const SHARED_PHRASE_WORDS = 6;
function phrases(value: string): Set<string> {
  const words = value.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  const found = new Set<string>();
  for (let index = 0; index + SHARED_PHRASE_WORDS <= words.length; index++) found.add(words.slice(index, index + SHARED_PHRASE_WORDS).join(' '));
  return found;
}

/**
 * Text shown together should not say the same thing twice: no sentence and no
 * six-word phrase in two blocks of one group, such as an introduction, a dataset
 * summary and the mission cards beside it. Two blocks with identical words count.
 */
export function compositionWarnings(objectId: string, blocks: readonly TextBlock[]): TextFinding[] {
  const unique = [...new Map(blocks.map(block => [block.source, block])).values()];
  const warnings: TextFinding[] = [];
  for (const [index, block] of unique.entries()) {
    const own = phrases(block.text), sentencesOf = new Set(sentences(block.text).map(sentence => normalize(sentence, '')));
    for (const other of unique.slice(index + 1)) {
      const repeated = sentences(other.text).find(sentence => sentencesOf.has(normalize(sentence, '')));
      if (repeated !== undefined) { warnings.push({ objectId, slot: other.source, rule: 'composition', detail: `repeats a sentence from ${block.source}` }); continue; }
      const shared = [...phrases(other.text)].find(phrase => own.has(phrase));
      if (shared !== undefined) warnings.push({ objectId, slot: other.source, rule: 'composition', detail: `shares “${shared}” with ${block.source}` });
    }
  }
  return warnings;
}

/** Cards and introductions are the catalogue's words for each object, so two objects sharing one is worth a second look. */
export function catalogueTextWarnings(entries: readonly { readonly text: ObjectText; readonly name: string }[]): TextFinding[] {
  const warnings: TextFinding[] = [];
  for (const slot of ['card', 'introduction'] as const) {
    const groups = new Map<string, string[]>();
    for (const { text, name } of entries) {
      const key = normalize(text[slot].text, name);
      groups.set(key, [...(groups.get(key) ?? []), text.objectId]);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const objectId of ids) {
        warnings.push({ objectId, slot, rule: 'unique', detail: `shared with ${ids.filter(id => id !== objectId).slice(0, 3).join(', ')}${ids.length > 4 ? ` and ${ids.length - 4} more` : ''}` });
      }
    }
  }
  return warnings;
}
