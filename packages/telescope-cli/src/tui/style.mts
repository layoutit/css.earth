import { stripVTControlCharacters } from 'node:util';
import { VERSION } from '../version.mts';

export const dim = (text: string): string => `\x1b[2m${text}\x1b[22m`;
export const bold = (text: string): string => `\x1b[1m${text}\x1b[22m`;
export const green = (text: string): string => `\x1b[32m${text}\x1b[39m`;
export const yellow = (text: string): string => `\x1b[33m${text}\x1b[39m`;
export const red = (text: string): string => `\x1b[31m${text}\x1b[39m`;
export const inverse = (text: string): string => `\x1b[7m${text}\x1b[27m`;
export const plain = stripVTControlCharacters;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function cellWidth(text: string): number {
  const point = text.codePointAt(0) ?? 0;
  if (/^[\p{Mark}\p{Control}\p{Format}]+$/u.test(text)) return 0;
  if (/\p{Emoji_Presentation}|\uFE0F/u.test(text) || point >= 0x1100 && (
    point <= 0x115f || point === 0x2329 || point === 0x232a ||
    point >= 0x2e80 && point <= 0xa4cf && point !== 0x303f ||
    point >= 0xac00 && point <= 0xd7a3 || point >= 0xf900 && point <= 0xfaff ||
    point >= 0xfe10 && point <= 0xfe19 || point >= 0xfe30 && point <= 0xfe6f ||
    point >= 0xff00 && point <= 0xff60 || point >= 0xffe0 && point <= 0xffe6 ||
    point >= 0x1b000 && point <= 0x1b2ff || point >= 0x20000 && point <= 0x3fffd)) return 2;
  return 1;
}
export const visibleWidth = (text: string): number =>
  Array.from(graphemes.segment(plain(text)), part => cellWidth(part.segment)).reduce((sum, width) => sum + width, 0);

/** Retain SGR styling, but never let one logical line occupy two terminal rows. */
export function clipLine(text: string, columns: number): string {
  const width = Math.max(0, Math.floor(columns));
  if (!width) return '';
  const tokens = text.replace(/[\r\n\t]/gu, ' ').split(/(\x1b\[[0-9;]*m)/u)
    .map(token => /^\x1b\[[0-9;]*m$/u.test(token) ? token : plain(token).replace(/[\p{Control}]/gu, ''));
  if (visibleWidth(tokens.join('')) <= width) return tokens.join('');
  let result = '', used = 0;
  for (const token of tokens) {
    if (token.startsWith('\x1b[')) { result += token; continue; }
    for (const { segment } of graphemes.segment(token)) {
      const cells = cellWidth(segment);
      if (used + cells > width - 1) return result + '…\x1b[0m';
      result += segment; used += cells;
    }
  }
  return result + '…\x1b[0m';
}
export const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - visibleWidth(text)));
export function cut(text: string, width: number): string {
  const characters = Array.from(plain(text));
  return characters.length > width ? characters.slice(0, Math.max(0, width - 1)).join('') + '…' : pad(text, width);
}
export function wrap(text: string, width: number, maximum = 99): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (visibleWidth(next) > width && line) { lines.push(line); line = word; }
    else line = next;
    if (lines.length >= maximum) break;
  }
  if (line && lines.length < maximum) lines.push(line);
  if (lines.length === maximum) lines[maximum - 1] = cut(lines[maximum - 1]!, width);
  return lines;
}
export function breadcrumb(parts: readonly string[]): string {
  return parts.map((part, index) => index === parts.length - 1 ? bold(part) : dim(part)).join(dim(' › ')) + dim(`   v${VERSION}`);
}
