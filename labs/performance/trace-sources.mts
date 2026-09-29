// Trace helpers the performance tools share: the occupied time of nested slices, and the build source behind a traced
// call site (its external source map, read only inside the supplied build).
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { SourceMapConsumer } from 'source-map-js';
import type { RawSourceMap } from 'source-map-js';
import type { OriginalLocation } from './trace-model.mts';
import { errorCode, errorMessage, recordOf } from './trace-model.mts';
import type { LocationSources } from './trace-evidence.mts';
import { allLocations } from './trace-evidence.mts';

const ms = (value: number) => Math.round(value * 1000) / 1000;

// Nested trace slices are overlapping descriptions of the same work. Report
// their union, never the sum of RunTask + FunctionCall + its child operations.
export function occupiedMs(events: readonly { readonly ts: number; readonly dur: number }[], start: number, end: number) {
  const ranges = events.map((e): [number, number] => [Math.max(start, e.ts), Math.min(end, e.ts + e.dur)])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let until = start, total = 0;
  for (const [a, b] of ranges) { total += Math.max(0, b - Math.max(a, until)); until = Math.max(until, b); }
  return ms(total / 1000);
}

export interface SourceMapStatus { file?: string; status: string; reason?: unknown }
export interface BuildCall { functionName: unknown; line: unknown; column: unknown; original: unknown; excerpt: string | undefined }
export interface BuildSource {
  url: unknown; file: string; bytes?: number;
  sourceMap?: SourceMapStatus; calls?: BuildCall[]; unavailable?: unknown;
}

function isRawSourceMap(value: unknown): value is RawSourceMap {
  const map = recordOf(value);
  const strings = (list: unknown) => Array.isArray(list) && list.every(item => typeof item === 'string');
  // SourceMapConsumer checks the version and decodes the mappings itself. Its
  // declaration types `version` as a string, although source maps store 3.
  return !!map && strings(map.sources) && strings(map.names) && typeof map.mappings === 'string';
}
/** Source maps in a supplied build are external JSON. */
export function readSourceMap(text: string): SourceMapConsumer {
  const value: unknown = JSON.parse(text);
  if (!isRawSourceMap(value)) throw new TypeError('Source map needs string sources, names and mappings.');
  return new SourceMapConsumer(value);
}

export async function inspectBuild(brief: LocationSources & { readonly sourceUrls: readonly unknown[] }, build?: string | null): Promise<BuildSource[]> {
  if (!build) return [];
  const root = await realpath(resolve(build)), output: BuildSource[] = [];
  const withinRoot = (file: string) => { const rel = relative(root, file); return !rel.startsWith('..') && !isAbsolute(rel); };
  const callSites = allLocations(brief);
  for (const url of brief.sourceUrls) {
    let pathname: string;
    // The URL constructor converts its argument exactly as String() does.
    try { pathname = decodeURIComponent(new URL(String(url)).pathname); } catch { continue; }
    const file = resolve(root, '.' + pathname), rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel) || !/\.m?js$/.test(file)) continue;
    try {
      if (!withinRoot(await realpath(file))) throw Error('Source symlink leaves supplied build');
      const bytes = await readFile(file), text = bytes.toString(), lines = text.split('\n');
      let consumer: SourceMapConsumer | undefined, sourceMap: SourceMapStatus;
      try {
        if (!withinRoot(await realpath(file + '.map'))) throw Error('Source map symlink leaves supplied build');
        const mapBytes = await readFile(file + '.map');
        consumer = readSourceMap(mapBytes.toString());
        sourceMap = { file: file + '.map', status: 'provided-build-map; traced bytes not independently verified' };
      } catch (error) { sourceMap = { status: 'unavailable', reason: errorCode(error) ?? errorMessage(error) }; }
      for (const c of callSites.filter(c => c.url === url)) {
        const line = c.lineNumber, column = c.columnNumber;
        if (!consumer || typeof line !== 'number' || typeof column !== 'number' || !(line > 0) || !(column > 0)) continue;
        const original = consumer.originalPositionFor({ line, column: column - 1 });
        if (!original.source) continue;
        const content = consumer.sourceContentFor(original.source, true);
        const located: OriginalLocation = { ...original, column: original.column + 1,
          excerpt: content?.split('\n').slice(Math.max(0, original.line - 3), original.line + 2).join('\n') ?? null };
        c.original = located;
      }
      output.push({ url, file, bytes: bytes.length, sourceMap,
        calls: [...new Map(callSites.filter(c => c.url === url).map(c => [JSON.stringify([c.lineNumber, c.columnNumber]), c])).values()].map(c => ({
          functionName: c.functionName, line: c.lineNumber, column: c.columnNumber,
          original: c.original ?? null,
          // Arithmetic converts recorded positions exactly as Number() does.
          excerpt: lines[Math.max(0, Number(c.lineNumber ?? 1) - 1)]?.slice(Math.max(0, Number(c.columnNumber ?? 1) - 61), Number(c.columnNumber ?? 1) + 300),
        })) });
    } catch (error) { output.push({ url, file, unavailable: errorCode(error) ?? errorMessage(error) }); }
  }
  return output;
}

const VALUE_OPTIONS = ['--out', '--url', '--build', '--framesleuth', '--compare', '--capture', '--label'];
