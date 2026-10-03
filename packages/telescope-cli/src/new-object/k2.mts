/** A draft spec for a red giant from Khan et al. (2023, A&A 677, A21; doi:10.1051/0004-6361/202346196): mass, radius and distance
 * from PARAM grid modelling of its oscillations (the Mosser & Appourchaux 2009 pipeline, MA09, as APOKASC-3's Mosser scale), a
 * temperature from spectra, and the star's Gaia source. One VizieR request per star (J/A+A/677/A21), from three of its tables:
 * K2 + APOGEE (k2_apo), K2 + GALAH (k2_gal) for a K2 star APOGEE did not observe, and TESS + APOGEE (tess_apo).
 *
 * K2 pointed along the ecliptic and TESS stares longest near the ecliptic poles, so these fields reach far above and below the
 * Galactic plane, where the Kepler field does not. The distance is the catalogue's asteroseismic one: at thousands of parsecs a Gaia
 * parallax is a few standard errors at best.
 *
 * PARAM gives each value as a median with 16th and 84th percentiles; the draft cites the median with half that interval. A star is
 * drafted only when the second pipeline (Elsworth et al. 2020, E20) gives a radius within the two pipelines' combined intervals, and
 * refused when the catalogue leaves a value empty (-99.9), APOGEE flags its spectrum STAR_BAD, or GALAH's stellar-parameter flag is
 * not 0, the value GALAH DR3 recommends (Buder et al. 2021, MNRAS 506, 150). */
import { requireString } from '@cssearth/core';
import { VIZIER_ASU, type Archive } from './archives.mts';

export const K2 = { source: 'J/A+A/677/A21/k2_apo', paper: 'https://doi.org/10.1051/0004-6361/202346196', credit: 'Khan et al. (2023), A&A 677, A21' };
const SHARED = ['GaiaEDR3', 'Mass-M', 'b_Mass-M', 'B_Mass-M', 'Rad-M', 'b_Rad-M', 'B_Rad-M', 'Rad-E', 'b_Rad-E', 'B_Rad-E', 'Dist-M', 'b_Dist-M', 'B_Dist-M', 'AV-M'] as const;
/** Each table's identifier, spectroscopic temperature and quality flag. */
const TABLES = {
  k2_apo: { key: 'K2-ID', mission: 'K2', spectra: 'APOGEE', release: 'APOGEE DR17', teff: 'Teff-A', error: 'e_Tefffin-A', flag: 'Flags-A' },
  k2_gal: { key: 'K2-ID', mission: 'K2', spectra: 'GALAH', release: 'GALAH DR3', teff: 'Teff-G', error: 'Tefffin-G', flag: 'Flagsp-G' },
  tess_apo: { key: 'TIC', mission: 'TESS', spectra: 'APOGEE', release: 'APOGEE DR17', teff: 'Teff-A', error: 'e_Tefffin-A', flag: 'Flags-A' },
} as const;
type Table = keyof typeof TABLES;
const columns = (table: Table) => { const { key, teff, error, flag } = TABLES[table]; return [key, ...key === 'K2-ID' ? ['K2-camp'] : [], teff, error, flag, ...SHARED]; };
const label = (table: Table, id: string) => `${TABLES[table].key === 'TIC' ? 'TIC' : 'EPIC'} ${id}`;

/** The rows of `tsv` that belong to the star: a K2 identifier carries its campaign after the EPIC number. */
function matching(tsv: string, table: Table, id: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [], at = header.indexOf(TABLES[table].key);
  const rows = lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => TABLES[table].key === 'TIC' ? row[at] === id : row[at]?.startsWith(`KTWO${id}-`));
  return { header, rows };
}

/** The catalogue row of one star, as VizieR serves it; an EPIC number is read from k2_apo unless the table is named. */
export function parseK2Row(tsv: string, id: string, table: Table = 'k2_apo') {
  const { header, rows } = matching(tsv, table, id), name = label(table, id), { key, teff, error, flag, spectra } = TABLES[table];
  if (rows.length !== 1) throw new Error(`${K2.credit} ${table} has ${rows.length} rows for ${name}, not one${rows.length ? ` (${rows.map(row => row[header.indexOf(key)]).join(', ')})` : ''}.`);
  const cell = (column: string) => rows[0]![header.indexOf(column)] ?? '';
  const value = (column: string) => { const number = Number(cell(column)); if (!cell(column) || !Number.isFinite(number) || number <= -99) throw new Error(`${K2.credit} ${name}: ${column} is empty.`); return number; };
  if (spectra === 'APOGEE' && cell(flag).includes('STAR_BAD')) throw new Error(`${K2.credit} ${name}: APOGEE flags its spectrum STAR_BAD (${cell(flag)}).`);
  if (spectra === 'GALAH' && cell(flag) !== '0') throw new Error(`${K2.credit} ${name}: GALAH's stellar-parameter flag is ${cell(flag) || 'empty'}, not 0.`);
  const interval = (column: 'Mass-M' | 'Rad-M' | 'Rad-E' | 'Dist-M') => [value(column), value(`b_${column}`), value(`B_${column}`)] as const;
  const radius = interval('Rad-M'), elsworth = interval('Rad-E');
  const half = (range: readonly [number, number, number]) => (range[2] - range[1]) / 2;
  if (Math.abs(radius[0] - elsworth[0]) > Math.hypot(half(radius), half(elsworth))) throw new Error(`${K2.credit} ${name}: the two pipelines disagree on its radius, MA09 ${radius[0]} (${radius[1]}-${radius[2]}) and E20 ${elsworth[0]} (${elsworth[1]}-${elsworth[2]}) solar radii.`);
  return { table, id, campaign: key === 'K2-ID' ? Number(cell('K2-camp')) : undefined, gaia: requireString(cell('GaiaEDR3'), `${K2.credit} ${name} GaiaEDR3`), mass: interval('Mass-M'), radius,
    distance: interval('Dist-M'), teff: [value(teff), value(error)] as const, extinction: value('AV-M') };
}

export function draftFromK2(row: ReturnType<typeof parseK2Row>) {
  const { mission, spectra, release, teff } = TABLES[row.table], name = label(row.table, row.id);
  const seen = row.campaign === undefined ? `observed by ${mission}` : `K2 campaign ${row.campaign}`;
  const cite = ([median, low, high]: readonly [number, number, number], what: string, digits = 4) => ({ value: Number(median.toFixed(digits)), uncertainty: Number(((high - low) / 2).toFixed(digits)),
    source: `${K2.credit}, ${row.table}, ${name} (${seen}): ${what} ${median} (16th-84th percentiles ${low}-${high}), MA09 pipeline with ${release}`, url: K2.paper });
  const radius = cite(row.radius, 'PARAM radius (solar radii)'), mass = cite(row.mass, 'PARAM mass (solar masses)'), distance = cite(row.distance, 'PARAM asteroseismic distance (pc)', 1);
  const id = name.toLowerCase().replace(' ', '-');
  return {
    id, name, system: `${name} system`, parent: 'milky-way', target: name, gaia: row.gaia,
    description: `A red giant ${row.campaign === undefined ? `observed by ${mission}` : `in K2 campaign ${row.campaign}`}, ${radius.value.toFixed(1)} solar radii and ${mass.value.toFixed(2)} solar masses, weighed by its oscillations.`,
    paper: { url: K2.paper, credit: K2.credit },
    radius, mass, distance,
    temperature: { value: Math.round(row.teff[0]), uncertainty: row.teff[1], source: `${K2.credit}, ${row.table}, ${name}: ${release} effective temperature ${row.teff[0]} +/- ${row.teff[1]} K (the catalogue's final uncertainty)`, url: K2.paper },
    // The reader text is the catalogue row in words, cited to it; nothing the row does not hold.
    text: { card: `A red giant ${Math.round(distance.value).toLocaleString('en-US')} parsecs away, ${radius.value.toFixed(0)} times the Sun's width, weighed by its starquakes.`,
      introduction: `Its oscillations, recorded ${row.campaign === undefined ? `by ${mission}` : `in K2 campaign ${row.campaign}`}, give ${mass.value.toFixed(2)} solar masses and ${radius.value.toFixed(1)} solar radii; ${spectra} spectra give ${Math.round(row.teff[0]).toLocaleString('en-US')} K at its surface.`,
      locator: `${row.table}, ${name}: Mass-M, Rad-M, Dist-M, ${teff}` },
    color: { skip: ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'],
      reason: `PARAM fits an extinction A_V = ${row.extinction.toFixed(2)} mag toward this star (${K2.credit}, ${row.table}, AV-M), and the color routes do not remove extinction; ${spectra} measured its temperature` },
    planets: [], companions: [],
  };
}

const request = (archive: Archive, table: Table, id: string) => archive.text(VIZIER_ASU, { '-source': `J/A+A/677/A21/${table}`,
  [TABLES[table].key]: TABLES[table].key === 'TIC' ? `=${id}` : `KTWO${id}*`, '-out': columns(table).join(','), '-out.max': '5' });

/** `new-object --from-k2 EPIC... --out spec.json`: the K2 + APOGEE row, else the K2 + GALAH row when APOGEE did not observe the star. */
export async function draftsFromK2(epics: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const epic of epics.map(value => value.replace(/^EPIC\s*/iu, '').trim())) {
    if (!/^\d{9}$/u.test(epic)) throw new Error(`${K2.credit} is read by nine-digit EPIC number, not ${epic}.`);
    const apogee = await request(archive, 'k2_apo', epic);
    const table: Table = matching(apogee, 'k2_apo', epic).rows.length ? 'k2_apo' : 'k2_gal';
    stars.push(draftFromK2(parseK2Row(table === 'k2_apo' ? apogee : await request(archive, table, epic), epic, table)));
    report.push(`EPIC ${epic}: drafted from ${K2.credit} (${table}); placed at its asteroseismic distance.`);
  }
  return { stars, report };
}

/** `new-object --from-tess TIC... --out spec.json`: the TESS + APOGEE row. */
export async function draftsFromTess(tics: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const tic of tics.map(value => value.replace(/^TIC\s*/iu, '').trim())) {
    if (!/^\d{1,10}$/u.test(tic)) throw new Error(`${K2.credit} tess_apo is read by TIC number, not ${tic}.`);
    stars.push(draftFromK2(parseK2Row(await request(archive, 'tess_apo', tic), tic, 'tess_apo')));
    report.push(`TIC ${tic}: drafted from ${K2.credit} (tess_apo); placed at its asteroseismic distance.`);
  }
  return { stars, report };
}
