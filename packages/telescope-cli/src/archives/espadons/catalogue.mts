/** What catalogues say of a star that a program needs before it can be reduced: the temperature, gravity and metallicity
 * its line mask is computed for, and the radial velocity its lines are looked for at.
 *
 *   - SIMBAD gives the star's spectral type and its radial velocity with the paper it took it from.
 *   - The TESS Input Catalog 8.2 (Stassun et al. 2019; VizieR IV/39/tic82) gives the temperature and gravity of most stars
 *     brighter than its limit, and a metallicity for some. It is used when it has both.
 *   - Otherwise the temperature and gravity are those of the star's spectral type in the dwarf sequence of Pecaut & Mamajek
 *     (2013, ApJS 208, 9), in the table E. Mamajek keeps current; the gravity is the row's mass over its radius squared. That
 *     is how a mask has always been chosen for this method: by spectral type. A star SIMBAD classes as a giant or a
 *     supergiant gets nothing from the dwarf table.
 *
 * SIMBAD's own table of measured temperatures is not used: its newest row is whatever survey ran last (4,407 K for the red
 * dwarf AD Leo, 5,466 K for the M6.5 dwarf DX Cnc). Each value comes back with where it is printed; a person may replace any. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tapRows } from '@cssearth/telescope/node';
import { DOWNLOADS, type Atmosphere, type Cited } from './program.mts';

export const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap', VIZIER_TAP = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap';
export const DWARF_SEQUENCE = Object.freeze({ name: 'EEM_dwarf_UBVIJHK_colors_Teff.txt', url: 'https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt', bytes: 55680, version: '2022.04.16' });
/** How far a catalogue row may lie from the star's place and still be the star, arcseconds. */
export const MATCH_ARCSEC = 2;
/** log g of the Sun in cgs (GM☉ / R☉², nominal IAU values). */
const SOLAR_LOG_GRAVITY = 4.438;

export interface DwarfRow { readonly type: string; readonly kelvin: number; readonly logGravity: number }
/** The dwarf sequence: each spectral type's temperature, and its gravity from the row's mass and radius. */
export function parseDwarfSequence(text: string): Map<string, DwarfRow> { const lines = text.split('\n'), header = lines.find(line => line.startsWith('#SpT'))?.slice(1).trim().split(/\s+/u);
  const column = (name: string) => { const at = header?.indexOf(name) ?? -1; if (at < 0) throw new TypeError(`The dwarf sequence has no ${name} column.`); return at; }, teff = column('Teff'), radius = column('R_Rsun'), mass = column('Msun'), rows = new Map<string, DwarfRow>();
  for (const line of lines) { const f = line.trim().split(/\s+/u); if (!/^[OBAFGKM]\d(?:\.\d)?V$/u.test(f[0] ?? '') || rows.has(f[0]!)) continue; const [t, r, m] = [Number(f[teff]), Number(f[radius]), Number(f[mass])];
    if ([t, r, m].every(value => Number.isFinite(value) && value > 0)) rows.set(f[0]!, { type: f[0]!, kelvin: t, logGravity: Number((SOLAR_LOG_GRAVITY + Math.log10(m / (r * r))).toFixed(2)) }); }
  if (rows.size < 40) throw new TypeError(`The dwarf sequence gave ${rows.size} rows.`); return rows; }
/** The row for a spectral type as SIMBAD writes it ("K2V", "dM3", "M6.5Ve", "G5VFe-0.7"); undefined for a giant or supergiant or a type the table lacks. */
export function dwarfRow(spectralType: string, rows: ReadonlyMap<string, DwarfRow>): DwarfRow | undefined { const match = /^(?:d|sd)?([OBAFGKM])(\d(?:\.\d)?)\s*(I{1,3}|IV|V)?/u.exec(spectralType.trim()); if (!match || (match[3] && match[3] !== 'V')) return undefined;
  return rows.get(`${match[1]}${Number(match[2])}V`); }

export interface SimbadStar { readonly name: string; readonly spectralType: string; readonly raDegrees: number; readonly decDegrees: number; readonly radialVelocityKmS?: number; readonly radialVelocityBibcode?: string }
export interface TicRow { readonly id: string; readonly separationArcsec: number; readonly kelvin?: number; readonly logGravity?: number; readonly metallicity?: number }
/** The program blocks the catalogues give, and a line for each thing they do not. */
export function chooseParameters(star: SimbadStar | undefined, tic: readonly TicRow[], dwarfs: ReadonlyMap<string, DwarfRow>): { readonly atmosphere?: Atmosphere; readonly radialVelocity?: Cited; readonly notes: readonly string[] } {
  if (!star) return { notes: ['SIMBAD has no star at this name or place: fill atmosphere and radialVelocity by hand.'] };
  const notes: string[] = [], name = star.name.split(/\s+/u).join(' '), nearest = [...tic].sort((a, b) => a.separationArcsec - b.separationArcsec)[0], row = nearest && nearest.separationArcsec <= MATCH_ARCSEC ? nearest : undefined;
  let atmosphere: Atmosphere | undefined;
  if (row?.kelvin && row.logGravity) { const source = `TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC ${row.id}`;
    atmosphere = { effectiveTemperatureK: { value: Math.round(row.kelvin), source: `${source}: Teff` }, logGravity: { value: Number(row.logGravity.toFixed(2)), source: `${source}: logg` }, ...(row.metallicity === undefined ? {} : { metallicity: { value: Number(row.metallicity.toFixed(2)), source: `${source}: [M/H]` } }) }; }
  else { const dwarf = dwarfRow(star.spectralType, dwarfs), source = dwarf && `Pecaut & Mamajek (2013, ApJS 208, 9), the online table's version ${DWARF_SEQUENCE.version}, row ${dwarf.type}, for SIMBAD's spectral type ${star.spectralType}`;
    if (dwarf) atmosphere = { effectiveTemperatureK: { value: dwarf.kelvin, source: `${source}: Teff` }, logGravity: { value: dwarf.logGravity, source: `${source}: from the row's mass and radius` } };
    else notes.push(`The TESS Input Catalog has no temperature and gravity for ${name}, and its spectral type (${star.spectralType || 'none in SIMBAD'}) is not a dwarf's in the sequence: fill atmosphere by hand.`); }
  const radialVelocity = star.radialVelocityKmS === undefined ? undefined : { value: star.radialVelocityKmS, source: `SIMBAD, radial velocity of ${name}${star.radialVelocityBibcode ? ` (${star.radialVelocityBibcode})` : ''}` };
  if (!radialVelocity) notes.push(`SIMBAD has no radial velocity for ${name}: without one the star's line is looked for blind, which fails on faint red stars.`);
  return { ...(atmosphere ? { atmosphere } : {}), ...(radialVelocity ? { radialVelocity } : {}), notes };
}

const number = (text: string | undefined) => text === undefined || text.trim() === '' || !Number.isFinite(Number(text)) ? undefined : Number(text);
const quoted = (value: string) => `'${value.replaceAll("'", "''")}'`;
/** The dwarf sequence on disk at its pinned size, fetched once. */
async function dwarfSequence() { const directory = resolve(DOWNLOADS, 'catalogues'), path = resolve(directory, DWARF_SEQUENCE.name);
  if ((await stat(path).then(info => info.size, () => -1)) !== DWARF_SEQUENCE.bytes) { const response = await fetch(DWARF_SEQUENCE.url, { headers: { 'User-Agent': 'cssEarth-telescope/1.0 (https://css.earth)' }, signal: AbortSignal.timeout(120_000) });
    const bytes = Buffer.from(await response.arrayBuffer()); if (!response.ok || bytes.length !== DWARF_SEQUENCE.bytes) throw new Error(`${DWARF_SEQUENCE.url} is ${bytes.length} bytes (status ${response.status}), not its pinned ${DWARF_SEQUENCE.bytes}: the table has a new version.`);
    await mkdir(directory, { recursive: true }); await writeFile(path, bytes); }
  return parseDwarfSequence(await readFile(path, 'latin1')); }

/** A star's catalogued parameters, by its name where SIMBAD knows it and by its place otherwise. */
export async function starParameters(name: string, raDegrees: number, decDegrees: number) {
  const columns = 'b.main_id, b.sp_type, b.ra, b.dec, b.rvz_radvel, b.rvz_bibcode', byName = await tapRows(SIMBAD_TAP, `SELECT ${columns} FROM basic AS b JOIN ident AS i ON i.oidref = b.oid WHERE i.id = ${quoted(name)}`);
  const found = byName[0] ?? (await tapRows(SIMBAD_TAP, `SELECT TOP 1 ${columns}, DISTANCE(POINT('ICRS', b.ra, b.dec), POINT('ICRS', ${raDegrees}, ${decDegrees})) AS d FROM basic AS b WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${raDegrees}, ${decDegrees}, ${MATCH_ARCSEC * 3 / 3600})) = 1 ORDER BY d`))[0];
  const ra = number(found?.ra), dec = number(found?.dec), velocity = number(found?.rvz_radvel);
  const star: SimbadStar | undefined = found && ra !== undefined && dec !== undefined ? { name: found.main_id ?? name, spectralType: found.sp_type ?? '', raDegrees: ra, decDegrees: dec, ...(velocity === undefined ? {} : { radialVelocityKmS: velocity, ...(found.rvz_bibcode ? { radialVelocityBibcode: found.rvz_bibcode } : {}) }) } : undefined;
  const tic = star ? (await tapRows(VIZIER_TAP, `SELECT TIC, RAJ2000, DEJ2000, Teff, logg, "[M/H]" AS mh FROM "IV/39/tic82" WHERE 1 = CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${star.raDegrees}, ${star.decDegrees}, ${MATCH_ARCSEC * 3 / 3600})) AND Tmag < 13`)).map((row): TicRow => { const kelvin = number(row.Teff), logGravity = number(row.logg), metallicity = number(row.mh);
    return { id: row.TIC ?? '', separationArcsec: 3600 * Math.hypot((Number(row.RAJ2000) - star.raDegrees) * Math.cos(star.decDegrees * Math.PI / 180), Number(row.DEJ2000) - star.decDegrees), ...(kelvin ? { kelvin } : {}), ...(logGravity ? { logGravity } : {}), ...(metallicity === undefined ? {} : { metallicity }) }; }) : [];
  return { star, ...chooseParameters(star, tic, await dwarfSequence()) };
}
