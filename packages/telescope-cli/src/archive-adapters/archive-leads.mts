/** Bounded live archive leads. These are observations to investigate, never acquisition or science qualifications. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { astroqueryToolchainSync, plainName } from '@cssearth/telescope/node';
import { INSTRUMENT_TABLES, koaQuery, TAP_SYNC } from '../archives/keck/koa.mts';
import { CADC_TAP, query as cadcQuery } from '../archives/gemini/cadc.mts';
import { recall } from '../archives/memory.mts';
import { cadcFrame, FRAME_COLUMNS, FRAME_JOIN } from '../archives/gemini/archive.mts';
import type { TargetCatalogueEntry } from '@cssearth/telescope';

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
  readonly name: string; readonly uri: string; readonly bytes: number;
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
/** Where a target that does not move is on the sky, and how far from there a frame still counts as pointed at it. */
export interface LeadPosition { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number }
const arcsec = (position: LeadPosition) => Math.round(position.radiusDeg * 3600);
export const KECK_SOURCE_SAMPLE_LIMIT = 3;
const key = (name: string) => name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '');
const namesOf = (target: TargetCatalogueEntry) => [...new Set([target.name, ...target.aliases].flatMap(name =>
  [name, name.replace(/\s+/gu, ''), name.replace(/\s+/gu, '-')]))].filter(Boolean);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const column = (row: Readonly<Record<string, string>>, name: string): string | undefined =>
  Object.entries(row).find(([key]) => key.toLowerCase() === name)?.[1];
/** Save one archive answer and return its name. Each answer keeps its own file, named by the archive host and the moment it
 * was saved; none is overwritten. */
export async function saveArchiveLeadEvidence(root: string, source: string, request: unknown, rows: unknown, now = new Date()): Promise<string> {
  const directory = resolve(root, 'output/telescopes/archive-leads'), text = `${JSON.stringify({ source, request, rows }, null, 2)}\n`;
  const host = URL.canParse(source) ? new URL(source).hostname : source, stem = plainName(host, now.toISOString().replace(/[^0-9]/gu, ''));
  await mkdir(directory, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    const name = attempt ? `${stem}-${attempt}` : stem;
    try { await writeFile(resolve(directory, `${name}.json`), text, { flag: 'wx' }); return name; }
    catch (error) { if (!hasErrorCode(error, 'EEXIST') || attempt >= 999) throw error; }
  }
}
const save = saveArchiveLeadEvidence;
/** The rows of a saved answer to the same question of the same archive, and the saved file's name (archives/memory.mts). */
const recalled = (root: string, source: string, request: string, same: (text: string) => string) => recall(resolve(root, 'output/telescopes/archive-leads'), '.json', (value, name) => {
  if (!isRecord(value) || value.source !== source || typeof value.request !== 'string' || same(value.request) !== same(request) || !Array.isArray(value.rows)) return undefined;
  const rows = value.rows.filter((row): row is Record<string, string> => isRecord(row) && Object.values(row).every(cell => typeof cell === 'string'));
  return rows.length === value.rows.length ? { rows, pin: name.slice(0, -'.json'.length) } : undefined;
});
/** One question to an archive: the saved answer when there is a recent one, else the archive's, saved. `same` leaves out the
 * part of a question that changes with the clock, when it has one. */
async function answered(root: string, source: string, adql: string, query: (adql: string) => Promise<Record<string, string>[]>,
  same: (text: string) => string = text => text): Promise<{ rows: Record<string, string>[]; pin: string; recalled: boolean }> {
  const kept = await recalled(root, source, adql, same);
  if (kept) return { ...kept, recalled: true };
  const rows = await query(adql);
  return { rows, pin: await save(root, source, adql, rows), recalled: false };
}
const fromMemory = (count: number) => count ? ` ${count} answer(s) are saved ones from the last day; --fresh asks again.` : '';

/** KOA publishes one TAP table per instrument. They are asked a few at a time: one after another the 14 took 92 s for one star
 * (2026-10-06), and each table's own queries still run in order. */
const KECK_TABLES_AT_ONCE = 4;
/** With a `position`, each table is asked twice, by name and by place, and the answers are joined: archives file one star under
 * several spellings (KOA holds HD 189733 as "HD189733", "HD 189733", "189733" and "GJ4130"), and a frame named for the star can
 * be pointed away from it. One query with both conditions never answered (10 minutes, 2026-10-06); each alone takes 4 to 5 s. */
export async function searchKeckLeads(root: string, target: TargetCatalogueEntry, query: typeof koaQuery = koaQuery,
  filter?: ArchiveLeadFilter, position?: LeadPosition): Promise<ArchiveLeadService> {
  const time = leadTime(filter), tables = filter?.instrument ? INSTRUMENT_TABLES.filter(table => table.slice(4).toLowerCase() === filter.instrument!.toLowerCase()) : INSTRUMENT_TABLES;
  const date = time ? ` AND date_obs BETWEEN '${time.fromIso.slice(0, 10)}' AND '${time.toIso.slice(0, 10)}'` : '';
  const scope = `Exact target-name variants${position ? `, and frames within ${arcsec(position)} arcsec of the target's position,` : ''} across ${tables.length} matching public KOA TAP instrument tables${time ? `; UTC observation dates ${time.fromIso.slice(0, 10)} to ${time.toIso.slice(0, 10)}` : ''}; object-frame counts and up to ${KECK_SOURCE_SAMPLE_LIMIT} exact public FITS files per instrument`;
  if (!tables.length) return { service: TAP_SYNC, state: 'empty-in-scope', scope, reason: `KOA has no public instrument table named ${filter!.instrument}.`, instruments: [] };
  try { if (query === koaQuery) astroqueryToolchainSync(); }
  catch (error) { return { service: TAP_SYNC, state: 'unavailable', scope, reason: message(error), instruments: [] }; }
  const names = namesOf(target), literals = names.map(name => `'${name.replaceAll("'", "''")}'`).join(',');
  const named = `targname IN (${literals})`, known = (name: string) => names.some(candidate => key(candidate) === key(name));
  const placed = position ? `CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${position.raDeg}, ${position.decDeg}, ${position.radiusDeg})) = 1` : undefined;
  type Found = { instruments: ArchiveLeadService['instruments'][number][]; sources: KeckSourceLead[]; failures: string[]; evidence: string[]; recalled: number };
  const sample = async (table: (typeof INSTRUMENT_TABLES)[number], found: Found, where: string) => {
    const { sources, evidence } = found;
    const instrument = table.slice(4).toUpperCase();
    const exact = `SELECT TOP ${KECK_SOURCE_SAMPLE_LIMIT} koaid,targname,koaimtyp,filehand,date_obs FROM ${table} WHERE koaimtyp='object' AND ${where} AND filehand IS NOT NULL${date} ORDER BY koaid`;
    const { rows: frames, pin, recalled: kept } = await answered(root, TAP_SYNC, exact, query);
    if (kept) found.recalled++;
    const sampled: KeckSourceLead[] = [];
    for (const frame of frames) {
      const targetName = where === named ? requireString(column(frame, 'targname'), 'KOA frame target') : column(frame, 'targname') ?? '';
      if (where === named && !known(targetName)) throw new TypeError(`KOA ${table} returned an unrequested frame target.`);
      if (column(frame, 'koaimtyp') !== 'object') throw new TypeError(`KOA ${table} returned a non-object frame.`);
      const koaid = requireString(column(frame, 'koaid'), 'KOA frame id'), filehand = requireString(column(frame, 'filehand'), 'KOA filehand');
      if (!/^\/[A-Za-z0-9._/-]+\.fits$/u.test(filehand) || filehand.includes('..') || !/^[A-Za-z0-9._-]+\.fits$/u.test(koaid))
        throw new TypeError(`KOA ${table} returned an unsupported source file identity.`);
      sampled.push({ table, instrument, koaid, targetName, filehand, dateObs: column(frame, 'date_obs') ?? '', evidence: pin });
    }
    evidence.push(pin); sources.push(...sampled);
  };
  const search = async (table: (typeof INSTRUMENT_TABLES)[number]): Promise<Found> => {
    const found: Found = { instruments: [], sources: [], failures: [], evidence: [], recalled: 0 }, { instruments, failures, evidence } = found;
    const counted = async (where: string) => {
      const adql = `SELECT targname, COUNT(*) AS frames FROM ${table} WHERE koaimtyp='object' AND ${where}${date} GROUP BY targname`;
      const { rows, pin, recalled: kept } = await answered(root, TAP_SYNC, adql, query);
      evidence.push(pin); if (kept) found.recalled++;
      return rows.map(row => {
        const name = where === named ? requireString(column(row, 'targname'), 'KOA target name') : column(row, 'targname') ?? '', count = Number(column(row, 'frames'));
        if (!Number.isSafeInteger(count) || count < 0) throw new TypeError(`KOA ${table} has an invalid frame count.`);
        if (where === named && !known(name)) throw new TypeError(`KOA ${table} returned an unrequested target.`);
        return { name, count };
      }).filter(row => row.count);
    };
    let byName: { name: string; count: number }[], byPlace: { name: string; count: number }[];
    try {
      // A name the first query counted already holds every frame of that exact name, so the place adds only the other names it finds.
      [byName, byPlace] = await Promise.all([counted(named), placed ? counted(placed) : []]);
      byPlace = byPlace.filter(row => !byName.some(other => other.name === row.name));
    } catch (error) {
      failures.push(`${table}: ${message(error)}`);
      return found;
    }
    const instrument = table.slice(4).toUpperCase();
    for (const row of [...byName, ...byPlace]) instruments.push({ telescope: 'Keck', instrument, records: row.count, sample: row.name || '(no target name)' });
    // The files are sampled by place when the place found any frame: it holds the named ones too, all but those pointed away.
    if (byName.length || byPlace.length) try { await sample(table, found, placed && byPlace.length ? placed : named); }
    catch (error) { failures.push(`${table}: exact-file sampling failed: ${message(error)}`); }
    return found;
  };
  const all: Found[] = [];
  for (let first = 0; first < tables.length; first += KECK_TABLES_AT_ONCE) all.push(...await Promise.all(tables.slice(first, first + KECK_TABLES_AT_ONCE).map(search)));
  const instruments = all.flatMap(found => found.instruments), sources = all.flatMap(found => found.sources), failures = all.flatMap(found => found.failures), evidence = all.flatMap(found => found.evidence);
  const attempted = tables.length;
  return { service: TAP_SYNC, state: failures.length ? evidence.length ? 'overflow' : 'unavailable' : instruments.length ? 'sampled' : 'empty-in-scope', scope,
    reason: failures.length ? `${attempted - failures.length}/${attempted} attempted tables answered; ${failures.join('; ')}` : `${instruments.reduce((n, item) => n + item.records, 0)} matching public object frames; ${sources.length} exact FITS leads sampled. Archive names${position ? ' and a place on the sky' : ''} are not science qualifications.${fromMemory(all.reduce((n, found) => n + found.recalled, 0))}`,
    instruments, sources: sources.sort((a,b)=>a.instrument.localeCompare(b.instrument)||a.koaid.localeCompare(b.koaid)), evidence };
}

/** CADC mirrors Gemini's public raw files and supplies a stable artifact URI and size. */
export async function searchGeminiLeads(root: string, target: TargetCatalogueEntry, query: typeof cadcQuery = cadcQuery,
  filter?: ArchiveLeadFilter, position?: LeadPosition): Promise<ArchiveLeadService> {
  const names = namesOf(target), searched = names.slice(0, 12), limit = 500;
  const time = leadTime(filter), instrument = filter?.instrument?.trim(), quoted = instrument?.replaceAll("'", "''");
  const scope = `CADC GEMINI public OBJECT science artifacts for ${searched.length} exact archive-name variants${position ? `, and for frames within ${arcsec(position)} arcsec of the target's position` : ''}${instrument ? `, instrument ${instrument}` : ''}${time ? `, UTC ${time.fromIso} to ${time.toIso}` : ''}; first ${limit} matching rows, up to 3 FITS files per instrument`;
  if (!searched.length) return { service: CADC_TAP, state: 'empty-in-scope', scope, reason: 'No target name was available.', instruments: [] };
  const named = `o.target_name IN (${searched.map(name => `'${name.replaceAll("'", "''")}'`).join(',')})`;
  const placed = position ? `INTERSECTS(CIRCLE('ICRS', ${position.raDeg}, ${position.decDeg}, ${position.radiusDeg}), p.position_bounds) = 1` : undefined;
  const asked = (where: string) => `SELECT TOP ${limit} ${FRAME_COLUMNS} FROM ${FRAME_JOIN} WHERE o.collection='GEMINI' AND o.type='OBJECT' AND o.intent='science' ` +
    `AND ${where} ` +
    `${quoted ? `AND o.instrument_name='${quoted}' ` : ''}` +
    `${time ? `AND p.time_bounds_upper >= ${time.from / 86_400_000 + 40_587} AND p.time_bounds_lower <= ${time.to / 86_400_000 + 40_587} ` : ''}` +
    `AND p.dataRelease < '${new Date().toISOString()}' AND a.uri LIKE 'gemini:GEMINI/%.fits' ORDER BY p.time_bounds_lower DESC`;
  try {
    // By name, then by place, each bounded on its own; a frame both find is counted once.
    // The release-date bound is the moment of asking; two askings a minute apart are the same question.
    const answers = await Promise.all([named, ...placed ? [placed] : []].map(async where => ({ where, ...await answered(root, CADC_TAP, asked(where), query, text => text.replace(/p\.dataRelease < '[^']*'/u, '')) })));
    const groups = new Map<string, { telescope: string; instrument: string; records: number; sample: string }>();
    const sources: GeminiSourceLead[] = [], seen = new Set<string>();
    for (const { where, rows, pin } of answers) for (const row of rows) {
      const name = where === named ? requireString(row.target_name, 'CADC target name') : row.target_name ?? '';
      if (where === named && !searched.some(candidate => key(candidate) === key(name))) throw new TypeError('CADC returned another target name.');
      if (!/^gemini:GEMINI\/[NS]\d{8}S\d{4}\.fits$/u.test(row.uri ?? '')) continue;
      const frame = cadcFrame(row), instrument = requireString(row.instrument_name, 'CADC instrument');
      if (seen.has(frame.uri)) continue;
      seen.add(frame.uri);
      const telescope = frame.name.startsWith('N') ? 'Gemini North' : 'Gemini South', groupKey = `${telescope}/${instrument}`;
      const group = groups.get(groupKey) ?? { telescope, instrument, records: 0, sample: frame.name };
      group.records++; groups.set(groupKey, group);
      if (group.records <= 3) sources.push({ name: frame.name, uri: frame.uri, bytes: frame.bytes,
        targetName: name, instrument, telescope, observation: frame.observation, dataRelease: frame.dataRelease, evidence: pin });
    }
    const instruments = [...groups.values()].sort((a, b) => b.records - a.records || a.instrument.localeCompare(b.instrument));
    return { service: CADC_TAP, state: answers.some(answer => answer.rows.length >= limit) || names.length > searched.length ? 'overflow' : instruments.length ? 'sampled' : 'empty-in-scope',
      scope, reason: `${seen.size} distinct public raw FITS artifact(s) in this bounded search. Archive names do not confirm target detection or calibration.${fromMemory(answers.filter(answer => answer.recalled).length)}`,
      instruments, sources, evidence: answers.map(answer => answer.pin) };
  } catch (error) { return { service: CADC_TAP, state: 'unavailable', scope, reason: message(error), instruments: [] }; }
}
