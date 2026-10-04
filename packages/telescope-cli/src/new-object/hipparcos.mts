/** A draft spec for a Hipparcos star from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2 (VizieR J/MNRAS/471/770): the
 * effective temperature and luminosity their fit of a model atmosphere to the star's archived photometry gives, and the radius those
 * imply (their column 14), at the distance of the parallax they invert: Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen (2007) (section 2.3). One VizieR request per star, read by HIP number.
 *
 * A star is drafted only inside the paper's own well-fit subset (section 3.1, Fig. 1 bottom panel): parallax uncertainty under 25 per
 * cent, line-of-sight extinction AV under 3 mag and goodness of fit Q under 0.5 (their eq. 1: Q is 0 for a perfect fit and 1 when the
 * photometry deviates from the model by a factor of two on average); and only with what the paper calls a meaningful luminosity
 * (section 2.1): one uncertain by less than a factor of two, a fractional uncertainty under 1. The table gives a hot star 1.00 and a
 * temperature uncertainty equal to the temperature: without ultraviolet photometry the fit does not confine a star above about
 * 10,000 K (section 3.2.6), and such a row is refused.
 *
 * The fit is of one stellar atmosphere to all the light catalogued under the Hipparcos number. A number SIMBAD classes as a double or
 * multiple star, or as one of that branch's kinds (spectroscopic, eclipsing, ellipsoidal, symbiotic, cataclysmic, X-ray binaries;
 * https://simbad.cds.unistra.fr/guide/otypes.htx), is refused: the radius would be the system's light read as one star's.
 *
 * The star sits at the paper's distance, so its radius and distance agree. A star SIMBAD links to a Gaia DR3 source takes Gaia's
 * position and motion; one Gaia does not list sits on its Hipparcos row (XHIP, Anderson & Francis 2012, whose radial velocity it
 * takes). The paper's surface gravity is assumed, not measured (its column 15), so the mass is "unmeasured": GM is the records'
 * unpublished 0 and no limb law is chosen. The star is shown by its preferred name (display-name.mts, the IAU name first); one with a
 * name of its own is a map target. */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { adql, csv, SIMBAD_TAP } from './companions.mts';
import { preferredName, simbadIdentifiers } from './display-name.mts';
import { readIauNames } from './iau-names.mts';
import { slug } from './identity.mts';
import { sunWidth, wikipediaQuotes } from './prose.mts';

export const MCDONALD = { source: 'J/MNRAS/471/770/table2', paper: 'https://doi.org/10.1093/mnras/stx1433', credit: 'McDonald, Zijlstra & Watson (2017), MNRAS 471, 770' };
export const XHIP = { catalogue: 'V/137D/XHIP', url: 'https://doi.org/10.1134/S1063773712050015', credit: 'Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry' };
/** The paper's well-fit subset (section 3.1) and its limit for a meaningful luminosity (section 2.1: a factor of two). */
export const WELL_FIT = { parallax: 0.25, extinction: 3, quality: 0.5, luminosity: 1 } as const;
const COLUMNS = ['HIP', 'D', 'dplx', 'AV', 'Teff', 'e_Teff', 'L', 'e_L/L', 'Rad', 'Q'] as const;
/** SIMBAD's "double or multiple star" branch: main types whose catalogued light is of more than one star. */
export const SEVERAL_STARS: ReadonlyMap<string, string> = new Map([['**', 'a double or multiple star'], ['SB*', 'a spectroscopic binary'], ['EB*', 'an eclipsing binary'], ['El*', 'an ellipsoidal variable'],
  ['Sy*', 'a symbiotic star'], ['CV*', 'a cataclysmic binary'], ['No*', 'a nova'], ['XB*', 'an X-ray binary'], ['LXB', 'a low-mass X-ray binary'], ['HXB', 'a high-mass X-ray binary']]);

/** Refuses a Hipparcos number whose SIMBAD main type says its light is of several stars. */
export function requireOneStar(hip: string, mainType: string) {
  const several = SEVERAL_STARS.get(mainType.trim());
  if (several) throw new Error(`${MCDONALD.credit}, HIP ${hip}: SIMBAD classes it ${several} (${mainType.trim()}), so the table's fit is of the system's light, not of one star's.`);
}

/** Rows of a VizieR ASU tab-separated answer whose `key` column is `value`. */
export function vizierRows(tsv: string, key: string, value: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  return { header, rows: lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row[header.indexOf(key)] === value) };
}

/** The table 2 row of one HIP number, refused outside the paper's well-fit subset. */
export function parseMcDonaldRow(tsv: string, hip: string) {
  const { header, rows } = vizierRows(tsv, 'HIP', hip);
  if (rows.length !== 1) throw new Error(`${MCDONALD.credit}, table 2 has ${rows.length} rows for HIP ${hip}, not one.`);
  const value = (name: typeof COLUMNS[number]) => { const cell = rows[0]![header.indexOf(name)] ?? '', number = Number(cell); if (!cell || !Number.isFinite(number)) throw new Error(`${MCDONALD.credit}, HIP ${hip}: ${name} is empty.`); return number; };
  const row = { hip, parsecs: value('D'), parallaxFraction: value('dplx'), extinction: value('AV'), teff: value('Teff'), teffError: value('e_Teff'), luminosity: value('L'), luminosityFraction: value('e_L/L'), radius: value('Rad'), quality: value('Q') };
  const outside = [row.parallaxFraction >= WELL_FIT.parallax && `its parallax uncertainty is ${Math.round(row.parallaxFraction * 100)} per cent (under ${WELL_FIT.parallax * 100} is well fit)`,
    row.extinction >= WELL_FIT.extinction && `its line-of-sight extinction is AV ${row.extinction} mag (under ${WELL_FIT.extinction})`,
    row.quality >= WELL_FIT.quality && `its fit quality Q is ${row.quality} (under ${WELL_FIT.quality})`].filter(Boolean);
  if (outside.length) throw new Error(`${MCDONALD.credit}, HIP ${hip}: outside the paper's well-fit subset (section 3.1): ${outside.join('; ')}.`);
  if (row.luminosityFraction >= WELL_FIT.luminosity) throw new Error(`${MCDONALD.credit}, HIP ${hip}: its luminosity is uncertain by a factor of two (fractional uncertainty ${row.luminosityFraction}, temperature ${row.teff} +/- ${row.teffError} K), the paper's limit for a meaningful luminosity (section 2.1).`);
  return row;
}

/** The XHIP row's radial velocity, for a star placed on that row. */
export function parseXhipVelocity(tsv: string, hip: string) {
  const { header, rows } = vizierRows(tsv, 'HIP', hip);
  if (rows.length !== 1) throw new Error(`${XHIP.credit} has ${rows.length} rows for HIP ${hip}, not one.`);
  const cell = (name: string) => rows[0]![header.indexOf(name)] ?? '';
  const velocity = Number(cell('RV')), error = Number(cell('e_RV'));
  if (!cell('RV') || !Number.isFinite(velocity)) throw new Error(`${XHIP.credit}, HIP ${hip}: no radial velocity, and Gaia DR3 does not list the star.`);
  return { velocity, ...(cell('e_RV') && Number.isFinite(error) ? { error } : {}), quality: cell('q_RV') };
}


export function draftFromMcDonald(row: ReturnType<typeof parseMcDonaldRow>, identifiers: readonly string[], options: { readonly name?: ReturnType<typeof preferredName>; readonly gaia: boolean; readonly velocity?: ReturnType<typeof parseXhipVelocity>; readonly taken: (id: string) => boolean }) {
  const hip = `HIP ${row.hip}`, preferred = options.name, name = preferred?.name ?? hip, hd = identifiers.map(id => id.replace(/\s+/gu, ' ')).find(id => /^HD \d+$/u.test(id));
  // The id is the name's slug, else (a name taken by another body, or one that starts with a digit) the HD, then the HIP number's.
  const id = [name, hd, hip].filter((value): value is string => !!value).map(slug).find(candidate => /^[a-z]/u.test(candidate) && !options.taken(candidate));
  if (!id) throw new Error(`${hip}: every id its names give (${[name, hd, hip].join(', ')}) is taken or starts with a digit; give this star a spec by hand.`);
  const at = `${MCDONALD.credit}, table 2, ${hip}`, parsecs = row.parsecs, width = sunWidth(row.radius), luminosity = row.luminosity >= 10 ? Math.round(row.luminosity).toLocaleString('en-US') : String(row.luminosity);
  return {
    id, name, system: `${name} system`, parent: 'milky-way', target: hip,
    ...(name === hip ? {} : { aliases: [...new Set([preferred?.step === 'iau' ? preferredName(identifiers)?.name : undefined, hd, hip].filter((value): value is string => !!value && value !== name))] }),
    description: `A star ${parsecs.toFixed(0)} parsecs away, ${width}, measured from its light.`,
    paper: { url: MCDONALD.paper, credit: MCDONALD.credit },
    distance: { value: parsecs, uncertainty: Number((parsecs * row.parallaxFraction).toFixed(3)), source: `${at}: distance ${parsecs} pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty ${row.parallaxFraction}), at which the luminosity and radius hold`, url: MCDONALD.paper },
    radius: { value: row.radius, source: `${at}: radius ${row.radius} solar radii, implied by the fitted luminosity ${row.luminosity} solar luminosities (fractional uncertainty ${row.luminosityFraction}) and temperature`, url: MCDONALD.paper },
    mass: 'unmeasured',
    temperature: { value: row.teff, uncertainty: row.teffError, source: `${at}: effective temperature ${row.teff} +/- ${row.teffError} K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q ${row.quality})`, url: MCDONALD.paper },
    ...(options.gaia ? {} : {
      position: { catalogue: XHIP.catalogue, row: { HIP: row.hip }, credit: XHIP.credit, url: XHIP.url, motion: { epoch: 1991.25, ra: 'pmRA', dec: 'pmDE' } },
      radialVelocity: { value: options.velocity!.velocity, ...(options.velocity!.error === undefined ? {} : { uncertainty: options.velocity!.error }), source: `${XHIP.credit}, ${hip}: RV ${options.velocity!.velocity}${options.velocity!.error === undefined ? '' : ` +/- ${options.velocity!.error}`} km/s${options.velocity!.quality ? ` (quality ${options.velocity!.quality})` : ''}`, url: XHIP.url },
    }),
    limb: { none: `no mass is measured and no spectroscopic surface gravity is published with this radius: ${MCDONALD.credit} assume the gravity of their fit (table column 15)` },
    // The reader text is the table row in words, cited to it; nothing the row does not hold.
    text: { card: `A star ${parsecs.toFixed(0)} parsecs away, ${width}, measured from its light.`,
      introduction: `Its brightness, measured band by band, gives ${luminosity} times the Sun's luminosity at ${row.teff.toLocaleString('en-US')} K, so ${row.radius} solar radii.`,
      locator: `Table 2, ${hip}: D, Teff, L, Rad, Q` },
    planets: [], companions: [],
  };
}

/** Quotes from a named star's own Wikipedia article, asked for by its designation (Bayer or Flamsteed spelled out, else its HD, HR or
 * HIP number) and then by its name. The lead must name one of those designations unless the article is served under the designation
 * itself: an article about a namesake (a novel, a nymph, a city) names none, and gives no quotes. */
export function starQuotes(archive: Archive, identifiers: readonly string[], name: string, catalogued: readonly string[] = []) {
  const ids = identifiers.map(id => id.replace(/\s+/gu, ' ').trim()), designation = preferredName(ids.filter(id => !id.startsWith('NAME')));
  // `catalogued` adds the designation a name catalogue gives (the WGSN's "BD+14 4559"), when SIMBAD lists it as written.
  const listed = [...designation && designation.step !== 'catalogue' ? [designation.name] : [], ...catalogued.filter(id => ids.includes(id) && !id.startsWith('* ')), ...ids.filter(id => /^(?:HD|HR|HIP) \d+$/u.test(id))];
  // Wikipedia writes the genitive of Boötes with its diaeresis; SIMBAD's abbreviation spells out without it.
  const designations = [...new Set(listed.flatMap(id => id.endsWith(' Bootis') ? [id.replace(/ Bootis$/u, ' Boötis'), id] : [id]))];
  return designations.length ? wikipediaQuotes(archive, [...new Set([designations[0]!, name])], designations) : Promise.resolve(undefined);
}

/** `new-object --from-hipparcos HIP... --out spec.json`. */
export async function draftsFromHipparcos(names: readonly string[], archive: Archive, existing: (id: string) => boolean = () => false) {
  const stars: Record<string, unknown>[] = [], report: string[] = [], { lookup } = await readIauNames(), drafted = new Set<string>();
  const taken = (id: string) => existing(id) || drafted.has(id);
  for (const hip of names.map(value => value.replace(/^HIP\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hip)) throw new Error(`${MCDONALD.credit} is read by HIP number, not ${hip}.`);
    const row = parseMcDonaldRow(await archive.text(VIZIER_ASU, { '-source': MCDONALD.source, HIP: `=${hip}`, '-out': COLUMNS.join(','), '-out.max': '5' }), hip);
    requireOneStar(hip, String(csv(await archive.text(SIMBAD_TAP, adql(`SELECT b.otype FROM ident AS n JOIN basic AS b ON b.oid = n.oidref WHERE n.id = 'HIP ${hip}'`)))[0]?.otype ?? ''));
    const identifiers = await simbadIdentifiers(archive, `HIP ${hip}`), gaia = identifiers.some(id => /^Gaia DR3 \d+$/u.test(id.replace(/\s+/gu, ' ')));
    const velocity = gaia ? undefined : parseXhipVelocity(await archive.text(VIZIER_ASU, { '-source': XHIP.catalogue, HIP: `=${hip}`, '-out': 'HIP,RV,e_RV,q_RV', '-out.max': '5' }), hip);
    const name = preferredName(identifiers, lookup), star = draftFromMcDonald(row, identifiers, { name, gaia, ...(velocity ? { velocity } : {}), taken });
    const quotes = await starQuotes(archive, identifiers, star.name, name?.step === 'iau' ? [name.identifier] : []);
    stars.push(quotes ? { ...star, text: { ...star.text, quotes } } : star);
    drafted.add(star.id);
    report.push(`HIP ${hip}: drafted as ${star.name} (${star.id}) from ${MCDONALD.credit}; placed ${gaia ? 'by Gaia DR3' : 'on its XHIP row'} at the paper's distance${quotes ? `; quotes ${quotes.title}` : '; no Wikipedia quotes'}.`);
  }
  return { stars, report };
}
