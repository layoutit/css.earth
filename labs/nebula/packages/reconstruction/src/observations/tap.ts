import { isRecord as record } from '@cssearth/core';

export interface TapTable { rows: Record<string, unknown>[]; overflow: boolean }
/** The three services expose different JSON serializations of their VOTable. */
export function readTapTable(value: unknown): TapTable {
  if (!record(value)) throw new TypeError('Archive returned no table.');
  let columns: unknown, data: unknown, overflow = false;
  if (Array.isArray(value.metadata) || Array.isArray(value.info)) {
    columns = value.metadata ?? value.info; data = value.data;
    if (value.error || value.status === 'ERROR') throw new TypeError('Archive query failed.');
  } else {
    const votable = value.VOTABLE;
    if (!record(votable) || !Array.isArray(votable.RESOURCE_ARRAY)) throw new TypeError('Missing archive result resource.');
    const resource = votable.RESOURCE_ARRAY.find(r => record(r) && record(r['<xmlattr>']) && r['<xmlattr>'].type === 'results');
    if (!record(resource) || !record(resource.TABLE)) throw new TypeError('Missing archive result table.');
    for (const info of Array.isArray(resource.INFO_ARRAY) ? resource.INFO_ARRAY : []) {
      if (!record(info) || !record(info['<xmlattr>']) || info['<xmlattr>'].name !== 'QUERY_STATUS') continue;
      if (info['<xmlattr>'].value === 'ERROR') throw new TypeError('Archive reports a failed query.');
      if (info['<xmlattr>'].value === 'OVERFLOW') overflow = true;
    }
    const table = resource.TABLE;
    columns = Array.isArray(table.FIELD_ARRAY) ? table.FIELD_ARRAY.map(f => record(f) ? f['<xmlattr>'] : null) : null;
    data = record(table.DATA) ? table.DATA.TABLEDATA ?? [] : [];
  }
  if (!Array.isArray(columns) || !columns.length || !columns.every(c => record(c) && typeof c.name === 'string') || !Array.isArray(data)) {
    throw new TypeError('Malformed archive table.');
  }
  const names = columns.map(c => String(c.name).toLowerCase());
  if (new Set(names).size !== names.length) throw new TypeError('Duplicate archive columns.');
  return { overflow, rows: data.map(row => {
    if (!Array.isArray(row) || row.length !== names.length) throw new TypeError('Malformed archive row.');
    return Object.fromEntries(names.map((name, index) => [name, row[index]]));
  }) };
}

export function tapUrl(endpoint: string, query: string, maxRecords: number): URL {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', MAXREC: String(maxRecords), QUERY: query }).toString();
  return url;
}
export interface TapRequestConfig { timeoutMs: number; userAgent: string; fetch?: typeof fetch }
export async function fetchTap(endpoint: string, query: string, maxRecords: number, config: TapRequestConfig, signal?: AbortSignal) {
  const url = tapUrl(endpoint, query, maxRecords);
  const response = await (config.fetch ?? fetch)(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]) : AbortSignal.timeout(config.timeoutMs),
    headers: { Accept: 'application/json', 'User-Agent': config.userAgent } });
  if (!response.ok) throw new Error(`Archive HTTP ${response.status}: ${(await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0,300)}`);
  const bytes = await response.text();
  let value: unknown; try { value = JSON.parse(bytes); } catch { throw new TypeError('Archive did not return JSON metadata.'); }
  return { ...readTapTable(value), bytes, url: url.href };
}
