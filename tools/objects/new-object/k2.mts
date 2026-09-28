/** A draft spec for a red giant of a K2 field from Khan et al. (2023, A&A 677, A21; doi:10.1051/0004-6361/202346196), the K2 + APOGEE table: mass,
 * radius and distance from PARAM grid modelling of its oscillations (the Mosser & Appourchaux 2009 pipeline, MA09, as APOKASC-3's
 * Mosser scale), temperature from APOGEE DR17 spectra, and the star's Gaia source. One VizieR request per star (J/A+A/677/A21, k2_apo).
 *
 * K2 pointed along the ecliptic, so its fields reach far above and below the Galactic plane, where the Kepler field does not. The
 * distance is the catalogue's asteroseismic one: at thousands of parsecs a Gaia parallax is a few standard errors at best.
 *
 * PARAM gives each value as a median with 16th and 84th percentiles; the draft cites the median with half that interval. A star is
 * drafted only when the second pipeline (Elsworth et al. 2020, E20) gives a radius within the two pipelines' combined intervals, and
 * refused when APOGEE flags its spectrum STAR_BAD or the catalogue leaves a value empty (-99.9). */
import { requireString } from '@cssearth/core';
import { VIZIER_ASU, type Archive } from './archives.mts';

export const K2 = { source: 'J/A+A/677/A21/k2_apo', paper: 'https://doi.org/10.1051/0004-6361/202346196', credit: 'Khan et al. (2023), A&A 677, A21' };
const COLUMNS = ['K2-ID', 'K2-camp', 'GaiaEDR3', 'Teff-A', 'e_Tefffin-A', 'Mass-M', 'b_Mass-M', 'B_Mass-M', 'Rad-M', 'b_Rad-M', 'B_Rad-M',
  'Rad-E', 'b_Rad-E', 'B_Rad-E', 'Dist-M', 'b_Dist-M', 'B_Dist-M', 'AV-M', 'Flags-A'] as const;

/** The catalogue row of one EPIC number, as VizieR serves it. */
export function parseK2Row(tsv: string, epic: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  const rows = lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row[header.indexOf('K2-ID')]?.startsWith(`KTWO${epic}-`));
  if (rows.length !== 1) throw new Error(`${K2.credit} k2_apo has ${rows.length} rows for EPIC ${epic}, not one${rows.length ? ` (${rows.map(row => row[header.indexOf('K2-ID')]).join(', ')})` : ''}.`);
  const cell = (name: typeof COLUMNS[number]) => rows[0]![header.indexOf(name)] ?? '';
  const value = (name: typeof COLUMNS[number]) => { const number = Number(cell(name)); if (!cell(name) || !Number.isFinite(number) || number <= -99) throw new Error(`${K2.credit} EPIC ${epic}: ${name} is empty.`); return number; };
  if (cell('Flags-A').includes('STAR_BAD')) throw new Error(`${K2.credit} EPIC ${epic}: APOGEE flags its spectrum STAR_BAD (${cell('Flags-A')}).`);
  const interval = (column: 'Mass-M' | 'Rad-M' | 'Rad-E' | 'Dist-M') => [value(column), value(`b_${column}`), value(`B_${column}`)] as const;
  const radius = interval('Rad-M'), elsworth = interval('Rad-E');
  const half = (range: readonly [number, number, number]) => (range[2] - range[1]) / 2;
  if (Math.abs(radius[0] - elsworth[0]) > Math.hypot(half(radius), half(elsworth))) throw new Error(`${K2.credit} EPIC ${epic}: the two pipelines disagree on its radius, MA09 ${radius[0]} (${radius[1]}-${radius[2]}) and E20 ${elsworth[0]} (${elsworth[1]}-${elsworth[2]}) solar radii.`);
  return { epic, campaign: Number(cell('K2-camp')), gaia: requireString(cell('GaiaEDR3'), `${K2.credit} EPIC ${epic} GaiaEDR3`), mass: interval('Mass-M'), radius,
    distance: interval('Dist-M'), teff: [value('Teff-A'), value('e_Tefffin-A')] as const, extinction: value('AV-M') };
}

export function draftFromK2(row: ReturnType<typeof parseK2Row>) {
  const cite = ([median, low, high]: readonly [number, number, number], what: string, digits = 4) => ({ value: Number(median.toFixed(digits)), uncertainty: Number(((high - low) / 2).toFixed(digits)),
    source: `${K2.credit}, k2_apo, EPIC ${row.epic} (K2 campaign ${row.campaign}): ${what} ${median} (16th-84th percentiles ${low}-${high}), MA09 pipeline with APOGEE DR17`, url: K2.paper });
  const radius = cite(row.radius, 'PARAM radius (solar radii)'), mass = cite(row.mass, 'PARAM mass (solar masses)'), distance = cite(row.distance, 'PARAM asteroseismic distance (pc)', 1);
  return {
    id: `epic-${row.epic}`, name: `EPIC ${row.epic}`, system: `EPIC ${row.epic} system`, target: `EPIC ${row.epic}`, gaia: row.gaia,
    description: `A red giant in K2 campaign ${row.campaign}, ${radius.value.toFixed(1)} solar radii and ${mass.value.toFixed(2)} solar masses, weighed by its oscillations.`,
    paper: { url: K2.paper, credit: K2.credit },
    radius, mass, distance,
    temperature: { value: Math.round(row.teff[0]), uncertainty: row.teff[1], source: `${K2.credit}, k2_apo, EPIC ${row.epic}: APOGEE DR17 effective temperature ${row.teff[0]} +/- ${row.teff[1]} K (the catalogue's final uncertainty)`, url: K2.paper },
    // The reader text is the catalogue row in words, cited to it; nothing the row does not hold.
    text: { card: `A red giant ${Math.round(distance.value).toLocaleString('en-US')} parsecs away, ${radius.value.toFixed(0)} times the Sun's width, weighed by its starquakes.`,
      introduction: `Its oscillations, recorded in K2 campaign ${row.campaign}, give ${mass.value.toFixed(2)} solar masses and ${radius.value.toFixed(1)} solar radii; APOGEE spectra give ${Math.round(row.teff[0]).toLocaleString('en-US')} K at its surface.`,
      locator: `k2_apo, EPIC ${row.epic}: Mass-M, Rad-M, Dist-M, Teff-A` },
    color: { skip: ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'],
      reason: `PARAM fits an extinction A_V = ${row.extinction.toFixed(2)} mag toward this star (${K2.credit}, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature` },
    planets: [], companions: [],
  };
}

/** `new-object --from-k2 EPIC... --out spec.json`. */
export async function draftsFromK2(epics: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const epic of epics.map(value => value.replace(/^EPIC\s*/iu, '').trim())) {
    if (!/^\d{9}$/u.test(epic)) throw new Error(`${K2.credit} is read by nine-digit EPIC number, not ${epic}.`);
    const tsv = await archive.text(VIZIER_ASU, { '-source': K2.source, 'K2-ID': `KTWO${epic}*`, '-out': COLUMNS.join(','), '-out.max': '5' });
    stars.push(draftFromK2(parseK2Row(tsv, epic)));
    report.push(`EPIC ${epic}: drafted from ${K2.credit}; placed at its asteroseismic distance.`);
  }
  return { stars, report };
}
