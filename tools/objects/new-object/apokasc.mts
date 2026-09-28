/** A draft spec for a red giant of the Kepler field from APOKASC-3 (Pinsonneault et al. 2025, ApJS 276, 69; arXiv:2410.00102): mass
 * and radius from its oscillations (the Mosser scale, the catalogue's recommended values), temperature from APOGEE spectra, and the
 * star's Gaia DR3 source, which places it. One VizieR request per star (J/ApJS/276/69, table4).
 *
 * Only the Gold and Silver categories are drafted: at least two measured large-frequency separations, not flagged as outliers. Any
 * other category, or a value the catalogue leaves empty (-9999), is refused with the star's KIC number and the reason. */
import { requireString } from '@cssearth/core';
import { VIZIER_ASU, type Archive } from './archives.mts';

export const APOKASC = { source: 'J/ApJS/276/69/table4', paper: 'https://arxiv.org/abs/2410.00102', credit: 'Pinsonneault et al. (2025), ApJS 276, 69 (APOKASC-3)' };
const COLUMNS = ['KIC', 'CatTab', 'EvolSt', 'Mass', 'e_Mass', 'Radius', 'e_Radius', 'Teff', 'e_Teff', 'loggSeis', 'e_loggSeis', 'GaiaDR3'] as const;
const DRAFTED = new Set(['Gold', 'Silver']);
const STATE: Readonly<Record<string, string>> = { RGB: 'a red giant climbing its first giant branch', RC: 'a red-clump giant burning helium in its core', 'RC/RGB': 'a red giant (red clump or first giant branch)' };

/** The catalogue row of one KIC number, as VizieR serves it. */
export function parseApokascRow(tsv: string, kic: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [], rows = lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row[0] === kic);
  if (rows.length !== 1) throw new Error(`APOKASC-3 has ${rows.length} rows for KIC ${kic}, not one.`);
  const cell = (name: typeof COLUMNS[number]) => rows[0]![header.indexOf(name)] ?? '';
  const category = cell('CatTab');
  if (!DRAFTED.has(category)) throw new Error(`APOKASC-3 KIC ${kic} is in category ${category}; only Gold and Silver asteroseismic values are drafted.`);
  const value = (name: typeof COLUMNS[number]) => { const number = Number(cell(name)); if (!cell(name) || !Number.isFinite(number) || number === -9999) throw new Error(`APOKASC-3 KIC ${kic}: ${name} is empty.`); return number; };
  return { kic, category, state: cell('EvolSt'), gaia: requireString(cell('GaiaDR3'), `APOKASC-3 KIC ${kic} GaiaDR3`), mass: [value('Mass'), value('e_Mass')] as const,
    radius: [value('Radius'), value('e_Radius')] as const, teff: [value('Teff'), value('e_Teff')] as const, logg: [value('loggSeis'), value('e_loggSeis')] as const };
}

export function draftFromApokasc(row: ReturnType<typeof parseApokascRow>) {
  const cite = ([value, uncertainty]: readonly [number, number], what: string) => ({ value: Number(value.toFixed(4)), uncertainty: Number(uncertainty.toFixed(4)),
    source: `${APOKASC.credit}, table4, KIC ${row.kic} (${row.category}): ${what} ${value} +/- ${uncertainty}`, url: APOKASC.paper });
  const radius = cite(row.radius, 'Radius (Mosser scale, solar radii)'), mass = cite(row.mass, 'Mass (Mosser scale, solar masses)');
  return {
    id: `kic-${row.kic}`, name: `KIC ${row.kic}`, system: `KIC ${row.kic} system`, target: `KIC ${row.kic}`, gaia: row.gaia,
    description: `${STATE[row.state] ?? 'A giant'} in the Kepler field, ${radius.value.toFixed(1)} solar radii and ${mass.value.toFixed(2)} solar masses, weighed by its oscillations.`.replace(/^./u, letter => letter.toUpperCase()),
    paper: { url: APOKASC.paper, credit: APOKASC.credit },
    radius, mass, temperature: { ...cite(row.teff, 'APOGEE effective temperature (K)'), value: Math.round(row.teff[0]), uncertainty: Math.round(row.teff[1]) },
    gravity: cite(row.logg, 'Asteroseismic log g'), planets: [], companions: [],
  };
}

/** `new-object --from-apokasc KIC... --out spec.json`. */
export async function draftsFromApokasc(kics: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const kic of kics.map(value => value.replace(/^KIC\s*/iu, '').trim())) {
    if (!/^\d{3,9}$/u.test(kic)) throw new Error(`APOKASC-3 is read by KIC number, not ${kic}.`);
    const tsv = await archive.text(VIZIER_ASU, { '-source': APOKASC.source, KIC: `=${kic}`, '-out': COLUMNS.join(','), '-out.max': '5' });
    stars.push(draftFromApokasc(parseApokascRow(tsv, kic)));
    report.push(`KIC ${kic}: drafted from ${APOKASC.credit}; Gaia DR3 places it when its parallax reaches the floor, else add distance.`);
  }
  return { stars, report };
}
