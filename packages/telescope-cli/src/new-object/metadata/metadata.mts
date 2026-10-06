/** Write what the catalogues print of each star into its measurements record, for stars already in the tree:
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --metadata --all
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --metadata <star id>...
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --metadata --all --periods [fresh]
 *
 * A star is a package whose source/measurements.json is a uniform-disc star's and whose body record holds a place on the
 * sky. The NASA Exoplanet Archive is asked once for the composite parameters of every host, and SIMBAD and the Gaia
 * Archive in groups of stars: SIMBAD by Gaia DR3 or Hipparcos identifier and by place for a star with neither, the Gaia
 * Archive by Gaia DR3 source. star-metadata.mts says which fields
 * are written and from which catalogue. Only the record changes: nothing is baked, and a field the record already holds
 * from its own source is left alone. Run again, the pass rewrites only what a catalogue changed.
 *
 * `--periods` also looks for each star's rotation period in every catalogue table that prints one (rotation-catalogues.mts,
 * some five hundred requests the first time). Without it, a star keeps the catalogued periods its record already lists. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { UNIFORM_DISC_STAR_SCHEMA } from '@cssearth/objects';
import { GAIA_TAP, type Archive } from '../archives/archives.mts';
import { simbadRows } from '../archives/tables/simbad-tap.mts';
import { json } from '../dataset.mts';
import { isConventionOnly } from '../maps/surface-maps.mts';
import { NASA_TAP } from '../planets/orbit.mts';
import { cataloguedPeriods } from './rotation-catalogues.mts';
import { gaiaFlameQuery, METADATA_FIELDS, parseGaiaRows, parseHostRows, PSCOMPPARS_QUERY, recordedPeriods, starMetadata, withMetadata, type CataloguedPeriod, type GaiaRow, type HostRow, type SimbadRow, measuredPeriod } from './star-metadata.mts';

/** How far a catalogue's star may lie from the record's place and be the star, degrees: both are Gaia positions near 2016. */
export const MATCH_DEGREES = 5 / 3600;
/** Identifiers in one SIMBAD question, and places in one. */
const NAMED = 200, PLACED = 20, SOURCES = 500;

/** Where the rotation-period harvest is kept between runs. */
export const PERIODS_KEPT = 'output/metadata/rotation-periods.jsonl';

interface Star { readonly id: string; readonly path: string; readonly record: Record<string, unknown>; readonly raDegrees: number; readonly decDegrees: number; /** The place moved back to J2000 with the record's proper motion, where the catalogues list it. */ readonly j2000: { readonly raDegrees: number; readonly decDegrees: number }; readonly identifier?: string; readonly gaiaDr3?: string; readonly measuredAxis: boolean }
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8').catch(() => 'null')) as unknown;
const apart = (a: { raDegrees: number; decDegrees: number }, raDegrees: number, decDegrees: number) => Math.hypot((a.raDegrees - raDegrees) * Math.cos(decDegrees * Math.PI / 180), a.decDegrees - decDegrees);

/** The stars of `ids`, or every star when `ids` is empty. */
async function stars(root: string, ids: readonly string[]): Promise<Star[]> { const out: Star[] = [];
  for (const id of ids.length ? ids : (await readdir(resolve(root, 'src/objects'))).sort()) { const path = resolve(root, 'src/objects', id, 'source/measurements.json'), record = await readJson(path), body = await readJson(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`));
    const place = isRecord(body) && isRecord(body.star) ? body.star : undefined;
    if (!isRecord(record) || record.schema !== UNIFORM_DISC_STAR_SCHEMA || !place || typeof place.rightAscensionDegrees !== 'number' || typeof place.declinationDegrees !== 'number') { if (ids.length) throw new Error(`${id} is not a star with a measurements record and a place on the sky.`); continue; }
    const gaiaDr3 = /Gaia DR3 (?:source )?(\d{10,})/u.exec(isRecord(place.sources) ? String(place.sources.position ?? '') : '')?.[1], hipparcos = typeof place.hipparcosId === 'number' || typeof place.hipparcosId === 'string' ? String(place.hipparcosId) : undefined;
    const rotation = await readJson(resolve(root, 'src/objects', id, 'source/preparation/rotation.json'));
    const years = (typeof place.positionEpochJulianYear === 'number' ? place.positionEpochJulianYear : 2000) - 2000, motion = (key: string) => typeof place[key] === 'number' ? place[key] * years / 3.6e6 : 0, dec2000 = place.declinationDegrees - motion('properMotionDecMasPerYear');
    out.push({ id, path, record, raDegrees: place.rightAscensionDegrees, decDegrees: place.declinationDegrees, j2000: { raDegrees: place.rightAscensionDegrees - motion('properMotionRaMasPerYear') / Math.cos(dec2000 * Math.PI / 180), decDegrees: dec2000 }, ...(gaiaDr3 ? { identifier: `Gaia DR3 ${gaiaDr3}`, gaiaDr3 } : hipparcos ? { identifier: `HIP ${hipparcos}` } : {}), measuredAxis: isRecord(rotation) && !isConventionOnly(rotation) }); }
  return out; }

const SIMBAD_COLUMNS = 'b.main_id, b.ra, b.dec, b.sp_type, b.sp_bibcode, b.otype, o.description AS otype_description, o.path AS otype_path, r.vsini, r.bibcode AS vsini_bibcode', ROTATION = 'LEFT JOIN mesRot AS r ON r.oidref = b.oid AND r.mespos = 1 LEFT JOIN otypedef AS o ON o.otype = b.otype';
const simbadRow = (row: Readonly<Record<string, string>>): SimbadRow => ({ name: row.main_id ?? '', ...(row.sp_type ? { spectralType: { value: row.sp_type, ...(row.sp_bibcode ? { bibcode: row.sp_bibcode } : {}) } } : {}),
  ...(row.otype && row.otype_description && row.otype_path ? { objectType: { code: row.otype, description: row.otype_description, path: row.otype_path } } : {}),
  ...(Number(row.vsini) > 0 ? { vsiniKmS: { value: Number(row.vsini), ...(row.vsini_bibcode ? { bibcode: row.vsini_bibcode } : {}) } } : {}) });

/** SIMBAD's row for each star that has one, by star id. */
async function simbadByStar(archive: Archive, list: readonly Star[]): Promise<Map<string, SimbadRow>> { const found = new Map<string, SimbadRow>(), named = list.filter(star => star.identifier), placed = list.filter(star => !star.identifier);
  for (let i = 0; i < named.length; i += NAMED) { const group = named.slice(i, i + NAMED), byIdentifier = new Map(group.map(star => [star.identifier!, star.id]));
    for (const row of await simbadRows(archive, `SELECT i.id, ${SIMBAD_COLUMNS} FROM ident AS i JOIN basic AS b ON b.oid = i.oidref ${ROTATION} WHERE i.id IN (${group.map(star => `'${star.identifier}'`).join(', ')})`)) { const id = byIdentifier.get((row.id ?? '').replace(/\s+/gu, ' ')); if (id) found.set(id, simbadRow(row)); } }
  for (let i = 0; i < placed.length; i += PLACED) { const group = placed.slice(i, i + PLACED);
    const rows = await simbadRows(archive, `SELECT ${SIMBAD_COLUMNS} FROM basic AS b ${ROTATION} WHERE ${group.map(star => `CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${star.raDegrees}, ${star.decDegrees}, ${MATCH_DEGREES})) = 1`).join(' OR ')}`);
    for (const star of group) { const nearest = rows.map(row => ({ row, degrees: apart({ raDegrees: Number(row.ra), decDegrees: Number(row.dec) }, star.raDegrees, star.decDegrees) })).filter(entry => entry.degrees <= MATCH_DEGREES).sort((a, b) => a.degrees - b.degrees)[0]; if (nearest) found.set(star.id, simbadRow(nearest.row)); } }
  return found; }

/** FLAME's row for each star with a Gaia DR3 source, by source. */
async function gaiaBySource(archive: Archive, list: readonly Star[]): Promise<Map<string, GaiaRow>> { const found = new Map<string, GaiaRow>(), sources = list.flatMap(star => star.gaiaDr3 ? [star.gaiaDr3] : []);
  for (let i = 0; i < sources.length; i += SOURCES) for (const row of parseGaiaRows(await archive.text(GAIA_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: gaiaFlameQuery(sources.slice(i, i + SOURCES)) }))) found.set(row.sourceId, row);
  return found; }

/** The archive's host for a star: the one with its Gaia DR3 identifier, else the nearest within reach. */
function hostOf(star: Star, byGaia: ReadonlyMap<string, HostRow>, hosts: readonly HostRow[]): HostRow | undefined {
  const same = star.gaiaDr3 ? byGaia.get(star.gaiaDr3) : undefined; if (same) return same;
  return hosts.map(host => ({ host, degrees: apart(host, star.raDegrees, star.decDegrees) })).filter(entry => entry.degrees <= MATCH_DEGREES && !(entry.host.gaiaDr3 && star.gaiaDr3)).sort((a, b) => a.degrees - b.degrees)[0]?.host; }

/** Writes the records; returns one line a changed star and a last line of counts. */
export async function writeStarMetadata(root: string, ids: readonly string[], archive: Archive, report: (line: string) => void = () => undefined, periods?: 'kept' | 'fresh'): Promise<string[]> {
  const list = await stars(root, ids), hosts = parseHostRows(await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: PSCOMPPARS_QUERY, format: 'csv' })}`)), byGaia = new Map(hosts.flatMap(host => host.gaiaDr3 ? [[host.gaiaDr3, host] as const] : []));
  report(`${list.length} stars; the archive lists ${hosts.length} hosts.`);
  const catalogued = await simbadByStar(archive, list), flame = await gaiaBySource(archive, list), lines: string[] = [], counts = new Map<string, number>(); let hosted = 0;
  const harvested: Map<string, CataloguedPeriod[]> | undefined = periods ? await cataloguedPeriods(list.map(star => ({ id: star.id, ...star.j2000 })), resolve(root, PERIODS_KEPT), periods === 'fresh', report) : undefined;
  for (const star of list) { const host = hostOf(star, byGaia, hosts), fields = starMetadata({ ...(typeof star.record.radiusKm === 'number' ? { radiusKm: star.record.radiusKm } : {}), measuredAxis: star.measuredAxis }, host, catalogued.get(star.id), star.gaiaDr3 ? flame.get(star.gaiaDr3) : undefined, harvested ? harvested.get(star.id) ?? [] : recordedPeriods(star.record), measuredPeriod(star.record));
    if (host) hosted++; for (const field of Object.keys(METADATA_FIELDS)) if (field in fields) counts.set(field, (counts.get(field) ?? 0) + 1);
    const next = json(withMetadata(star.record, fields)); if (next !== json(star.record)) { await writeFile(star.path, next); lines.push(`${star.id}: ${Object.keys(METADATA_FIELDS).filter(field => field in fields).join(', ') || 'no catalogued value'}`); report(lines.at(-1)!); } }
  lines.push(`${list.length} stars, ${hosted} of them archive hosts, ${catalogued.size} in SIMBAD and ${flame.size} with a Gaia FLAME row: ${Object.keys(METADATA_FIELDS).map(field => `${field} ${counts.get(field) ?? 0}`).join(', ')}.`);
  return lines; }
