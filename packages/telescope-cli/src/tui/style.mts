import { stripVTControlCharacters } from 'node:util';
import { VERSION } from '../version.mts';

export const dim = (text: string): string => `\x1b[2m${text}\x1b[22m`;
export const bold = (text: string): string => `\x1b[1m${text}\x1b[22m`;
export const green = (text: string): string => `\x1b[32m${text}\x1b[39m`;
export const yellow = (text: string): string => `\x1b[33m${text}\x1b[39m`;
export const red = (text: string): string => `\x1b[31m${text}\x1b[39m`;
export const inverse = (text: string): string => `\x1b[7m${text}\x1b[27m`;
export const plain = stripVTControlCharacters;
export const visibleWidth = (text: string): number => Array.from(plain(text)).length;
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
