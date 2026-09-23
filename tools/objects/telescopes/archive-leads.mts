/** Bounded live archive leads. These are observations to investigate, never acquisition or science qualifications. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { astroqueryToolchainSync } from '../astronomy-packages/toolchain.mts';
import { INSTRUMENT_TABLES, koaQuery, TAP_SYNC } from '../keck/koa.mts';
import type { TargetCatalogueEntry } from './targets.mts';

export interface ArchiveLeadService {
  readonly service: string; readonly state: 'sampled' | 'overflow' | 'empty-in-scope' | 'unavailable';
  readonly scope: string; readonly reason: string;
  readonly instruments: readonly { readonly telescope: string; readonly instrument: string; readonly records: number; readonly sample: string }[];
  readonly evidence?: readonly string[];
}
const key = (name: string) => name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '');
const namesOf = (target: TargetCatalogueEntry) => [...new Set([target.name, ...target.aliases].flatMap(name =>
  [name, name.replace(/\s+/gu, ''), name.replace(/\s+/gu, '-')]))].filter(Boolean);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const column = (row: Readonly<Record<string, string>>, name: string): string | undefined =>
  Object.entries(row).find(([key]) => key.toLowerCase() === name)?.[1];
async function save(root: string, source: string, request: unknown, rows: unknown): Promise<string> {
  const directory = resolve(root, 'output/telescopes/archive-leads'), text = `${JSON.stringify({ source, request, rows }, null, 2)}\n`, digest = sha256(text);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${digest}.json`), text);
  return digest;
}

/** KOA publishes one TAP table per instrument. Query each sequentially to keep process and network load small. */
export async function searchKeckLeads(root: string, target: TargetCatalogueEntry, query: typeof koaQuery = koaQuery): Promise<ArchiveLeadService> {
  const scope = `Exact target-name variants across ${INSTRUMENT_TABLES.length} public KOA TAP instrument tables; object-frame counts only`;
  try { if (query === koaQuery) astroqueryToolchainSync(); }
  catch (error) { return { service: TAP_SYNC, state: 'unavailable', scope, reason: message(error), instruments: [] }; }
  const names = namesOf(target), literals = names.map(name => `'${name.replaceAll("'", "''")}'`).join(',');
  const instruments: ArchiveLeadService['instruments'][number][] = [], failures: string[] = [], evidence: string[] = [];
  let attempted = 0;
  for (const table of INSTRUMENT_TABLES) {
    attempted++;
    const adql = `SELECT targname, COUNT(*) AS frames FROM ${table} WHERE koaimtyp='object' AND targname IN (${literals}) GROUP BY targname`;
    try {
      const rows = await query(adql);
      evidence.push(await save(root, TAP_SYNC, adql, rows));
      for (const row of rows) {
        const name = requireString(column(row, 'targname'), 'KOA target name'), count = Number(column(row, 'frames'));
        if (!Number.isSafeInteger(count) || count < 0) throw new TypeError(`KOA ${table} has an invalid frame count.`);
        if (!names.some(candidate => key(candidate) === key(name))) throw new TypeError(`KOA ${table} returned an unrequested target.`);
        if (count) instruments.push({ telescope: 'Keck', instrument: table.slice(4).toUpperCase(), records: count, sample: name });
      }
    } catch (error) {
      failures.push(`${table}: ${message(error)}`);
    }
  }
  return { service: TAP_SYNC, state: failures.length ? evidence.length ? 'overflow' : 'unavailable' : instruments.length ? 'sampled' : 'empty-in-scope', scope,
    reason: failures.length ? `${evidence.length}/${attempted} attempted tables answered; ${INSTRUMENT_TABLES.length - attempted} not searched; ${failures.join('; ')}` : `${instruments.reduce((n, item) => n + item.records, 0)} matching public object frames; archive names are not science qualifications.`,
    instruments, evidence };
}

const GEMINI = 'https://archive.gemini.edu/jsonsummary/';
const MAX_GEMINI_BYTES = 1_000_000;
async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > MAX_GEMINI_BYTES) { await reader.cancel(); throw new RangeError('Gemini metadata exceeded the 1 MB search bound.'); }
    chunks.push(item.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
/** Gemini's documented JSON summary uses free-form observer names; exact matches are reported as leads only. */
export async function searchGeminiLeads(root: string, target: TargetCatalogueEntry, fetcher: typeof fetch = fetch): Promise<ArchiveLeadService> {
  const scope = 'Gemini public canonical JSON summary; at most three exact object-name variants and 1 MB per response';
  const allNames = namesOf(target), names = allNames.slice(0, 3), truncated = allNames.length > names.length;
  const groups = new Map<string, { telescope: string; instrument: string; records: number; sample: string }>();
  const evidence: string[] = [], failures: string[] = [], seen = new Set<string>();
  for (const name of names) {
    const url = `${GEMINI}canonical/object=${encodeURIComponent(name)}`;
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } });
      if (!response.ok || !/json/iu.test(response.headers.get('content-type') ?? '')) throw new Error(`Gemini returned HTTP ${response.status} ${response.headers.get('content-type') ?? 'without JSON'}.`);
      const rows = requireArray(JSON.parse(await boundedText(response)) as unknown, 'Gemini summary');
      evidence.push(await save(root, GEMINI, url, rows));
      for (const value of rows) {
        const row = requireRecord(value, 'Gemini row'), archiveName = requireString(row.object, 'Gemini object');
        if (!names.some(candidate => key(candidate) === key(archiveName)) || row.observation_class !== 'science') continue;
        const telescope = requireString(row.telescope, 'Gemini telescope'), instrument = requireString(row.instrument, 'Gemini instrument');
        const id = requireString(row.data_label, 'Gemini data label');
        if (seen.has(id)) continue;
        seen.add(id);
        const groupKey = `${telescope}/${instrument}`, group = groups.get(groupKey) ?? { telescope, instrument, records: 0, sample: id };
        group.records++; groups.set(groupKey, group);
      }
    } catch (error) {
      failures.push(`${name}: ${message(error)}`);
      if (/HTTP (?:401|403)/u.test(message(error))) break;
    }
  }
  const instruments = [...groups.values()].sort((a, b) => b.records - a.records || a.instrument.localeCompare(b.instrument));
  return { service: GEMINI, state: failures.length ? evidence.length ? 'overflow' : 'unavailable' : truncated ? 'overflow' : instruments.length ? 'sampled' : 'empty-in-scope', scope,
    reason: failures.length ? `${evidence.length}/${names.length} name queries answered; ${failures.join('; ')}` : `${seen.size} matching science-file metadata rows; ${truncated ? `${allNames.length - names.length} name variants were not searched; ` : ''}archive object names are not target confirmations or access rights.`,
    instruments, evidence };
}
