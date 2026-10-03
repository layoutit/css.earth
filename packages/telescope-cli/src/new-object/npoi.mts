/** A draft spec for a bright star whose disc the Navy Precision Optical Interferometer measured, from one of two papers of the same
 * team: Baines et al. (2018), AJ 155, 30 (doi:10.3847/1538-3881/aa9d8b; 87 stars) and Baines et al. (2021), AJ 162, 198
 * (doi:10.3847/1538-3881/ac2431; 44 stars). Each paper prints the radius from its limb-darkened angular diameter and a parallax, and the
 * effective temperature from that diameter and the bolometric flux of its SED fit. The 2018 paper also estimates a mass with the PARAM
 * Bayesian fit to PARSEC isochrones (its Section 3.3 calls the masses "estimates only"); the 2021 paper fits none. Read by HD number,
 * one VizieR request per table: Table 1 (parallax), Table 4 (diameter, literature log g), Table 5 (radius, temperature) and the 2018
 * Table 6 (mass).
 *
 * The star is placed at the parallax the paper computed its radius with, so the radius and the distance agree. A star SIMBAD lists no
 * Gaia DR3 source for (most stars brighter than about second magnitude) is placed by its Hipparcos row in XHIP (Anderson & Francis
 * 2012), with that row's proper motion and radial velocity, as Procyon is.
 *
 * A row the paper flags as having no useful radius (a parallax error over 50%) is refused. A star with no mass is drafted "unmeasured":
 * GM stays the records' unpublished 0, and its limb law reads the literature log g the paper lists beside its diameter (Table 4), when
 * that log g is the star's own (GRAVITY). */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from './display-name.mts';

type Paper = 2018 | 2021;
export const NPOI: Readonly<Record<Paper, { readonly catalogue: string; readonly key: string; readonly paper: string; readonly credit: string }>> = {
  2021: { catalogue: 'J/AJ/162/198', key: 'Target', paper: 'https://doi.org/10.3847/1538-3881/ac2431', credit: 'Baines et al. (2021), AJ 162, 198' },
  2018: { catalogue: 'J/AJ/155/30', key: 'HD', paper: 'https://doi.org/10.3847/1538-3881/aa9d8b', credit: 'Baines et al. (2018), AJ 155, 30' },
};
/** The parallax each star's radius was computed with: the 2018 paper used van Leeuwen (2007) throughout (its Table 1); the 2021 paper
 * names one per star in Table 1's r_Plx, from the references its table note numbers. */
const PARALLAX_2021: Readonly<Record<string, string>> = { 1: 'Gaia EDR3 (Gaia Collaboration 2021)', 2: 'Hipparcos (van Leeuwen 2007)', 3: 'Gaia DR2 (Gaia Collaboration 2018)', 4: 'Montesinos et al. (2016)' };
/** The sources of the literature log g each paper lists in Table 4, by the numbers of its table note. A source that reads log g off
 * the spectral type (Cox 2000; the calibrator catalogues of Bordé et al. 2002 and Lafrasse et al. 2010) is left out: a class value is
 * not this star's. */
const GRAVITY: Readonly<Record<Paper, Readonly<Record<string, string>>>> = {
  2018: { 1: 'Prugniel et al. (2007)', 3: 'Allende Prieto & Lambert (1999)', 5: 'Le Borgne et al. (2003)', 6: 'Houdashelt et al. (2000)', 7: 'Katz et al. (2011)', 8: 'Valdes et al. (2004)',
    9: 'Soubiran et al. (2016), PASTEL', 10: 'Milone et al. (2011)', 11: 'Prugniel et al. (2011)', 13: 'Hekker & Melendez (2007)', 14: 'Hohle et al. (2010)' },
  2021: { 1: 'Allende Prieto & Lambert (1999)', 2: 'Prugniel et al. (2011)', 4: 'Soubiran et al. (2016), PASTEL', 5: 'Valdes et al. (2004)', 6: 'McDonald et al. (2017)', 7: 'Cesetti et al. (2013)' },
};
export const XHIP = { catalogue: 'V/137D/XHIP', credit: 'Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry', url: 'https://doi.org/10.1134/S1063773712050015' };

/** The lines of a VizieR table as records by column name. The units and dash lines come back as records too; a caller picks its rows
 * by a key column's value, which those lines never hold. */
export function vizierRows(tsv: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  return lines.slice(1).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row.length === header.length)
    .map(row => Object.fromEntries(header.map((name, index) => [name, row[index]!])) as Record<string, string>);
}

export type NpoiTables = { readonly parallax: string; readonly diameter: string; readonly parameters: string; readonly mass?: string };
/** One star's measurements from one paper's tables. */
export function parseNpoiRow(year: Paper, hd: string, tables: NpoiTables) {
  const { credit, key } = NPOI[year], where = `${credit}, HD ${hd}`;
  const one = (tsv: string, table: string) => {
    const rows = vizierRows(tsv).filter(row => row[key] === hd);
    if (rows.length !== 1) throw new Error(`${where}: Table ${table} has ${rows.length} rows, not one.`);
    return rows[0]!;
  };
  // Table 5 first: a radius the paper flags as not useful refuses the star whatever the other tables hold.
  const t5 = one(tables.parameters, '5');
  if (t5.f_Rad === '*') throw new Error(`${where}: the paper flags the radius as not useful (a parallax error over 50%, Table 5 note).`);
  const t1 = one(tables.parallax, '1'), t4 = one(tables.diameter, '4');
  const number = (row: Record<string, string>, column: string, table: string) => {
    const value = Number(row[column]);
    if (!row[column] || !Number.isFinite(value)) throw new Error(`${where}: Table ${table} ${column} is empty.`);
    return value;
  };
  const lower = number(t5, 'e_Rad', '5'), upper = t5.E_Rad ? number(t5, 'E_Rad', '5') : lower;
  const diameter = year === 2018 ? [number(t4, 'theta-LDf', '4'), number(t4, 'e_theta-LDf', '4')] as const : [number(t4, 'theta-ld-f', '4'), number(t4, 'e_theta-ld-f', '4')] as const;
  const parallaxSource = year === 2018 ? PARALLAX_2021[2]! : PARALLAX_2021[t1.r_Plx ?? ''];
  if (!parallaxSource) throw new Error(`${where}: Table 1 names parallax source ${t1.r_Plx || 'none'}, which the table note does not list.`);
  let mass: readonly [number, number] | undefined;
  if (year === 2018 && tables.mass !== undefined) {
    const rows = vizierRows(tables.mass).filter(row => row.HD === hd);
    if (rows.length > 1) throw new Error(`${where}: Table 6 has ${rows.length} rows, not one.`);
    if (rows[0]) mass = [number(rows[0], 'Mass', '6'), number(rows[0], 'e_Mass', '6')];
  }
  const gravitySource = GRAVITY[year][t4.Ref ?? ''];
  return { year, hd, spectralType: t5.SpType ?? t5.SpT ?? '', parallax: [number(t1, 'Plx', '1'), number(t1, 'e_Plx', '1')] as const, parallaxSource,
    diameter, radius: { value: number(t5, 'Rad', '5'), lower, upper }, teff: [number(t5, 'Teff', '5'), number(t5, 'e_Teff', '5')] as const, mass,
    gravity: t4.logg && gravitySource ? { value: number(t4, 'logg', '4'), source: gravitySource } : undefined };
}

/** The Hipparcos row that places a star Gaia DR3 lists no source for, with its radial velocity, from XHIP. */
export function parseXhipRow(tsv: string, hip: string) {
  const rows = vizierRows(tsv).filter(row => row.HIP === hip);
  if (rows.length !== 1) throw new Error(`${XHIP.credit}: ${rows.length} rows for HIP ${hip}, not one.`);
  const row = rows[0]!, rv = Number(row.RV), error = Number(row.e_RV);
  if (!row.RV || !Number.isFinite(rv) || !row.e_RV || !Number.isFinite(error)) throw new Error(`${XHIP.credit}, HIP ${hip}: no radial velocity.`);
  return { hip, rv, error, quality: row.q_RV ?? '' };
}

export function draftFromNpoi(row: ReturnType<typeof parseNpoiRow>, identifiers: readonly string[], hipparcos?: ReturnType<typeof parseXhipRow>) {
  const { credit, paper } = NPOI[row.year], preferred = preferredName(identifiers), hd = `HD ${row.hd}`, name = preferred?.name ?? hd;
  // A table error of zero (some PARAM masses) is printed but is no uncertainty: the value is cited without one.
  const cite = (value: number, uncertainty: number, what: string) => ({ value, ...(uncertainty > 0 ? { uncertainty } : {}), source: `${credit}, ${hd}: ${what}`, url: paper });
  const { value: r, lower, upper } = row.radius, spread = upper === lower ? `+/- ${lower}` : `+${upper}/-${lower}`;
  // A cited value carries one uncertainty: the wider side of an asymmetric pair, the pair itself in the words.
  const radius = cite(r, Math.max(lower, upper), `radius ${r} ${spread} solar radii (Table 5), from the limb-darkened angular diameter ${row.diameter[0]} +/- ${row.diameter[1]} mas (NPOI, Table 4) and the ${row.parallaxSource} parallax`);
  const mass = row.mass ? cite(row.mass[0], row.mass[1], `mass ${row.mass[0]} +/- ${row.mass[1]} solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only`) : 'unmeasured' as const;
  // The width to a tenth below a hundred solar radii: two giants at one distance (Unukalhai and Epsilon Cygni, 23 pc) differ only there.
  const parsecs = 1000 / row.parallax[0], wider = r >= 1.05 ? `${r >= 100 ? Math.round(r) : r.toFixed(1)} times the Sun's width` : `the Sun's width`;
  const hip = hipparcos ? { position: { catalogue: XHIP.catalogue, row: { HIP: hipparcos.hip }, credit: XHIP.credit, url: XHIP.url, motion: { epoch: 1991.25, ra: 'pmRA', dec: 'pmDE' } },
    radialVelocity: { value: hipparcos.rv, uncertainty: hipparcos.error, source: `${XHIP.credit.split(' (XHIP)')[0]}, XHIP, HIP ${hipparcos.hip}: RV ${hipparcos.rv} +/- ${hipparcos.error} km/s${hipparcos.quality ? ` (quality ${hipparcos.quality})` : ''}`, url: XHIP.url } } : {};
  return {
    // An id starts with a letter: a star named by its Flamsteed number takes its HD number as its id.
    id: (/^\d/u.test(name) ? hd : name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), name, system: `${name} system`, target: hd,
    ...(name === hd ? {} : { aliases: [hd] }), ...(preferred?.step === 'proper' ? { featured: true } : {}),
    description: `A naked-eye star ${parsecs.toFixed(parsecs < 100 ? 1 : 0)} parsecs away, ${wider}: its disc was measured with the Navy Precision Optical Interferometer.`,
    paper: { url: paper, credit },
    distance: { value: Number(parsecs.toFixed(3)), uncertainty: Number((parsecs * row.parallax[1] / row.parallax[0]).toFixed(3)),
      source: `${credit}, ${hd}: the ${row.parallaxSource} parallax the radius was computed with (Table 1), ${row.parallax[0]} +/- ${row.parallax[1]} mas, inverted`, url: paper },
    ...hip,
    radius, mass, temperature: cite(row.teff[0], row.teff[1], `effective temperature ${row.teff[0]} +/- ${row.teff[1]} K (Table 5), from the angular diameter and the bolometric flux of the SED fit`),
    ...(row.gravity && mass === 'unmeasured' ? { gravity: { value: row.gravity.value, source: `${credit}, ${hd}: log g ${row.gravity.value}, from ${row.gravity.source}, as the paper lists it beside the diameter (Table 4)`, url: paper } } : {}),
    // The reader text is the table row in words, cited to it; nothing the row does not hold.
    text: { card: `A naked-eye star ${parsecs.toFixed(0)} parsecs away whose disc the NPOI measured: ${wider}.`,
      introduction: `Its disc spans ${row.diameter[0]} milliarcseconds, which gives ${r} solar radii and ${row.teff[0].toLocaleString('en-US')} K at its surface.`,
      locator: `Tables 1, 4 and 5, ${hd}: parallax, limb-darkened diameter, radius, Teff` },
    planets: [], companions: [],
  };
}

const table = (archive: Archive, year: Paper, number: number, hd: string) =>
  archive.text(VIZIER_ASU, { '-source': `${NPOI[year].catalogue}/table${number}`, [NPOI[year].key]: `=${hd}`, '-out.all': '1', '-out.max': '5' });

/** `new-object --from-npoi HD... --out spec.json`: each star from the paper that measured it (2021 first; no star is in both). */
export async function draftsFromNpoi(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const hd of names.map(value => value.replace(/^HD\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hd)) throw new Error(`The NPOI papers are read by HD number, not ${hd}.`);
    let found: ReturnType<typeof parseNpoiRow> | undefined;
    for (const year of [2021, 2018] as const) {
      const parameters = await table(archive, year, 5, hd);
      if (!vizierRows(parameters).some(row => row[NPOI[year].key] === hd)) continue;
      const [parallax, diameter, mass] = await Promise.all([table(archive, year, 1, hd), table(archive, year, 4, hd), year === 2018 ? table(archive, year, 6, hd) : undefined]);
      found = parseNpoiRow(year, hd, { parallax, diameter, parameters, ...(mass === undefined ? {} : { mass }) });
      break;
    }
    if (!found) throw new Error(`Neither ${NPOI[2021].credit} nor ${NPOI[2018].credit} measured HD ${hd}.`);
    const identifiers = await simbadIdentifiers(archive, `HD ${hd}`);
    // A star SIMBAD lists no Gaia DR3 source for is placed by its Hipparcos row.
    const hip = identifiers.some(id => id.startsWith('Gaia DR3 ')) ? undefined : identifiers.find(id => /^HIP \d+$/u.test(id))?.slice(4);
    if (!identifiers.some(id => id.startsWith('Gaia DR3 ')) && !hip) throw new Error(`HD ${hd}: SIMBAD lists neither a Gaia DR3 source nor a HIP number.`);
    const hipparcos = hip ? parseXhipRow(await archive.text(VIZIER_ASU, { '-source': XHIP.catalogue, HIP: `=${hip}`, '-out.all': '1', '-out.max': '5' }), hip) : undefined;
    const star = draftFromNpoi(found, identifiers, hipparcos);
    stars.push(star);
    report.push(`HD ${hd}: drafted as ${star.name} from ${NPOI[found.year].credit}${found.mass ? '' : '; the paper gives no mass, so none is recorded'}${hipparcos ? `; placed by Hipparcos (HIP ${hip}), which Gaia DR3 does not list` : ''}.`);
  }
  return { stars, report };
}
