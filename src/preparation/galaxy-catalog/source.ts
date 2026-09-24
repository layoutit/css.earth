import { gunzipSync } from 'node:zlib';
import { isMap, parseDocument } from 'yaml';
import type { AuthorMetadata, CsvRow } from './types.js';

/** RFC 4180 records, including quoted commas, quotes and line breaks. */
export function parseGalaxyCsv(source: string): CsvRow[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; } else cell += c;
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (c === '\r' && source[i + 1] === '\n') i++; rows.push(row); row = []; }
    } else {
      if (closed || c === '"') throw new TypeError('Malformed CSV quote.'); cell += c;
    }
  }
  if (quoted) throw new TypeError('Unclosed CSV field.');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  const header = rows.shift();
  if (!header?.length || new Set(header).size !== header.length || header.some(v => !v)) throw new TypeError('CSV needs unique nonempty column names.');
  return rows.map((r, index) => {
    if (r.length !== header.length) throw new TypeError(`CSV row ${index + 2} has the wrong number of fields.`);
    return Object.fromEntries(header.map((key, i) => [key, r[i]!]));
  });
}

/** Walk the gzipped tar's members in order; never extract files or execute archive content. */
function* tarMembers(archive: Uint8Array): Generator<{ name: string; type: string; bytes: Buffer }> {
  const tar = gunzipSync(archive, { maxOutputLength: 64 * 1024 * 1024 });
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(v => v === 0)) return;
    const str = (start: number, end: number) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const size = Number.parseInt(str(124, 136).trim(), 8);
    const expected = Number.parseInt(str(148, 156).trim(), 8);
    const sum = header.reduce((n, byte, i) => n + (i >= 148 && i < 156 ? 32 : byte), 0);
    if (!Number.isSafeInteger(size) || size < 0 || sum !== expected || offset + 512 + size > tar.length) throw new TypeError('Invalid or truncated source tar member.');
    yield { name: [str(345, 500), str(0, 100)].filter(Boolean).join('/'), type: str(156, 157), bytes: tar.subarray(offset + 512, offset + 512 + size) };
    offset += 512 + Math.ceil(size / 512) * 512;
  }
}

/** Read one regular file member of the author archive by its exact name. */
export function readArchiveMember(archive: Uint8Array, member: string): Buffer {
  for (const { name, type, bytes } of tarMembers(archive)) {
    if (name !== member) continue;
    if (!['', '0'].includes(type)) throw new TypeError(`Archive member ${member} is not a regular file (tar type ${JSON.stringify(type)}).`);
    return bytes;
  }
  throw new TypeError(`Source archive has no member ${member}.`);
}

/** Read regular source members only; never extract files or execute archive content. */
export function readAuthorMetadata(archive: Uint8Array, prefix: string, eligibleTables: readonly string[]): Map<string, AuthorMetadata> {
  const result = new Map<string, AuthorMetadata>();
  for (const { name, type, bytes } of tarMembers(archive)) {
    if (name.startsWith(prefix) && name.endsWith('.yaml')) {
      if (!['', '0'].includes(type) || name.split('/').some(p => p === '..') || name.startsWith('/')) throw new TypeError('Source YAML must be a regular contained archive member.');
      // The author archive contains duplicate fields in unused structural fits.
      // Validate every consumed mapping, without rewriting that original source.
      const doc = parseDocument(bytes.toString('utf8'), { uniqueKeys: false });
      if (doc.errors.length) throw doc.errors[0];
      if (!isMap(doc.contents)) throw new TypeError('Source YAML must be a mapping.');
      if (!eligibleTables.includes(String(doc.get('table')))) continue;
      const consumed = [
        [doc.contents, ['key', 'table', 'location', 'name_discovery', 'distance']],
        [doc.get('location', true), ['ra', 'dec', 'ref_location']],
        [doc.get('name_discovery', true), ['other_name', 'host', 'false_positive', 'confirmed_star_cluster']],
        [doc.get('distance', true), ['distance_fixed_host', 'ref_distance', 'distance_measurement_method']],
      ] as const;
      for (const [mapping, used] of consumed) {
        if (!isMap(mapping)) continue;
        const keys = mapping.items.map(pair => String(pair.key)).filter(key => (used as readonly string[]).includes(key));
        if (new Set(keys).size !== keys.length) throw new TypeError(`Duplicate consumed source YAML field: ${name}`);
      }
      const value: unknown = doc.toJS({ maxAliasCount: 0 });
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Source YAML must be an object.');
      const item = value as AuthorMetadata;
      if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(item.key) || result.has(item.key) || !name.toLowerCase().endsWith(`/${item.key.toLowerCase()}.yaml`)) throw new TypeError('Source YAML identifier disagrees with its filename or repeats.');
      result.set(item.key, item);
    }
  }
  if (!result.size) throw new TypeError('Source archive contains no authored galaxy inputs.');
  return result;
}

export function parseMembershipTable(source: string): Map<string, string> {
  const rows = new Map<string, string>();
  // Names may contain A or I themselves: require the following morphology column.
  const pattern = /^(.*?) ([GALN](?:\/[GALN])?) (?:dSph|dIrr|S\(|Sb\b|Sc\b|Irr|cE\b|dE|\?\?\?\?|\(d\))/;
  for (const line of source.split(/\r?\n/)) {
    const match = pattern.exec(line); if (!match) continue;
    const name = match[1]!.trim();
    if (rows.has(name)) throw new TypeError(`Repeated membership-table name: ${name}`);
    rows.set(name, match[2]!);
  }
  if (!rows.size) throw new TypeError('Membership table contains no classifications.');
  return rows;
}
