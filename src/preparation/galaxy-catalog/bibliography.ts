import { spatialPublicationId } from '@cssearth/catalog';
import type { SpatialCitation } from '@cssearth/catalog';

/** Read the retained ADS BibTeX fields; balanced braces preserve nested titles.
 * Unsupported concatenation/macros fail instead of silently inventing a citation. */
export function readBibliography(input: string): ReadonlyMap<string, SpatialCitation> {
  const entries = new Map<string, SpatialCitation>();
  const starts = [...input.matchAll(/^@\w+\s*\{([^,\s]+),/gmu)];
  for (const [index, match] of starts.entries()) {
    const id = match[1]!, body = input.slice(match.index! + match[0].length, starts[index + 1]?.index ?? input.length);
    const field = (name: string) => {
      const start = new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*`, 'iu').exec(body);
      if (!start) return undefined;
      let offset = start.index + start[0].length, depth = 0, quoted = false, value = '';
      if (body[offset] !== '{' && body[offset] !== '"') throw new TypeError(`Unsupported bibliography field: ${id}/${name}`);
      for (; offset < body.length; offset++) {
        const char = body[offset]!;
        if (char === '\\' && offset + 1 < body.length) { value += char + body[++offset]!; continue; }
        if (char === '"' && depth === 0) quoted = !quoted;
        if (char === '{') depth++;
        if (char === '}') { if (depth === 0) break; depth--; }
        if (char === ',' && depth === 0 && !quoted) break;
        if (char === '#' && depth === 0 && !quoted) throw new TypeError(`Unsupported bibliography concatenation: ${id}/${name}`);
        value += char;
      }
      if (depth || quoted) throw new TypeError(`Unclosed bibliography field: ${id}/${name}`);
      return value.trim().replace(/^"|"$/gu, '').replace(/^\{|\}$/gu, '').trim();
    };
    const url = field('adsurl') ?? field('url') ?? (field('doi') ? `https://doi.org/${field('doi')}` : undefined);
    const title = field('title');
    // Entries never referenced by this catalogue need not have an online locator.
    if (!url || !title) continue;
    if (!/^https?:\/\/[^\s{}"]+$/u.test(url)) throw new TypeError(`Invalid bibliography URL: ${id}`);
    const citation = { id, catalogueId: spatialPublicationId(id), url, citation: `${id}: ${title.replace(/[{}]/gu, '').replace(/\s+/gu, ' ')}` };
    const previous = entries.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(citation)) throw new TypeError(`Conflicting bibliography key: ${id}`);
    entries.set(id, citation);
  }
  return entries;
}
