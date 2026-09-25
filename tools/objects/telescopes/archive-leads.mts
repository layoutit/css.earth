/** Bounded live archive leads. These are observations to investigate, never acquisition or science qualifications. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { astroqueryToolchainSync } from '../astronomy-packages/toolchain.mts';
import { INSTRUMENT_TABLES, koaQuery, TAP_SYNC } from '../keck/koa.mts';
import { CADC_TAP, query as cadcQuery } from '../gemini/cadc.mts';
import { cadcFrame, FRAME_COLUMNS, FRAME_JOIN } from '../gemini/archive.mts';
import type { TargetCatalogueEntry } from './targets.mts';

export interface ArchiveLeadService {
  readonly service: string; readonly state: 'sampled' | 'overflow' | 'empty-in-scope' | 'unavailable';
  readonly scope: string; readonly reason: string;
  readonly instruments: readonly { readonly telescope: string; readonly instrument: string; readonly records: number; readonly sample: string }[];
  /** Bounded source identities, distinct from qualified observation choices. */
  readonly sources?: readonly (KeckSourceLead | GeminiSourceLead | ChandraSourceLead | SpitzerSourceLead)[];
  readonly evidence?: readonly string[];
}
export interface ArchiveLeadFilter {
  readonly instrument?: string;
  readonly time?: { readonly fromIso: string; readonly toIso: string };
}
export function leadTime(filter?: ArchiveLeadFilter) {
  if (!filter?.time) return null;
  const from = Date.parse(filter.time.fromIso), to = Date.parse(filter.time.toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new TypeError('Archive source time bounds must be valid and ordered.');
  return { fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString(), from, to };
}
export interface KeckSourceLead {
  readonly table: string; readonly instrument: string; readonly koaid: string;
  readonly targetName: string; readonly filehand: string; readonly dateObs: string;
  readonly evidence: string;
}
export interface GeminiSourceLead {
  readonly name: string; readonly uri: string; readonly bytes: number; readonly md5: string;
  readonly targetName: string; readonly instrument: string; readonly telescope: string;
  readonly observation: string; readonly dataRelease: string; readonly evidence: string;
}
export interface ChandraSourceLead {
  readonly obsid: number; readonly targetName: string; readonly instrument: string; readonly grating: string;
  readonly startDate: string; readonly evidence: string;
}
export interface SpitzerSourceLead {
  readonly aorKey: number; readonly targetName: string; readonly instrument: string; readonly mode: string;
  readonly startIso: string; readonly evidence: string;
}
export const KECK_SOURCE_SAMPLE_LIMIT = 3;
const key = (name: string) => name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '');
const namesOf = (target: TargetCatalogueEntry) => [...new Set([target.name, ...target.aliases].flatMap(name =>
  [name, name.replace(/\s+/gu, ''), name.replace(/\s+/gu, '-')]))].filter(Boolean);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const column = (row: Readonly<Record<string, string>>, name: string): string | undefined =>
  Object.entries(row).find(([key]) => key.toLowerCase() === name)?.[1];
export async function saveArchiveLeadEvidence(root: string, source: string, request: unknown, rows: unknown): Promise<string> {
  const directory = resolve(root, 'output/telescopes/archive-leads'), text = `${JSON.stringify({ source, request, rows }, null, 2)}\n`, digest = sha256(text);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${digest}.json`), text);
  return digest;
}
const save = saveArchiveLeadEvidence;

/** KOA publishes one TAP table per instrument. Query each sequentially to keep process and network load small. */
export async function searchKeckLeads(root: string, target: TargetCatalogueEntry, query: typeof koaQuery = koaQuery,
  filter?: ArchiveLeadFilter): Promise<ArchiveLeadService> {
  const time = leadTime(filter), tables = filter?.instrument ? INSTRUMENT_TABLES.filter(table => table.slice(4).toLowerCase() === filter.instrument!.toLowerCase()) : INSTRUMENT_TABLES;
  const date = time ? ` AND date_obs BETWEEN '${time.fromIso.slice(0, 10)}' AND '${time.toIso.slice(0, 10)}'` : '';
  const scope = `Exact target-name variants across ${tables.length} matching public KOA TAP instrument tables${time ? `; UTC observation dates ${time.fromIso.slice(0, 10)} to ${time.toIso.slice(0, 10)}` : ''}; object-frame counts and up to ${KECK_SOURCE_SAMPLE_LIMIT} exact public FITS files per instrument`;
  if (!tables.length) return { service: TAP_SYNC, state: 'empty-in-scope', scope, reason: `KOA has no public instrument table named ${filter!.instrument}.`, instruments: [] };
  try { if (query === koaQuery) astroqueryToolchainSync(); }
  catch (error) { return { service: TAP_SYNC, state: 'unavailable', scope, reason: message(error), instruments: [] }; }
  const names = namesOf(target), literals = names.map(name => `'${name.replaceAll("'", "''")}'`).join(',');
  const instruments: ArchiveLeadService['instruments'][number][] = [], sources: KeckSourceLead[] = [], failures: string[] = [], evidence: string[] = [];
  const sample = async (table: (typeof INSTRUMENT_TABLES)[number]) => {
    const instrument = table.slice(4).toUpperCase();
    const exact = `SELECT TOP ${KECK_SOURCE_SAMPLE_LIMIT} koaid,targname,koaimtyp,filehand,date_obs FROM ${table} WHERE koaimtyp='object' AND targname IN (${literals}) AND filehand IS NOT NULL${date} ORDER BY koaid`;
    const frames = await query(exact);
    const pin = await save(root, TAP_SYNC, exact, frames);
    const sampled: KeckSourceLead[] = [];
    for (const frame of frames) {
      const targetName = requireString(column(frame, 'targname'), 'KOA frame target');
      if (!names.some(candidate => key(candidate) === key(targetName))) throw new TypeError(`KOA ${table} returned an unrequested frame target.`);
      if (column(frame, 'koaimtyp') !== 'object') throw new TypeError(`KOA ${table} returned a non-object frame.`);
      const koaid = requireString(column(frame, 'koaid'), 'KOA frame id'), filehand = requireString(column(frame, 'filehand'), 'KOA filehand');
      if (!/^\/[A-Za-z0-9._/-]+\.fits$/u.test(filehand) || filehand.includes('..') || !/^[A-Za-z0-9._-]+\.fits$/u.test(koaid))
        throw new TypeError(`KOA ${table} returned an unsupported source file identity.`);
      sampled.push({ table, instrument, koaid, targetName, filehand, dateObs: column(frame, 'date_obs') ?? '', evidence: pin });
    }
    evidence.push(pin); sources.push(...sampled);
  };
  let attempted = 0;
  for (const table of tables) {
    attempted++;
    const adql = `SELECT targname, COUNT(*) AS frames FROM ${table} WHERE koaimtyp='object' AND targname IN (${literals})${date} GROUP BY targname`;
    let hasFrames = false;
    try {
      const rows = await query(adql);
      evidence.push(await save(root, TAP_SYNC, adql, rows));
      for (const row of rows) {
        const name = requireString(column(row, 'targname'), 'KOA target name'), count = Number(column(row, 'frames'));
        if (!Number.isSafeInteger(count) || count < 0) throw new TypeError(`KOA ${table} has an invalid frame count.`);
        if (!names.some(candidate => key(candidate) === key(name))) throw new TypeError(`KOA ${table} returned an unrequested target.`);
        if (!count) continue;
        hasFrames = true;
        const instrument = table.slice(4).toUpperCase();
        instruments.push({ telescope: 'Keck', instrument, records: count, sample: name });
      }
    } catch (error) {
      failures.push(`${table}: ${message(error)}`);
      continue;
    }
    if (hasFrames) try { await sample(table); }
    catch (error) { failures.push(`${table}: exact-file sampling failed: ${message(error)}`); }
  }
  return { service: TAP_SYNC, state: failures.length ? evidence.length ? 'overflow' : 'unavailable' : instruments.length ? 'sampled' : 'empty-in-scope', scope,
    reason: failures.length ? `${attempted - failures.length}/${attempted} attempted tables answered; ${failures.join('; ')}` : `${instruments.reduce((n, item) => n + item.records, 0)} matching public object frames; ${sources.length} exact FITS leads sampled. Archive names are not science qualifications.`,
    instruments, sources: sources.sort((a,b)=>a.instrument.localeCompare(b.instrument)||a.koaid.localeCompare(b.koaid)), evidence };
}

/** CADC mirrors Gemini's public raw files and supplies stable artifact URI, size and MD5. */
export async function searchGeminiLeads(root: string, target: TargetCatalogueEntry, query: typeof cadcQuery = cadcQuery,
  filter?: ArchiveLeadFilter): Promise<ArchiveLeadService> {
  const names = namesOf(target), searched = names.slice(0, 12), limit = 500;
  const time = leadTime(filter), instrument = filter?.instrument?.trim(), quoted = instrument?.replaceAll("'", "''");
  const scope = `CADC GEMINI public OBJECT science artifacts for ${searched.length} exact archive-name variants${instrument ? `, instrument ${instrument}` : ''}${time ? `, UTC ${time.fromIso} to ${time.toIso}` : ''}; first ${limit} matching rows, up to 3 FITS files per instrument`;
  if (!searched.length) return { service: CADC_TAP, state: 'empty-in-scope', scope, reason: 'No target name was available.', instruments: [] };
  const adql = `SELECT TOP ${limit} ${FRAME_COLUMNS} FROM ${FRAME_JOIN} WHERE o.collection='GEMINI' AND o.type='OBJECT' AND o.intent='science' ` +
    `AND o.target_name IN (${searched.map(name => `'${name.replaceAll("'", "''")}'`).join(',')}) ` +
    `${quoted ? `AND o.instrument_name='${quoted}' ` : ''}` +
    `${time ? `AND p.time_bounds_upper >= ${time.from / 86_400_000 + 40_587} AND p.time_bounds_lower <= ${time.to / 86_400_000 + 40_587} ` : ''}` +
    `AND p.dataRelease < '${new Date().toISOString()}' AND a.uri LIKE 'gemini:GEMINI/%.fits' ORDER BY p.time_bounds_lower DESC`;
  try {
    const rows = await query(adql), pin = await save(root, CADC_TAP, adql, rows);
    const groups = new Map<string, { telescope: string; instrument: string; records: number; sample: string }>();
    const sources: GeminiSourceLead[] = [], seen = new Set<string>();
    for (const row of rows) {
      const name = requireString(row.target_name, 'CADC target name');
      if (!searched.some(candidate => key(candidate) === key(name))) throw new TypeError('CADC returned another target name.');
      if (!/^gemini:GEMINI\/[NS]\d{8}S\d{4}\.fits$/u.test(row.uri ?? '')) continue;
      const frame = cadcFrame(row), instrument = requireString(row.instrument_name, 'CADC instrument');
      if (seen.has(frame.uri)) continue;
      seen.add(frame.uri);
      const telescope = frame.name.startsWith('N') ? 'Gemini North' : 'Gemini South', groupKey = `${telescope}/${instrument}`;
      const group = groups.get(groupKey) ?? { telescope, instrument, records: 0, sample: frame.name };
      group.records++; groups.set(groupKey, group);
      if (group.records <= 3) sources.push({ name: frame.name, uri: frame.uri, bytes: frame.bytes, md5: frame.md5,
        targetName: name, instrument, telescope, observation: frame.observation, dataRelease: frame.dataRelease, evidence: pin });
    }
    const instruments = [...groups.values()].sort((a, b) => b.records - a.records || a.instrument.localeCompare(b.instrument));
    return { service: CADC_TAP, state: rows.length >= limit || names.length > searched.length ? 'overflow' : instruments.length ? 'sampled' : 'empty-in-scope',
      scope, reason: `${seen.size} distinct public raw FITS artifact(s) in this bounded search. Archive names do not confirm target detection or calibration.`,
      instruments, sources, evidence: [pin] };
  } catch (error) { return { service: CADC_TAP, state: 'unavailable', scope, reason: message(error), instruments: [] }; }
}
