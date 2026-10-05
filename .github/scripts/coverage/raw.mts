/** Versioned disk boundary between independent coverage collectors and the shared converter. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

export interface V8Range { startOffset: number; endOffset: number; count: number }
export interface V8Function { functionName: string; isBlockCoverage: boolean; ranges: V8Range[] }
export interface RawScript { url: string; source: string; sourcePath?: string; map?: string; mapBase?: string; functions: V8Function[]; context?: string }
export interface RawRun { version: 1; kind: string; root: string; costMs: number; scripts: RawScript[]; issues: string[] }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Expected string'); return value; }
export function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Expected array'); return value; }
export function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Expected nonnegative finite number'); return value; }
function integer(value: unknown): number { const n = number(value); if (!Number.isSafeInteger(n)) throw new Error('Expected integer'); return n; }
export function repoPath(value: unknown): string {
  const p = text(value); if (!p || isAbsolute(p) || p.includes('\\') || p.split('/').some(s => !s || s === '.' || s === '..')) throw new Error(`Invalid repository path: ${p}`); return p;
}
export function localFile(dir: string, path: string): string {
  repoPath(path); const file = resolve(dir, path);
  if (relative(dir, file).startsWith('..')) throw new Error('File escapes raw directory'); return file;
}
export function parseFunctions(value: unknown): V8Function[] {
  return list(value).map(v => {
    const f = object(v); if (typeof f.isBlockCoverage !== 'boolean') throw new Error('Expected block coverage boolean');
    const ranges = list(f.ranges).map(r => {
      const o = object(r), startOffset = integer(o.startOffset), endOffset = integer(o.endOffset), count = integer(o.count);
      if (endOffset <= startOffset) throw new Error('Empty or reversed V8 range'); return { startOffset, endOffset, count };
    });
    if (!ranges.length) throw new Error('Function has no ranges');
    const outer = ranges[0]!;
    if (ranges.some(r => r.startOffset < outer.startOffset || r.endOffset > outer.endOffset)) throw new Error('Range escapes function');
    return { functionName: text(f.functionName), isBlockCoverage: f.isBlockCoverage, ranges };
  });
}
export function parseRaw(value: unknown): RawRun {
  const o = object(value); if (o.version !== 1) throw new Error('Unsupported raw coverage version');
  const root = text(o.root); if (!isAbsolute(root)) throw new Error('Raw root must be absolute');
  return { version: 1, kind: text(o.kind), root, costMs: number(o.costMs), issues: list(o.issues).map(text), scripts: list(o.scripts).map(v => {
    const s = object(v);
    return { url: text(s.url), source: repoPath(s.source), functions: parseFunctions(s.functions),
      ...(s.sourcePath === undefined ? {} : { sourcePath: repoPath(s.sourcePath) }),
      ...(s.map === undefined ? {} : { map: repoPath(s.map) }),
      ...(s.mapBase === undefined ? {} : { mapBase: text(s.mapBase) }),
      ...(s.context === undefined ? {} : { context: text(s.context) }) };
  }) };
}
export function readRaw(dir: string): RawRun { return parseRaw(JSON.parse(readFileSync(resolve(dir, 'raw.json'), 'utf8'))); }
export function writeRaw(dir: string, run: RawRun): void {
  const validated = parseRaw(run); mkdirSync(dir, { recursive: true }); writeFileSync(resolve(dir, 'raw.json'), JSON.stringify(validated, null, 2) + '\n');
}
