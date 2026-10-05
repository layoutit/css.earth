/** Resolve an invoked bound listener through production maps and S0's stable AST identity. */
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js';
import { bindingSites, type ListenerWrapper } from './binding-sites.mts';
import type { ManifestEntry } from './reachability.mts';
function sourceMap(input: unknown): RawSourceMap {
  if (!input || typeof input !== 'object' || !('version' in input) || !('sources' in input) || !Array.isArray(input.sources)
    || !input.sources.every(value => typeof value === 'string') || !('names' in input) || !Array.isArray(input.names)
    || !input.names.every(value => typeof value === 'string') || !('mappings' in input) || typeof input.mappings !== 'string') throw new Error('Invalid source map');
  return { version: String(input.version), sources: input.sources, names: input.names, mappings: input.mappings };
}
export function listenerResolver(dist: string, entries: ManifestEntry[], checkout: string, wrappers: ListenerWrapper[]) {
  const maps = new Map<string, SourceMapConsumer | null>();
  const sources = new Map<string, ReturnType<typeof bindingSites>>();
  const known = new Map(entries.filter(entry => entry.kind === 'handler').map(entry => [entry.id, entry]));
  async function matching(source: string, line: number, column: number, type: string) {
    const file = source.replaceAll('\\', '/').replace(/^.*?(?=(?:site|packages|src)\/)/u, '').replace(/\?.*$/u, '');
    if (![...known.values()].some(entry => entry.source.startsWith(file + ':'))) return [];
    let index = sources.get(file);
    if (!index) { index = bindingSites(file, await readFile(resolve(checkout, file), 'utf8'), wrappers); sources.set(file, index); }
    const position = index.offset(line, column);
    const sites = index.sites.filter(site => position >= site.start && position < site.end && known.get(site.id)?.eventTypes?.includes(type));
    // A nested registration owns its own callsite, even when an outer callback shares its event type.
    sites.sort((a, b) => (a.end - a.start) - (b.end - b.start));
    return sites[0] ? [sites[0].id] : [];
  }
  return async (records: unknown[]) => {
    const observed = new Set<string>(), unresolved: { type: string; stack: string }[] = [];
    for (const row of records) {
      if (!row || typeof row !== 'object' || !('type' in row) || typeof row.type !== 'string' || !('stack' in row) || typeof row.stack !== 'string') throw new Error('Invalid listener evidence');
      let resolved = false;
      for (const match of row.stack.matchAll(/(http:\/\/(?:localhost|127\.0\.0\.1):\d+\/[^\s)]+\.js):(\d+):(\d+)/gu)) {
        const path = new URL(match[1]!).pathname, file = resolve(dist, '.' + path), rel = relative(resolve(dist), file);
        if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Map outside supplied distribution');
        if (!maps.has(path)) {
          const bytes = await readFile(file + '.map', 'utf8').catch(() => null);
          maps.set(path, bytes ? new SourceMapConsumer(sourceMap(JSON.parse(bytes))) : null);
        }
        const map = maps.get(path); if (!map) continue;
        const position = map.originalPositionFor({ line: Number(match[2]), column: Number(match[3]) - 1 });
        if (!position.source || !position.line || position.column === null) continue;
        const ids = await matching(position.source, position.line, position.column, row.type);
        if (ids.length) { ids.forEach(id => observed.add(id)); resolved = true; break; }
      }
      if (!resolved && row.stack.includes('/_astro/')) unresolved.push({ type: row.type, stack: row.stack });
    }
    return { observed: [...observed].sort(), unresolved };
  };
}
