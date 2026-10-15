import { clipLine } from './style.mts';

/** Alternate-buffer frames always start at home; no cursor position survives a resize. */
export function screenFrame(lines: readonly string[], columns: number, rows: number): string {
  return '\x1b[H' + lines.slice(0, Math.max(1, rows)).map(line => `${clipLine(line, columns)}\x1b[K`).join('\r\n') + '\x1b[J';
}
