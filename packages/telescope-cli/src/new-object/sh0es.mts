/** Draft specs for the Cepheids Hubble found one by one in the SH0ES galaxies, 7 to 40 Mpc away, from Hoffmann et al. (2016, ApJ 830,
 * 10; arXiv:1607.08658), table 5 (VizieR J/ApJ/830/10/table5): each star's J2000 position, period, and HST F555W and F814W magnitudes.
 * Gaia cannot see them (25th magnitude), so each is placed by its catalogue row (spec `position`), at its galaxy's Cepheid distance from
 * Riess et al. (2016), with its galaxy's radial velocity from SIMBAD.
 *
 * No paper measures the radius, temperature or mass of any one of these stars. The draft gives the radius and temperature that
 * Groenewegen's (2020) period relations for Galactic Cepheids give at the star's measured period, and says so wherever they appear;
 * the mass stays unmeasured, as for the Galactic Cepheids (cepheids.mts). */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { adql, csv, SIMBAD_TAP } from './companions.mts';
import { CEPHEID_GRAVITIES } from './cepheids.mts';

export const HOFFMANN = { catalogue: 'J/ApJ/830/10/table5', credit: 'Hoffmann et al. (2016), ApJ 830, 10', paper: 'https://arxiv.org/abs/1607.08658' };
const COLUMNS = ['Gal', 'RAJ2000', 'DEJ2000', 'ID', 'Per', 'F555W', 'F814W', 'SimbadName'] as const;

/** Riess et al. (2016), ApJ 826, 56 (arXiv:1604.01424), table 5, "Approximations for Distance Parameters", column mu_Ceph: each host's
 * distance modulus from its Cepheids, with its supernova left out of the fit, and its error, in mag. VizieR J/ApJ/826/56 does not carry
 * table 5, so the 19 rows are transcribed from the paper's source. NGC 4258, the maser anchor, is not a row. */
export const RIESS_2016_HOSTS: Readonly<Record<string, readonly [number, number]>> = {
  M101: [29.135, 0.045], N1015: [32.497, 0.081], N1309: [32.523, 0.055], N1365: [31.307, 0.057], N1448: [31.311, 0.045], N2442: [31.511, 0.053],
  N3021: [32.498, 0.090], N3370: [32.072, 0.049], N3447: [31.908, 0.043], N3972: [31.587, 0.070], N3982: [31.737, 0.069], N4038: [31.290, 0.112],
  N4424: [31.080, 0.292], N4536: [30.906, 0.053], N4639: [31.532, 0.071], N5584: [31.786, 0.046], N5917: [32.263, 0.102], N7250: [31.499, 0.078],
  U9391: [32.919, 0.063],
};
export const RIESS_2016 = { credit: 'Riess et al. (2016), ApJ 826, 56', url: 'https://arxiv.org/abs/1604.01424' };

/** Groenewegen (2020), A&A 635, A33 (arXiv:2002.02186), Sect. "Period-luminosity and period-radius relations": fits to the SED
 * luminosities and radii of Galactic fundamental-mode Cepheids. Eq. 1: M_bol = -2.95 log P - 0.98 (380 stars, rms 0.40 mag); eq. 2:
 * log R = 0.721 log P + 1.083 (372 stars, rms 0.067 dex). The longest period among the stars they fit is S Vul's, 68.464 d (VizieR
 * J/A+A/635/A33 table1). */
export const GROENEWEGEN_2020 = { credit: 'Groenewegen (2020), A&A 635, A33', url: 'https://arxiv.org/abs/2002.02186', radiusRmsDex: 0.067, longestPeriodDays: 68.464,
  /** The two relations together miss the paper's own SED temperatures of its 376 fundamental-mode Cepheids (4,000 to 7,000 K, under
   * 50,000 solar luminosities, the paper's selection) by +10 K on average with an rms of 317 K, computed 2026-09-30 from VizieR
   * J/A+A/635/A33 table1 (Period, Lum, Teff). A distance error moves a star's luminosity and radius together and leaves this
   * temperature alone. */
  temperatureRmsK: 317 };
/** The IAU 2015 nominal Sun (Resolution B2: M_bol = 4.74; Resolution B3: T_eff = 5772 K), which turns eq. 1 into a luminosity. */
const IAU_SUN = { bolometricMagnitude: 4.74, temperatureK: 5772, sources: 'IAU 2015 Resolutions B2 (Mamajek et al. 2015, arXiv:1510.06262) and B3 (Prsa et al. 2016, arXiv:1605.09788)' };

/** The radius and temperature Groenewegen's relations give at a period in days: R from eq. 2, L from eq. 1, T from L = 4 pi R^2 sigma T^4. */
export function cepheidRelations(periodDays: number) {
  const logP = Math.log10(periodDays), radius = 10 ** (0.721 * logP + 1.083), luminosity = 10 ** ((IAU_SUN.bolometricMagnitude - (-2.95 * logP - 0.98)) / 2.5);
  return { radius, luminosity, temperature: IAU_SUN.temperatureK * (luminosity / radius ** 2) ** 0.25 };
}

/** A host as the tables write it (N4536, M101, U9391), as SIMBAD and a reader name it. */
export function hostName(host: string) {
  const match = /^([NMU])(\d+)$/u.exec(host);
  if (!match) throw new TypeError(`${host} is not a host as Hoffmann et al. (2016) table 5 writes it (N4536, M101, U9391).`);
  return `${{ N: 'NGC', M: 'M', U: 'UGC' }[match[1] as 'N' | 'M' | 'U']} ${match[2]}`;
}

export interface HoffmannRow { readonly host: string; readonly id: string; readonly ra: number; readonly dec: number; readonly periodDays: number; readonly v: number; readonly i: number; readonly simbad: string }
export function parseHoffmannRows(tsv: string): HoffmannRow[] {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [], missing = COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new Error(`${HOFFMANN.catalogue}: the response has no ${missing.join(', ')} column.`);
  return lines.slice(3).map(line => {
    const cells = line.split('\t').map(cell => cell.trim()), cell = (column: typeof COLUMNS[number]) => cells[header.indexOf(column)] ?? '';
    const number = (column: typeof COLUMNS[number]) => { const value = Number(cell(column)); if (!cell(column) || !Number.isFinite(value)) throw new Error(`${HOFFMANN.catalogue} ${cell('Gal')} ${cell('ID')}: ${column} is empty.`); return value; };
    return { host: cell('Gal'), id: cell('ID'), ra: number('RAJ2000'), dec: number('DEJ2000'), periodDays: number('Per'), v: number('F555W'), i: number('F814W'), simbad: cell('SimbadName').replace(/\s+/gu, ' ') };
  });
}

/** A galaxy's radial velocity from SIMBAD, cited to the paper SIMBAD names. */
export async function galaxyVelocity(archive: Archive, name: string) {
  const [row] = csv(await archive.text(SIMBAD_TAP, adql(`SELECT b.rvz_radvel, b.rvz_err, b.rvz_bibcode FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = '${name}'`)));
  if (!row?.rvz_radvel || !row.rvz_bibcode) throw new Error(`SIMBAD gives ${name} no radial velocity; cite one for its Cepheids.`);
  return { value: Number(row.rvz_radvel), ...(Number(row.rvz_err) > 0 ? { uncertainty: Number(row.rvz_err) } : {}),
    source: `SIMBAD's radial velocity of ${name}, the Cepheid's galaxy, from ${row.rvz_bibcode}; the star's own motion within the galaxy is not measured`, url: `https://ui.adsabs.harvard.edu/abs/${row.rvz_bibcode}/abstract` };
}

/** What a Cepheid placed by a catalogue row needs beside its period: who it is, where its row is, and its galaxy's distance and velocity. */
export interface RelationCepheid {
  readonly id: string; readonly name: string; readonly target: string; readonly galaxy: string; readonly periodDays: number;
  /** The galaxy's object, which the star is inside (the spec's `parent`). */
  readonly inside: string;
  readonly paper: { readonly url: string; readonly credit: string }; readonly periodSource: string;
  readonly position: { readonly catalogue: string; readonly row: Readonly<Record<string, string>>; readonly credit: string; readonly url: string };
  readonly distance: { readonly value: number; readonly uncertainty?: number; readonly source: string; readonly url: string };
  readonly velocity: { readonly value: number; readonly uncertainty?: number; readonly source: string; readonly url: string };
  readonly description: string; readonly text: { readonly card: string; readonly introduction: string; readonly locator: string };
}
/** The draft of a Cepheid no paper sizes: radius and temperature from Groenewegen's relations at its period, mass unmeasured. */
export function relationCepheidDraft(star: RelationCepheid) {
  const { radius, temperature } = cepheidRelations(star.periodDays);
  const relation = `${GROENEWEGEN_2020.credit}, period relations for Galactic fundamental-mode Cepheids applied to this star's period, ${star.periodDays} d in ${star.periodSource}; not a measurement of this star`;
  return {
    id: star.id, name: star.name, system: `${star.name} system`, parent: star.inside, target: star.target, paper: star.paper, description: star.description,
    position: star.position, distance: star.distance, radialVelocity: star.velocity,
    radius: { value: Number(radius.toFixed(1)), uncertainty: Number((radius * (10 ** GROENEWEGEN_2020.radiusRmsDex - 1)).toFixed(1)),
      source: `${relation}: eq. 2, log R = 0.721 log P + 1.083; the uncertainty is the relation's scatter, ${GROENEWEGEN_2020.radiusRmsDex} dex`, url: GROENEWEGEN_2020.url },
    temperature: { value: Math.round(temperature / 10) * 10, uncertainty: GROENEWEGEN_2020.temperatureRmsK,
      source: `${relation}: the luminosity of eq. 1 (M_bol = -2.95 log P - 0.98, with the nominal solar M_bol 4.74) over the radius of eq. 2, through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (${IAU_SUN.sources}); the uncertainty is the ${GROENEWEGEN_2020.temperatureRmsK} K by which the two relations miss the paper's own Cepheid temperatures`, url: GROENEWEGEN_2020.url },
    mass: 'unmeasured' as const, gravityRange: CEPHEID_GRAVITIES, text: star.text,
    planets: [], companions: [],
    notes: ['The star pulsates; it is drawn at its mean radius',
      `Its radius and temperature are what ${GROENEWEGEN_2020.credit}'s relations for Galactic Cepheids give at its period; no measurement of this star's size or temperature exists`,
      ...star.periodDays > GROENEWEGEN_2020.longestPeriodDays ? [`Its period, ${star.periodDays} d, is longer than any in the relations' sample (${GROENEWEGEN_2020.longestPeriodDays} d), so they are extrapolated`] : [],
      `Its radial velocity is its galaxy's; its own motion within ${star.galaxy} is not measured`],
  };
}

export function draftFromHoffmann(row: HoffmannRow, velocity: { value: number; uncertainty?: number; source: string; url: string }) {
  const distance = RIESS_2016_HOSTS[row.host];
  if (!distance) throw new Error(`${row.host} ${row.id}: Riess et al. (2016) table 5 gives ${hostName(row.host)} no Cepheid distance${row.host === 'N4258' ? ' (it is the maser anchor)' : ''}.`);
  const galaxy = hostName(row.host), [modulus, error] = distance, parsecs = 10 ** (modulus / 5 + 1);
  const period = row.periodDays.toFixed(row.periodDays < 10 ? 2 : 1), id = `${galaxy.toLowerCase().replace(/\s+/gu, '-')}-cepheid-${row.id}`, name = `${galaxy} Cepheid ${row.id}`;
  return relationCepheidDraft({
    id, name, target: row.simbad, galaxy, inside: galaxy.toLowerCase().replace(/\s+/gu, '-'), periodDays: row.periodDays, paper: { url: HOFFMANN.paper, credit: HOFFMANN.credit }, periodSource: `${HOFFMANN.credit}, table 5`,
    description: `A Cepheid in the galaxy ${galaxy} that pulsates every ${period} days, found by the Hubble Space Telescope.`,
    position: { catalogue: HOFFMANN.catalogue, row: { Gal: row.host, ID: row.id }, credit: `${HOFFMANN.credit}, table 5`, url: HOFFMANN.paper },
    distance: { value: Math.round(parsecs), uncertainty: Math.round(parsecs * Math.LN10 / 5 * error),
      source: `${RIESS_2016.credit}, table 5: ${galaxy}'s Cepheid distance modulus ${modulus} +/- ${error} mag, 10^(mu/5 + 1) pc`, url: RIESS_2016.url },
    velocity,
    text: { card: `A Cepheid in the galaxy ${galaxy}, ${Math.round(parsecs / 1e6)} million parsecs away, that swells and shrinks every ${period} days.`,
      introduction: `The Hubble Space Telescope found it and timed its pulsation at ${period} days. Its galaxy's distance, ${(parsecs / 1e6).toFixed(1)} million parsecs, was measured from Cepheids like it.`,
      locator: `table 5, Gal ${row.host}, ID ${row.id}: Per; ${RIESS_2016.credit}, table 5, ${row.host}: mu_Ceph` },
  });
}

/** `new-object --from-sh0es HOST[/ID]... --out spec.json`: every Cepheid of each host, or the one named. */
export async function draftsFromSh0es(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [], velocities = new Map<string, Awaited<ReturnType<typeof galaxyVelocity>>>();
  for (const name of names) {
    const [host, id] = name.split('/') as [string, string | undefined];
    const rows = parseHoffmannRows(await archive.text(VIZIER_ASU, { '-source': HOFFMANN.catalogue, '-out': COLUMNS.join(','), '-out.max': '9999', Gal: host, ...(id ? { ID: id } : {}) }))
      .filter(row => row.host === host && (!id || row.id === id));
    if (!rows.length) throw new Error(`${HOFFMANN.catalogue} has no Cepheid ${name}; hosts are written as the table writes them (N4536, M101).`);
    if (!velocities.has(host)) velocities.set(host, await galaxyVelocity(archive, hostName(host)));
    for (const row of rows) stars.push(draftFromHoffmann(row, velocities.get(host)!));
    const extrapolated = rows.filter(row => row.periodDays > GROENEWEGEN_2020.longestPeriodDays).length;
    report.push(`${name}: ${rows.length} Cepheid${rows.length === 1 ? '' : 's'} in ${hostName(host)}; radius and temperature from ${GROENEWEGEN_2020.credit}'s period relations${extrapolated ? `, extrapolated for ${extrapolated} with periods beyond ${GROENEWEGEN_2020.longestPeriodDays} d` : ''}.`);
  }
  return { stars, report };
}
