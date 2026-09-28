/** Edit one entry of a source manifest's documents array in place, leaving every other byte of the file as it was. */
import assert from 'node:assert/strict';
import { requireRecord, requireString } from '@cssearth/core';

/** Insert or replace one entry in the manifest's documents array without reformatting the rest of the file. */
export function spliceDocument(text: string, path: string, entry: Record<string, unknown> | undefined): string {
  const start = text.indexOf('"documents": [');
  assert.ok(start >= 0, 'manifest without documents');
  const open = text.indexOf('[', start);
  const spans: { start: number; end: number }[] = [];
  let depth = 0, inString = false, elementStart = -1, close = -1;
  for (let index = open; index < text.length; index++) {
    const char = text[index]!;
    if (inString) { if (char === '\\') index++; else if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; continue; }
    if (char === '[' || char === '{') { if (depth === 1 && char === '{') elementStart = index; depth++; }
    else if (char === ']' || char === '}') { depth--; if (depth === 1 && char === '}') spans.push({ start: elementStart, end: index + 1 }); if (depth === 0) { close = index; break; } }
  }
  assert.ok(close > open, 'unterminated documents array');
  const paths = spans.map(span => requireString(requireRecord(JSON.parse(text.slice(span.start, span.end))).path));
  const existing = paths.indexOf(path);
  const indent = /\n([ \t]*)"documents"/.exec(text)?.[1] ?? '  ', inner = `${indent}  `;
  const rendered = entry ? JSON.stringify(entry, null, 2).split('\n').join(`\n${inner}`) : '';
  if (existing >= 0) {
    const span = spans[existing]!;
    if (entry) return `${text.slice(0, span.start)}${rendered}${text.slice(span.end)}`;
    const before = text.lastIndexOf(',', span.start), after = text.indexOf(',', span.end);
    if (existing > 0) return `${text.slice(0, before)}${text.slice(span.end)}`;
    if (spans.length > 1) return `${text.slice(0, span.start)}${text.slice(after + 1).replace(/^\s*/, '')}`;
    return `${text.slice(0, open + 1)}${text.slice(close)}`;
  }
  if (!entry) return text;
  if (!spans.length) return `${text.slice(0, open + 1)}\n${inner}${rendered}\n${indent}${text.slice(close)}`;
  const next = paths.findIndex(candidate => candidate > path);
  if (next < 0) { const last = spans.at(-1)!; return `${text.slice(0, last.end)},\n${inner}${rendered}${text.slice(last.end)}`; }
  const span = spans[next]!;
  return `${text.slice(0, span.start)}${rendered},\n${inner}${text.slice(span.start)}`;
}
