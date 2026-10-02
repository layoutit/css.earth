/** Draft specs for Cepheids in the Andromeda Galaxy (M31): the 54 stars in the 55 rows the Hubble Space Telescope measured for the
 * galaxy's distance (Li et al. 2021, ApJ 920, 84; arXiv:2107.08029; VizieR J/ApJ/920/84/table2: position, period, sample) and Hubble's V1, the first
 * Cepheid found there (row 579568 of the PAndromeda sample, Kodric et al. 2018, AJ 156, 130; VizieR J/AJ/156/130/main).
 *
 * Each is placed by its catalogue row in the galaxy as the app draws it (discPlacement), with the galaxy's radial velocity from
 * SIMBAD; the Cepheid distance of M31 from Li et al. (2021) is what its text tells. As for the SH0ES Cepheids (sh0es.mts), no paper measures the radius, temperature or mass of any one of them: the draft
 * gives the radius and temperature Groenewegen's (2020) period relations give at the star's period, and says so. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageLayerDisc, imageLayerDiscDistanceKpc } from '@cssearth/bake/image-layers';
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from './display-name.mts';
import { slug } from './identity.mts';
import { galaxyVelocity, relationCepheidDraft } from './sh0es.mts';

export const LI_2021 = { catalogue: 'J/ApJ/920/84/table2', credit: 'Li et al. (2021), ApJ 920, 84', paper: 'https://arxiv.org/abs/2107.08029',
  /** The abstract's distance modulus of M31 from these 55 Cepheids, mu_0 = 24.407 +/- 0.032 mag (761 +/- 11 kpc). */
  modulus: [24.407, 0.032] as const };
export const KODRIC_2018 = { catalogue: 'J/AJ/156/130/main', credit: 'Kodric et al. (2018), AJ 156, 130', paper: 'https://ui.adsabs.harvard.edu/abs/2018AJ....156..130K' };
/** Hubble's first Cepheid in M31, by the name Templeton et al. (2011, PASP 123, 1374; arXiv:1111.0262) give it, "M31-V1", on its
 * PAndromeda row: PSO J010.3637+41.1696, 31.38 d, where they time it at 31.4 +/- 0.1 d. */
export const HUBBLE_V1 = { name: 'M31-V1', row: '579568', identification: { credit: 'Templeton et al. (2011), PASP 123, 1374', url: 'https://arxiv.org/abs/1111.0262' } };
const GALAXY = 'M31';

interface Row { readonly [column: string]: string }
/** The data rows of a VizieR tab-separated answer, by column name. */
export function vizierRows(tsv: string, columns: readonly string[], catalogue: string): Row[] {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#')), header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  const missing = columns.filter(column => !header.includes(column));
  if (missing.length) throw new Error(`${catalogue}: the response has no ${missing.join(', ')} column.`);
  return lines.slice(3).map(line => { const cells = line.split('\t').map(cell => cell.trim()); return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ''])); });
}
const period = (row: Row, column: string, what: string) => { const value = Number(row[column]); if (!row[column] || !(value > 0)) throw new Error(`${what}: ${column} is empty.`); return value; };

/** A Local Group galaxy the app draws as an inclined disc (its package's image-layer recipe), and its Cepheid distance. */
export interface CepheidGalaxy { readonly name: string; readonly objectId: string; readonly reader: string; readonly distance: { readonly credit: string; readonly paper: string; readonly modulus: readonly [number, number] } }
export const M31: CepheidGalaxy = { name: GALAXY, objectId: 'm31', reader: 'the Andromeda Galaxy', distance: LI_2021 };
export interface GalaxyCepheid { readonly name: string; readonly target: string; readonly raDeg: number; readonly decDeg: number; readonly periodDays: number; readonly periodSource: string; readonly paper: { url: string; credit: string };
  readonly position: { catalogue: string; row: Record<string, string>; credit: string; url: string }; readonly found: string; readonly locator: string; readonly aliases?: readonly string[]; readonly featured?: true }

/** The Local Volume Database release the Local Group's galaxies are placed by (src/objects/local-group-galaxies). */
const LVDB = { credit: 'the Local Volume Database v1.1.1 (Pace 2025)', url: 'https://doi.org/10.33232/001c.144859' };
/** The disc the app draws `galaxy` on, from its package's recipe: the same construction its layers and catalogue dots use. */
export async function galaxyDisc(root: string, galaxy: CepheidGalaxy) {
  const recipe = JSON.parse(await readFile(resolve(root, 'src/objects', `${galaxy.objectId}-layers`, 'source/recipe.json'), 'utf8')) as Parameters<typeof imageLayerDisc>[0];
  return { disc: imageLayerDisc(recipe), recipe };
}
/** A star of a galaxy is placed in the galaxy as it is drawn: where its sight line crosses the disc's midplane, as the galaxy's
 * own catalogue dots are. A galaxy's Cepheid distance places the galaxy, not a star within it: M33's (840 kpc) put its Cepheids
 * 19 kpc in front of a disc drawn at 859 kpc and 9 kpc in radius, outside the galaxy from every direction but the Sun's
 * (2026-10-01). */
export function discPlacement(galaxy: CepheidGalaxy, placed: Awaited<ReturnType<typeof galaxyDisc>>, raDeg: number, decDeg: number, measured: string) {
  const parsecs = Math.round(imageLayerDiscDistanceKpc(placed.disc, raDeg, decDeg) * 1000), { target, geometry } = placed.recipe;
  return { value: parsecs, url: LVDB.url,
    source: `Placed in ${galaxy.name} as the app draws it, where the star's sight line crosses the disc's midplane: ${parsecs.toLocaleString('en-US')} pc (src/objects/${galaxy.objectId}-layers/source/recipe.json: centre ${Math.round(target.distancePc).toLocaleString('en-US')} pc from ${LVDB.credit}, inclination ${geometry.inclinationDeg} deg, line of nodes ${geometry.lineOfNodesPaDeg} deg). ${measured}` };
}

/** One Cepheid's draft in `galaxy`: `name` as a reader meets it, `found` the sentence of who measured it. */
export function draftGalaxyCepheid(star: GalaxyCepheid, galaxy: CepheidGalaxy, placed: Awaited<ReturnType<typeof galaxyDisc>>, velocity: { value: number; uncertainty?: number; source: string; url: string }) {
  const [modulus, error] = galaxy.distance.modulus, parsecs = 10 ** (modulus / 5 + 1), days = star.periodDays.toFixed(star.periodDays < 10 ? 2 : 1), kpc = Math.round(parsecs / 1000);
  return { ...relationCepheidDraft({
    id: slug(star.name), name: star.name, target: star.target, galaxy: galaxy.name, periodDays: star.periodDays, paper: star.paper, periodSource: star.periodSource, position: star.position,
    description: `A Cepheid in ${galaxy.reader} that pulsates every ${days} days.`,
    distance: discPlacement(galaxy, placed, star.raDeg, star.decDeg,
      `The galaxy's Cepheid distance, ${galaxy.distance.credit}, abstract: modulus ${modulus} +/- ${error} mag, ${kpc} kpc; it places the galaxy, not a star within it`),
    velocity,
    text: { card: `A Cepheid in ${galaxy.reader}, ${kpc} kiloparsecs away, that swells and shrinks every ${days} days.`,
      introduction: `${star.found} Its galaxy's distance, ${kpc} kiloparsecs, was measured from Cepheids like it.`, locator: star.locator },
  }), ...(star.aliases?.length ? { aliases: star.aliases } : {}), ...(star.featured ? { featured: true as const } : {}) };
}


/** `new-object --from-m31cepheids all | V1 | ID... --out spec.json`: Hubble's V1, every Cepheid of Li et al. (2021), or those named
 * by their table ID (CEPH-10.91809+41.18565). */
export async function draftsFromM31Cepheids(names: readonly string[], archive: Archive, root: string) {
  const stars: Record<string, unknown>[] = [], report: string[] = [], velocity = await galaxyVelocity(archive, GALAXY), all = names.includes('all'), placed = await galaxyDisc(root, M31);
  const degrees = (row: Row, column: string) => { const value = Number(row[column]); if (!row[column] || !Number.isFinite(value)) throw new Error(`${row.ID}: ${column} is empty.`); return value; };
  if (all || names.includes('V1')) {
    const columns = ['ID', 'RAJ2000', 'DEJ2000', 'Pr', 'PSO'], [row] = vizierRows(await archive.text(VIZIER_ASU, { '-source': KODRIC_2018.catalogue, '-out': columns.join(','), ID: HUBBLE_V1.row }), columns, KODRIC_2018.catalogue);
    if (!row) throw new Error(`${KODRIC_2018.catalogue} has no row ${HUBBLE_V1.row}, Hubble's V1.`);
    const days = period(row, 'Pr', `${KODRIC_2018.catalogue} ${HUBBLE_V1.row}`);
    stars.push(draftGalaxyCepheid({ name: HUBBLE_V1.name, target: row.PSO!, raDeg: degrees(row, 'RAJ2000'), decDeg: degrees(row, 'DEJ2000'), periodDays: days, periodSource: `${KODRIC_2018.credit}, VizieR ${KODRIC_2018.catalogue}`, paper: HUBBLE_V1.identification,
      position: { catalogue: KODRIC_2018.catalogue, row: { ID: HUBBLE_V1.row }, credit: KODRIC_2018.credit, url: KODRIC_2018.paper }, aliases: [row.PSO!], featured: true,
      found: `Edwin Hubble's M31-V1 is the first Cepheid found in the Andromeda Galaxy.`,
      locator: `${HUBBLE_V1.identification.credit}: M31-V1; ${KODRIC_2018.catalogue}, ID ${HUBBLE_V1.row}: Pr; ${LI_2021.credit}: mu_0` }, M31, placed, velocity));
    report.push(`V1: Hubble's first Cepheid in M31, ${KODRIC_2018.catalogue} row ${HUBBLE_V1.row}, P ${days} d.`);
  }
  const wanted = names.filter(name => name !== 'all' && name !== 'V1');
  if (all || wanted.length) {
    const columns = ['ID', 'RAJ2000', 'DEJ2000', 'Per', 'Sample', 'SimbadName'];
    const rows = vizierRows(await archive.text(VIZIER_ASU, { '-source': LI_2021.catalogue, '-out': columns.join(','), '-out.max': '999' }), columns, LI_2021.catalogue).filter(row => all || wanted.includes(row.ID!));
    const absent = wanted.filter(name => !rows.some(row => row.ID === name));
    if (absent.length) throw new Error(`${LI_2021.catalogue} has no Cepheid ${absent.join(', ')}; ids are written as the table writes them (CEPH-10.91809+41.18565).`);
    // A row's ID names its HST pointing: a GRP- pointing holds two or three Cepheids, so a row is picked by its ID and period. One
    // star is listed twice, in the Gold and the Silver sample (DIRECT V9029 M31C, 35.903 and 36.130 d): its first row is drafted.
    const matched = (row: Row) => row.SimbadName!.replace(/\s+/gu, ' ').trim(), place = (row: Row) => `${row.RAJ2000} ${row.DEJ2000}`;
    const stars55 = rows.filter((row, index) => rows.findIndex(other => place(other) === place(row) && matched(other) === matched(row)) === index);
    for (const row of stars55) {
      // The name is the designation SIMBAD prefers (display-name.mts), else the one CDS matched to the row, else the table's own.
      const simbad = matched(row), preferred = simbad ? preferredName(await simbadIdentifiers(archive, simbad)) : undefined, name = preferred?.name ?? (simbad || row.ID!);
      const days = period(row, 'Per', `${LI_2021.catalogue} ${row.ID}`), own = row.ID!.startsWith('CEPH-') ? [row.ID!] : [];
      stars.push(draftGalaxyCepheid({ name, target: simbad || row.ID!, raDeg: degrees(row, 'RAJ2000'), decDeg: degrees(row, 'DEJ2000'), periodDays: days, periodSource: `${LI_2021.credit}, table 2`, paper: { url: LI_2021.paper, credit: LI_2021.credit },
        position: { catalogue: LI_2021.catalogue, row: { ID: row.ID!, Per: row.Per! }, credit: `${LI_2021.credit}, table 2`, url: LI_2021.paper }, aliases: [...own, ...simbad && simbad !== name ? [simbad] : []],
        found: `The Hubble Space Telescope measured its brightness in three colours and its pulsation of ${days.toFixed(days < 10 ? 2 : 1)} days.`,
        locator: `table 2, ID ${row.ID}, Per ${row.Per}: Per; ${LI_2021.credit}: mu_0` }, M31, placed, velocity));
    }
    report.push(`${stars55.length} Cepheid${stars55.length === 1 ? '' : 's'} of ${LI_2021.credit} in M31; radius and temperature from Groenewegen (2020)'s period relations.`);
  }
  return { stars, report };
}
