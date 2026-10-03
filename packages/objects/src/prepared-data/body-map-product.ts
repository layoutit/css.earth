import { canonical, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
/** What a map of a measurement on a body means, carried beside the map.
 *
 * Three telescopes already put a measurement on a body through the same projection (jwst/cubes/body-map.mts): a JWST band
 * depth, an ALMA brightness temperature, a Hubble equivalent width. The grid they share says where a number is. It does not
 * say what the number is, and a quantity with its units does not either: two maps in Angstrom can use different absorption
 * windows or continua, and two maps in kelvin can be different physical quantities. So a body map carries:
 *
 * - the **measurement definition**: the quantity, its units, exactly how it was measured (windows, continuum model, frequency,
 *   convention, reference) and the publication the definition comes from, and whether it is a property of the ground or the
 *   state of the ground at one moment;
 * - the **frame**: the body, its radius and the rotation model that turned sky into longitude and latitude;
 * - the **grid** and what its planes are (value, one-sigma uncertainty, and what a missing cell means);
 * - every **observation** that went in: when, from where, how far, and the angular resolution the instrument had. Angular
 *   resolution is a fact about the observation; kilometres on the surface also need the range, and hold only where the body
 *   faced the telescope, so both are stated and neither is derived from the other in silence.
 *
 * Maps combine only when their definitions are the same definition (compared field by field, not by quantity name) on the same
 * body, frame and grid, and only under a stated policy for the two things that legitimately differ between observations:
 * time and resolution. A heat snapshot is never averaged with a band depth, and two snapshots of a changing quantity are
 * never averaged as if they were one without the caller saying so. */
import { parseResolutionEvidence, type ResolutionEvidence } from './resolution-evidence.js';

export const BODY_MAP_SCHEMA = 'cssearth-body-map@1';

/** `surface-property`: the ground's own, the same whenever it is looked at (a band depth of a stable material).
 * `instantaneous-state`: what the ground was doing at that moment (a temperature at one time of day). */
export type TimeDependence = 'surface-property' | 'instantaneous-state';

export interface MeasurementDefinition {
  readonly quantity: string; readonly units: string; readonly timeDependence: TimeDependence;
  /** Actual wavelength intervals used by this measurement, when the author can establish them from the product. Publication
   * requires them before claiming that a map answers a wavelength-constrained request. */
  readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
  /** Everything that fixes the number: windows, continuum model and order, frequency, convention, reference spectrum. Two
   * definitions are the same only when every entry here is equal. */
  readonly method: Readonly<Record<string, unknown>>;
  /** The publication or document the definition is taken from. Not part of the identity: a citation can be corrected. */
  readonly source: string;
}

export interface AngularResolution { readonly majorArcsec: number; readonly minorArcsec: number; readonly positionAngleDegrees?: number;
  readonly evidence?: ResolutionEvidence;
  /** What the figure is: a fitted beam, a diffraction limit, a published value, a pixel pair. */ readonly basis: string }

export interface BodyMapObservation {
  readonly id: string; readonly telescope: string; readonly instrument: string;
  /** The exact ledger mode this observation belongs to. Older records may omit it; publication requires it. */
  readonly mode?: string;
  /** The pinned toolkit program that supplied the observation. Older records may omit it; publication requires it. */
  readonly programme?: string;
  readonly midTimeJd: number; readonly exposureSeconds?: number;
  readonly startTimeJd?: number; readonly endTimeJd?: number;
  readonly startIso?: string; readonly endIso?: string;
  readonly rangeKm: number;
  readonly subObserver: { readonly latitudeDegrees: number; readonly westLongitudeDegrees: number };
  readonly subSolar?: { readonly latitudeDegrees: number; readonly westLongitudeDegrees: number };
  readonly angularResolution: AngularResolution;
}

export interface BodyMapFrame { readonly body: string; readonly radiusKm: number;
  /** The rotation model that defines longitude and latitude: the file and the body code read from it. */
  readonly rotation: { readonly model: string; readonly bodyCode: number } }

export interface BodyMapGrid { readonly width: number; readonly height: number; readonly longitude: 'east-positive-from-0'; readonly rows: 'north-to-south' }

export interface BodyMapProduct {
  readonly schema: typeof BODY_MAP_SCHEMA;
  readonly definition: MeasurementDefinition; readonly frame: BodyMapFrame; readonly grid: BodyMapGrid;
  /** The FITS file and which of its extensions hold the value and its one-sigma uncertainty. */
  readonly planes: { readonly file: string; readonly value: string; readonly uncertainty: string };
  /** A cell is NaN where the body was not seen within this emission angle, or where the measurement had no support. */
  readonly mask: { readonly maximumEmissionDegrees: number; readonly missing: 'NaN' };
  readonly observations: readonly BodyMapObservation[];
  /** How the observations were put together, when there is more than one. */
  readonly combination?: CombinationPolicy;
}

/** The two differences a combination must be told how to treat. */
export interface CombinationPolicy {
  /** `same-epoch-only`: refuse observations further apart than `withinDays`. `mosaic-of-snapshots`: keep each where it saw
   * best and say the result is not one moment. `time-invariant`: only for a surface property. */
  readonly time: { readonly rule: 'same-epoch-only'; readonly withinDays: number } | { readonly rule: 'mosaic-of-snapshots' } | { readonly rule: 'time-invariant' };
  /** `within-factor`: refuse observations whose surface resolution differs by more than the factor. `as-observed`: keep each
   * at its own resolution and report the range. */
  readonly resolution: { readonly rule: 'within-factor'; readonly factor: number } | { readonly rule: 'as-observed' };
}



/** What fixes a measurement definition's number, in canonical order. The citation is left out. */
const definitionFields = (definition: MeasurementDefinition): string =>
  JSON.stringify(canonical({ quantity: definition.quantity, units: definition.units, timeDependence: definition.timeDependence,
    wavelengthIntervalsMicrometres: definition.wavelengthIntervalsMicrometres ?? null, method: definition.method }));

/** Whether two definitions measure the same thing: every field that fixes the number agrees; the citation may differ. */
export const sameDefinition = (a: MeasurementDefinition, b: MeasurementDefinition): boolean => definitionFields(a) === definitionFields(b);

export function parseBodyMapProduct(value: unknown, surfaceResolution: SurfaceResolutionReader): BodyMapProduct {
  const record = requireRecord(value, 'body map');
  if (record.schema !== BODY_MAP_SCHEMA) throw new TypeError(`Unsupported body map schema ${String(record.schema)}.`);
  const point = (raw: unknown, label: string) => { const entry = requireRecord(raw, label), latitudeDegrees = requireFiniteNumber(entry.latitudeDegrees, `${label} latitude`), westLongitudeDegrees = requireFiniteNumber(entry.westLongitudeDegrees, `${label} longitude`);
    if (Math.abs(latitudeDegrees) > 90 || westLongitudeDegrees < 0 || westLongitudeDegrees >= 360) throw new RangeError(`${label} is a latitude and a west longitude in [0, 360).`);
    return { latitudeDegrees, westLongitudeDegrees }; };
  const definitionRecord = requireRecord(record.definition, 'definition'), timeDependence = requireString(definitionRecord.timeDependence, 'timeDependence');
  if (timeDependence !== 'surface-property' && timeDependence !== 'instantaneous-state') throw new TypeError('A definition says whether it measures a surface property or an instantaneous state.');
  const method = requireRecord(definitionRecord.method, 'definition.method');
  if (!Object.keys(method).length) throw new TypeError('A definition states how the quantity was measured; a quantity and its units are not a definition.');
  const wavelengthIntervalsMicrometres = definitionRecord.wavelengthIntervalsMicrometres === undefined ? undefined
    : requireArray(definitionRecord.wavelengthIntervalsMicrometres, 'definition wavelength intervals').map((raw, index) => {
      const interval = requireArray(raw, `definition wavelength interval ${index}`);
      if (interval.length !== 2) throw new TypeError('A definition wavelength interval has two values.');
      const from = requireFiniteNumber(interval[0], 'wavelength interval start'), to = requireFiniteNumber(interval[1], 'wavelength interval end');
      if (!(from > 0 && to >= from)) throw new RangeError(`Invalid definition wavelength interval ${from} to ${to}.`);
      return [from, to] as const;
    });
  const definition: MeasurementDefinition = { quantity: requireString(definitionRecord.quantity, 'quantity'), units: requireString(definitionRecord.units, 'units'), timeDependence,
    ...(wavelengthIntervalsMicrometres === undefined ? {} : { wavelengthIntervalsMicrometres }), method, source: requireString(definitionRecord.source, 'definition.source') };
  const frameRecord = requireRecord(record.frame, 'frame'), rotation = requireRecord(frameRecord.rotation, 'frame.rotation');
  const frame: BodyMapFrame = { body: requireString(frameRecord.body, 'frame.body'), radiusKm: requireFiniteNumber(frameRecord.radiusKm, 'frame.radiusKm'),
    rotation: { model: requireString(rotation.model, 'rotation.model'), bodyCode: requireFiniteNumber(rotation.bodyCode, 'rotation.bodyCode') } };
  const gridRecord = requireRecord(record.grid, 'grid');
  if (gridRecord.longitude !== 'east-positive-from-0' || gridRecord.rows !== 'north-to-south') throw new TypeError('A body map grid runs east from 0 degrees, north to south.');
  const grid: BodyMapGrid = { width: requireFiniteNumber(gridRecord.width, 'grid.width'), height: requireFiniteNumber(gridRecord.height, 'grid.height'), longitude: 'east-positive-from-0', rows: 'north-to-south' };
  const planesRecord = requireRecord(record.planes, 'planes'), maskRecord = requireRecord(record.mask, 'mask');
  const observations = requireArray(record.observations, 'observations').map((raw, index) => {
    const entry = requireRecord(raw, `observation ${index}`), resolution = requireRecord(entry.angularResolution, 'angularResolution');
    const angularResolution: AngularResolution = { majorArcsec: requireFiniteNumber(resolution.majorArcsec, 'majorArcsec'), minorArcsec: requireFiniteNumber(resolution.minorArcsec, 'minorArcsec'),
      ...(resolution.positionAngleDegrees === undefined ? {} : { positionAngleDegrees: requireFiniteNumber(resolution.positionAngleDegrees, 'positionAngleDegrees') }), basis: requireString(resolution.basis, 'angularResolution.basis'),
      ...(resolution.evidence === undefined ? {} : { evidence: parseResolutionEvidence(resolution.evidence) }) };
    if (!(angularResolution.majorArcsec >= angularResolution.minorArcsec && angularResolution.minorArcsec > 0)) throw new RangeError(`Observation ${index}: the resolution's major axis is at least its minor, and both are positive.`);
    const startIso = entry.startIso === undefined ? undefined : requireString(entry.startIso), endIso = entry.endIso === undefined ? undefined : requireString(entry.endIso);
    if ((startIso === undefined) !== (endIso === undefined) || startIso !== undefined && (!/Z$/u.test(startIso) || !/Z$/u.test(endIso!) || !Number.isFinite(Date.parse(startIso)) || !Number.isFinite(Date.parse(endIso!)) || Date.parse(startIso)>Date.parse(endIso!))) throw new RangeError('Invalid authoritative UTC interval.');
    const startTimeJd = entry.startTimeJd === undefined ? undefined : requireFiniteNumber(entry.startTimeJd, 'startTimeJd');
    const endTimeJd = entry.endTimeJd === undefined ? undefined : requireFiniteNumber(entry.endTimeJd, 'endTimeJd');
    if ((startTimeJd === undefined) !== (endTimeJd === undefined) || (startTimeJd !== undefined && endTimeJd !== undefined && (startTimeJd > endTimeJd || Number(entry.midTimeJd) < startTimeJd || Number(entry.midTimeJd) > endTimeJd))) throw new RangeError('Observation needs a complete, ordered time interval containing its midpoint.');
    if (startIso !== undefined && startTimeJd !== undefined && (Math.abs((startTimeJd - 2440587.5) * 86400000 - Date.parse(startIso)) > 1 || Math.abs((endTimeJd! - 2440587.5) * 86400000 - Date.parse(endIso!)) > 1)) throw new RangeError('UTC and Julian date intervals disagree.');
    const rangeKm = requireFiniteNumber(entry.rangeKm, 'rangeKm');
    if (!(rangeKm > 0)) throw new RangeError(`Observation ${index} needs the range to the body, in kilometres.`);
    return { id: requireString(entry.id, 'observation id'), telescope: requireString(entry.telescope, 'telescope'), instrument: requireString(entry.instrument, 'instrument'),
      ...(entry.mode === undefined ? {} : { mode: requireString(entry.mode, 'observation mode') }),
      ...(entry.programme === undefined ? {} : { programme: requireString(entry.programme, 'observation programme') }),
      midTimeJd: requireFiniteNumber(entry.midTimeJd, 'midTimeJd'),
      ...(startTimeJd === undefined ? {} : { startTimeJd, endTimeJd }),
      ...(startIso === undefined ? {} : { startIso: new Date(startIso).toISOString(), endIso: new Date(endIso!).toISOString() }),
      ...(entry.exposureSeconds === undefined ? {} : { exposureSeconds: requireFiniteNumber(entry.exposureSeconds, 'exposureSeconds') }), rangeKm, subObserver: point(entry.subObserver, 'subObserver'),
      ...(entry.subSolar === undefined ? {} : { subSolar: point(entry.subSolar, 'subSolar') }), angularResolution };
  });
  if (!observations.length) throw new TypeError('A body map names the observations it was made from.');
  const product: BodyMapProduct = { schema: BODY_MAP_SCHEMA, definition, frame, grid,
    planes: { file: requireString(planesRecord.file, 'planes.file'), value: requireString(planesRecord.value, 'planes.value'), uncertainty: requireString(planesRecord.uncertainty, 'planes.uncertainty') },
    mask: { maximumEmissionDegrees: requireFiniteNumber(maskRecord.maximumEmissionDegrees, 'maximumEmissionDegrees'), missing: 'NaN' }, observations,
    ...(record.combination === undefined ? {} : { combination: parseCombinationPolicy(record.combination) }) };
  if (observations.length > 1 && !product.combination) throw new TypeError('A map made from several observations states how they were combined.');
  if (product.combination) assertCombinable([product.definition], [frame], [grid], observations, product.combination, surfaceResolution);
  return product;
}

export function parseCombinationPolicy(value: unknown): CombinationPolicy {
  const record = requireRecord(value, 'combination'), time = requireRecord(record.time, 'combination.time'), resolution = requireRecord(record.resolution, 'combination.resolution');
  const timeRule = requireString(time.rule, 'time.rule'), resolutionRule = requireString(resolution.rule, 'resolution.rule');
  const parsedTime: CombinationPolicy['time'] = timeRule === 'same-epoch-only' ? { rule: timeRule, withinDays: requireFiniteNumber(time.withinDays, 'withinDays') }
    : timeRule === 'mosaic-of-snapshots' || timeRule === 'time-invariant' ? { rule: timeRule } : (() => { throw new TypeError(`Unknown time rule ${timeRule}.`); })();
  const parsedResolution: CombinationPolicy['resolution'] = resolutionRule === 'within-factor' ? { rule: resolutionRule, factor: requireFiniteNumber(resolution.factor, 'factor') }
    : resolutionRule === 'as-observed' ? { rule: resolutionRule } : (() => { throw new TypeError(`Unknown resolution rule ${resolutionRule}.`); })();
  return { time: parsedTime, resolution: parsedResolution };
}

/** Refuse a combination the maps' meaning does not allow. Every refusal says which maps and why. */
export function assertCombinable(definitions: readonly MeasurementDefinition[], frames: readonly BodyMapFrame[], grids: readonly BodyMapGrid[], observations: readonly BodyMapObservation[], policy: CombinationPolicy, surfaceResolution: SurfaceResolutionReader): void {
  const first = definitions[0];
  if (!first) throw new RangeError('Nothing to combine.');
  definitions.forEach((definition, index) => { if (!sameDefinition(definition, first)) throw new TypeError(
    `Map ${index} measures ${definition.quantity} (${definition.units}) by another definition than map 0's ${first.quantity} (${first.units}): the same quantity name and units are not the same measurement.`); });
  frames.forEach((frame, index) => { const base = frames[0]!; if (frame.body !== base.body || frame.radiusKm !== base.radiusKm || frame.rotation.bodyCode !== base.rotation.bodyCode) throw new TypeError(`Map ${index} is in another body frame than map 0.`); });
  grids.forEach((grid, index) => { if (grid.width !== grids[0]!.width || grid.height !== grids[0]!.height) throw new TypeError(`Map ${index} is on another grid than map 0.`); });
  const times = observations.map(observation => observation.midTimeJd), spreadDays = Math.max(...times) - Math.min(...times);
  if (policy.time.rule === 'time-invariant' && first.timeDependence !== 'surface-property') throw new TypeError(`${first.quantity} is an instantaneous state; observations ${spreadDays.toFixed(1)} days apart cannot be combined as if time did not matter. Use mosaic-of-snapshots or same-epoch-only.`);
  if (policy.time.rule === 'same-epoch-only' && spreadDays > policy.time.withinDays) throw new RangeError(`The observations span ${spreadDays.toFixed(2)} days; the policy allows ${policy.time.withinDays}.`);
  if (policy.resolution.rule === 'within-factor') {
    // A beam has two axes and either can differ: a round beam and a needle of the same length are not the same resolution.
    for (const axis of ['majorKm', 'minorKm'] as const) {
      const sizes = observations.map(observation => surfaceResolution(observation)[axis]), ratio = Math.max(...sizes) / Math.min(...sizes);
      if (ratio > policy.resolution.factor) throw new RangeError(`Surface resolution along the ${axis === 'majorKm' ? 'major' : 'minor'} axis ranges over a factor of ${ratio.toFixed(2)} (${Math.min(...sizes).toFixed(0)} to ${Math.max(...sizes).toFixed(0)} km); the policy allows ${policy.resolution.factor}.`);
    }
  }
}

/** Whether two finished maps may be combined under a policy, by their records alone. */
export function assertProductsCombinable(products: readonly BodyMapProduct[], policy: CombinationPolicy, surfaceResolution: SurfaceResolutionReader): void {
  assertCombinable(products.map(product => product.definition), products.map(product => product.frame), products.map(product => product.grid), products.flatMap(product => product.observations), policy, surfaceResolution);
}

export const formatBodyMapProduct = (product: BodyMapProduct, surfaceResolution: SurfaceResolutionReader): string => `${JSON.stringify(parseBodyMapProduct(product, surfaceResolution), null, 2)}\n`;

/** Surface sizes supplied by the scientific owner; compatibility only compares them. */
export type SurfaceResolutionReader = (observation: Pick<BodyMapObservation, 'rangeKm' | 'angularResolution'>) => { readonly majorKm: number; readonly minorKm: number };
