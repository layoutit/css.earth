/** Rotation periods of stars from every catalogue table that prints one.
 *
 * No single catalogue holds the rotation periods of stars: they are spread over hundreds of papers' tables at VizieR. The
 * Virtual Observatory registry says which. It is asked (RegTAP, at the GAVO data centre) for every VizieR table with a column
 * whose content type is a period and whose description says rotation; CDS X-Match then matches all the stars against each
 * table by place in one request. What comes back is kept as it is printed: one candidate a table row, with the table, its
 * title, the column and how far the row lies from the star.
 *
 * Which candidate a star's record adopts is star-metadata.mts's rule (adoptPeriod). The harvest is some five hundred requests,
 * so it is kept under ignored output/metadata and read again until `--periods fresh` asks the catalogues anew. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isRecord } from '@cssearth/core';
import { tapRows } from '@cssearth/telescope/node';
import { TRANSFER_TIMEOUT_MS, USER_AGENT } from '../archives/archives.mts';
import type { CataloguedPeriod } from './star-metadata.mts';

export const REGISTRY_TAP = 'https://dc.g-vo.org/tap', XMATCH = 'https://cdsxmatch.u-strasbg.fr/xmatch/api/v1/sync';
export const ROTATION_COLUMNS_QUERY = "SELECT r.res_title, t.table_name, c.name, c.unit, c.column_description FROM rr.table_column AS c JOIN rr.res_table AS t ON t.ivoid = c.ivoid AND t.table_index = c.table_index JOIN rr.resource AS r ON r.ivoid = c.ivoid WHERE r.ivoid LIKE 'ivo://cds.vizier/%' AND c.ucd LIKE 'time.period%' AND 1 = ivo_hasword(c.column_description, 'rotation')";
/** How far a table's row may lie from a star's J2000 place and be the star, arcseconds. */
export const MATCH_ARCSEC = 3;
/** Tables that are not of stars' own rotation: other bodies, and models. */
const OTHER_SUBJECT = /asteroid|pulsar|minor planet|comet|trans-neptun|kuiper|solar system|galax|neutron|\bNEAs?\b|evolutionary tracks|\bmodels?\b/iu;
/** A column that is not the rotation period itself: one divided by the sine of the tilt, an orbit's, a predicted or a critical one. */
const OTHER_COLUMN = /orbit|\/\s*sin|critical|break-?up|predict|expected|theor|model|error|uncertaint|flag|number of/iu;
const DAYS: Readonly<Record<string, number>> = { d: 1, h: 1 / 24, yr: 365.25, a: 365.25, min: 1 / 1440 };

export interface PeriodColumn { readonly table: string; readonly title: string; readonly name: string; readonly unit: string }
/** The registry's answer as the columns to read: stars' tables, a unit of time this module knows, a name and a description of the period itself. */
export function periodColumns(rows: readonly Readonly<Record<string, string>>[]): PeriodColumn[] {
  return rows.flatMap(row => { const table = row.table_name ?? '', title = row.res_title ?? '', name = row.name ?? '', unit = (row.unit ?? '').trim();
    return !table || OTHER_SUBJECT.test(title) || !(unit in DAYS) || name.includes('/') || OTHER_COLUMN.test(row.column_description ?? '') ? [] : [{ table, title, name, unit }]; });
}

const cells = (line: string) => { const out: string[] = []; let cell = '', quoted = false; for (const character of line) { if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { out.push(cell); cell = ''; } else cell += character; } out.push(cell); return out; };
/** X-Match's CSV answer for one table: each matched star with the period of `column`, in days. A star two rows match keeps the nearer. */
export function parseMatches(csv: string, column: PeriodColumn): { readonly id: string; readonly period: CataloguedPeriod }[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), names = cells(header ?? ''), at = names.findIndex(name => name.toLowerCase() === column.name.toLowerCase()), star = names.indexOf('id');
  if (names[0] !== 'angDist' || at < 0 || star < 0) return [];
  const nearest = new Map<string, { arcsec: number; value: number }>();
  for (const line of lines) { const row = cells(line), arcsec = Number(row[0]), value = Number(row[at]), id = row[star] ?? ''; if (!(value > 0) || !(arcsec <= MATCH_ARCSEC) || !id) continue; if (!(nearest.get(id)?.arcsec! <= arcsec)) nearest.set(id, { arcsec, value }); }
  return [...nearest].map(([id, { arcsec, value }]) => ({ id, period: { days: Number((value * DAYS[column.unit]!).toPrecision(6)),
    source: `VizieR ${column.table} (${column.title.split(/\s+/u).join(' ')}), column ${names[at]}: ${value} ${column.unit}, the row ${arcsec.toFixed(1)} arcsec from the star's J2000 place` } }));
}

/** One table matched against the stars; an answer that is not a table (the table has no place on the sky) is no match. */
async function match(column: PeriodColumn, stars: string): Promise<string> {
  const form = new FormData(); for (const [key, value] of Object.entries({ request: 'xmatch', distMaxArcsec: String(MATCH_ARCSEC), RESPONSEFORMAT: 'csv', colRA1: 'ra', colDec1: 'dec', cat2: `vizier:${column.table}` })) form.set(key, value);
  form.set('cat1', new Blob([stars], { type: 'text/csv' }), 'stars.csv');
  const response = await fetch(XMATCH, { method: 'POST', body: form, headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) }).catch(() => undefined);
  return response?.ok ? response.text() : '';
}

/** Every catalogued rotation period of each star, by star id. `stars` are at their J2000 places. `kept` is the harvest file. */
export async function cataloguedPeriods(stars: readonly { readonly id: string; readonly raDegrees: number; readonly decDegrees: number }[], kept: string, fresh: boolean, report: (line: string) => void): Promise<Map<string, CataloguedPeriod[]>> {
  const found = new Map<string, CataloguedPeriod[]>(), add = (id: string, period: CataloguedPeriod) => { found.set(id, [...found.get(id) ?? [], period]); };
  const saved = fresh ? undefined : await readFile(kept, 'utf8').catch(() => undefined);
  if (saved !== undefined) { const wanted = new Set(stars.map(star => star.id));
    for (const line of saved.split('\n').filter(Boolean)) { const row = JSON.parse(line) as unknown; if (isRecord(row) && typeof row.id === 'string' && wanted.has(row.id) && isRecord(row.period) && typeof row.period.days === 'number' && typeof row.period.source === 'string') add(row.id, { days: row.period.days, source: row.period.source }); }
    report(`Rotation periods read from ${kept}; --periods fresh asks the catalogues again.`); return found; }
  const columns = periodColumns(await tapRows(REGISTRY_TAP, ROTATION_COLUMNS_QUERY, 50000)), csv = `id,ra,dec\n${stars.map(star => `${star.id},${star.raDegrees.toFixed(6)},${star.decDegrees.toFixed(6)}`).join('\n')}\n`, lines: string[] = [];
  report(`${columns.length} rotation-period columns in ${new Set(columns.map(column => column.table)).size} VizieR tables.`);
  const answers = new Map<string, string>();
  for (const column of columns) { if (!answers.has(column.table)) answers.set(column.table, await match(column, csv));
    for (const { id, period } of parseMatches(answers.get(column.table)!, column)) { add(id, period); lines.push(JSON.stringify({ id, period })); } }
  // The stars asked anew replace their own kept lines; every other star's stay.
  const asked = new Set(stars.map(star => star.id)), others = (await readFile(kept, 'utf8').catch(() => '')).split('\n').filter(line => { if (!line) return false; const row = JSON.parse(line) as unknown; return isRecord(row) && typeof row.id === 'string' && !asked.has(row.id); });
  await mkdir(dirname(kept), { recursive: true }); await writeFile(kept, [...others, ...lines].map(line => `${line}\n`).join(''));
  return found;
}
