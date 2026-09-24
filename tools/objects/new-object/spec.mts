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
 *     "color": { "skip": ["gaia-xp"], "reason": "why those routes are not used" },
 *     "planets": [{ "id": "wasp-121b", "name": "WASP-121b", "description": "…", "paper": { … }, "orbit": { "archive": "nasa-ps", "reference": "BOURRIER_ET_AL__2020" } }],
 *     "companions": [{ "id": "…", "name": "…", "description": "…", "paper": { … }, "temperature": { … }, "radius": { … }, "mass": { … }, "orbit": { … } }]
 *   }]
 * }
 *
 * A planet or companion is a body on a hosted orbit around this star (orbit.mts): `orbit` is { "whereistheplanet": key,
 * "measurements": CSV path, "measurementsSource", "source", "url" } for an imaged orbit from the paper's posterior;
 * { "archive": "nasa-ps", "reference"? } for one paper's transit fit in the NASA Exoplanet Archive; or { "elements": { … },
 * "source", "url" }. A planet's radius and mass are in Jupiter units and default to the archive row's; a planet with a cited
 * `temperature` glows with its own heat (a young giant imaged directly). A companion is a star: solar units, temperature required.
 *
 * `target` is a name SIMBAD resolves, through the telescope's resolver (tools/objects/telescopes/sky/target.mts); `gaia` is a Gaia
 * DR3 source_id. Give either: the other is read from SIMBAD, and when both are given they must name the same star.
 * `radius` and `mass` may be "gaia-flame": the Gaia DR3 FLAME value of the same source, an archive product. `gravity` defaults to
 * log g from the mass and radius. `radialVelocity` is needed only when Gaia DR3 has none. Every cited value names its source and a
 * URL; the URL becomes the fact's catalogue record (arXiv and DOI links are resolved to publication records). */
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { DISC_BAND_COLOR_SCHEMA, parseDiscBandColorRecord } from '../observation/disc-band-color.mts';

export interface Cited { readonly value: number; readonly source: string; readonly url: string; readonly uncertainty?: number }
export type ColorRoute = 'stis-ngsl' | 'gaia-xp' | 'pulkovo' | 'kiehling' | 'kharitonov' | 'burnashev';
export const COLOR_ROUTES: readonly ColorRoute[] = ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'];
export interface StarSpec {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string; readonly order?: number;
  /** A SIMBAD name, a Gaia DR3 source_id, or both. */
  readonly target?: string; readonly gaia?: string;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius: Cited | 'gaia-flame'; readonly mass: Cited | 'gaia-flame'; readonly temperature: Cited;
  readonly gravity?: Cited; readonly radialVelocity?: Cited;
  readonly spin?: { readonly inclinationDegrees: number; readonly periodDays?: number; readonly source: string; readonly url: string };
  readonly limb?: { readonly none: string };
  readonly color?: { readonly skip: readonly ColorRoute[]; readonly reason: string };
  readonly planets: readonly HostedSpec[]; readonly companions: readonly HostedSpec[];
  /** Drafted reader text, cited to the paper at `locator`; without it the card and introduction stay marked for a person. */
  readonly text?: DraftText;
  /** What the generator or a person chose not to show, one sentence each, for the README. */
  readonly notes: readonly string[];
}
export interface DraftText { readonly card: string; readonly introduction: string; readonly locator: string }
function photometrySpec(value: unknown, label: string): PhotometrySpec {
  // The lens's own parser refuses anything the record cannot carry; the spec's object id is filled in at generation.
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
  return { card, introduction, locator: requireString(input.locator, `${label}.locator`) };
}
export type OrbitSpec =
  | { readonly whereistheplanet: string; readonly measurements: string; readonly measurementsSource: string; readonly body?: number; readonly source: string; readonly url: string }
  | { readonly archive: 'nasa-ps'; readonly reference?: string; readonly planetName?: string }
  | { readonly elements: Readonly<Record<string, number>>; readonly epoch?: 'periastron' | 'inferior-conjunction'; readonly source: string; readonly url: string };
/** A body on a hosted orbit: a planet (Jupiter units) or a companion star (solar units). */
/** A measured dayside brightness temperature (secondary eclipse) for the "Thermal glow" lens (planet-lenses.mts). */
export interface ThermalSpec { readonly temperatureK: number; readonly uncertaintyK?: number; readonly wavelengthMicrometres: number; readonly facility: string; readonly source: string; readonly url: string; readonly chosen: string }
/** Published flux densities in three infrared bands for the band-colour lens of an imaged planet (planet-lenses.mts): red, green,
 * blue from the longest wavelength, on one display range shared with the bodies it names. */
export interface PhotometrySpec {
  readonly unit: string; readonly source: { readonly citation: string; readonly url: string; readonly locator: string };
  readonly bands: readonly [{ readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }];
  readonly displayRange: readonly [number, number]; readonly displayRangeSource: string;
}
export interface HostedSpec {
  readonly kind: 'planet' | 'companion'; readonly id: string; readonly name: string; readonly description: string; readonly order?: number;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius?: Cited; readonly mass?: Cited; readonly temperature?: Cited; readonly orbit: OrbitSpec; readonly text?: DraftText; readonly thermal?: ThermalSpec; readonly photometry?: PhotometrySpec;
}
const ELEMENT_KEYS = ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'argumentOfPeriapsisDegrees', 'transitTimeBmjdTdb', 'ascendingNodePositionAngleDegrees'];
function orbitSpec(value: unknown, label: string): OrbitSpec {
  const o = requireRecord(value, label);
  if (o.whereistheplanet !== undefined) return { whereistheplanet: requireString(o.whereistheplanet, `${label}.whereistheplanet`), measurements: requireString(o.measurements, `${label}.measurements`),
    measurementsSource: requireString(o.measurementsSource, `${label}.measurementsSource`), ...(o.body === undefined ? {} : { body: requireFiniteNumber(o.body, `${label}.body`) }),
    source: requireString(o.source, `${label}.source`), url: requireString(o.url, `${label}.url`) };
  if (o.archive !== undefined) {
    if (o.archive !== 'nasa-ps') throw new TypeError(`${label}.archive is nasa-ps, not ${String(o.archive)}.`);
    return { archive: 'nasa-ps', ...(o.reference === undefined ? {} : { reference: requireString(o.reference, `${label}.reference`) }), ...(o.planetName === undefined ? {} : { planetName: requireString(o.planetName, `${label}.planetName`) }) };
  }
  if (o.elements !== undefined) {
    const elements = requireRecord(o.elements, `${label}.elements`), unknown = Object.keys(elements).filter(key => !ELEMENT_KEYS.includes(key));
    if (unknown.length) throw new TypeError(`${label}.elements: unknown ${unknown.join(', ')} (${ELEMENT_KEYS.join(', ')}).`);
    for (const key of ['periodDays', 'semiMajorAxisStellarRadii', 'inclinationDegrees', 'eccentricity', 'transitTimeBmjdTdb']) requireFiniteNumber(elements[key], `${label}.elements.${key}`);
    // An eccentric orbit says what its reference epoch is: a periastron passage or a transit (inferior conjunction).
    const epoch = o.epoch === undefined ? undefined : requireString(o.epoch, `${label}.epoch`);
    if (epoch !== undefined && epoch !== 'periastron' && epoch !== 'inferior-conjunction') throw new TypeError(`${label}.epoch is periastron or inferior-conjunction, not ${epoch}.`);
    if (Number(elements.eccentricity) > 0 && (epoch === undefined || elements.argumentOfPeriapsisDegrees === undefined)) throw new TypeError(`${label}: an eccentric orbit needs argumentOfPeriapsisDegrees and epoch (periastron or inferior-conjunction).`);
    return { elements: Object.fromEntries(Object.entries(elements).map(([key, v]) => [key, requireFiniteNumber(v, `${label}.elements.${key}`)])), ...(epoch ? { epoch: epoch as 'periastron' | 'inferior-conjunction' } : {}), source: requireString(o.source, `${label}.source`), url: requireString(o.url, `${label}.url`) };
  }
  throw new TypeError(`${label} needs whereistheplanet, archive or elements.`);
}
function hostedSpec(value: unknown, kind: HostedSpec['kind'], label: string): HostedSpec {
  const input = requireRecord(value, label), id = requireString(input.id, `${label}.id`), at = (name: string) => `${id}.${name}`;
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id}: an id is lowercase letters, digits and hyphens.`);
  const known = new Set(['id', 'name', 'description', 'order', 'paper', 'radius', 'mass', 'temperature', 'orbit', 'text', 'thermal', 'photometry']), unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${id}: unknown fields ${unknown.join(', ')}.`);
  const paper = requireRecord(input.paper, at('paper')), orbit = orbitSpec(input.orbit, at('orbit'));
  const thermal = input.thermal === undefined ? undefined : thermalSpec(input.thermal, at('thermal'));
  if (thermal && kind !== 'planet') throw new TypeError(`${id}: a thermal lens is a planet's; a companion star has its temperature.`);
  const photometry = input.photometry === undefined ? undefined : photometrySpec(input.photometry, at('photometry'));
  if (photometry && (kind !== 'planet' || thermal)) throw new TypeError(`${id}: band photometry is a planet's one colour lens; not with a companion star or a thermal lens.`);
  const range = kind === 'planet' ? { radius: [0.01, 5] as const, mass: [0.0001, 100] as const } : { radius: [0.005, 3000] as const, mass: [0.01, 300] as const };
  const out: HostedSpec = { kind, id, name: requireString(input.name, at('name')), description: requireString(input.description, at('description')),
    ...(input.order === undefined ? {} : { order: requireFiniteNumber(input.order, at('order')) }), paper: { url: requireString(paper.url, at('paper.url')), credit: requireString(paper.credit, at('paper.credit')) },
    ...(input.radius === undefined ? {} : { radius: cited(input.radius, at('radius'), range.radius) }), ...(input.mass === undefined ? {} : { mass: cited(input.mass, at('mass'), range.mass) }),
    ...(input.temperature === undefined ? {} : { temperature: cited(input.temperature, at('temperature'), [100, 60000]) }), orbit, ...(input.text === undefined ? {} : { text: draftText(input.text, at('text')) }), ...(thermal ? { thermal } : {}), ...(photometry ? { photometry } : {}) };
  const fromArchive = 'archive' in orbit;
  if (!fromArchive && (!out.radius || !out.mass)) throw new TypeError(`${id}: give radius and mass with their sources; only an archive orbit supplies them.`);
  if (kind === 'companion' && (!out.temperature || !out.radius || !out.mass)) throw new TypeError(`${id}: a companion star needs its cited temperature, radius and mass.`);
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
const citedOrFlame = (value: unknown, label: string, range: readonly [number, number]) => value === 'gaia-flame' ? 'gaia-flame' as const : cited(value, label, range);

export function parseStarSpec(value: unknown): StarSpec {
  const input = requireRecord(value, 'star spec'), id = requireString(input.id, 'id');
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id}: a star id is lowercase letters, digits and hyphens.`);
  const at = (label: string) => `${id}.${label}`;
  const known = new Set(['id', 'name', 'system', 'description', 'order', 'target', 'gaia', 'paper', 'radius', 'mass', 'temperature', 'gravity', 'radialVelocity', 'spin', 'limb', 'color', 'planets', 'companions', 'text', 'notes']);
  const unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${id}: unknown spec fields ${unknown.join(', ')}.`);
  const gaia = input.gaia === undefined ? undefined : requireString(input.gaia, at('gaia')), target = input.target === undefined ? undefined : requireString(input.target, at('target'));
  if (gaia !== undefined && !/^\d{6,20}$/u.test(gaia)) throw new TypeError(`${at('gaia')} is a Gaia DR3 source_id (digits), not ${gaia}.`);
  if (gaia === undefined && target === undefined) throw new TypeError(`${id}: give target (a SIMBAD name) or gaia (a Gaia DR3 source_id).`);
  const paper = requireRecord(input.paper, at('paper')), name = requireString(input.name, at('name'));
  const spin = input.spin === undefined ? undefined : (() => {
    const s = requireRecord(input.spin, at('spin')), inclination = requireFiniteNumber(s.inclinationDegrees, at('spin.inclinationDegrees'));
    if (inclination < 0 || inclination > 90) throw new RangeError(`${at('spin.inclinationDegrees')} ${inclination} is outside 0 to 90.`);
    const period = s.periodDays === undefined ? undefined : requireFiniteNumber(s.periodDays, at('spin.periodDays'));
    if (period !== undefined && !(period > 0)) throw new RangeError(`${at('spin.periodDays')} must be positive.`);
    return { inclinationDegrees: inclination, ...(period === undefined ? {} : { periodDays: period }), source: requireString(s.source, at('spin.source')), url: requireString(s.url, at('spin.url')) };
  })();
  const color = input.color === undefined ? undefined : (() => {
    const c = requireRecord(input.color, at('color')), skip = requireArray(c.skip, at('color.skip')).map(route => requireString(route, at('color.skip')));
    const bad = skip.filter(route => !COLOR_ROUTES.includes(route as ColorRoute));
    if (bad.length) throw new TypeError(`${at('color.skip')}: ${bad.join(', ')} are not colour routes (${COLOR_ROUTES.join(', ')}).`);
    return { skip: skip as ColorRoute[], reason: requireString(c.reason, at('color.reason')) };
  })();
  const limb = input.limb === undefined ? undefined : { none: requireString(requireRecord(input.limb, at('limb')).none, at('limb.none')) };
  return {
    id, name, system: input.system === undefined ? `${name} system` : requireString(input.system, at('system')), description: requireString(input.description, at('description')),
    ...(input.order === undefined ? {} : { order: requireFiniteNumber(input.order, at('order')) }), ...(target ? { target } : {}), ...(gaia ? { gaia } : {}),
    paper: { url: requireString(paper.url, at('paper.url')), credit: requireString(paper.credit, at('paper.credit')) },
    radius: citedOrFlame(input.radius, at('radius'), [0.005, 3000]), mass: citedOrFlame(input.mass, at('mass'), [0.01, 300]),
    temperature: cited(input.temperature, at('temperature'), [1000, 60000]),
    ...(input.gravity === undefined ? {} : { gravity: cited(input.gravity, at('gravity'), [-1, 9]) }),
    ...(input.radialVelocity === undefined ? {} : { radialVelocity: cited(input.radialVelocity, at('radialVelocity'), [-1000, 1000]) }),
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
export function parseObjectSpecs(value: unknown): { readonly stars: StarSpec[]; readonly additions: HostAddition[] } {
  const entries = isRecord(value) ? requireArray(value.stars, 'stars') : requireArray(value, 'object specs');
  const stars = entries.filter(entry => !(isRecord(entry) && entry.host !== undefined)).map(parseStarSpec), additions = entries.filter(entry => isRecord(entry) && entry.host !== undefined).map(parseHostAddition);
  const ids = [...stars.flatMap(spec => [spec.id, ...spec.planets.map(p => p.id), ...spec.companions.map(c => c.id)]), ...additions.flatMap(entry => [...entry.planets, ...entry.companions].map(body => body.id))];
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repeated.length) throw new TypeError(`Object ids repeat: ${repeated.join(', ')}.`);
  return { stars, additions };
}

export function parseStarSpecs(value: unknown): StarSpec[] {
  const stars = isRecord(value) ? requireArray(value.stars, 'stars') : requireArray(value, 'star specs');
  const specs = stars.map(parseStarSpec), ids = specs.flatMap(spec => [spec.id, ...spec.planets.map(p => p.id), ...spec.companions.map(c => c.id)]);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repeated.length) throw new TypeError(`Object ids repeat: ${repeated.join(', ')}.`);
  return specs;
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
