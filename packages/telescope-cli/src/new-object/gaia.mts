/** A draft spec for a star from Gaia DR3 alone, anywhere on the sky: radius and mass from FLAME (Creevey et al. 2023, A&A 674,
 * A26), the effective temperature FLAME itself used from GSP-Phot (Andrae et al. 2023, A&A 674, A27), and the source's
 * parallax, which places it. One Gaia Archive request per star (gaiadr3.gaia_source joined to astrophysical_parameters).
 *
 * A star is drafted only when the archive's own flags vouch for that chain:
 * - flags_flame is "00" or "10": FLAME derived its parameters from the parallax (second digit 0), the parallax the generator
 *   places the star by, and a mass exists (first digit 0, or 1 for a giant, whose mass the documentation gives a 20-30%
 *   uncertainty). Gaia DR3 documentation, astrophysical_parameters data model, flags_flame.
 * - RUWE below 1.4, the single-star astrometry threshold of Lindegren's technical note that defines RUWE
 *   (GAIA-C3-TN-LU-LL-124, "Re-normalising the astrometric chi-square in Gaia DR2").
 * - A parallax of at least five standard errors, the generator's own floor (PARALLAX_FLOOR_SIGMA).
 *
 * The color is the Planck spectrum at the GSP-Phot temperature: GSP-Phot's extinction says how much dust reddens the
 * spectrum, and the color routes do not remove it. */
import { GAIA_TAP, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from './display-name.mts';

export const GAIA_FLAME = { paper: 'https://doi.org/10.1051/0004-6361/202243688', credit: 'Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)' };
export const GAIA_GSPPHOT = { paper: 'https://doi.org/10.1051/0004-6361/202243462', credit: 'Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot)' };
const DRAFTED_FLAGS = new Set(['00', '10']);
const RUWE_LIMIT = 1.4, PARALLAX_SIGMA = 5;
const COLUMNS = ['source_id', 'parallax', 'parallax_error', 'ruwe', 'flags_flame', 'radius_flame', 'mass_flame', 'teff_gspphot', 'teff_gspphot_lower', 'teff_gspphot_upper', 'ag_gspphot'] as const;
export const gaiaDraftQuery = (sourceId: string) => `SELECT s.source_id, s.parallax, s.parallax_error, s.ruwe, a.flags_flame, a.radius_flame, a.mass_flame, a.teff_gspphot, a.teff_gspphot_lower, a.teff_gspphot_upper, a.ag_gspphot FROM gaiadr3.gaia_source AS s JOIN gaiadr3.astrophysical_parameters AS a ON a.source_id = s.source_id WHERE s.source_id = ${sourceId}`;

/** The archive row of one source, as the Gaia Archive's CSV serves it. */
export function parseGaiaDraftRow(csv: string, sourceId: string) {
  const [header, ...rows] = csv.trim().split('\n').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/gu, '')));
  const matching = rows.filter(row => row[header!.indexOf('source_id')] === sourceId);
  if (matching.length !== 1) throw new Error(`Gaia DR3 ${sourceId}: the archive returned ${matching.length} rows with astrophysical parameters, not one.`);
  const cell = (column: typeof COLUMNS[number]) => matching[0]![header!.indexOf(column)] ?? '';
  const value = (column: typeof COLUMNS[number]) => { const number = Number(cell(column)); if (!cell(column) || !Number.isFinite(number)) throw new Error(`Gaia DR3 ${sourceId}: ${column} is empty.`); return number; };
  const flags = cell('flags_flame');
  if (!DRAFTED_FLAGS.has(flags)) throw new Error(`Gaia DR3 ${sourceId}: flags_flame is ${flags || 'empty'}; only 00 and 10 (parameters from the parallax, a mass given) are drafted.`);
  const ruwe = value('ruwe'), parallax = value('parallax'), parallaxError = value('parallax_error');
  if (!(ruwe < RUWE_LIMIT)) throw new Error(`Gaia DR3 ${sourceId}: RUWE ${ruwe} is not below ${RUWE_LIMIT}.`);
  if (!(parallax >= PARALLAX_SIGMA * parallaxError)) throw new Error(`Gaia DR3 ${sourceId}: parallax ${parallax} +/- ${parallaxError} mas is under ${PARALLAX_SIGMA} standard errors.`);
  return { sourceId, flags, ruwe, parallax, radius: value('radius_flame'), mass: value('mass_flame'),
    teff: [value('teff_gspphot'), value('teff_gspphot_lower'), value('teff_gspphot_upper')] as const, extinction: value('ag_gspphot') };
}

export function draftFromGaia(row: ReturnType<typeof parseGaiaDraftRow>) {
  const name = `Gaia DR3 ${row.sourceId}`, [teff, low, high] = row.teff;
  // About, because the parallax is inverted as it stands; the generator places the star by the same parallax.
  const parsecs = Math.round(1000 / row.parallax / 100) * 100;
  return {
    id: `gaia-dr3-${row.sourceId}`, name, system: `${name} system`, parent: 'milky-way', target: name, gaia: row.sourceId,
    description: `A star ${row.radius.toFixed(1)} solar radii and ${row.mass.toFixed(2)} solar masses, about ${parsecs.toLocaleString('en-US')} parsecs away, measured by Gaia.`,
    paper: { url: GAIA_FLAME.paper, credit: GAIA_FLAME.credit },
    radius: 'gaia-flame', mass: 'gaia-flame',
    temperature: { value: Math.round(teff), uncertainty: Number(((high - low) / 2).toFixed(1)),
      source: `${GAIA_GSPPHOT.credit}, astrophysical_parameters of ${name}: teff_gspphot ${teff} K (16th-84th percentiles ${low}-${high}), the temperature FLAME used`, url: GAIA_GSPPHOT.paper },
    // The reader text is the archive row in words, cited to it; nothing the row does not hold.
    text: { card: `A star about ${parsecs.toLocaleString('en-US')} parsecs away, ${row.radius.toFixed(0)} times the Sun's width, measured by Gaia.`,
      introduction: `Gaia's parallax, brightness and spectrum give it ${row.radius.toFixed(1)} solar radii and ${row.mass.toFixed(2)} solar masses (FLAME) and ${Math.round(teff).toLocaleString('en-US')} K at its surface (GSP-Phot).`,
      locator: `gaiadr3.astrophysical_parameters, ${name}: radius_flame, mass_flame, teff_gspphot` },
    color: { skip: ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'],
      reason: `GSP-Phot fits an extinction A_G = ${row.extinction.toFixed(2)} mag toward this star (${GAIA_GSPPHOT.credit}, ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature` },
    planets: [], companions: [],
  };
}

/** `new-object --from-gaia SOURCE_ID... --out spec.json`. */
export async function draftsFromGaia(sourceIds: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const sourceId of sourceIds.map(value => value.replace(/^Gaia\s*DR3\s*/iu, '').trim())) {
    if (!/^\d{6,20}$/u.test(sourceId)) throw new Error(`Gaia DR3 drafts are read by source_id, not ${sourceId}.`);
    const csv = await archive.text(GAIA_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: gaiaDraftQuery(sourceId) });
    const draft = draftFromGaia(parseGaiaDraftRow(csv, sourceId)), gaiaName = draft.name;
    // A star SIMBAD knows by a designation that reads as a name takes it (display-name.mts); its Gaia number becomes an alias.
    const preferred = preferredName(await simbadIdentifiers(archive, gaiaName));
    stars.push(preferred ? { ...draft, name: preferred.name, system: `${preferred.name} system`, aliases: [gaiaName] } : draft);
    report.push(`Gaia DR3 ${sourceId}: drafted from ${GAIA_FLAME.credit} and ${GAIA_GSPPHOT.credit}; placed by its parallax${preferred ? `; named ${preferred.name}, as SIMBAD lists it (${preferred.identifier})` : ''}.`);
  }
  return { stars, report };
}
