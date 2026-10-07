/** A draft spec for one of the 32 stars whose discs the Narrabri intensity interferometer measured: Hanbury Brown, Davis & Allen
 * (1974), MNRAS 167, 121. Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, then derived each star's effective temperature
 * from that angular diameter and its flux measured from the ultraviolet (OAO-2) to the infrared: the first temperatures of hot stars
 * that rest on a measured size. No machine-readable copy of the 1976 tables exists, so they are typed here, once, from the journal's
 * page images (`code-1976.json`, with its pages and the date); when a star is drafted its diameter is checked against the row of the
 * 1974 paper in the JMDC, the catalogue of measured stellar diameters (VizieR II/345), and a difference refuses the star.
 *
 * Neither paper prints a radius the map can use: the 1976 radii are for twelve stars at the parallaxes of their day. The radius
 * is computed here, and its source says so: the angular diameter times the distance of the Hipparcos parallax (van Leeuwen 2007, as
 * XHIP lists it), with both errors. The star is placed at that parallax, so its radius and distance agree, and by its XHIP row when
 * Gaia DR3 does not place it (npoi.mts gaiaPlaces), as the NPOI route places its stars.
 *
 * A star whose 1976 temperature is of the primary of a multiple star (the table's asterisk) is refused: the page would show one
 * star with a number that is another's. No mass is measured, and none is recorded. */
import table from './code-1976.json' with { type: 'json' };
import { isRecord } from '@cssearth/core';
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from '../names/display-name.mts';
import { gaiaPlaces, parseXhipRow, starKind, vizierRows, XHIP } from './npoi.mts';

export const JMDC = { source: 'II/345/jmdc', bibcode: '1974MNRAS.167..121H', credit: 'JMDC, the JMMC Measured Stellar Diameters Catalogue (Duvert 2016), VizieR II/345' };
/** The radius, in solar radii, of one milliarcsecond of angular diameter at one parsec. A milliarcsecond at a parsec spans a
 * thousandth of an astronomical unit, the radius is half of it, and the IAU 2015 nominal solar radius is 695,700 km:
 * 149,597,870.7 km / (2 x 1000 x 695,700 km) = 0.1075. */
export const SOLAR_RADII_PER_MAS_PARSEC = 149_597_870.7 / (2 * 1000 * 695_700);

interface ProgramStar { readonly hd: number; readonly mk: string; readonly diameterMas: number; readonly diameterErrorMas: number; readonly teffK: number; readonly teffErrorK: number; readonly primaryComponent?: boolean }
function programStars(value: unknown) {
  if (!isRecord(value) || value.schema !== 'cssearth-code-1976-program-stars@1' || !isRecord(value.source) || !isRecord(value.source.diameters) || !Array.isArray(value.stars)) throw new TypeError('Invalid table of the Narrabri program stars.');
  const text = (record: Record<string, unknown>, key: string) => { const cell = record[key]; if (typeof cell !== 'string' || !cell) throw new TypeError(`The Narrabri table's ${key} is missing.`); return cell; };
  const stars = value.stars.map((entry): ProgramStar => {
    if (!isRecord(entry)) throw new TypeError('Invalid Narrabri program star.');
    const number = (key: string) => { const cell = entry[key]; if (typeof cell !== 'number' || !(cell > 0)) throw new TypeError(`Narrabri program star ${String(entry.hd)}: ${key} is not a positive number.`); return cell; };
    return { hd: number('hd'), mk: text(entry, 'mk'), diameterMas: number('diameterMas'), diameterErrorMas: number('diameterErrorMas'), teffK: number('teffK'), teffErrorK: number('teffErrorK'), ...(entry.primaryComponent === true ? { primaryComponent: true } : {}) };
  });
  if (new Set(stars.map(star => star.hd)).size !== stars.length) throw new TypeError('A Narrabri program star is listed twice.');
  return { stars, credit: text(value.source, 'credit'), url: text(value.source, 'url'), diameters: { credit: text(value.source.diameters, 'credit'), url: text(value.source.diameters, 'url') } };
}
export const NARRABRI = programStars(table);

/** One star's row of the typed tables, checked against the JMDC's row of the 1974 paper, with its Hipparcos parallax. */
export function parseNarrabriRow(hd: string, jmdc: string, xhip: string, hip: string) {
  const star = NARRABRI.stars.find(entry => String(entry.hd) === hd), where = `${NARRABRI.credit}, HD ${hd}`;
  if (!star) throw new Error(`${where}: not one of the paper's 32 program stars.`);
  if (star.primaryComponent) throw new Error(`${where}: the paper's temperature is of the primary component of a multiple star (Table 6, asterisk).`);
  const measured = vizierRows(jmdc).filter(row => row.BibCode === JMDC.bibcode && row.e_LDdiam);
  if (measured.length !== 1) throw new Error(`${where}: the JMDC holds ${measured.length} rows of ${NARRABRI.diameters.credit} with an error, not one.`);
  const diameter = Number(measured[0]!.LDdiam), error = Number(measured[0]!.e_LDdiam);
  if (diameter !== star.diameterMas || error !== star.diameterErrorMas) throw new Error(`${where}: the diameter typed from Table 1 (${star.diameterMas} +/- ${star.diameterErrorMas} mas) is not the JMDC's (${diameter} +/- ${error} mas).`);
  const rows = vizierRows(xhip).filter(row => row.HIP === hip);
  if (rows.length !== 1) throw new Error(`${XHIP.credit}: ${rows.length} rows for HIP ${hip}, not one.`);
  const parallax = Number(rows[0]!.Plx), parallaxError = Number(rows[0]!.e_Plx);
  if (!rows[0]!.Plx || !rows[0]!.e_Plx || !(parallax > 0) || !(parallaxError > 0)) throw new Error(`${XHIP.credit}, HIP ${hip}: no parallax.`);
  return { hd, hip, spectralType: star.mk, diameter: [star.diameterMas, star.diameterErrorMas] as const, teff: [star.teffK, star.teffErrorK] as const, parallax: [parallax, parallaxError] as const };
}

export function draftFromNarrabri(row: ReturnType<typeof parseNarrabriRow>, identifiers: readonly string[], hipparcos: ReturnType<typeof parseXhipRow>, gaia: boolean) {
  const { credit, url, diameters } = NARRABRI, preferred = preferredName(identifiers), hd = `HD ${row.hd}`, name = preferred?.name ?? hd;
  const parsecs = 1000 / row.parallax[0], r = SOLAR_RADII_PER_MAS_PARSEC * row.diameter[0] * parsecs, relative = Math.hypot(row.diameter[1] / row.diameter[0], row.parallax[1] / row.parallax[0]);
  // The radius to three significant figures, its error to two: no more than the diameter and the parallax carry.
  const radius = Number(r.toPrecision(3)), radiusError = Number((r * relative).toPrecision(2));
  const wider = radius >= 1.05 ? `${radius >= 100 ? Math.round(radius) : radius.toFixed(1)} times the Sun's width` : `the Sun's width`, kind = starKind(row.spectralType);
  const hip = gaia ? {} : { position: { catalogue: XHIP.catalogue, row: { HIP: hipparcos.hip }, credit: XHIP.credit, url: XHIP.url, motion: { epoch: 1991.25, ra: 'pmRA', dec: 'pmDE' } },
    radialVelocity: { value: hipparcos.rv, uncertainty: hipparcos.error, source: `${XHIP.credit.split(' (XHIP)')[0]}, XHIP, HIP ${hipparcos.hip}: RV ${hipparcos.rv} +/- ${hipparcos.error} km/s${hipparcos.quality ? ` (quality ${hipparcos.quality})` : ''}`, url: XHIP.url } };
  return {
    // An id starts with a letter: a star named by its Flamsteed number takes its HD number as its id.
    id: (/^\d/u.test(name) ? hd : name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), name, system: `${name} system`, parent: 'milky-way', target: hd,
    ...(name === hd ? {} : { aliases: [hd] }),
    description: `${kind} ${parsecs.toFixed(parsecs < 100 ? 1 : 0)} parsecs away, ${wider}: its disc was measured with the Narrabri intensity interferometer.`,
    paper: { url, credit },
    distance: { value: Number(parsecs.toFixed(3)), uncertainty: Number((parsecs * row.parallax[1] / row.parallax[0]).toFixed(3)),
      source: `${XHIP.credit}, HIP ${row.hip}: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, ${row.parallax[0]} +/- ${row.parallax[1]} mas, inverted`, url: XHIP.url },
    ...hip,
    radius: { value: radius, uncertainty: radiusError, url: diameters.url,
      source: `Computed here, not printed by a paper: ${radius} +/- ${radiusError} solar radii, from the limb-darkened angular diameter ${row.diameter[0]} +/- ${row.diameter[1]} mas of ${diameters.credit} (the Narrabri intensity interferometer; ${credit}, Table 1, and the JMDC) and the Hipparcos parallax ${row.parallax[0]} +/- ${row.parallax[1]} mas (van Leeuwen 2007, XHIP)` },
    mass: 'unmeasured' as const,
    temperature: { value: row.teff[0], uncertainty: row.teff[1], url, source: `${credit}, ${hd}: effective temperature ${row.teff[0]} +/- ${row.teff[1]} K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared` },
    // The reader text is the two tables' rows in words; nothing they do not hold but the radius, which the distance gives.
    text: { card: `${kind}, ${parsecs.toFixed(0)} parsecs away: ${wider}.`,
      introduction: `Its disc spans ${row.diameter[0]} milliarcseconds, which at its distance is ${radius} solar radii, and its surface is at ${row.teff[0].toLocaleString('en-US')} K.`,
      locator: `Tables 1 and 6, ${hd}: MK type, limb-darkened diameter, effective temperature` },
    planets: [], companions: [],
  };
}

/** `new-object --from-narrabri HD... --out spec.json`. */
export async function draftsFromNarrabri(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const hd of names.map(value => value.replace(/^HD\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hd)) throw new Error(`${NARRABRI.credit} is read by HD number, not ${hd}.`);
    const identifiers = await simbadIdentifiers(archive, `HD ${hd}`), hip = identifiers.find(id => /^HIP \d+$/u.test(id))?.slice(4);
    if (!hip) throw new Error(`HD ${hd}: SIMBAD lists no HIP number, and the radius needs the Hipparcos parallax.`);
    const jmdc = await archive.text(VIZIER_ASU, { '-source': JMDC.source, '-c': `HD ${hd}`, '-c.rs': '10', '-out': 'ID1,LDdiam,e_LDdiam,Method,BibCode', '-out.max': '50' });
    const xhip = await archive.text(VIZIER_ASU, { '-source': XHIP.catalogue, HIP: `=${hip}`, '-out.all': '1', '-out.max': '5' });
    const gaia = await gaiaPlaces(archive, identifiers), star = draftFromNarrabri(parseNarrabriRow(hd, jmdc, xhip, hip), identifiers, parseXhipRow(xhip, hip), gaia);
    stars.push(star);
    report.push(`HD ${hd}: drafted as ${star.name} from ${NARRABRI.credit}; its radius is computed here from the measured diameter and the Hipparcos parallax; no mass is recorded${gaia ? '' : `; placed by Hipparcos (HIP ${hip}), which Gaia DR3 does not place`}.`);
  }
  return { stars, report };
}
