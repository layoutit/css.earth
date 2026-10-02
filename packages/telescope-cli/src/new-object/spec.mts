/** The star spec: what a person decides for a new placed star, in one JSON file per batch. Everything else the generator looks up
 * (Gaia, SIMBAD, the spectrophotometric archives, the limb-darkening grids) or derives.
 *
 * {
 *   "stars": [{
 *     "id": "hd-29615", "name": "HD 29615", "system": "HD 29615 system", "order": 1771,
 *     "description": "Catalogue line.",
 *     "target": "HD 29615", "gaia": "4891725758804030208",
 *     "paper": { "url": "https://arxiv.org/abs/2110.06729", "credit": "Willamo et al. (2022), A&A 659, A71" },
 *     "radius": { "value": 0.96, "source": "Vidotto et al. (2014), MNRAS 441, 2361, as listed by Willamo et al. (2022), Table 2", "url": "https://arxiv.org/abs/2110.06729" },
 *     "temperature": { "value": 5820, "uncertainty": 50, "source": "…", "url": "…" },
 *     "mass": "gaia-flame",
 *     "gravity": { "value": 4.4, "source": "…", "url": "…" },
 *     "spin": { "inclinationDegrees": 62, "periodDays": 2.32, "source": "…", "url": "…" },
 *     "radialVelocity": { "value": 18.2, "source": "…", "url": "…" },
 *     "limb": { "none": "why no law is drawn" },
 *     "color": { "skip": ["gaia-xp"], "reason": "why those routes are not used", "disagreement": "why the color and its cross-check differ" },
 *     "planets": [{ "id": "wasp-121b", "name": "WASP-121b", "description": "…", "paper": { … }, "orbit": { "archive": "nasa-ps", "reference": "BOURRIER_ET_AL__2020" } }],
 *     "companions": [{ "id": "…", "name": "…", "description": "…", "paper": { … }, "temperature": { … }, "radius": { … }, "mass": { … }, "orbit": { … } }]
 *   }]
 * }
 *
 * A planet or companion is a body on a hosted orbit around this star (orbit.mts): `orbit` is { "whereistheplanet": key,
 * "measurements": CSV path, "measurementsSource", "source", "url" } for an imaged orbit from the paper's posterior;
 * { "archive": "nasa-ps", "reference"? } for one paper's transit fit in the NASA Exoplanet Archive ("measured": true for a planet
 * found without a transit whose paper measures its whole orbit, inclination included, orbit.mts assembleMeasuredOrbit); { "elements": { … },
 * "source", "url" }; or { "record": true, "source", "url" } for a body whose astronomy record another owner already writes (the
 * S-stars of packages/astronomy/cli/generate-s-stars.mts): the record is kept as it is and only the package is written, and the spec's
 * cited radius and mass must reproduce the record's. A planet's radius and mass are in Jupiter units and default to the archive row's;
 * a planet with a cited `temperature` glows with its own heat (a young giant imaged directly). A companion is a star: solar units,
 * temperature required; `colorReason` says why its color is a Planck spectrum when that is not because the archives cannot separate it
 * from its star. A companion with `"blackHole": true` is a black hole: no temperature, a radius only if a source measures one (else the
 * records' unmeasured 0), and an astronomy record only, drawn in its star's system, with no package of its own.
 *
 * `target` is a name SIMBAD resolves, through the telescope's resolver (packages/telescope/src/node/sky-target.ts); `gaia` is a Gaia
 * DR3 source_id. Give either: the other is read from SIMBAD, and when both are given they must name the same star.
 * `position` anchors a star Gaia cannot see (a Cepheid in another galaxy, 25th magnitude) on one row of a published VizieR table
 * instead: { "catalogue": "J/ApJ/830/10/table5", "row": { "Gal": "N4536", "ID": "12345" }, "credit", "url" }, where `row` holds the
 * column values that pick exactly one row, whose RAJ2000 and DEJ2000 place the star (generate.mts catalogueAnchor). Such a star takes
 * no `gaia`, and cites its distance, radial velocity, radius and mass; `target` is then only its SIMBAD name, for the README. A star
 * too bright for Gaia is placed the same way on its Hipparcos row, whose `motion` names the position's epoch and the proper-motion columns.
 * `distance` (parsecs) places the star at a cited distance instead of Gaia DR3's parallax: for a star Gaia gives no parallax (a
 * two-parameter solution, as in other galaxies) or one under the placement floor (generate.mts PARALLAX_FLOOR_SIGMA), or when the
 * paper's own distance is the one its radius and mass assume. The README names the Gaia parallax it replaces.
 * `radius` and `mass` may be "gaia-flame": the Gaia DR3 FLAME value of the same source, an archive product. `mass` may be
 * "unmeasured" (a Cepheid: no dynamical mass): GM is then the records' unpublished 0, and log g comes only from a cited `gravity`;
 * without one no limb law is chosen. `gravity` defaults to
 * log g from the mass and radius. `radialVelocity` is needed only when Gaia DR3 has none. Every cited value names its source and a
 * URL; the URL becomes the fact's catalogue record (arXiv and DOI links are resolved to publication records; ADS links are cited by
 * bibcode; any other page by its address).
 *
 * `aliases` lists the star's other designations (the catalogue's `aliases`: searchable, never a map label); `new-object --rename`
 * moves the old name there when a better designation exists (display-name.mts). `featured: true` makes the star a map target
 * (ring, name, click); without it a star is a plain dot, reachable through search.
 *
 * `text` ({ card, introduction, locator }) is drafted reader text cited to the paper, as `--from-archive` writes it; without it the
 * card and introduction stay marked for a person. `notes` are sentences for the README's "Not shown" list. A planet may carry
 * `thermal` (a measured dayside brightness temperature from the archive's emission table, for the "Thermal glow" dataset) or
 * `photometry` (three-band flux densities for the band-color dataset); planet-datasets.mts. `phaseCurves` adds a heat-map dataset per
 * published phase-curve fit beside the color dataset (phase-curve-dataset.mts).
 *
 * A file may also hold `"pulsars": [ … ]`: neutron stars with a published hot-region map, written whole from cited values (pulsar.mts). */
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { parsePulsarSpec, type PulsarSpec } from './pulsar.mts';
import { DISC_BAND_COLOR_SCHEMA, parseDiscBandColorRecord } from '@cssearth/bake/objects/layers/observation';
import { phaseCurveEntry, type PhaseCurveEntry } from './phase-curve-dataset.mts';

export interface Cited { readonly value: number; readonly source: string; readonly url: string; readonly uncertainty?: number }
export type ColorRoute = 'stis-ngsl' | 'gaia-xp' | 'pulkovo' | 'kiehling' | 'kharitonov' | 'burnashev';
export const COLOR_ROUTES: readonly ColorRoute[] = ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'];
export interface StarSpec {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string; readonly order?: number;
  /** A SIMBAD name, a Gaia DR3 source_id, or both. */
  readonly target?: string; readonly gaia?: string;
  /** Other designations of the star, searchable and listed on its card: the names `name` was preferred to (display-name.mts). */
  readonly aliases?: readonly string[];
  /** A map target: ringed, named and opened by a click (the catalogue's `featured`). Every other star is a plain dot. */
  readonly featured?: true;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius: Cited | 'gaia-flame'; readonly mass: Cited | 'gaia-flame' | 'unmeasured'; readonly temperature: Cited;
  readonly gravity?: Cited; readonly radialVelocity?: Cited;
  /** The published range of gravities for the star's class, cited: a limb read inside it when the star's own is unpublished (gravity.mts). */
  readonly gravityRange?: { readonly min: number; readonly max: number; readonly source: string; readonly url: string };
  /** Parsecs, cited: replaces Gaia DR3's parallax distance (spec header). */
  readonly distance?: Cited;
  /** One row of a published VizieR table that places a star Gaia cannot see (spec header). */
  readonly position?: CataloguePosition;
  readonly spin?: { readonly inclinationDegrees: number; readonly periodDays?: number; readonly source: string; readonly url: string };
  readonly limb?: { readonly none: string };
  /** `disagreement` says why the color and its cross-check differ by more than the agreement threshold, for the color record. */
  readonly color?: { readonly skip: readonly ColorRoute[]; readonly reason: string; readonly disagreement?: string };
  readonly planets: readonly HostedSpec[]; readonly companions: readonly HostedSpec[];
  /** Drafted reader text, cited to the paper at `locator`; without it the card and introduction stay marked for a person. */
  readonly text?: DraftText;
  /** What the generator or a person chose not to show, one sentence each, for the README. */
  readonly notes: readonly string[];
}
/** `motion` is for a catalogue that measures the star's proper motion (Hipparcos, for a star too bright for Gaia): the Julian year its
 * RAJ2000 and DEJ2000 are given at and the columns holding the motion in right ascension (times cos declination) and declination, mas/yr. */
export interface CataloguePosition { readonly catalogue: string; readonly row: Readonly<Record<string, string>>; readonly credit: string; readonly url: string;
  readonly motion?: { readonly epoch: number; readonly ra: string; readonly dec: string } }
/** Sentences of the body's Wikipedia article lead, verbatim (prose.mts), cited as quotes beside the drafted text. */
export interface DraftQuotes { readonly url: string; readonly title: string; readonly revision: string; readonly card?: string; readonly introduction?: string }
export interface DraftText { readonly card: string; readonly introduction: string; readonly locator: string; readonly quotes?: DraftQuotes }
function photometrySpec(value: unknown, label: string): PhotometrySpec {
  // The dataset's own parser refuses anything the record cannot carry; the spec's object id is filled in at generation.
  const input = requireRecord(value, label), record = parseDiscBandColorRecord({ schema: DISC_BAND_COLOR_SCHEMA, objectId: 'spec', ...input }, label);
  return { unit: record.unit, source: record.source, bands: record.bands, displayRange: record.displayRange, displayRangeSource: record.displayRangeSource };
}
function thermalSpec(value: unknown, label: string): ThermalSpec {
  const input = requireRecord(value, label), temperatureK = requireFiniteNumber(input.temperatureK, `${label}.temperatureK`), wavelength = requireFiniteNumber(input.wavelengthMicrometres, `${label}.wavelengthMicrometres`);
  if (!(temperatureK >= 100 && temperatureK <= 10000)) throw new RangeError(`${label}.temperatureK ${temperatureK} is outside 100..10000 K.`);
  if (!(wavelength > 0)) throw new RangeError(`${label}.wavelengthMicrometres must be positive.`);
  const uncertainty = input.uncertaintyK === undefined ? undefined : requireFiniteNumber(input.uncertaintyK, `${label}.uncertaintyK`);
  return { temperatureK, ...(uncertainty === undefined ? {} : { uncertaintyK: uncertainty }), wavelengthMicrometres: wavelength, facility: requireString(input.facility, `${label}.facility`),
    source: requireString(input.source, `${label}.source`), url: requireString(input.url, `${label}.url`), chosen: requireString(input.chosen, `${label}.chosen`) };
}
function draftText(value: unknown, label: string): DraftText {
  const input = requireRecord(value, label), card = requireString(input.card, `${label}.card`), introduction = requireString(input.introduction, `${label}.introduction`);
  if (card.length > 110) throw new RangeError(`${label}.card is ${card.length} characters; the card budget is 110.`);
  if (introduction.length > 180) throw new RangeError(`${label}.introduction is ${introduction.length} characters; the budget is 180.`);
  const quotes = input.quotes === undefined ? undefined : draftQuotes(input.quotes, `${label}.quotes`);
  return { card, introduction, locator: requireString(input.locator, `${label}.locator`), ...(quotes ? { quotes } : {}) };
}
function draftQuotes(value: unknown, label: string): DraftQuotes {
  const input = requireRecord(value, label), url = requireString(input.url, `${label}.url`);
  if (!/^https:\/\/en\.wikipedia\.org\/wiki\//u.test(url)) throw new TypeError(`${label}.url must be an English Wikipedia article: ${url}`);
  const quote = (key: 'card' | 'introduction') => { if (input[key] === undefined) return {}; const text = requireString(input[key], `${label}.${key}`); if (text.length > 300) throw new RangeError(`${label}.${key} is ${text.length} characters; a quote is 300 at most.`); return { [key]: text }; };
  return { url, title: requireString(input.title, `${label}.title`), revision: requireString(input.revision, `${label}.revision`), ...quote('card'), ...quote('introduction') };
}
export const HOSTED_EPOCHS = ['periastron', 'inferior-conjunction', 'superior-conjunction'] as const;
export type HostedEpoch = typeof HOSTED_EPOCHS[number];
export type OrbitSpec =
  | { readonly whereistheplanet: string; readonly measurements: string; readonly measurementsSource: string; readonly body?: number; readonly source: string; readonly url: string }
  | { readonly archive: 'nasa-ps'; readonly reference?: string; readonly planetName?: string; readonly measured?: true }
  | { readonly elements: Readonly<Record<string, number>>; readonly epoch?: HostedEpoch; readonly source: string; readonly url: string }
  | { readonly record: true; readonly source: string; readonly url: string };
/** A measured dayside brightness temperature (secondary eclipse) for the "Thermal glow" dataset (planet-datasets.mts). */
export interface ThermalSpec { readonly temperatureK: number; readonly uncertaintyK?: number; readonly wavelengthMicrometres: number; readonly facility: string; readonly source: string; readonly url: string; readonly chosen: string }
/** Published flux densities in three infrared bands for the band-color dataset of an imaged planet (planet-datasets.mts): red, green,
 * blue from the longest wavelength, on one display range shared with the bodies it names. */
export interface PhotometrySpec {
  readonly unit: string; readonly source: { readonly citation: string; readonly url: string; readonly locator: string };
  readonly bands: readonly [{ readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }];
  readonly displayRange: readonly [number, number]; readonly displayRangeSource: string;
}
/** A body on a hosted orbit: a planet (Jupiter units) or a companion star (solar units). */
export interface HostedSpec {
  readonly kind: 'planet' | 'companion'; readonly id: string; readonly name: string; readonly description: string; readonly order?: number;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius?: Cited; readonly mass?: Cited; readonly temperature?: Cited; readonly orbit: OrbitSpec; readonly text?: DraftText; readonly thermal?: ThermalSpec; readonly photometry?: PhotometrySpec;
  /** Heat maps from published phase-curve fits, added beside the color dataset (phase-curve-dataset.mts). */
  readonly phaseCurves?: readonly PhaseCurveEntry[];
  /** A companion that is a black hole: an astronomy record only (spec header). */
  readonly blackHole?: true;
  /** Why a companion's color is a Planck spectrum at its temperature, when not because the archives cannot separate it. */
  readonly colorReason?: string;
}
const ELEMENT_KEYS = ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'argumentOfPeriapsisDegrees', 'transitTimeBmjdTdb', 'ascendingNodePositionAngleDegrees'];
function orbitSpec(value: unknown, label: string): OrbitSpec {
  const o = requireRecord(value, label);
  if (o.whereistheplanet !== undefined) return { whereistheplanet: requireString(o.whereistheplanet, `${label}.whereistheplanet`), measurements: requireString(o.measurements, `${label}.measurements`),
    measurementsSource: requireString(o.measurementsSource, `${label}.measurementsSource`), ...(o.body === undefined ? {} : { body: requireFiniteNumber(o.body, `${label}.body`) }),
    source: requireString(o.source, `${label}.source`), url: requireString(o.url, `${label}.url`) };
  if (o.archive !== undefined) {
    if (o.archive !== 'nasa-ps') throw new TypeError(`${label}.archive is nasa-ps, not ${String(o.archive)}.`);
    return { archive: 'nasa-ps', ...(o.reference === undefined ? {} : { reference: requireString(o.reference, `${label}.reference`) }), ...(o.planetName === undefined ? {} : { planetName: requireString(o.planetName, `${label}.planetName`) }),
      ...(o.measured === undefined ? {} : o.measured === true ? { measured: true as const } : (() => { throw new TypeError(`${label}.measured is true or absent, not ${JSON.stringify(o.measured)}.`); })()) };
  }
  if (o.record !== undefined) {
    if (o.record !== true) throw new TypeError(`${label}.record is true or absent, not ${JSON.stringify(o.record)}.`);
    return { record: true, source: requireString(o.source, `${label}.source`), url: requireString(o.url, `${label}.url`) };
  }
  if (o.elements !== undefined) {
    const elements = requireRecord(o.elements, `${label}.elements`), unknown = Object.keys(elements).filter(key => !ELEMENT_KEYS.includes(key));
    if (unknown.length) throw new TypeError(`${label}.elements: unknown ${unknown.join(', ')} (${ELEMENT_KEYS.join(', ')}).`);
    for (const key of ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'transitTimeBmjdTdb']) requireFiniteNumber(elements[key], `${label}.elements.${key}`);
    // An eccentric orbit says what its reference epoch is: a periastron passage, the body in front of its host (a transit or primary
    // eclipse, inferior conjunction), or behind it (an occultation or secondary eclipse, superior conjunction), as the paper times it.
    const epoch = o.epoch === undefined ? undefined : requireString(o.epoch, `${label}.epoch`);
    if (epoch !== undefined && !(HOSTED_EPOCHS as readonly string[]).includes(epoch)) throw new TypeError(`${label}.epoch is ${HOSTED_EPOCHS.join(', ')}, not ${epoch}.`);
    if (Number(elements.eccentricity) > 0 && (epoch === undefined || elements.argumentOfPeriapsisDegrees === undefined)) throw new TypeError(`${label}: an eccentric orbit needs argumentOfPeriapsisDegrees and epoch (${HOSTED_EPOCHS.join(', ')}).`);
    return { elements: Object.fromEntries(Object.entries(elements).map(([key, v]) => [key, requireFiniteNumber(v, `${label}.elements.${key}`)])), ...(epoch ? { epoch: epoch as HostedEpoch } : {}), source: requireString(o.source, `${label}.source`), url: requireString(o.url, `${label}.url`) };
  }
  throw new TypeError(`${label} needs whereistheplanet, archive, elements or record.`);
}
function hostedSpec(value: unknown, kind: HostedSpec['kind'], label: string): HostedSpec {
  const input = requireRecord(value, label), id = requireString(input.id, `${label}.id`), at = (name: string) => `${id}.${name}`;
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id}: an id is lowercase letters, digits and hyphens.`);
  const known = new Set(['id', 'name', 'description', 'order', 'paper', 'radius', 'mass', 'temperature', 'orbit', 'text', 'thermal', 'photometry', 'phaseCurves', 'blackHole', 'colorReason']), unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${id}: unknown fields ${unknown.join(', ')}.`);
  const paper = requireRecord(input.paper, at('paper')), orbit = orbitSpec(input.orbit, at('orbit'));
  const thermal = input.thermal === undefined ? undefined : thermalSpec(input.thermal, at('thermal'));
  if (thermal && kind !== 'planet') throw new TypeError(`${id}: a thermal dataset is a planet's; a companion star has its temperature.`);
  const photometry = input.photometry === undefined ? undefined : photometrySpec(input.photometry, at('photometry'));
  if (photometry && (kind !== 'planet' || thermal)) throw new TypeError(`${id}: band photometry is a planet's one color dataset; not with a companion star or a thermal dataset.`);
  const phaseCurves = input.phaseCurves === undefined ? undefined : requireArray(input.phaseCurves, at('phaseCurves')).map((entry, i) => phaseCurveEntry(entry, at(`phaseCurves[${i}]`)));
  if (phaseCurves && kind !== 'planet') throw new TypeError(`${id}: a phase-curve map is a planet's.`);
  if (input.blackHole !== undefined && input.blackHole !== true) throw new TypeError(`${id}.blackHole is true or absent, not ${JSON.stringify(input.blackHole)}.`);
  const blackHole = input.blackHole === true;
  if (blackHole && kind !== 'companion') throw new TypeError(`${id}: only a companion may be a black hole.`);
  if (blackHole && input.temperature !== undefined) throw new TypeError(`${id}: a black hole has no effective temperature.`);
  if (input.colorReason !== undefined && (kind !== 'companion' || blackHole)) throw new TypeError(`${id}: colorReason explains a companion star's Planck color.`);
  const range = kind === 'planet' ? { radius: [0.01, 5] as const, mass: [0.0001, 100] as const } : { radius: [0.005, 3000] as const, mass: [0.01, 300] as const };
  const out: HostedSpec = { kind, id, name: requireString(input.name, at('name')), description: requireString(input.description, at('description')),
    ...(input.order === undefined ? {} : { order: requireFiniteNumber(input.order, at('order')) }), paper: { url: requireString(paper.url, at('paper.url')), credit: requireString(paper.credit, at('paper.credit')) },
    ...(input.radius === undefined ? {} : { radius: cited(input.radius, at('radius'), range.radius) }), ...(input.mass === undefined ? {} : { mass: cited(input.mass, at('mass'), range.mass) }),
    ...(input.temperature === undefined ? {} : { temperature: cited(input.temperature, at('temperature'), [100, 60000]) }), orbit, ...(input.text === undefined ? {} : { text: draftText(input.text, at('text')) }), ...(thermal ? { thermal } : {}), ...(photometry ? { photometry } : {}), ...(phaseCurves ? { phaseCurves } : {}),
    ...(blackHole ? { blackHole: true as const } : {}), ...(input.colorReason === undefined ? {} : { colorReason: requireString(input.colorReason, at('colorReason')) }) };
  const fromArchive = 'archive' in orbit;
  if (blackHole) { if (!out.mass) throw new TypeError(`${id}: a black hole needs its cited mass.`); if ('record' in orbit) throw new TypeError(`${id}: a black hole's record is written here; the record route packages a star another owner records.`); }
  else if (!fromArchive && (!out.radius || !out.mass)) throw new TypeError(`${id}: give radius and mass with their sources; only an archive orbit supplies them.`);
  if (kind === 'companion' && !blackHole && (!out.temperature || !out.radius || !out.mass)) throw new TypeError(`${id}: a companion star needs its cited temperature, radius and mass.`);
  return out;
}

const URL_PATTERN = /^https:\/\/\S+$/u;
function cited(value: unknown, label: string, range: readonly [number, number]): Cited {
  const input = requireRecord(value, label), number = requireFiniteNumber(input.value, `${label}.value`);
  if (number < range[0] || number > range[1]) throw new RangeError(`${label}.value ${number} is outside ${range[0]} to ${range[1]}.`);
  const url = requireString(input.url, `${label}.url`);
  if (!URL_PATTERN.test(url)) throw new TypeError(`${label}.url must be an https URL, not ${url}.`);
  const uncertainty = input.uncertainty === undefined ? undefined : requireFiniteNumber(input.uncertainty, `${label}.uncertainty`);
  if (uncertainty !== undefined && !(uncertainty > 0)) throw new RangeError(`${label}.uncertainty must be positive.`);
  return { value: number, source: requireString(input.source, `${label}.source`), url, ...(uncertainty === undefined ? {} : { uncertainty }) };
}
function cataloguePosition(value: unknown, label: string): CataloguePosition {
  const input = requireRecord(value, label), catalogue = requireString(input.catalogue, `${label}.catalogue`), row = requireRecord(input.row, `${label}.row`);
  if (!/^[A-Z]+\/[\w+/.-]+$/u.test(catalogue)) throw new TypeError(`${label}.catalogue is a VizieR table (J/ApJ/830/10/table5), not ${catalogue}.`);
  const entries = Object.entries(row).map(([column, cell]) => [column, requireString(cell, `${label}.row.${column}`)] as const);
  if (!entries.length) throw new TypeError(`${label}.row names no column: give the values that pick one row of ${catalogue}.`);
  const url = requireString(input.url, `${label}.url`);
  if (!URL_PATTERN.test(url)) throw new TypeError(`${label}.url must be an https URL, not ${url}.`);
  const motion = input.motion === undefined ? undefined : requireRecord(input.motion, `${label}.motion`), epoch = motion && requireFiniteNumber(motion.epoch, `${label}.motion.epoch`);
  if (epoch !== undefined && !(epoch >= 1900 && epoch <= 2100)) throw new RangeError(`${label}.motion.epoch is the Julian year of the position, not ${epoch}.`);
  return { catalogue, row: Object.fromEntries(entries), credit: requireString(input.credit, `${label}.credit`), url,
    ...(motion ? { motion: { epoch: epoch!, ra: requireString(motion.ra, `${label}.motion.ra`), dec: requireString(motion.dec, `${label}.motion.dec`) } } : {}) };
}
const citedOrFlame = (value: unknown, label: string, range: readonly [number, number]) => value === 'gaia-flame' ? 'gaia-flame' as const : cited(value, label, range);

export function parseStarSpec(value: unknown): StarSpec {
  const input = requireRecord(value, 'star spec'), id = requireString(input.id, 'id');
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id}: a star id is lowercase letters, digits and hyphens.`);
  const at = (label: string) => `${id}.${label}`;
  const known = new Set(['id', 'name', 'system', 'description', 'order', 'target', 'gaia', 'paper', 'radius', 'mass', 'temperature', 'gravity', 'gravityRange', 'radialVelocity', 'distance', 'position', 'spin', 'limb', 'color', 'planets', 'companions', 'text', 'notes', 'aliases', 'featured']);
  const unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${id}: unknown spec fields ${unknown.join(', ')}.`);
  const gaia = input.gaia === undefined ? undefined : requireString(input.gaia, at('gaia')), target = input.target === undefined ? undefined : requireString(input.target, at('target'));
  if (gaia !== undefined && !/^\d{6,20}$/u.test(gaia)) throw new TypeError(`${at('gaia')} is a Gaia DR3 source_id (digits), not ${gaia}.`);
  const position = input.position === undefined ? undefined : cataloguePosition(input.position, at('position'));
  if (gaia === undefined && target === undefined && !position) throw new TypeError(`${id}: give target (a SIMBAD name), gaia (a Gaia DR3 source_id) or position (a catalogue row).`);
  if (position) {
    // Gaia supplies nothing for a star it cannot see: every value it would have given is cited instead.
    if (gaia !== undefined) throw new TypeError(`${id}: a star placed by a catalogue row has no Gaia DR3 source; give position or gaia, not both.`);
    const missing = [input.distance === undefined && 'distance', input.radialVelocity === undefined && 'radialVelocity', input.radius === 'gaia-flame' && 'a cited radius (not gaia-flame)', input.mass === 'gaia-flame' && 'a cited or "unmeasured" mass (not gaia-flame)'].filter(Boolean);
    if (missing.length) throw new TypeError(`${id}: a star placed by ${position.catalogue} has no Gaia DR3 row; give ${missing.join(', ')}.`);
  }
  const paper = requireRecord(input.paper, at('paper')), name = requireString(input.name, at('name'));
  const spin = input.spin === undefined ? undefined : (() => {
    const s = requireRecord(input.spin, at('spin')), inclination = requireFiniteNumber(s.inclinationDegrees, at('spin.inclinationDegrees'));
    if (inclination < 0 || inclination > 90) throw new RangeError(`${at('spin.inclinationDegrees')} ${inclination} is outside 0 to 90.`);
    const period = s.periodDays === undefined ? undefined : requireFiniteNumber(s.periodDays, at('spin.periodDays'));
    if (period !== undefined && !(period > 0)) throw new RangeError(`${at('spin.periodDays')} must be positive.`);
    return { inclinationDegrees: inclination, ...(period === undefined ? {} : { periodDays: period }), source: requireString(s.source, at('spin.source')), url: requireString(s.url, at('spin.url')) };
  })();
  const color = input.color === undefined ? undefined : (() => {
    const c = requireRecord(input.color, at('color')), skip = requireArray(c.skip ?? [], at('color.skip')).map(route => requireString(route, at('color.skip')));
    const bad = skip.filter(route => !COLOR_ROUTES.includes(route as ColorRoute));
    if (bad.length) throw new TypeError(`${at('color.skip')}: ${bad.join(', ')} are not color routes (${COLOR_ROUTES.join(', ')}).`);
    return { skip: skip as ColorRoute[], reason: skip.length ? requireString(c.reason, at('color.reason')) : '', ...(c.disagreement === undefined ? {} : { disagreement: requireString(c.disagreement, at('color.disagreement')) }) };
  })();
  const limb = input.limb === undefined ? undefined : { none: requireString(requireRecord(input.limb, at('limb')).none, at('limb.none')) };
  const aliases = input.aliases === undefined ? undefined : requireArray(input.aliases, at('aliases')).map(alias => requireString(alias, at('aliases')));
  return {
    id, name, system: input.system === undefined ? `${name} system` : requireString(input.system, at('system')), description: requireString(input.description, at('description')),
    ...(aliases?.length ? { aliases } : {}),
    ...(input.featured === undefined ? {} : input.featured === true ? { featured: true as const } : (() => { throw new TypeError(`${at('featured')} is true or absent, not ${JSON.stringify(input.featured)}.`); })()),
    ...(input.order === undefined ? {} : { order: requireFiniteNumber(input.order, at('order')) }), ...(target ? { target } : {}), ...(gaia ? { gaia } : {}),
    paper: { url: requireString(paper.url, at('paper.url')), credit: requireString(paper.credit, at('paper.credit')) },
    radius: citedOrFlame(input.radius, at('radius'), [0.005, 3000]), mass: input.mass === 'unmeasured' ? 'unmeasured' : citedOrFlame(input.mass, at('mass'), [0.01, 300]),
    temperature: cited(input.temperature, at('temperature'), [1000, 60000]),
    ...(input.gravity === undefined ? {} : { gravity: cited(input.gravity, at('gravity'), [-1, 9]) }),
    ...(input.gravityRange === undefined ? {} : { gravityRange: (() => {
      const r = requireRecord(input.gravityRange, at('gravityRange')), min = requireFiniteNumber(r.min, at('gravityRange.min')), max = requireFiniteNumber(r.max, at('gravityRange.max'));
      if (!(min < max) || min < -2 || max > 9) throw new RangeError(`${at('gravityRange')} must be an increasing range inside log g -2 to 9, not ${min} to ${max}.`);
      const url = requireString(r.url, at('gravityRange.url'));
      if (!URL_PATTERN.test(url)) throw new TypeError(`${at('gravityRange.url')} must be an https URL, not ${url}.`);
      return { min, max, source: requireString(r.source, at('gravityRange.source')), url };
    })() }),
    // A star in another galaxy recedes with it: NGC 4536's Cepheids at 1,800 km/s, a galaxy at redshift 0.1 at 30,000.
    ...(input.radialVelocity === undefined ? {} : { radialVelocity: cited(input.radialVelocity, at('radialVelocity'), input.position ? [-30000, 30000] : [-1000, 1000]) }),
    // Out to a gigaparsec: the stars measured one by one in other galaxies are at most tens of megaparsecs away.
    ...(input.distance === undefined ? {} : { distance: cited(input.distance, at('distance'), [1, 1e9]) }), ...(position ? { position } : {}),
    ...(spin ? { spin } : {}), ...(limb ? { limb } : {}), ...(color ? { color } : {}),
    planets: input.planets === undefined ? [] : requireArray(input.planets, at('planets')).map((entry, i) => hostedSpec(entry, 'planet', `${at('planets')}[${i}]`)),
    companions: input.companions === undefined ? [] : requireArray(input.companions, at('companions')).map((entry, i) => hostedSpec(entry, 'companion', `${at('companions')}[${i}]`)),
    ...(input.text === undefined ? {} : { text: draftText(input.text, at('text')) }),
    notes: input.notes === undefined ? [] : requireArray(input.notes, at('notes')).map(note => requireString(note, at('notes'))),
  };
}

/** New bodies for a star already in the universe: { "host": "<its id>", "planets": [ … ], "companions": [ … ] }. */
export interface HostAddition { readonly host: string; readonly planets: readonly HostedSpec[]; readonly companions: readonly HostedSpec[]; readonly notes: readonly string[] }
export function parseHostAddition(value: unknown): HostAddition {
  const input = requireRecord(value, 'host addition'), host = requireString(input.host, 'host'), unknown = Object.keys(input).filter(key => !['host', 'planets', 'companions', 'notes'].includes(key));
  if (unknown.length) throw new TypeError(`${host}: a host addition takes only host, planets and companions, not ${unknown.join(', ')}.`);
  return { host, planets: input.planets === undefined ? [] : requireArray(input.planets, `${host}.planets`).map((entry, i) => hostedSpec(entry, 'planet', `${host}.planets[${i}]`)),
    companions: input.companions === undefined ? [] : requireArray(input.companions, `${host}.companions`).map((entry, i) => hostedSpec(entry, 'companion', `${host}.companions[${i}]`)),
    notes: input.notes === undefined ? [] : requireArray(input.notes, `${host}.notes`).map(note => requireString(note, `${host}.notes`)) };
}

/** A spec file's entries: new stars with their systems, and additions to stars that exist. */
export function parseObjectSpecs(value: unknown): { readonly stars: StarSpec[]; readonly additions: HostAddition[]; readonly pulsars: PulsarSpec[] } {
  // `pulsars` are neutron stars with a published surface map (pulsar.mts); a file may hold only them.
  const pulsars = isRecord(value) && value.pulsars !== undefined ? requireArray(value.pulsars, 'pulsars').map(parsePulsarSpec) : [];
  const entries = isRecord(value) ? (value.stars === undefined && pulsars.length ? [] : requireArray(value.stars, 'stars')) : requireArray(value, 'object specs');
  const stars = entries.filter(entry => !(isRecord(entry) && entry.host !== undefined)).map(parseStarSpec), additions = entries.filter(entry => isRecord(entry) && entry.host !== undefined).map(parseHostAddition);
  const ids = [...pulsars.map(spec => spec.id), ...stars.flatMap(spec => [spec.id, ...spec.planets.map(p => p.id), ...spec.companions.map(c => c.id)]), ...additions.flatMap(entry => [...entry.planets, ...entry.companions].map(body => body.id))];
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repeated.length) throw new TypeError(`Object ids repeat: ${repeated.join(', ')}.`);
  return { stars, additions, pulsars };
}

/** `--photometry entries.json`: a list of { id, photometry } for planets already in the tree. */
export function parsePhotometryEntries(value: unknown): Map<string, PhotometrySpec> {
  const entries = requireArray(value, 'photometry entries'), out = new Map<string, PhotometrySpec>();
  for (const [index, entry] of entries.entries()) {
    const input = requireRecord(entry, `entries[${index}]`), id = requireString(input.id, `entries[${index}].id`);
    if (out.has(id)) throw new TypeError(`entries[${index}]: ${id} is listed twice.`);
    out.set(id, photometrySpec(input.photometry, `${id}.photometry`));
  }
  return out;
}
