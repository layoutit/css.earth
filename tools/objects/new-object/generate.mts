/** Generate a complete placed-star package from a star spec (spec.mts): the astronomy record from Gaia DR3 and SIMBAD, the colour
 * lens from the best archived spectrum (color.mts) with its limb-darkening law (limb.mts), the catalogue colour and navigation
 * marker from that lens, the manifest, acquisition plan, source records, credits and the README sections the data determine. Prose
 * only a person can write (the reader card and introduction, the README's account of the star) is marked TODO(new-object), which
 * tools/contract/object-package-consistency.test.mts refuses. The package's own readers check every choice as it is made. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCieTable } from '../observation/disc-integrated-color.mts';
import { readCie1931ColorMatching } from '../../references/reference-bank.mts';
import { bindInputs, installColorLens, json } from './lens.mts';
import { CROSS_CHECK_AGREEMENT } from '../observation/stellar/stellar-photometric-color.mts';
import { neutralDiscMarker, scaffoldStarFiles, solarRadii, TODO } from './scaffold.mts';
import { fetchGaiaRow, fetchPublication, GAIA_TAP, gaiaRowForm, identify, liveArchive, telescopeResolver, type Archive, type GaiaRow, type Identifiers, type Publication, type Resolver } from './archives.mts';
import { CHECKED, chooseColor, type ColorChoice } from './color.mts';
import { chooseLimb, type LimbChoice } from './limb.mts';
import type { Cited, StarSpec } from './spec.mts';
import { DUPLICATE_ARCSEC, duplicateName, duplicateStar, existingBodies, type Existing } from './identity.mts';
import { mergeRefresh, removeStale, STORED_SPEC, storedSpecDocument, storedStarSpec } from './refresh.mts';
import { quoteSource } from './prose.mts';

const SOLAR_RADIUS_KM = 695700, GM_SUN = 132712440041.93938;
const GAIA_LICENSE = { license: 'Gaia data are public under the ESA Gaia data policy; the Gaia/DPAC credit is retained', licenseEvidence: ['https://www.cosmos.esa.int/web/gaia-users/credits'] };
const fixed = (value: number, digits: number) => Number(value.toFixed(digits));

/** The star's physical values and the sentence that cites each. */
export function physicalValues(spec: StarSpec, row: GaiaRow) {
  const flame = (key: 'radiusFlame' | 'massFlame', label: string) => {
    const value = row[key];
    if (!value) throw new TypeError(`${spec.id}: the spec asks for the Gaia DR3 FLAME ${label}, and Gaia DR3 source ${row.sourceId} has none; cite a published value.`);
    return { value: value[0], text: `${label} ${value[0].toFixed(3)} (${value[1].toFixed(3)} to ${value[2].toFixed(3)}) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source)` };
  };
  const cite = (value: Cited, label: string, unit: string) => ({ value: value.value, text: `${label} ${value.value}${value.uncertainty ? ` +/- ${value.uncertainty}` : ''} ${unit} from ${value.source} (${value.url})` });
  const radius = spec.radius === 'gaia-flame' ? flame('radiusFlame', 'Radius') : cite(spec.radius, 'Radius', 'solar radii');
  const mass = spec.mass === 'gaia-flame' ? flame('massFlame', 'Mass') : cite(spec.mass, 'Mass', 'solar masses');
  const radiusKm = radius.value * SOLAR_RADIUS_KM, gm = GM_SUN * mass.value;
  const exact = Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2);
  const logg = spec.gravity ? spec.gravity.value : fixed(exact, 2);
  const gravitySource = spec.gravity ? `${spec.gravity.source} (${spec.gravity.url})`
    : `log g from the mass and radius in packages/astronomy/data/bodies/${spec.id}.json (sources in its physicalNotes), log10(GM/R^2) in cgs: ${exact.toFixed(3)}, rounded to two decimals`;
  return { radiusKm, gm, logg, gravitySource, radiusText: radius.text, massText: mass.text, radiusSolar: radius.value };
}

/** The astronomy record: Gaia DR3 astrometry, the spec's physical values, each with its source. */
export function astronomyRecord(spec: StarSpec, row: GaiaRow, ids: Identifiers, order: number) {
  const p = physicalValues(spec, row), t = spec.temperature;
  const rv = row.radialVelocity ?? spec.radialVelocity?.value;
  if (rv === undefined) throw new TypeError(`${spec.id}: Gaia DR3 source ${row.sourceId} has no radial velocity; give radialVelocity with its source.`);
  const cross = [ids.hd && `HD ${ids.hd}`, ids.hr && `HR ${ids.hr}`, ids.hip && `HIP ${ids.hip}`].filter(Boolean).join(', ');
  return { id: spec.id, classification: 'star', order,
    physical: { name: spec.name, horizonsCode: null, meanRadiusKm: fixed(p.radiusKm, 1), gravitationalParameterKm3PerS2: fixed(p.gm, 5), parent: null, effectiveTemperatureK: t.value },
    physicalNotes: `${p.radiusText}: ${Math.round(p.radiusKm).toLocaleString('en-US')} km at ${SOLAR_RADIUS_KM.toLocaleString('en-US')} km per solar radius. ${p.massText}; GM is that mass times the JPL solar GM. `
      + `Temperature ${t.value}${t.uncertainty ? ` +/- ${t.uncertainty}` : ''} K from ${t.source} (${t.url}).`
      + (spec.spin ? ` Spin inclination ${spec.spin.inclinationDegrees} degrees${spec.spin.periodDays ? ` and rotation period ${spec.spin.periodDays} d` : ''} from ${spec.spin.source} (${spec.spin.url}).` : '')
      + ' presentationUp: the display axis is a sky-plane convention; the spin axis\'s position angle on the sky is not measured.',
    star: { rightAscensionDegrees: row.ra, declinationDegrees: row.dec, positionEpochJulianYear: 2016, distanceParsecs: 1000 / row.parallax,
      properMotionRaMasPerYear: row.pmra, properMotionDecMasPerYear: row.pmdec, radialVelocityKmPerS: rv, presentationUp: 'display-axis',
      sources: {
        position: `Gaia DR3 source ${row.sourceId} (Gaia Collaboration 2023, A&A 674, A1), ICRS at epoch J2016.0, from the archived row src/objects/${spec.id}/source/photometry/gaia-dr3-source.csv${cross ? `; cross-identification ${cross}: https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Gaia+DR3+${row.sourceId}` : ''}`,
        distance: `Gaia DR3 parallax ${row.parallax.toFixed(4)} +/- ${row.parallaxError.toFixed(4)} mas (same row, RUWE ${row.ruwe.toFixed(2)}): ${(1000 / row.parallax).toFixed(2)} pc, no zero-point correction`
          + (row.ruwe > 1.4 ? '; the RUWE is high, so the astrometry fits a single star poorly, and the parallax is used as published' : ''),
        properMotion: `Gaia DR3 (same row): ${row.pmra.toFixed(3)}, ${row.pmdec.toFixed(3)} mas/yr`,
        radialVelocity: row.radialVelocity !== undefined ? `Gaia DR3 (same row): ${row.radialVelocity.toFixed(2)}${row.radialVelocityError ? ` +/- ${row.radialVelocityError.toFixed(2)}` : ''} km/s` : `${spec.radialVelocity!.source} (${spec.radialVelocity!.url})` } } };
}

/** A publication record in src/sources for a cited arXiv or DOI link. */
export function publicationRecord(publication: Publication) {
  if (publication.wikipedia) return { id: publication.id, kind: 'reference-page', identityLevel: 'work', title: `Wikipedia article: ${publication.title}`, identifiers: [{ type: 'Archive resource', value: publication.url }],
    links: [{ role: 'landing', url: publication.url, label: `Wikipedia, ${publication.title}` }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'Lead section, as the REST summary API serves it; the quotes name the revision' }], relations: [],
    statements: [{ kind: 'credit', text: `Wikipedia contributors, "${publication.title}", Wikipedia, The Free Encyclopedia`, scope: 'citation', evidence: publication.url },
      { kind: 'rights', text: 'Creative Commons Attribution-ShareAlike 4.0; sentences quoted verbatim with attribution', scope: 'Quoted text', evidence: 'https://creativecommons.org/licenses/by-sa/4.0/' }], creators: publication.creators };
  if (publication.page) return { id: publication.id, kind: 'reference-page', identityLevel: 'work', title: `Web page ${publication.title}`, identifiers: [{ type: 'Archive resource', value: publication.url }],
    links: [{ role: 'landing', url: publication.url, label: publication.title }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'The page as cited by a NASA Exoplanet Archive parameter set or by a spec' }], relations: [],
    statements: [{ kind: 'credit', text: publication.title, scope: 'citation', evidence: publication.url }] };
  const identifiers = [...publication.arxiv ? [{ type: 'arXiv', value: publication.arxiv }] : [], ...publication.doi ? [{ type: 'DOI', value: publication.doi }] : [], ...publication.bibcode ? [{ type: 'bibliography-key', value: publication.bibcode }] : []];
  if (publication.bibcode && !publication.arxiv && !publication.doi) return { id: publication.id, kind: 'publication', identityLevel: 'work', title: `Reference ${publication.bibcode}, as the NASA Exoplanet Archive cites it.`, identifiers,
    links: [{ role: 'landing', url: publication.url, label: 'Published reference' }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'ADS bibcode from the NASA Exoplanet Archive ps table (pl_refname)' }], relations: [],
    statements: [{ kind: 'limitation', text: 'Bibliographic identity transcribed from the NASA Exoplanet Archive; this record does not claim independent review of the paper.', scope: 'citation', evidence: publication.url }], publicationDate: publication.year };
  const lead = publication.creators[0]?.split(' ').at(-1) ?? 'Anonymous', authors = publication.creators.length > 2 ? `${lead} et al.` : publication.creators.map(name => name.split(' ').at(-1)).join(' & ');
  return { id: publication.id, kind: 'publication', identityLevel: 'work', title: `${authors} (${publication.year}): ${publication.title}`, identifiers,
    links: [{ role: 'archive', url: publication.url, label: publication.arxiv ? 'arXiv preprint' : 'Publisher' }, ...publication.doi && publication.arxiv ? [{ role: 'landing', url: `https://doi.org/${publication.doi}`, label: publication.publisher ?? 'Journal version' }] : []],
    evidence: [{ url: publication.url, checkedOn: CHECKED, locator: publication.arxiv ? 'arXiv API record: title, authors, journal reference' : 'Crossref record: title, authors, container' }],
    relations: [], statements: [{ kind: 'credit', text: `${authors} (${publication.year})${publication.publisher ? `, ${publication.publisher}` : ''}`, scope: 'citation', evidence: publication.url }],
    ...(publication.publisher ? { publisher: publication.publisher } : {}), creators: publication.creators.length > 3 ? [...publication.creators.slice(0, 3), 'et al.'] : publication.creators, publicationDate: publication.year };
}

export interface Generated {
  readonly id: string; readonly files: Map<string, string | Buffer>; readonly color: ColorChoice; readonly limb: LimbChoice; readonly hex: string;
  readonly todo: readonly string[];
}

/** Compose every file of the package and its shared records. Pure apart from the archive reads; the caller writes. */
export async function generateStar(spec: StarSpec, { archive = liveArchive, root = process.cwd(), resolver = telescopeResolver(root), order, universe, refresh = false }: { archive?: Archive; root?: string; resolver?: Resolver; order: number; universe?: Existing; refresh?: boolean }): Promise<Generated> {
  // The Gaia row waits only for the identity; everything else (colour, limb, the papers) is read at once.
  const ids = await identify(resolver, spec.target, spec.gaia, spec.id);
  const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  const urls = [...new Set([spec.paper.url, ...(spec.text?.quotes ? [spec.text.quotes.url] : []), ...[spec.radius, spec.mass, spec.temperature, spec.gravity, spec.radialVelocity, spec.spin].flatMap(value => value && value !== 'gaia-flame' ? [value.url] : [])])];
  const [{ csv, row }, found] = await Promise.all([fetchGaiaRow(archive, ids.gaia), Promise.all(urls.map(async url => [url, await fetchPublication(archive, url)] as const))]);
  const id = spec.id, o = `src/objects/${id}`, s = `${o}/source`, physical = physicalValues(spec, row);
  // A star already placed under another id (a common name, another catalogue) is the same star: never a second package.
  const held = duplicateStar(universe ?? await existingBodies(root), { ra: row.ra, dec: row.dec, epoch: 2016 }, refresh ? id : undefined);
  if (held) throw new Error(`${id}: Gaia DR3 ${row.sourceId} is ${held}, already in the universe (within ${DUPLICATE_ARCSEC}" of its position); add its bodies with { "host": "${held}" }.`);
  const body = astronomyRecord(spec, row, ids, order);
  const [color, limb] = await Promise.all([chooseColor(spec, row, ids, archive, cmf), chooseLimb(id, spec.temperature.value, physical.logg, archive, spec.limb?.none)]);
  const publications = new Map<string, Publication>(found.flatMap(([url, publication]) => publication ? [[url, publication]] : []));
  const catalogueOf = (url: string) => { const publication = publications.get(url); if (!publication) throw new TypeError(`${id}: no publication record was read for ${url}; cite the paper by arXiv, DOI or ADS link, or a web page by its address.`); return publication; };
  const paper = catalogueOf(spec.paper.url);

  // The package the scaffold writes, then every file the data decide.
  const scaffold = scaffoldStarFiles({ id, name: spec.name, system: spec.system, temperatureK: spec.temperature.value, temperatureSource: `${spec.temperature.source} (${spec.temperature.url})`,
    description: spec.description, paper: spec.paper.url, paperCredit: spec.paper.credit, order }, body, (await import(pathToFileURL(resolve(root, 'src/platform/solar-geometry.mts')).href) as { SOLAR_GEOMETRY_EPOCH_JD_TT: number }).SOLAR_GEOMETRY_EPOCH_JD_TT);
  const files = new Map<string, string | Buffer>(scaffold), read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  files.set(`packages/astronomy/data/bodies/${id}.json`, `${JSON.stringify(body, null, 1)}\n`);
  files.set(`${s}/photometry/gaia-dr3-source.csv`, csv);
  const { hex: colorHex, words: colorWords } = await installColorLens(files, id, color, limb);

  const measurements = read(`${s}/measurements.json`), distance = 1000 / row.parallax, out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(measurements)) {
    out[key] = value;
    if (key === 'effectiveTemperatureSource') { out.surfaceGravityLogg = physical.logg; out.surfaceGravitySource = physical.gravitySource; }
  }
  out.angularDiameterSource = `Computed here from the record's radius and distance: 2 x ${Math.round(physical.radiusKm).toLocaleString('en-US')} km at ${distance.toFixed(2)} pc = ${measurements.angularDiameterMas} mas. No interferometric diameter of this star is used.`;
  out.shape = { kind: 'uniform-disc-sphere', qualification: `A sphere at the published radius, coloured from ${colorWords} (photometry/stellar-color.json); no image of the photosphere exists.` };
  files.set(`${s}/measurements.json`, json(out));

  // Spin: a tilt the spec cites is used, with the visible pole north and toward us; its position angle stays a convention.
  if (spec.spin) {
    const ra = row.ra * Math.PI / 180, dec = row.dec * Math.PI / 180, i = spec.spin.inclinationDegrees * Math.PI / 180;
    const los = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
    const axis = north.map((n, k) => Math.sin(i) * n - Math.cos(i) * los[k]!);
    const axisRa = (Math.atan2(axis[1]!, axis[0]!) * 180 / Math.PI + 360) % 360, axisDec = Math.asin(axis[2]!) * 180 / Math.PI;
    const rotation = read(`${s}/preparation/rotation.json`);
    Object.assign(rotation, { rightAscensionDegrees: axisRa, declinationDegrees: axisDec, displayMeridianDegrees: 90,
      source: `Spin inclination ${spec.spin.inclinationDegrees} degrees from the line of sight${spec.spin.periodDays ? ` and rotation period ${spec.spin.periodDays} d` : ''}: ${spec.spin.source} (${spec.spin.url}), with the north pole tilted toward us. The direction of the axis on the sky is not measured; it is placed toward celestial north as a convention. The axis is sin(i) x sky-north - cos(i) x (direction to the star): RA ${axisRa.toFixed(4)}, Dec ${axisDec >= 0 ? '+' : ''}${axisDec.toFixed(4)}. Longitude 0 faces the Sun as a display convention.`,
      coordinateSystem: 'ICRF/J2000. +Z is the spin axis above; +X is the display meridian; east longitude. No spin is propagated.',
      qualification: 'The tilt of the spin axis is measured; its position angle on the sky and the rotation phase are display conventions.' });
    files.set(`${s}/preparation/rotation.json`, json(rotation));
  } else {
    const rotation = read(`${s}/preparation/rotation.json`);
    rotation.source = rotation.source.replace(` (${TODO}: name the literature checked)`, ' is used');
    files.set(`${s}/preparation/rotation.json`, json(rotation));
  }

  const content = read(`${s}/content/object.json`), radiusSource = spec.radius === 'gaia-flame' ? undefined : catalogueOf(spec.radius.url);
  const gaiaFact = { catalogueId: `gaia-dr3-${id}`, url: 'https://gea.esac.esa.int/archive/', label: 'Gaia DR3', checked: CHECKED };
  content.panel.facts = [
    { id: 'radius', label: 'Radius', value: `${solarRadii(physical.radiusSolar)} solar radii`,
      source: { ...(radiusSource ? { catalogueId: radiusSource.id, url: radiusSource.url, label: String(publicationRecord(radiusSource).statements[0]!.text) } : { ...gaiaFact, label: 'Gaia DR3 FLAME' }), checked: CHECKED, path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
    { id: 'distance', label: 'Distance from the Sun', value: `${distance >= 100 ? Math.round(distance) : distance.toFixed(1)} parsecs`, source: { ...gaiaFact, label: 'Gaia DR3 parallax', path: 'source/measurements.json', locator: 'distanceParsecs; distanceSource' } },
    ...spec.spin?.periodDays ? [{ id: 'rotation', label: 'Day', value: spec.spin.periodDays >= 2 ? `${spec.spin.periodDays.toFixed(1)} days` : `${Math.round(spec.spin.periodDays * 24)} hours`,
      source: { catalogueId: catalogueOf(spec.spin.url).id, url: spec.spin.url, label: spec.spin.source, checked: CHECKED, path: 'source/preparation/rotation.json', locator: 'source' } }] : []];
  content.provenance.physical.credit = `${physical.radiusText.split(' from ')[1]?.split(' (')[0] ?? 'Published radius'} radius; Gaia DR3 astrometry${spec.spin ? '; measured spin tilt, axis direction a display convention' : '; no measured rotation axis (display convention)'}`;
  files.set(`${s}/content/object.json`, json(content));

  const text = read(`${o}/text.json`);
  // Drafted text is written as it stands, cited to the paper at its locator; otherwise the card and introduction stay marked.
  if (spec.text) { text.card.text = spec.text.card; text.introduction.text = spec.text.introduction; }
  // The label a reader sees: the record's credit line, or the spec's credit when the record has none (an ADS bibcode alone).
  const paperLabel = publicationRecord(paper).statements.find(statement => statement.kind === 'credit')?.text ?? spec.paper.credit;
  for (const key of ['card', 'introduction'] as const) text[key].sources = [{ catalogueId: paper.id, url: spec.paper.url, label: paperLabel, checked: CHECKED, ...(spec.text ? { locator: spec.text.locator } : { locator: TODO, quote: TODO }) },
    ...quoteSource(spec.text?.quotes, key, publications)];
  files.set(`${o}/text.json`, json(text));

  // Manifest and acquisition.
  const manifest = read(`${s}/manifest.json`);
  const gaiaInput = { id: `${id}-gaia-dr3-source`, path: 'photometry/gaia-dr3-source.csv', origin: GAIA_TAP, credit: 'ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; Creevey et al. (2023), A&A 674, A26 (FLAME)', ...GAIA_LICENSE,
    acquisition: `Gaia Archive TAP query in source/preparation/acquisition.json: the gaia_source row of source_id ${row.sourceId} (position, parallax, proper motion, radial velocity) with its FLAME mass and radius.`,
    redistribution: 'One catalogue row, retained unchanged with its credit.', consumers: ['placement'] };
  manifest.inputs = [...manifest.inputs, gaiaInput];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...plan.operations, { kind: 'request-download', groups: ['restore', 'refresh'], path: 'photometry/gaia-dr3-source.csv', url: GAIA_TAP, form: gaiaRowForm(row.sourceId), requiredPrefix: 'source_id,' },
  ];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  // The spec this package was made from, so `--refresh` can make it again (refresh.mts).
  files.set(`${s}/preparation/new-object.json`, storedStarSpec(spec, order));
  const declared = read(`${s}/manifest.json`);
  declared.documents = [...declared.documents.filter((entry: { path: string }) => entry.path !== storedSpecDocument.path), storedSpecDocument];
  files.set(`${s}/manifest.json`, json(declared));
  bindInputs(files, id);

  // Credits, README and records.
  const credits = [`# ${spec.name} credits`,
    `Radius, mass and temperature: ${[physical.radiusText, physical.massText, `temperature from ${spec.temperature.source}`].join('; ')}.${spec.spin ? ` Spin: ${spec.spin.source}.` : ''}`,
    ...color.credits, ...limb.credit ? [limb.credit] : [],
    `Placement: Gaia DR3 source ${row.sourceId}: position, parallax, proper motion${row.radialVelocity !== undefined ? ' and radial velocity' : ''}. This work has made use of data from the European Space Agency (ESA) mission Gaia, processed by the Gaia Data Processing and Analysis Consortium (DPAC). Identifiers: SIMBAD, CDS, Strasbourg.`,
  ];
  files.set(`${o}/NOTICE.md`, `${credits.join('\n\n')}\n`);
  const names = [ids.hd && `HD ${ids.hd}`, ids.hr && `HR ${ids.hr}`, ids.hip && `HIP ${ids.hip}`].filter(Boolean).join(', ');
  files.set(`${o}/README.md`, [`# ${spec.name}`, '', '## Sources', '',
    spec.text ? `${spec.text.introduction}${names ? ` It is also ${names}.` : ''} This account was drafted from ${spec.paper.credit}'s values; the sections below are the data's own.` : `${spec.name}${names ? ` (${names})` : ''} is ${distance.toFixed(1)} parsecs away. ${TODO}: what the star is and why it is here, from ${spec.paper.credit}.`, '',
    `**Star.** Placement: Gaia DR3 source ${row.sourceId}, parallax ${row.parallax.toFixed(3)} ± ${row.parallaxError.toFixed(3)} mas (${distance.toFixed(2)} pc)${row.ruwe > 1.4 ? `; its RUWE is ${row.ruwe.toFixed(1)}, so the single-star astrometry fits poorly, and the parallax is used as published` : ''}. ${physical.radiusText}. ${physical.massText}. Temperature ${spec.temperature.value.toLocaleString('en-US')} K from ${spec.temperature.source}. log g ${physical.logg}${spec.gravity ? ` from ${spec.gravity.source}` : ' from the mass and radius'}.`, '',
    `**Colour.** ${color.summary.charAt(0).toUpperCase()}${color.summary.slice(1)}, through the CIE 1931 2° observer: ${colorHex}. Routes tried in order: ${[...color.tried, `${color.route}: used`].join('; ')}.`, '',
    `**Limb.** ${limb.limbDarkening ? `The disc is ${limb.sentence}.` : `${limb.sentence}.`}`, '',
    ...spec.spin ? [`**Spin.** ${spec.spin.inclinationDegrees}° from the line of sight${spec.spin.periodDays ? `, period ${spec.spin.periodDays} d` : ''} (${spec.spin.source}). The axis's direction on the sky is unmeasured and set toward celestial north.`, ''] : [],
    '## Evidence', '', `Generated ${CHECKED} by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.`, '',
    ...color.crossCheck ? [`- The colour's cross-check differs by ${color.crossCheck.difference} levels at most in any channel (threshold ${CROSS_CHECK_AGREEMENT}); [object-package-consistency.test.mts](../../../tools/contract/object-package-consistency.test.mts) recomputes it after preparation.`] : [],
    ...spec.text ? [] : [`- ${TODO}: the tests and captures that prove the rest of the package.`], '',
    '## Known problems', '', '- **Assumptions of the frame.** The axis\'s position angle and the rotation phase are conventions.',
    ...limb.limbDarkening ? ['- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.'] : [],
    ...spec.notes.map(note => `- **Not shown.** ${note}.`),
    ...spec.text ? [`- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person${spec.text.quotes ? `; their quotes are sentences of the Wikipedia article "${spec.text.quotes.title}" (revision ${spec.text.quotes.revision}), verbatim, CC BY-SA 4.0` : ''}.`] : [`- ${TODO}: anything else not shown and why.`], '',
    '[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)', ''].join('\n'));

  files.set(`src/sources/gaia-dr3-${id}.json`, json({ id: `gaia-dr3-${id}`, kind: 'data-product', identityLevel: 'work', title: `Gaia DR3 gaia_source row for ${spec.name} (source_id ${row.sourceId})`,
    identifiers: [{ type: 'Gaia DR3 source_id', value: row.sourceId }], links: [{ role: 'archive', url: 'https://gea.esac.esa.int/archive/', label: 'Gaia Archive' }, { role: 'landing', url: 'https://doi.org/10.1051/0004-6361/202243940', label: 'Gaia Collaboration (2023), Gaia DR3 summary' }],
    evidence: [{ url: `${GAIA_TAP}?${new URLSearchParams(gaiaRowForm(row.sourceId))}`, checkedOn: CHECKED,
      locator: `gaiadr3.gaia_source at epoch 2016.0: parallax ${row.parallax.toFixed(5)} +/- ${row.parallaxError.toFixed(5)} mas, pmra ${row.pmra.toFixed(3)}, pmdec ${row.pmdec.toFixed(3)} mas/yr${row.radialVelocity !== undefined ? `, radial_velocity ${row.radialVelocity.toFixed(2)} km/s` : ''}, RUWE ${row.ruwe.toFixed(2)}, has_xp_sampled ${row.hasXpSampled}${row.massFlame ? `; mass_flame ${row.massFlame[0].toFixed(4)}` : ''}${row.radiusFlame ? `, radius_flame ${row.radiusFlame[0].toFixed(4)}` : ''}` }],
    relations: [], statements: [{ kind: 'credit', text: 'ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; Creevey et al. (2023), A&A 674, A26', scope: 'citation', evidence: 'https://www.cosmos.esa.int/web/gaia-users/credits' }],
    publisher: 'European Space Agency, Gaia Data Processing and Analysis Consortium' }));
  for (const publication of publications.values()) files.set(`src/sources/${publication.id}.json`, json(publicationRecord(publication)));
  for (const record of color.catalogue) files.set(`src/sources/${record.id}.json`, json(record.record));

  const todo = [...color.todo ? [color.todo] : [], ...spec.text ? ['review the drafted card, introduction and README'] : ['reader card and introduction with quotes (text.json)', 'the README account of the star and its evidence']];
  return { id, files, color, limb, hex: colorHex, todo };
}

/** A source record the catalogue already holds under another id (the same arXiv, DOI, bibcode or Gaia source_id) is reused, not
 * written again: the catalogue refuses two records for one provider identity. Every reference in the generated files is pointed
 * at the existing record. */
export async function reconcileSources(files: Map<string, string | Buffer>, root: string) {
  const { readdir } = await import('node:fs/promises'), directory = resolve(root, 'src/sources'), owners = new Map<string, string>();
  type SourceIdentity = { id: string; identityLevel?: string; version?: string; identifiers?: { type: string; value: string }[] };
  const key = (record: SourceIdentity) => (record.identifiers ?? []).map(id => `${record.identityLevel}:${record.version ?? ''}:${id.type}:${id.value}`);
  for (const name of await readdir(directory)) {
    const record = JSON.parse(await readFile(resolve(directory, name), 'utf8')) as SourceIdentity;
    for (const identity of key(record)) owners.set(identity, record.id);
  }
  const renames = new Map<string, string>();
  for (const [path, value] of files) {
    if (!path.startsWith('src/sources/')) continue;
    const record = JSON.parse(String(value)) as SourceIdentity, existing = key(record).map(identity => owners.get(identity)).find(owner => owner && owner !== record.id);
    if (existing) { renames.set(record.id, existing); files.delete(path); }
  }
  if (!renames.size) return renames;
  for (const [path, value] of files) {
    if (typeof value !== 'string') continue;
    let text = value;
    for (const [from, to] of renames) text = text.replaceAll(`"${from}"`, `"${to}"`);
    files.set(path, text);
  }
  return renames;
}

/** Write a generated package's files. A package that exists is written over only on a refresh, under refresh.mts's rules; shared
 * records that exist are kept. Returns the paths written and, on a refresh, what a person wrote that was kept. */
export async function writePackageFiles(files: Map<string, string | Buffer>, id: string, root: string, refresh = false) {
  const exists = (path: string) => stat(resolve(root, path)).then(() => true, () => false);
  let kept: string[] = [], stale: string[] = [];
  if (await exists(`src/objects/${id}`)) {
    if (!refresh) throw new Error(`src/objects/${id} already exists; the generator never overwrites a package (refresh regenerates one it made: --refresh ${id}).`);
    ({ kept, stale } = await mergeRefresh(files, id, root));
  } else if (await exists(`packages/astronomy/data/bodies/${id}.json`) && !refresh) throw new Error(`packages/astronomy/data/bodies/${id}.json already exists; the generator never overwrites a record.`);
  await reconcileSources(files, root);
  const written: string[] = [];
  for (const [path, value] of files) {
    if (path.startsWith('src/sources/') && await exists(path)) continue;
    await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); written.push(path);
  }
  await removeStale(root, stale);
  return { written, kept };
}

/** Write a generated star's package and its marker. */
export async function writeGenerated(generated: Generated, root = process.cwd(), refresh = false) {
  const { written, kept } = await writePackageFiles(generated.files, generated.id, root, refresh);
  const presentation = resolve(root, `src/objects/${generated.id}/source/presentation`);
  // The marker needs the package on disk: a placeholder first, then the colour lens as a disc.
  await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
  const { authorContextMarkers } = await import('../source-authoring/context-markers.mts');
  await authorContextMarkers([generated.id]);
  return { written, kept };
}

export interface NewObjectResult { readonly id: string; readonly kind: 'star' | 'planet' | 'companion'; readonly files: number; readonly hex?: string; readonly color?: string; readonly crossCheck?: { readonly route: string; readonly difference: number }; readonly limb?: string; readonly orbit?: string; readonly todo: readonly string[];
  /** On a refresh: what a person wrote that was kept. */
  readonly kept?: readonly string[];
  /** Why this body was not written; the rest of the batch still is. */
  readonly failed?: string }
const HANDOFF = 'output/new-object/hosted.json';
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;

/** Every system of a spec file, generated and written: the one run behind `telescope new-object` and tools/objects/new-object.mts.
 * Stars and every hosted body's astronomy record are written first; the astronomy package is rebuilt; the hosted packages are then
 * written by a fresh process (runHostedPhase), which loads the rebuilt package. A system that fails is reported with its reason and
 * the rest of the batch goes on; nothing of it is written. `refresh` regenerates bodies the tool made, under refresh.mts's rules. */
export async function runNewObject(specPath: string, { root = process.cwd(), progress = (_line: string) => {}, skipExisting = false, refresh = false }: { root?: string; progress?: (line: string) => void; skipExisting?: boolean; refresh?: boolean } = {}): Promise<NewObjectResult[]> {
  const { readdir } = await import('node:fs/promises'), { parseObjectSpecs } = await import('./spec.mts'), { hostedRecord } = await import('./hosted.mts');
  const parsed = parseObjectSpecs(JSON.parse(await readFile(resolve(specPath), 'utf8')));
  const exists = (path: string) => stat(resolve(root, path)).then(() => true, () => false);
  const skipped: string[] = [];
  const keep = async <T extends { id: string }>(entries: readonly T[]) => { const out: T[] = []; for (const entry of entries) { if (skipExisting && !refresh && await exists(`src/objects/${entry.id}`)) skipped.push(entry.id); else out.push(entry); } return out; };
  const specs: StarSpec[] = [], additions: typeof parsed.additions = [];
  for (const spec of await keep(parsed.stars)) specs.push({ ...spec, planets: await keep(spec.planets), companions: await keep(spec.companions) });
  for (const addition of parsed.additions) { const planets = await keep(addition.planets), companions = await keep(addition.companions); if (planets.length || companions.length) additions.push({ ...addition, planets, companions }); }
  if (skipped.length) progress(`Already in the universe, skipped: ${skipped.join(', ')}`);
  for (const addition of additions) if (!await exists(`packages/astronomy/data/bodies/${addition.host}.json`)) throw new Error(`${addition.host}: no such star to add bodies to.`);
  // An id or a name the universe holds is refused before any archive is read; a refresh may only name bodies the tool made.
  const universe = await existingBodies(root);
  for (const entry of [...specs, ...specs.flatMap(spec => [...spec.planets, ...spec.companions]), ...additions.flatMap(addition => [...addition.planets, ...addition.companions])]) {
    if (refresh) { if (!await exists(`src/objects/${entry.id}/${STORED_SPEC}`)) throw new Error(`${entry.id}: no ${STORED_SPEC}; refresh only regenerates what new-object made.`); continue; }
    for (const path of [`src/objects/${entry.id}`, `packages/astronomy/data/bodies/${entry.id}.json`]) if (await exists(path)) throw new Error(`${path} already exists; the generator never overwrites an object (refresh regenerates one it made: --refresh ${entry.id}).`);
    const held = duplicateName(universe, entry.name);
    if (held) throw new Error(`${entry.id}: ${entry.name} is already in the universe as ${held}.`);
  }
  // An object without an order takes the next free one after every body the astronomy package holds.
  const bodies = resolve(root, 'packages/astronomy/data/bodies'), taken: number[] = [];
  for (const name of await readdir(bodies)) taken.push(Number((JSON.parse(await readFile(resolve(bodies, name), 'utf8')) as { order?: number }).order ?? 0));
  let next = Math.max(...taken) + 1;
  const results: NewObjectResult[] = [], hosted: unknown[] = [];
  const total = specs.length + additions.length, started = Date.now(), elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  let done = 0;
  // Orders are handed out before the systems run, so the numbering does not depend on which finishes first.
  const orders = new Map<string, number>();
  for (const spec of specs) { orders.set(spec.id, spec.order ?? next++); for (const entry of [...spec.planets, ...spec.companions]) orders.set(entry.id, entry.order ?? next++); }
  for (const addition of additions) for (const entry of [...addition.planets, ...addition.companions]) orders.set(entry.id, entry.order ?? next++);
  const failed = (id: string, kind: NewObjectResult['kind'], error: unknown) => { results.push({ id, kind, files: 0, todo: [], failed: reason(error) }); progress(`  ${id}: FAILED, not written: ${reason(error)}`); };
  // Three systems at a time: enough to overlap the archives' latency, few enough to stay polite to them.
  const system = async (spec: StarSpec) => {
    progress(`[${++done}/${total}] ${spec.id}: resolving ${spec.target ?? `Gaia DR3 ${spec.gaia}`} and reading the archives (${elapsed()})`);
    let generated: Generated, written: { written: string[]; kept: string[] };
    try { generated = await generateStar(spec, { root, order: orders.get(spec.id)!, universe, refresh }); written = await writeGenerated(generated, root, refresh); }
    catch (error) { failed(spec.id, 'star', error); for (const entry of [...spec.planets, ...spec.companions]) failed(entry.id, entry.kind, new Error(`its star ${spec.id} failed`)); return; }
    const result: NewObjectResult = { id: spec.id, kind: 'star', files: written.written.length, hex: generated.hex, color: generated.color.route, ...(generated.color.crossCheck ? { crossCheck: generated.color.crossCheck } : {}),
      limb: generated.limb.grid ?? 'none', todo: generated.todo, ...(written.kept.length ? { kept: written.kept } : {}) };
    results.push(result);
    progress(`  ${spec.id}: colour ${result.hex} from ${result.color}${result.crossCheck ? ` (cross-check ${result.crossCheck.route}, ${result.crossCheck.difference} levels)` : ''}, limb ${result.limb}, ${written.written.length} files${written.kept.length ? `; kept ${written.kept.join(', ')}` : ''} (${elapsed()})`);
    const body = JSON.parse(String(generated.files.get(`packages/astronomy/data/bodies/${spec.id}.json`))) as Record<string, any>;
    await Promise.all([...spec.planets, ...spec.companions].map(entry => hostedRecordFor(entry, { spec, body })));
  };
  const hostedRecordFor = async (entry: StarSpec['planets'][number], host: { spec: StarSpec; body: Record<string, any> }) => {
    try {
      const record = await hostedRecord(entry, host, orders.get(entry.id)!, liveArchive, root);
      progress(`  ${entry.id}: orbit from ${'whereistheplanet' in entry.orbit ? `whereistheplanet ${entry.orbit.whereistheplanet}` : 'archive' in entry.orbit ? record.orbitCitation.label : 'the cited elements'} (P ${record.orbit.periodDays} d, a/R* ${record.orbit.semiMajorAxisStellarRadii})${record.todo.length ? `; noted: ${record.todo.join('; ')}` : ''}`);
      await writeFile(resolve(root, `packages/astronomy/data/bodies/${entry.id}.json`), `${JSON.stringify(record.body, null, 1)}\n`);
      hosted.push({ ...record, documents: Object.fromEntries(record.documents) });
    } catch (error) { failed(entry.id, entry.kind, error); }
  };
  const queue = [...specs];
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { for (let spec = queue.shift(); spec; spec = queue.shift()) await system(spec); }));
  for (const addition of additions) {
    progress(`[${++done}/${total}] ${addition.host}: adding ${[...addition.planets, ...addition.companions].map(body => body.id).join(', ')}`);
    // A star that exists: its astronomy record is the host, its system name the one its package already carries.
    const body = JSON.parse(await readFile(resolve(root, `packages/astronomy/data/bodies/${addition.host}.json`), 'utf8')) as Record<string, any>;
    if (!body.star) { for (const entry of [...addition.planets, ...addition.companions]) failed(entry.id, entry.kind, new Error(`${addition.host} is not a placed star (its record has no star block)`)); continue; }
    const descriptor = JSON.parse(await readFile(resolve(root, `src/objects/${addition.host}/object.json`), 'utf8')) as Record<string, any>;
    const host = { spec: { id: addition.host, system: String(descriptor.properties.catalog.systemName ?? `${body.physical.name} system`) } as StarSpec, body };
    for (const entry of [...addition.planets, ...addition.companions]) await hostedRecordFor(entry, host);
  }
  if (hosted.length) {
    progress(`Rebuilding the astronomy package with ${hosted.length} orbit${hosted.length === 1 ? '' : 's'}, then writing their packages (${elapsed()})`);
    execFileSync('pnpm', ['-s', 'build:astronomy'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    await mkdir(resolve(root, dirname(HANDOFF)), { recursive: true }); await writeFile(resolve(root, HANDOFF), json({ refresh, records: hosted }));
    const out = execFileSync(process.execPath, [resolve(root, 'tools/objects/new-object.mts'), '--hosted', HANDOFF], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] }).toString('utf8');
    for (const result of JSON.parse(out) as NewObjectResult[]) { results.push(result); if (result.failed) progress(`  ${result.id}: FAILED, not written: ${result.failed}`); }
  }
  const failures = results.filter(result => result.failed);
  if (failures.length) progress(`${failures.length} of ${results.length} bodies failed and were not written: ${failures.map(result => result.id).join(', ')}`);
  return results;
}

/** Phase two, in a process that loads the rebuilt astronomy package: every hosted body's package. */
export async function runHostedPhase(handoff: string, root = process.cwd()): Promise<NewObjectResult[]> {
  const { hostedPackage } = await import('./hosted.mts'), { neutralDiscMarker } = await import('./scaffold.mts');
  const { SOLAR_GEOMETRY_EPOCH_JD_TT } = await import(pathToFileURL(resolve(root, 'src/platform/solar-geometry.mts')).href) as { SOLAR_GEOMETRY_EPOCH_JD_TT: number };
  const { refresh, records } = JSON.parse(await readFile(resolve(root, handoff), 'utf8')) as { refresh: boolean; records: any[] }, results: NewObjectResult[] = [];
  for (const saved of records) {
    try {
      const record = { ...saved, documents: new Map(Object.entries(saved.documents as Record<string, string>)) };
      const hostBody = JSON.parse(await readFile(resolve(root, `packages/astronomy/data/bodies/${record.hostId}.json`), 'utf8'));
      const urls = [record.spec.paper.url, record.spec.text?.quotes?.url, record.radius.url, record.mass.url, record.orbitCitation.url, record.spec.temperature?.url].filter((url): url is string => typeof url === 'string');
      const publications = new Map<string, Publication>();
      for (const url of new Set(urls)) { const publication = await fetchPublication(liveArchive, url); if (publication) publications.set(url, publication); }
      const { files, hex } = await hostedPackage(record, hostBody, publications, liveArchive, root, SOLAR_GEOMETRY_EPOCH_JD_TT);
      for (const publication of publications.values()) files.set(`src/sources/${publication.id}.json`, json(publicationRecord(publication)));
      const { written, kept } = await writePackageFiles(files, record.spec.id, root, refresh);
      const presentation = resolve(root, `src/objects/${record.spec.id}/source/presentation`);
      await mkdir(presentation, { recursive: true });
      await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
      if (record.spec.kind === 'companion') { const { authorContextMarkers } = await import('../source-authoring/context-markers.mts'); await authorContextMarkers([record.spec.id]); }
      results.push({ id: record.spec.id, kind: record.spec.kind, files: written.length, ...(hex ? { hex } : {}), ...(kept.length ? { kept } : {}),
        orbit: 'whereistheplanet' in record.spec.orbit ? `whereistheplanet ${record.spec.orbit.whereistheplanet}` : 'archive' in record.spec.orbit ? `NASA Exoplanet Archive (${record.orbitCitation.label})` : 'cited elements',
        todo: [...record.todo, ...record.spec.text ? ['review the drafted card, introduction and README'] : ['reader card and introduction with quotes (text.json)', 'the README account of the body and its evidence']] });
    } catch (error) { results.push({ id: saved.spec.id, kind: saved.spec.kind, files: 0, todo: [], failed: reason(error) }); }
  }
  return results;
}
export const formatNewObject = (results: readonly NewObjectResult[]) => `${results.map(result => result.failed ? `${result.id} (${result.kind}): FAILED, not written: ${result.failed}` : `${result.id} (${result.kind}): ${result.files} files.${result.kept?.length ? ` Kept what a person wrote: ${result.kept.join('; ')}.` : ''}${result.hex ? ` Colour ${result.hex}${result.color ? ` from ${result.color}` : ''}${result.crossCheck ? `, cross-checked against ${result.crossCheck.route} (${result.crossCheck.difference} levels)` : ''}.` : ''}${result.limb ? ` Limb ${result.limb}.` : ''}${result.orbit ? ` Orbit from ${result.orbit}.` : ''}\n  Still to write: ${result.todo.join('; ')}.`).join('\n')}\nReplace every ${TODO}, then bake: node tools/prepare/prepare-object.mts <id>\n`;

/** A spec file for planet hosts, from the NASA Exoplanet Archive (from-archive.mts); hosts already in the universe get their
 * new planets as host additions. */
export async function specFromArchive(hosts: readonly string[], out: string, { root = process.cwd(), progress = (_line: string) => {} } = {}) {
  const { archiveSpec } = await import('./from-archive.mts'), { existingBodies } = await import('./identity.mts');
  const universe = await existingBodies(root), stars: unknown[] = [], report: string[] = [], failed: string[] = [];
  for (const host of hosts) {
    progress(`${host}: reading its default parameter sets`);
    // A host the archive cannot give a spec for is reported and left out; the rest of the batch is still drafted.
    let drafted: Awaited<ReturnType<typeof archiveSpec>>;
    try { drafted = await archiveSpec(liveArchive, host, universe); } catch (error) { failed.push(`${host}: ${(error as Error).message.split('\n')[0]}`); progress(`  ${host}: left out: ${failed.at(-1)}`); continue; }
    const { spec, skipped, notes } = drafted;
    const planets = (spec.planets as unknown[]).length;
    if (planets || !('host' in spec)) stars.push(spec);
    report.push(`${host}: ${planets} planet${planets === 1 ? '' : 's'}${'host' in spec ? ' added to the existing star' : ''}${skipped.length ? `; left out: ${skipped.join('; ')}` : ''}${notes.length ? `; ${notes.join('; ')}` : ''}`);
  }
  await mkdir(dirname(resolve(root, out)), { recursive: true }); await writeFile(resolve(root, out), json({ stars }));
  return { path: out, entries: stars.length, report: [...report, ...failed.map(line => `left out: ${line}`)] };
}
