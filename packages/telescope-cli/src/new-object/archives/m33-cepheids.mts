/** Draft specs for the 154 Cepheids of the Triangulum Galaxy (M33) the Hubble Space Telescope measured for its distance (Breuval
 * et al. 2023, ApJ 951, 118; arXiv:2304.00037; VizieR J/ApJ/951/118/table9: ID, position, log period, sample). Each is placed by its
 * row in the galaxy as the app draws it (m31-cepheids.mts discPlacement), with the galaxy's radial velocity from SIMBAD; radius and temperature are what
 * Groenewegen's (2020) period relations give at its period, as for the Cepheids of M31 (m31-cepheids.mts) and of the SH0ES galaxies.
 *
 * The table's ID is the star's name in the M33 Synoptic Stellar Survey (Pellerin & Macri 2011), whose light curves gave the periods:
 * "01334390+3032452" is "M33SSS J013343.90+303245.2", as SIMBAD lists it. The longest-period Cepheid of the Gold sample is featured. */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from '../names/display-name.mts';
import { draftGalaxyCepheid, galaxyDisc, vizierRows, type CepheidGalaxy } from './m31-cepheids.mts';
import { galaxyVelocity } from './sh0es.mts';

export const BREUVAL_2023 = { catalogue: 'J/ApJ/951/118/table9', credit: 'Breuval et al. (2023), ApJ 951, 118', paper: 'https://arxiv.org/abs/2304.00037',
  /** The abstract's distance modulus of M33 from these Cepheids, mu = 24.622 +/- 0.030 mag (840 +/- 11 kpc). */
  modulus: [24.622, 0.030] as const };
export const M33: CepheidGalaxy = { name: 'M33', objectId: 'm33', reader: 'the Triangulum Galaxy', distance: BREUVAL_2023 };
const COLUMNS = ['ID', 'RAJ2000', 'DEJ2000', 'logP', 'Set'] as const;

/** The table's ID (HHMMSSss+DDMMSSs) as the survey and SIMBAD write the name. */
export function surveyName(id: string) {
  const match = /^(\d{6})(\d{2})([+-]\d{6})(\d)$/u.exec(id);
  if (!match) throw new TypeError(`${id} is not an ID as ${BREUVAL_2023.catalogue} writes it (01334390+3032452).`);
  return `M33SSS J${match[1]}.${match[2]}${match[3]}.${match[4]}`;
}

/** `new-object --from-m33cepheids all | ID... --out spec.json`: every Cepheid of the table, or those named by its ID. */
export async function draftsFromM33Cepheids(names: readonly string[], archive: Archive, root: string) {
  const all = names.includes('all'), wanted = names.filter(name => name !== 'all');
  const table = vizierRows(await archive.text(VIZIER_ASU, { '-source': BREUVAL_2023.catalogue, '-out': COLUMNS.join(','), '-out.max': '999' }), COLUMNS, BREUVAL_2023.catalogue);
  const absent = wanted.filter(name => !table.some(row => row.ID === name));
  if (absent.length) throw new Error(`${BREUVAL_2023.catalogue} has no Cepheid ${absent.join(', ')}; ids are written as the table writes them (01334390+3032452).`);
  const logP = (row: typeof table[number]) => { const value = Number(row.logP); if (!row.logP || !Number.isFinite(value)) throw new Error(`${BREUVAL_2023.catalogue} ${row.ID}: logP is empty.`); return value; };
  // Featured: the longest period of the Gold sample, the largest star by the relation; decided on the whole table, whichever rows are drafted.
  const featured = table.filter(row => row.Set === 'G').reduce((longest, row) => logP(row) > logP(longest) ? row : longest).ID;
  const stars: Record<string, unknown>[] = [], velocity = await galaxyVelocity(archive, M33.name), placed = await galaxyDisc(root, M33);
  for (const row of table.filter(candidate => all || wanted.includes(candidate.ID!))) {
    const survey = surveyName(row.ID!), preferred = preferredName(await simbadIdentifiers(archive, survey)), name = preferred?.name ?? survey;
    // log P is given to a thousandth, 0.1% of the period: four significant figures of days.
    const days = Number((10 ** logP(row)).toPrecision(4));
    stars.push(draftGalaxyCepheid({ name, target: survey, raDeg: Number(row.RAJ2000), decDeg: Number(row.DEJ2000), periodDays: days, periodSource: `${BREUVAL_2023.credit}, table 9 (log P ${row.logP})`, paper: { url: BREUVAL_2023.paper, credit: BREUVAL_2023.credit },
      position: { catalogue: BREUVAL_2023.catalogue, row: { ID: row.ID! }, credit: `${BREUVAL_2023.credit}, table 9`, url: BREUVAL_2023.paper },
      aliases: name === survey ? [] : [survey], ...(row.ID === featured ? { featured: true as const } : {}),
      found: `The Hubble Space Telescope measured its brightness in three colors; its pulsation takes ${days.toFixed(days < 10 ? 2 : 1)} days.`,
      locator: `table 9, ID ${row.ID}: logP; ${BREUVAL_2023.credit}: mu` }, M33, placed, velocity));
  }
  return { stars, report: [`${stars.length} Cepheid${stars.length === 1 ? '' : 's'} of ${BREUVAL_2023.credit} in M33; radius and temperature from Groenewegen (2020)'s period relations.`] };
}
