/** A draft spec for one of the Gaia FGK benchmark stars, third version: Soubiran et al. (2024), A&A 682, A145
 * (doi:10.1051/0004-6361/202347136; 192 benchmark stars and 9 with an indirect diameter, one table). They are stars with a
 * measured angular diameter and a parallax: the table prints the limb-darkened diameter with the paper that measured it, the
 * parallax and where it is from, the bolometric flux of the paper's SED fit, and from those the effective temperature, the
 * luminosity and the radius, and a surface gravity from Newton's law. Read by HD number, one VizieR request.
 *
 * The star is placed at the parallax the paper computed its radius with. A star Gaia DR3 does not place (npoi.mts gaiaPlaces)
 * is placed by its Hipparcos row in XHIP, as the NPOI route places its stars.
 *
 * The table prints two masses, from two sets of evolution models (BaSTI and STAREVOL), and adopts neither here: the star is
 * drafted "unmeasured" and its limb law reads the paper's own surface gravity. A star whose diameter is indirect (the nine the
 * paper keeps apart from its benchmark stars) is refused. */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from '../names/display-name.mts';
import { gaiaPlaces, parseXhipRow, vizierRows, XHIP } from './npoi.mts';

export const BENCHMARK = { source: 'J/A+A/682/A145/catalog', paper: 'https://doi.org/10.1051/0004-6361/202347136', credit: 'Soubiran et al. (2024), A&A 682, A145' };
/** Where each parallax is from, by the codes of the table's note. */
const PARALLAX: Readonly<Record<string, string>> = { G: 'Gaia DR3 (Gaia Collaboration 2023)', H: 'Hipparcos (van Leeuwen 2007)', A: 'Akeson et al. (2021)' };

/** One star's row. The table writes an HD number as `HD18884`. */
export function parseBenchmarkRow(tsv: string, hd: string) {
  const where = `${BENCHMARK.credit}, HD ${hd}`, rows = vizierRows(tsv).filter(row => row.HD === `HD${hd}`);
  if (rows.length !== 1) throw new Error(`${where}: the table has ${rows.length} rows, not one.`);
  const row = rows[0]!;
  if (row.Indirect === '1') throw new Error(`${where}: the table marks its angular diameter as an indirect measurement, and the paper keeps such stars apart from its benchmark stars.`);
  const pair = (name: string) => { const value = Number(row[name]), error = Number(row[`e_${name}`]);
    if (!row[name] || !row[`e_${name}`] || !Number.isFinite(value) || !Number.isFinite(error)) throw new Error(`${where}: ${name} is empty.`);
    return [value, error] as const; };
  const parallaxSource = PARALLAX[row.o_Plx ?? ''];
  if (!parallaxSource) throw new Error(`${where}: the table names parallax origin ${row.o_Plx || 'none'}, which its note does not list.`);
  if (!row.r_ThetaLD) throw new Error(`${where}: the table names no paper for the angular diameter.`);
  return { hd, diameter: pair('ThetaLD'), diameterPaper: row.r_ThetaLD, parallax: pair('Plx'), parallaxSource, teff: pair('Teff'), luminosity: pair('Lum'), radius: pair('Rad'), gravity: pair('logg') };
}

export function draftFromBenchmark(row: ReturnType<typeof parseBenchmarkRow>, identifiers: readonly string[], hipparcos?: ReturnType<typeof parseXhipRow>) {
  const { credit, paper } = BENCHMARK, preferred = preferredName(identifiers), hd = `HD ${row.hd}`, name = preferred?.name ?? hd;
  const cite = ([value, uncertainty]: readonly [number, number], what: string) => ({ value, uncertainty, source: `${credit}, ${hd}: ${what}`, url: paper });
  const [r] = row.radius, [l] = row.luminosity, parsecs = 1000 / row.parallax[0];
  const wider = r >= 1.05 ? `${r >= 100 ? Math.round(r) : r.toFixed(1)} times the Sun's width` : r <= 0.95 ? `${Math.round(r * 100)}% of the Sun's width` : `the Sun's width`;
  const light = `${l >= 100 ? Math.round(l).toLocaleString('en-US') : l >= 10 ? Math.round(l) : l.toFixed(1)} times its light`;
  const hip = hipparcos ? { position: { catalogue: XHIP.catalogue, row: { HIP: hipparcos.hip }, credit: XHIP.credit, url: XHIP.url, motion: { epoch: 1991.25, ra: 'pmRA', dec: 'pmDE' } },
    radialVelocity: { value: hipparcos.rv, uncertainty: hipparcos.error, source: `${XHIP.credit.split(' (XHIP)')[0]}, XHIP, HIP ${hipparcos.hip}: RV ${hipparcos.rv} +/- ${hipparcos.error} km/s${hipparcos.quality ? ` (quality ${hipparcos.quality})` : ''}`, url: XHIP.url } } : {};
  return {
    // An id starts with a letter: a star named by its Flamsteed number takes its HD number as its id.
    id: (/^\d/u.test(name) ? hd : name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), name, system: `${name} system`, parent: 'milky-way', target: hd,
    ...(name === hd ? {} : { aliases: [hd] }),
    description: `One of the Gaia benchmark stars, ${parsecs.toFixed(parsecs < 100 ? 1 : 0)} parsecs away, ${wider}: its disc was measured by interferometry.`,
    paper: { url: paper, credit },
    distance: { value: Number(parsecs.toFixed(3)), uncertainty: Number((parsecs * row.parallax[1] / row.parallax[0]).toFixed(3)),
      source: `${credit}, ${hd}: the ${row.parallaxSource} parallax the radius was computed with, ${row.parallax[0]} +/- ${row.parallax[1]} mas, inverted`, url: paper },
    ...hip,
    radius: cite(row.radius, `radius ${row.radius[0]} +/- ${row.radius[1]} solar radii, from the limb-darkened angular diameter ${row.diameter[0]} +/- ${row.diameter[1]} mas (measured in ${row.diameterPaper}, as the table lists it) and the ${row.parallaxSource} parallax`),
    mass: 'unmeasured' as const,
    temperature: cite(row.teff, `effective temperature ${row.teff[0]} +/- ${row.teff[1]} K, from the angular diameter and the bolometric flux of the paper's SED fit`),
    gravity: { value: row.gravity[0], source: `${credit}, ${hd}: log g ${row.gravity[0]} +/- ${row.gravity[1]}, the paper's own, from Newton's law with its radius and a mass from evolution models`, url: paper },
    // The reader text is the table row in words, cited to it; nothing the row does not hold.
    text: { card: `One of the Gaia benchmark stars, ${parsecs.toFixed(0)} parsecs away: ${wider} and ${light}.`,
      introduction: `Its disc spans ${row.diameter[0]} milliarcseconds, which gives ${r} solar radii and ${row.teff[0].toLocaleString('en-US')} K at its surface.`,
      locator: `The catalogue's table, ${hd}: limb-darkened diameter, parallax, Teff, luminosity, radius, log g` },
    planets: [], companions: [],
  };
}

/** `new-object --from-benchmark HD... --out spec.json`. */
export async function draftsFromBenchmark(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const hd of names.map(value => value.replace(/^HD\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hd)) throw new Error(`${BENCHMARK.credit} is read by HD number, not ${hd}.`);
    const row = parseBenchmarkRow(await archive.text(VIZIER_ASU, { '-source': BENCHMARK.source, HD: `HD${hd}`, '-out.all': '1', '-out.max': '5' }), hd);
    const identifiers = await simbadIdentifiers(archive, `HD ${hd}`);
    // A star Gaia DR3 does not place (gaiaPlaces) sits on its Hipparcos row.
    const placed = await gaiaPlaces(archive, identifiers), hip = placed ? undefined : identifiers.find(id => /^HIP \d+$/u.test(id))?.slice(4);
    if (!placed && !hip) throw new Error(`HD ${hd}: Gaia DR3 does not place the star and SIMBAD lists no HIP number.`);
    const hipparcos = hip ? parseXhipRow(await archive.text(VIZIER_ASU, { '-source': XHIP.catalogue, HIP: `=${hip}`, '-out.all': '1', '-out.max': '5' }), hip) : undefined;
    const star = draftFromBenchmark(row, identifiers, hipparcos);
    stars.push(star);
    report.push(`HD ${hd}: drafted as ${star.name} from ${BENCHMARK.credit}; the table's two model masses are not taken, so none is recorded${hipparcos ? `; placed by Hipparcos (HIP ${hip}), which Gaia DR3 does not place` : ''}.`);
  }
  return { stars, report };
}
