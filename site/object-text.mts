import { sourceArray, sourceDate, sourceId, sourceObject, sourcePath, sourceText, sourceUrl } from '../src/platform/source-catalog.mts';

/**
 * Reader text for one object: the card line, the introduction and each dataset's
 * title, chooser detail and summary. It lives in `source/content/text.json`, apart
 * from data recipes, so preparation, tests and review check the same words.
 */
export const OBJECT_TEXT_SCHEMA = 'cssearth-object-text@1';

export interface TextCitation {
  readonly catalogueId: string; readonly url: string; readonly label: string; readonly checked: string;
  readonly path?: string; readonly locator?: string;
  /** A short excerpt a reviewer can find at the URL; numbers in the text may round from it. */
  readonly quote?: string;
}
export interface CitedText { readonly text: string; readonly sources: readonly TextCitation[] }
export interface ObjectTextDataset {
  readonly title: string; readonly detail?: string; readonly summary: string; readonly sources?: readonly TextCitation[];
}
export interface ObjectText {
  readonly schema: typeof OBJECT_TEXT_SCHEMA; readonly objectId: string;
  readonly card: CitedText; readonly introduction: CitedText;
  readonly datasets: Readonly<Record<string, ObjectTextDataset>>;
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
  const value = sourceObject(raw, ['catalogueId', 'url', 'label', 'checked', 'path', 'locator', 'quote']);
  const path = value.path === undefined ? undefined : sourcePath(value.path);
  if (path !== undefined && !path.startsWith('source/')) throw new TypeError('Text evidence must be inside the body source directory.');
  const quote = value.quote === undefined ? undefined : sourceText(value.quote);
  if (quote !== undefined && quote.length > 300) throw new TypeError('A text citation quote is limited to 300 characters.');
  return Object.freeze({
    catalogueId: sourceId(value.catalogueId), url: sourceUrl(value.url), label: sourceText(value.label),
    checked: sourceDate(value.checked, true),
    ...(path === undefined ? {} : { path }),
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

export function parseObjectText(input: unknown, objectId?: string): ObjectText {
  const value = sourceObject(input, ['schema', 'objectId', 'card', 'introduction', 'datasets']);
  if (value.schema !== OBJECT_TEXT_SCHEMA) throw new TypeError('Unsupported object text schema.');
  const id = sourceId(value.objectId);
  if (objectId !== undefined && id !== objectId) throw new TypeError(`Object text belongs to ${id}, not ${objectId}.`);
  const datasets = Object.entries(sourceObject(value.datasets)).map(([lensId, raw]) => [sourceId(lensId), dataset(raw)] as const);
  return Object.freeze({
    schema: OBJECT_TEXT_SCHEMA, objectId: id,
    card: cited(value.card, `${id} card`), introduction: cited(value.introduction, `${id} introduction`),
    datasets: Object.freeze(Object.fromEntries(datasets)),
  });
}

export interface TextViolation { readonly objectId: string; readonly slot: string; readonly rule: string; readonly detail: string }

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

/** Phrasing no shipped string may use, including shell and catalogue text. */
export function phraseViolations(text: string): string[] {
  return [...PROCESS_WORDS, ...EMPTY_WORDS, ...HYPE_WORDS].flatMap(pattern => {
    const match = pattern.exec(text);
    return match ? [match[0]] : [];
  });
}

const ABBREVIATION = /(?:\b(?:[A-Z]|St|Mt|Dr|Jr|Sr|No|vs|ca|approx|al|e\.g|i\.e|U\.S))\.$/u;
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

const NUMBER = /\d[\d,]*(?:\.\d+)?/gu;
function numbers(text: string): { value: number; decimals: number; raw: string }[] {
  const found: { value: number; decimals: number; raw: string }[] = [];
  for (const match of text.matchAll(NUMBER)) {
    const index = match.index, before = text[index - 1] ?? '', after = text[index + match[0].length] ?? '';
    // Designations such as 67P, AZ84 or C/1995 O1 are names, not measurements.
    if (/[\p{L}/]/u.test(before) || /\p{L}/u.test(after)) continue;
    const raw = match[0].replace(/[,.]$/u, ''), normalized = raw.replaceAll(',', '');
    const value = Number(normalized);
    if (!Number.isFinite(value)) continue;
    found.push({ value, decimals: normalized.includes('.') ? normalized.split('.')[1]!.length : 0, raw });
  }
  return found;
}

const APPROXIMATE = /\b(?:about|around|roughly|nearly|almost|approximately|some|over|more than|less than|under)\s*$/iu;
/** A number in reader text must round from a value in the object's facts or cited evidence. */
function unsupportedNumbers(text: string, evidence: readonly string[]): string[] {
  const known = evidence.flatMap(numbers);
  return numbers(text).filter(({ value, decimals, raw }) => {
    if (decimals === 0 && value <= 10) return false;
    const approximate = APPROXIMATE.test(text.slice(0, text.indexOf(raw)));
    return !known.some(candidate => {
      if (Number(candidate.value.toFixed(decimals)) === value) return true;
      return approximate && Math.abs(candidate.value - value) <= Math.max(candidate.value, value) * 0.05;
    });
  }).map(({ raw }) => raw);
}

export interface TextContext {
  /** Registry name, used to recognise copies that only swap the object name. */
  readonly name: string;
  /** Dataset identities and chooser labels from the content recipe, in order. */
  readonly lenses: readonly { readonly id: string; readonly label: string }[];
  /** Fact values and cited evidence that support numbers in the card and introduction. */
  readonly evidence: readonly string[];
}

/** Every rule for one object's reader text. An empty list means it may be published. */
export function objectTextViolations(text: ObjectText, context: TextContext): TextViolation[] {
  const violations: TextViolation[] = [];
  const add = (slot: string, rule: string, detail: string) => violations.push({ objectId: text.objectId, slot, rule, detail });
  const budget = (slot: string, kind: TextSlot, value: string) => {
    const limit = TEXT_BUDGETS[kind];
    if (value.length > limit.characters) add(slot, 'length', `${value.length} characters; the ${kind} budget is ${limit.characters}`);
    if (limit.sentences !== undefined) {
      const count = sentences(value).length;
      if (count > limit.sentences) add(slot, 'sentences', `${count} sentences; the ${kind} budget is ${limit.sentences}`);
      if (!/[.!?]$/u.test(value)) add(slot, 'punctuation', 'ends without a full stop');
    } else if (/[.!?]$/u.test(value)) add(slot, 'punctuation', 'a label ends without a full stop');
    for (const phrase of phraseViolations(value)) add(slot, 'phrasing', `“${phrase}”`);
    if (/\bgrid\b/iu.test(value)) add(slot, 'grid', 'the dataset legend explains the no-data grid');
  };
  budget('card', 'card', text.card.text);
  budget('introduction', 'introduction', text.introduction.text);
  for (const slot of ['card', 'introduction'] as const) {
    for (const pattern of DISPLAY_WORDS) {
      const match = pattern.exec(text[slot].text);
      if (match) add(slot, 'about-the-object', `“${match[0]}” describes the display; say it in a dataset summary`);
    }
    const quotes = [...text.card.sources, ...text.introduction.sources].flatMap(source => source.quote === undefined ? [] : [source.quote]);
    for (const value of unsupportedNumbers(text[slot].text, [...context.evidence, ...quotes])) {
      add(slot, 'evidence', `${value} is not in the object's facts or cited evidence`);
    }
  }
  const lensIds = context.lenses.map(lens => lens.id), authored = Object.keys(text.datasets);
  for (const id of lensIds.filter(id => !authored.includes(id))) add(`datasets.${id}`, 'datasets', 'the dataset has no reader text');
  for (const id of authored.filter(id => !lensIds.includes(id))) add(`datasets.${id}`, 'datasets', 'no dataset has this id');
  for (const lens of context.lenses) {
    const dataset = text.datasets[lens.id];
    if (!dataset) continue;
    budget(`datasets.${lens.id}.title`, 'title', dataset.title);
    if (dataset.detail !== undefined) budget(`datasets.${lens.id}.detail`, 'detail', dataset.detail);
    budget(`datasets.${lens.id}.summary`, 'summary', dataset.summary);
    if (dataset.title.toLocaleLowerCase('en') === lens.label.toLocaleLowerCase('en')) {
      add(`datasets.${lens.id}.title`, 'specific-title', 'the title repeats the chooser label');
    }
  }
  const seen = new Map<string, string>();
  const slots: [string, string][] = [['card', text.card.text], ['introduction', text.introduction.text],
    ...Object.entries(text.datasets).map(([id, value]): [string, string] => [`datasets.${id}.summary`, value.summary])];
  for (const [slot, value] of slots) {
    for (const sentence of sentences(value)) {
      const key = normalize(sentence, context.name);
      const first = seen.get(key);
      if (first !== undefined && first !== slot) add(slot, 'repetition', `repeats a sentence from ${first}`);
      else seen.set(key, slot);
    }
  }
  if (normalize(text.introduction.text, context.name).includes(normalize(text.card.text, context.name))) {
    add('introduction', 'repetition', 'contains the card line');
  }
  return violations;
}

function normalize(value: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return value.replace(new RegExp(escaped, 'giu'), '{name}').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}{}]+/gu, ' ').trim();
}

/** Cards and introductions are the catalogue's words for each object, so no two objects share one. */
export function catalogueTextViolations(entries: readonly { readonly text: ObjectText; readonly name: string }[]): TextViolation[] {
  const violations: TextViolation[] = [];
  for (const slot of ['card', 'introduction'] as const) {
    const groups = new Map<string, string[]>();
    for (const { text, name } of entries) {
      const key = normalize(text[slot].text, name);
      groups.set(key, [...(groups.get(key) ?? []), text.objectId]);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const objectId of ids) {
        violations.push({ objectId, slot, rule: 'unique', detail: `shared with ${ids.filter(id => id !== objectId).slice(0, 3).join(', ')}${ids.length > 4 ? ` and ${ids.length - 4} more` : ''}` });
      }
    }
  }
  return violations;
}
