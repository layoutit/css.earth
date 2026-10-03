import { PUBLISHED_MUTUAL_ORBIT_SCHEMA, PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA } from './source-schema-identifiers.js';
import { sourceRecordReaders } from './source-record-readers.js';
const { string, number, vector, optional, array, dictionary, boolean, literal, shape } = sourceRecordReaders;
const stateFields = { positionKm: vector, velocityKmPerDay: vector };
const pinFields = { path: string, bytes: number };
const urlPinFields = { ...pinFields, url: string };
const horizonPinFields = { ...urlPinFields, target: number, center: number };
const sourcePin = shape(urlPinFields);
const horizonPin = shape(horizonPinFields);
const parentPin = shape({ ...horizonPinFields, requestEpochJdUtc: number, ttMinusUtcSeconds: number, targetKind: string });
const bodyFields = { id: string, centerBodyId: string, epochJdTt: number, referenceFrame: string, units: string,
  correction: string, runtimeExtrapolation: boolean, limitations: array(string), ...stateFields,
  gravitationalParametersKm3PerS2: shape({ body: number, parent: number, combined: number }) };
const projectionFields = { epochJdTt: number, geocentricLightTimeDays: number };
const comparison = shape({ ...projectionFields, responseTableJd: number,
  miriadePositionMas: array(number), publishedModelPositionMas: array(number), differenceMagnitudeMas: number });
const historicalComparison = shape({ ...projectionFields, line: number, sourceRow: string, jdUtc: number,
  reportedModelPositionMas: array(number), publishedPrintedElementsPositionMas: array(number) });
const validation = shape({ orbitalPlaneVsIndependentRadarDegrees: optional(number), sourceEpochState: optional(shape(stateFields)),
  comparisons: optional(array(comparison)), comparisonCount: optional(number), maxDifferenceMas: optional(number),
  scientificPrecisionQualified: optional(boolean), publishedFitReproduction: optional(shape({
    comparisons: array(historicalComparison), comparisonCount: number, maxDifferenceMas: number })) });
export const parsePublishedBodyEpochRecord = shape({ ...bodyFields, schema: literal(PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA),
  source: shape(pinFields), sourcePins: optional(dictionary(sourcePin)), validation,
  parentHeliocentricState: optional(shape(stateFields)), parentHeliocentricSource: optional(parentPin) });
export const parsePublishedParameters = shape({ schema: literal(PUBLISHED_MUTUAL_ORBIT_SCHEMA), id: string,
  placement: optional(literal('approximate')),
  centerBodyId: string, referenceFrame: string, epochJd: number, timeQualification: string, citation: shape({ url: string }),
  semiMajorAxisKm: number, eccentricity: number, inclinationDegrees: number, ascendingNodeDegrees: number,
  argumentPeriapsisDegrees: number, meanAnomalyDegrees: number, meanMotionDegreesPerDay: number,
  quadraticMeanAnomalyDegreesPerYear2: number, sourceObservations: optional(shape({ table3ReportedRmsMas: number })),
  independentPlaneReference: optional(shape({ poleIcrfRightAscensionDegrees: number, poleIcrfDeclinationDegrees: number })) });
export type PublishedRecord = ReturnType<typeof parsePublishedBodyEpochRecord>;
export type PublishedParameters = ReturnType<typeof parsePublishedParameters>;
export type SourcePin = ReturnType<typeof sourcePin>;
export type HorizonsPin = ReturnType<typeof horizonPin>;
export type ProjectionSample = ReturnType<typeof comparison> | ReturnType<typeof historicalComparison>;
