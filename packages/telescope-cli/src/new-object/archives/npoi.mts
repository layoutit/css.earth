/** A draft spec for a bright star whose disc the Navy Precision Optical Interferometer measured, from one of four papers of the same
 * team: Baines et al. (2018), AJ 155, 30 (doi:10.3847/1538-3881/aa9d8b; 87 stars), Baines et al. (2021), AJ 162, 198
 * (doi:10.3847/1538-3881/ac2431; 44 stars), Baines et al. (2023), AJ 166, 268 (doi:10.3847/1538-3881/ad08be; 33 stars) and Baines
 * et al. (2025), AJ 169, 293 (doi:10.3847/1538-3881/adc930; 145 stars, 62 of them new). Each paper prints the radius from its
 * limb-darkened angular diameter and a parallax, and the effective temperature from that diameter and the bolometric flux of its SED
 * fit. The 2018 paper also estimates a mass with the PARAM Bayesian fit to PARSEC isochrones (its Section 3.3 calls the masses
 * "estimates only"); the others fit none. Read by HD number, one VizieR request per table: the parallax table, the diameter table
 * (with a literature log g) and the parameters table (radius, temperature), whose numbers differ by paper (`NPOI`), and the 2018
 * Table 6 (mass).
 *
 * The star is placed at the parallax the paper computed its radius with, so the radius and the distance agree. A star SIMBAD lists no
 * Gaia DR3 source for (most stars brighter than about second magnitude) is placed by its Hipparcos row in XHIP (Anderson & Francis
 * 2012), with that row's proper motion and radial velocity, as Procyon is.
 *
 * A row the paper flags is refused: a radius of no use (a parallax error over 50%, 2018 and 2021), a diameter fit of doubtful value
 * without the star's pulsation phase (2023), a possible bias the paper discusses (2025). A star with no mass is drafted
 * "unmeasured": GM stays the records' unpublished 0, and its limb law reads the literature log g the paper lists beside its
 * diameter, when that log g is the star's own (GRAVITY). The 2025 paper's luminosity is a literature value (its r_L), not the
 * paper's, and is left out. */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from '../names/display-name.mts';

type Paper = 2018 | 2021 | 2023 | 2025;
/** Each paper's catalogue, the column its rows are keyed by, and the numbers of its parallax, diameter and parameters tables. */
export const NPOI: Readonly<Record<Paper, { readonly catalogue: string; readonly key: string; readonly paper: string; readonly credit: string; readonly tables: { readonly parallax: number; readonly diameter: number; readonly parameters: number } }>> = {
  2021: { catalogue: 'J/AJ/162/198', key: 'Target', paper: 'https://doi.org/10.3847/1538-3881/ac2431', credit: 'Baines et al. (2021), AJ 162, 198', tables: { parallax: 1, diameter: 4, parameters: 5 } },
  2018: { catalogue: 'J/AJ/155/30', key: 'HD', paper: 'https://doi.org/10.3847/1538-3881/aa9d8b', credit: 'Baines et al. (2018), AJ 155, 30', tables: { parallax: 1, diameter: 4, parameters: 5 } },
  2023: { catalogue: 'J/AJ/166/268', key: 'HD', paper: 'https://doi.org/10.3847/1538-3881/ad08be', credit: 'Baines et al. (2023), AJ 166, 268', tables: { parallax: 2, diameter: 5, parameters: 7 } },
  2025: { catalogue: 'J/AJ/169/293', key: 'HD', paper: 'https://doi.org/10.3847/1538-3881/adc930', credit: 'Baines et al. (2025), AJ 169, 293', tables: { parallax: 2, diameter: 6, parameters: 7 } },
};
/** The papers in the order a star is looked for. No star of the first two is in both; a star the later papers measure again keeps
 * the paper it was first drafted from. */
const PAPERS: readonly Paper[] = [2021, 2018, 2023, 2025];
/** The parallax each star's radius was computed with: the 2018 paper used van Leeuwen (2007) throughout (its Table 1); the others
 * name one per star in the parallax table's reference column, by the codes of that table's note (each catalogue's ReadMe). */
const PARALLAX: Readonly<Record<Exclude<Paper, 2018>, Readonly<Record<string, string>>>> = {
  2021: { 1: 'Gaia EDR3 (Gaia Collaboration 2021)', 2: 'Hipparcos (van Leeuwen 2007)', 3: 'Gaia DR2 (Gaia Collaboration 2018)', 4: 'Montesinos et al. (2016)' },
  2023: { 1: 'Gaia DR3 (Gaia Collaboration 2022)', 2: 'Hipparcos (van Leeuwen 2007)', 3: 'Gaia DR2 (Gaia Collaboration 2018)', 4: 'Mamajek et al. (2008)' },
  2025: { CM22: 'Chulkov & Malkov (2022)', Gaia18: 'Gaia DR2 (Gaia Collaboration 2018)', Gaia22: 'Gaia DR3 (Gaia Collaboration 2022)', vL07: 'Hipparcos (van Leeuwen 2007)' },
};
/** The sources of the literature log g each paper lists in its diameter table, by the codes of its table note. A source that reads
 * log g off the spectral type (Cox 2000; the calibrator catalogues of Bordé et al. 2002 and Lafrasse et al. 2010) is left out: a
 * class value is not this star's. The 2023 table has no code: its note gives McDonald et al. (2017) for every star but HD 224014,
 * whose values are a model's (Robin et al. 2012), so that one is left out. The 2025 codes kept are the sources the earlier papers'
 * notes already name; a code that is not listed here gives no log g. */
const GRAVITY: Readonly<Record<Paper, Readonly<Record<string, string>>>> = {
  2018: { 1: 'Prugniel et al. (2007)', 3: 'Allende Prieto & Lambert (1999)', 5: 'Le Borgne et al. (2003)', 6: 'Houdashelt et al. (2000)', 7: 'Katz et al. (2011)', 8: 'Valdes et al. (2004)',
    9: 'Soubiran et al. (2016), PASTEL', 10: 'Milone et al. (2011)', 11: 'Prugniel et al. (2011)', 13: 'Hekker & Melendez (2007)', 14: 'Hohle et al. (2010)' },
  2021: { 1: 'Allende Prieto & Lambert (1999)', 2: 'Prugniel et al. (2011)', 4: 'Soubiran et al. (2016), PASTEL', 5: 'Valdes et al. (2004)', 6: 'McDonald et al. (2017)', 7: 'Cesetti et al. (2013)' },
  2023: {},
  2025: { APL99: 'Allende Prieto & Lambert (1999)', C13: 'Cesetti et al. (2013)', H07: 'Hekker & Melendez (2007)', K11: 'Katz et al. (2011)', LB03: 'Le Borgne et al. (2003)', M11: 'Milone et al. (2011)',
    MZW17: 'McDonald et al. (2017)', P07: 'Prugniel et al. (2007)', P11: 'Prugniel et al. (2011)', Sou16: 'Soubiran et al. (2016), PASTEL', V04: 'Valdes et al. (2004)' },
};
const GRAVITY_2023 = { source: 'McDonald et al. (2017)', except: '224014' } as const;
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
  const { credit, key, tables: at } = NPOI[year], where = `${credit}, HD ${hd}`, recent = year === 2023 || year === 2025;
  const one = (tsv: string, table: number) => {
    const rows = vizierRows(tsv).filter(row => row[key] === hd);
    if (rows.length !== 1) throw new Error(`${where}: Table ${table} has ${rows.length} rows, not one.`);
    return rows[0]!;
  };
  // The parameters table first: a radius the paper flags as not useful refuses the star whatever the other tables hold.
  const t5 = one(tables.parameters, at.parameters);
  if (t5.f_Rad === '*') throw new Error(`${where}: the paper flags the radius as not useful (a parallax error over 50%, Table ${at.parameters} note).`);
  const t1 = one(tables.parallax, at.parallax), t4 = one(tables.diameter, at.diameter);
  if (recent && t4.Flag === '*') throw new Error(`${where}: the paper flags the diameter (Table ${at.diameter} note: ${year === 2023 ? 'the fit may not be of significant value without the star\'s pulsation phase' : 'a possible bias it discusses in its Section 5'}).`);
  const number = (row: Record<string, string>, column: string, table: number) => {
    const value = Number(row[column]);
    if (!row[column] || !Number.isFinite(value)) throw new Error(`${where}: Table ${table} ${column} is empty.`);
    return value;
  };
  const lower = number(t5, 'e_Rad', at.parameters), upper = t5.E_Rad ? number(t5, 'E_Rad', at.parameters) : lower;
  const diameter = year === 2018 ? [number(t4, 'theta-LDf', at.diameter), number(t4, 'e_theta-LDf', at.diameter)] as const : [number(t4, 'theta-ld-f', at.diameter), number(t4, 'e_theta-ld-f', at.diameter)] as const;
  // The 2023 and 2025 tables print the parallax columns in lower case.
  const plx = recent ? 'plx' : 'Plx', code = t1[`r_${plx}`] ?? '';
  const parallaxSource = year === 2018 ? PARALLAX[2021][2]! : PARALLAX[year][code];
  if (!parallaxSource) throw new Error(`${where}: Table ${at.parallax} names parallax source ${code || 'none'}, which the table note does not list.`);
  let mass: readonly [number, number] | undefined;
  if (year === 2018 && tables.mass !== undefined) {
    const rows = vizierRows(tables.mass).filter(row => row.HD === hd);
    if (rows.length > 1) throw new Error(`${where}: Table 6 has ${rows.length} rows, not one.`);
    if (rows[0]) mass = [number(rows[0], 'Mass', 6), number(rows[0], 'e_Mass', 6)];
  }
  const gravitySource = year === 2023 ? (hd === GRAVITY_2023.except ? undefined : GRAVITY_2023.source) : GRAVITY[year][t4.Ref ?? ''];
  // A luminosity the 2018 paper flags (a parallax error of 20% or more) is not used; the 2023 paper prints its own as L; the 2025
  // paper's L is a literature value.
  const luminosity = year === 2025 ? undefined : year === 2023 ? (t5.L ? number(t5, 'L', at.parameters) : undefined) : t5.Lum && t5.f_Lum !== '*' ? number(t5, 'Lum', at.parameters) : undefined;
  return { year, hd, spectralType: (t1.SpType ?? t1.SpT ?? '').replace(/\s+/gu, ' ').trim(), luminosity, parallax: [number(t1, plx, at.parallax), number(t1, `e_${plx}`, at.parallax)] as const, parallaxSource,
    diameter, radius: { value: number(t5, 'Rad', at.parameters), lower, upper }, teff: [number(t5, 'Teff', at.parameters), number(t5, 'e_Teff', at.parameters)] as const, mass,
    gravity: t4.logg && gravitySource ? { value: number(t4, 'logg', at.diameter), source: gravitySource } : undefined };
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
  const { credit, paper, tables: at } = NPOI[row.year], preferred = preferredName(identifiers), hd = `HD ${row.hd}`, name = preferred?.name ?? hd;
  // A table error of zero (some PARAM masses) is printed but is no uncertainty: the value is cited without one.
  const cite = (value: number, uncertainty: number, what: string) => ({ value, ...(uncertainty > 0 ? { uncertainty } : {}), source: `${credit}, ${hd}: ${what}`, url: paper });
  const { value: r, lower, upper } = row.radius, spread = upper === lower ? `+/- ${lower}` : `+${upper}/-${lower}`;
  // A cited value carries one uncertainty: the wider side of an asymmetric pair, the pair itself in the words.
  const radius = cite(r, Math.max(lower, upper), `radius ${r} ${spread} solar radii (Table ${at.parameters}), from the limb-darkened angular diameter ${row.diameter[0]} +/- ${row.diameter[1]} mas (NPOI, Table ${at.diameter}) and the ${row.parallaxSource} parallax`);
  const mass = row.mass ? cite(row.mass[0], row.mass[1], `mass ${row.mass[0]} +/- ${row.mass[1]} solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only`) : 'unmeasured' as const;
  // The width to a tenth below a hundred solar radii: two giants at one distance (Unukalhai and Epsilon Cygni, 23 pc) differ only there.
  const parsecs = 1000 / row.parallax[0], wider = r >= 1.05 ? `${r >= 100 ? Math.round(r) : r.toFixed(1)} times the Sun's width` : `the Sun's width`;
  // What kind of star, in the papers' own terms: the MK type they list from SIMBAD (Table 1; Table 5's is the best-fitting SED
  // template, G4 III for the F5 Ib supergiant Mirfak) and the luminosity class it names, as the 2018 abstract counts its sample
  // ("dwarfs, subgiants, giants, bright giants and supergiants"). A type between two classes takes the first.
  const CLASSES: Readonly<Record<string, string>> = { I: 'supergiant', II: 'bright giant', III: 'giant', IV: 'subgiant', V: 'dwarf' };
  const luminosityClass = /(?:\s|\d)(I{1,3}|IV|V)(?![IV])/u.exec(row.spectralType)?.[1], word = luminosityClass ? CLASSES[luminosityClass]! : 'star';
  const kind = row.spectralType ? `A ${word} of type ${row.spectralType}` : 'A naked-eye star', l = row.luminosity;
  const light = l === undefined ? '' : ` and ${l >= 100 ? Math.round(l).toLocaleString('en-US') : l >= 10 ? Math.round(l) : l.toFixed(1)} times its light`;
  const hip = hipparcos ? { position: { catalogue: XHIP.catalogue, row: { HIP: hipparcos.hip }, credit: XHIP.credit, url: XHIP.url, motion: { epoch: 1991.25, ra: 'pmRA', dec: 'pmDE' } },
    radialVelocity: { value: hipparcos.rv, uncertainty: hipparcos.error, source: `${XHIP.credit.split(' (XHIP)')[0]}, XHIP, HIP ${hipparcos.hip}: RV ${hipparcos.rv} +/- ${hipparcos.error} km/s${hipparcos.quality ? ` (quality ${hipparcos.quality})` : ''}`, url: XHIP.url } } : {};
  return {
    // An id starts with a letter: a star named by its Flamsteed number takes its HD number as its id.
    id: (/^\d/u.test(name) ? hd : name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), name, system: `${name} system`, parent: 'milky-way', target: hd,
    ...(name === hd ? {} : { aliases: [hd] }),
    description: `${kind} ${parsecs.toFixed(parsecs < 100 ? 1 : 0)} parsecs away, ${wider}: its disc was measured with the Navy Precision Optical Interferometer.`,
    paper: { url: paper, credit },
    distance: { value: Number(parsecs.toFixed(3)), uncertainty: Number((parsecs * row.parallax[1] / row.parallax[0]).toFixed(3)),
      source: `${credit}, ${hd}: the ${row.parallaxSource} parallax the radius was computed with (Table ${at.parallax}), ${row.parallax[0]} +/- ${row.parallax[1]} mas, inverted`, url: paper },
    ...hip,
    radius, mass, temperature: cite(row.teff[0], row.teff[1], `effective temperature ${row.teff[0]} +/- ${row.teff[1]} K (Table ${at.parameters}), from the angular diameter and the bolometric flux of the SED fit`),
    ...(row.gravity && mass === 'unmeasured' ? { gravity: { value: row.gravity.value, source: `${credit}, ${hd}: log g ${row.gravity.value}, from ${row.gravity.source}, as the paper lists it beside the diameter (Table ${at.diameter})`, url: paper } } : {}),
    // The reader text is the table row in words, cited to it; nothing the row does not hold.
    text: { card: `${kind}, ${parsecs.toFixed(0)} parsecs away: ${wider}${light}.`,
      introduction: `Its disc spans ${row.diameter[0]} milliarcseconds, which gives ${r} solar radii and ${row.teff[0].toLocaleString('en-US')} K at its surface.`,
      locator: `Tables ${at.parallax}, ${at.diameter} and ${at.parameters}, ${hd}: parallax, MK type, limb-darkened diameter, radius, Teff${row.year === 2025 ? '' : ', luminosity'}` },
    planets: [], companions: [],
  };
}

const table = (archive: Archive, year: Paper, number: number, hd: string) =>
  archive.text(VIZIER_ASU, { '-source': `${NPOI[year].catalogue}/table${number}`, [NPOI[year].key]: `=${hd}`, '-out.all': '1', '-out.max': '5' });

/** `new-object --from-npoi HD... --out spec.json`: each star from the first paper, in `PAPERS`' order, that measured it. */
export async function draftsFromNpoi(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const hd of names.map(value => value.replace(/^HD\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hd)) throw new Error(`The NPOI papers are read by HD number, not ${hd}.`);
    let found: ReturnType<typeof parseNpoiRow> | undefined;
    for (const year of PAPERS) {
      const at = NPOI[year].tables, parameters = await table(archive, year, at.parameters, hd);
      if (!vizierRows(parameters).some(row => row[NPOI[year].key] === hd)) continue;
      const [parallax, diameter, mass] = await Promise.all([table(archive, year, at.parallax, hd), table(archive, year, at.diameter, hd), year === 2018 ? table(archive, year, 6, hd) : undefined]);
      found = parseNpoiRow(year, hd, { parallax, diameter, parameters, ...(mass === undefined ? {} : { mass }) });
      break;
    }
    if (!found) throw new Error(`None of ${PAPERS.map(year => NPOI[year].credit).join(', ')} measured HD ${hd}.`);
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
