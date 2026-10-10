import { sourceRecordReaders } from '@cssearth/objects';
const { objectValue, stringValue, numberValue } = sourceRecordReaders;

const HOSTED_EPOCHS = ['inferior-conjunction', 'superior-conjunction', 'periastron'] as const;
const isHostedEpoch = (value: unknown): value is typeof HOSTED_EPOCHS[number] => (HOSTED_EPOCHS as readonly unknown[]).includes(value);
export interface HostedOrbitRecord { periodDays: number; semiMajorAxisStellarRadii: number; inclinationDegrees: number; eccentricity: number;
  argumentOfPeriapsisDegrees?: number; epochDefinition?: 'inferior-conjunction' | 'superior-conjunction' | 'periastron';
  transitTimeBmjdTdb: number; ascendingNodePositionAngleDegrees: number; prediction?: HostedOrbitPredictionRecord; weaklyConstrained?: true; placement?: 'approximate';
  barycentreCompanion?: string;
  sources: { period: string; shape: string; phase: string; orientation: string; eccentricity?: string; argumentOfPeriapsis?: string; constraint?: string; placement?: string; barycentre?: string } }

/** Preserve the selected published solution. Eccentric orbits need a sourced planet-centric periapsis and an explicit epoch convention. */
/** The published orbit this planet is predicted from, named as the upstream prediction tool knows it. */
export interface HostedOrbitPredictionRecord { tool: 'whereistheplanet'; planet: string; reference: string }
function readPredictionRecord(value: unknown): HostedOrbitPredictionRecord {
  const record = objectValue(value, 'hosted orbit prediction');
  for (const key of Object.keys(record)) if (!['tool', 'planet', 'reference'].includes(key)) throw new TypeError(`Unknown hosted orbit prediction field ${key}.`);
  if (record.tool !== 'whereistheplanet') throw new TypeError('The only hosted orbit prediction tool is whereistheplanet.');
  const planet = stringValue(record.planet);
  if (!/^[a-z0-9+_-]+$/u.test(planet)) throw new TypeError('A whereistheplanet planet name is lowercase and unspaced.');
  return { tool: 'whereistheplanet', planet, reference: stringValue(record.reference) };
}
const trueValue = (value: unknown): true => {
  if (value !== true) throw new TypeError(`Expected true or absent, got ${JSON.stringify(value)}.`);
  return true;
};
const approximateValue = (value: unknown): 'approximate' => {
  if (value !== 'approximate') throw new TypeError(`A hosted orbit's placement is approximate or absent, not ${JSON.stringify(value)}.`);
  return 'approximate';
};
export function readHostedOrbitRecord(value: unknown): HostedOrbitRecord {
  const record = objectValue(value), sources = objectValue(record.sources, 'hosted orbit sources');
  const eccentricity = numberValue(record.eccentricity, 'hosted eccentricity');
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new TypeError('Hosted eccentricity must be in [0, 1).');
  const epochDefinition = record.epochDefinition;
  if (epochDefinition !== undefined && !isHostedEpoch(epochDefinition)) throw new TypeError(`Unsupported hosted orbit epoch definition: ${String(epochDefinition)}.`);
  if (eccentricity > 0 && (record.argumentOfPeriapsisDegrees === undefined || epochDefinition === undefined ||
      sources.eccentricity === undefined || sources.argumentOfPeriapsis === undefined)) throw new TypeError('An eccentric hosted orbit needs a periapsis argument, an epoch definition (inferior-conjunction, superior-conjunction or periastron) and sources for both eccentricity and periapsis.');
  const orbit: HostedOrbitRecord = { periodDays: numberValue(record.periodDays), semiMajorAxisStellarRadii: numberValue(record.semiMajorAxisStellarRadii),
    inclinationDegrees: numberValue(record.inclinationDegrees), eccentricity, transitTimeBmjdTdb: numberValue(record.transitTimeBmjdTdb),
    ...(record.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsisDegrees: numberValue(record.argumentOfPeriapsisDegrees) }),
    ...(epochDefinition === undefined ? {} : { epochDefinition }),
    ascendingNodePositionAngleDegrees: numberValue(record.ascendingNodePositionAngleDegrees),
    ...(record.prediction === undefined ? {} : { prediction: readPredictionRecord(record.prediction) }),
    ...(record.weaklyConstrained === undefined ? {} : { weaklyConstrained: trueValue(record.weaklyConstrained) }),
    ...(record.placement === undefined ? {} : { placement: approximateValue(record.placement) }),
    ...(record.barycentreCompanion === undefined ? {} : { barycentreCompanion: stringValue(record.barycentreCompanion, 'hosted barycentre companion') }),
    sources: { period: stringValue(sources.period), shape: stringValue(sources.shape), phase: stringValue(sources.phase), orientation: stringValue(sources.orientation),
      ...(sources.eccentricity === undefined ? {} : { eccentricity: stringValue(sources.eccentricity) }),
      ...(sources.argumentOfPeriapsis === undefined ? {} : { argumentOfPeriapsis: stringValue(sources.argumentOfPeriapsis) }),
      ...(sources.constraint === undefined ? {} : { constraint: stringValue(sources.constraint) }),
      ...(sources.placement === undefined ? {} : { placement: stringValue(sources.placement) }),
      ...(sources.barycentre === undefined ? {} : { barycentre: stringValue(sources.barycentre) }) } };
  if ((orbit.barycentreCompanion === undefined) !== (orbit.sources.barycentre === undefined)) {
    throw new TypeError(`A hosted orbit about a binary barycentre cites that barycentre in sources.barycentre, and only then: barycentreCompanion ${String(orbit.barycentreCompanion)}.`);
  }
  if ((orbit.weaklyConstrained === undefined) !== (orbit.sources.constraint === undefined)) {
    throw new TypeError(`A weakly constrained hosted orbit quotes its criterion in sources.constraint, and only then: weaklyConstrained ${String(orbit.weaklyConstrained)}.`);
  }
  if ((orbit.placement === undefined) !== (orbit.sources.placement === undefined)) {
    throw new TypeError(`An approximately placed hosted orbit states its assumption in sources.placement, and only then: placement ${String(orbit.placement)}.`);
  }
  // Each broken rule is named with its value, so a refused record says what to fix.
  const broken = [
    !(orbit.periodDays > 0) && `periodDays ${orbit.periodDays} is not positive`,
    !(orbit.semiMajorAxisStellarRadii > 1) && `semiMajorAxisStellarRadii ${orbit.semiMajorAxisStellarRadii} puts the orbit inside the star`,
    (orbit.inclinationDegrees < 0 || orbit.inclinationDegrees > 180) && `inclinationDegrees ${orbit.inclinationDegrees} is outside 0 to 180`,
    (orbit.ascendingNodePositionAngleDegrees < 0 || orbit.ascendingNodePositionAngleDegrees >= 360) && `ascendingNodePositionAngleDegrees ${orbit.ascendingNodePositionAngleDegrees} is outside 0 to 360`,
    orbit.argumentOfPeriapsisDegrees !== undefined && (orbit.argumentOfPeriapsisDegrees < 0 || orbit.argumentOfPeriapsisDegrees >= 360) && `argumentOfPeriapsisDegrees ${orbit.argumentOfPeriapsisDegrees} is outside 0 to 360`,
    orbit.semiMajorAxisStellarRadii > 1 && orbit.semiMajorAxisStellarRadii * (1 - eccentricity) <= 1 && `periastron ${orbit.semiMajorAxisStellarRadii} x (1 - ${eccentricity}) stellar radii is inside the star`,
    Object.entries(orbit.sources).some(([, text]) => !text.trim()) && `sources.${Object.entries(orbit.sources).find(([, text]) => !text.trim())![0]} is empty`,
  ].filter(Boolean);
  if (broken.length) throw new TypeError(`Invalid hosted orbit: ${broken.join('; ')}.`);
  return orbit;
}
