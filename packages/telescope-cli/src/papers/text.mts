/** The words of a paper: its title and abstract compared with the names a search asked for, and the sentences of an HTML full
 * text that say something about the target. Nothing here interprets a sentence; it is reported as the paper prints it. */

export const SENTENCE_LIMIT = 300;
/** Sentences reported for one paper. */
export const SENTENCES_NAMED = 5;

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', minus: '−', deg: '°', times: '×', micro: 'µ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}
// Inline tags join their text; block tags separate it.
const INLINE_TAG = /<\/?(?:a|abbr|b|bold|em|i|italic|span|strong|sub|sup|small|u|mi|mn|mo|mrow|msub|msup|math)\b[^>]*>/giu;
// LaTeXML sets invisible operators between the letters of a formula (U+2061 to U+2064) and zero-width spaces.
export const plainText = (html: string): string => decodeEntities(html.replace(INLINE_TAG, '').replace(/<[^>]*>/gu, ' ')).replace(/[\u200B\u2061-\u2064]/gu, '').replace(/\s+/gu, ' ').replace(/\s+([.,;:)])/gu, '$1').replace(/\(\s+/gu, '(').trim();

const words = (value: string): string => ` ${value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const names = (text: string, phrases: readonly string[]): boolean => phrases.some(phrase => text.includes(words(phrase)));
/** OpenAlex search stems and matches loosely; keep only works whose title or abstract really names every phrase. */
export function mentions(work: { readonly title: string; readonly abstract: string }, phrases: readonly string[]): boolean {
  const text = words(`${work.title} ${work.abstract}`);
  return phrases.every(phrase => text.includes(words(phrase)));
}
/** Whether the title or abstract names any one of the phrases, as whole words. */
export const mentionsAny = (work: { readonly title: string; readonly abstract: string }, phrases: readonly string[]): boolean => names(words(`${work.title} ${work.abstract}`), phrases);

/** A full stop after one of these does not end a sentence: an abbreviation, or an initial ("J."), which a unit after a number
 * ("3550 K.") is not. */
const ABBREVIATION = /(?:\b(?:al|e\.g|i\.e|Figs?|Eqs?|Sect?|Tab|Refs?|cf|vs|ca|No)|(?<!\d\s?)\b[A-Z])\.$/u;
function sentencesOf(paragraph: string): string[] {
  const sentences: string[] = [];
  for (const piece of paragraph.split(/(?<=[.!?])\s+(?=[\p{Lu}\d(“"])/u)) {
    const previous = sentences.at(-1);
    if (previous !== undefined && ABBREVIATION.test(previous)) sentences[sentences.length - 1] = `${previous} ${piece}`;
    else sentences.push(piece);
  }
  return sentences;
}

/** What is not the article's text: scripts, styles, drawings, and the TeX source LaTeXML keeps beside each rendered formula. */
export const UNREAD = /<(script|style|svg|noscript|template|annotation|annotation-xml)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;

/** The paragraphs of an HTML article as plain text. */
export function paragraphs(html: string): string[] {
  const source = html.replace(/<!--[\s\S]*?-->/gu, '').replace(UNREAD, '');
  return [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/giu)].map(match => plainText(match[1]!)).filter(Boolean);
}

/**
 * What a full text says about the target: the sentences that name one of the phrases, as printed, those that also name the
 * target first. A sentence that names a phrase alone is reported only when `whole` says the paper is about the target (its
 * title names it); in a paper about many objects it would be about another one. With no phrase, the sentences that name the
 * target.
 */
export function evidenceSentences(html: string, targetNames: readonly string[], phrases: readonly string[], whole: boolean, limit = SENTENCES_NAMED): string[] {
  const both: string[] = [], alone: string[] = [], seen = new Set<string>();
  for (const paragraph of paragraphs(html)) for (const sentence of sentencesOf(paragraph)) {
    const text = words(sentence);
    if (!names(text, phrases.length ? phrases : targetNames) || seen.has(text)) continue;
    seen.add(text);
    (names(text, targetNames) ? both : alone).push(sentence.length <= SENTENCE_LIMIT ? sentence : `${sentence.slice(0, SENTENCE_LIMIT - 1).trimEnd()}…`);
  }
  return [...both, ...whole ? alone : []].slice(0, limit);
}
