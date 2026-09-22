import { array, boolean, dictionary, literal, number, optional, shape, string, vector } from './source-validation.mts';
import { objectValue } from './generator-records.mts';
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
const comparison = shape({ ...projectionFields, sourcePins: array(string), responseTableJd: number,
  miriadePositionMas: array(number), publishedModelPositionMas: array(number), differenceMagnitudeMas: number });
const historicalComparison = shape({ ...projectionFields, line: number, sourceRow: string, jdUtc: number,
  reportedModelPositionMas: array(number), publishedPrintedElementsPositionMas: array(number) });
const validation = shape({ orbitalPlaneVsIndependentRadarDegrees: optional(number), sourceEpochState: optional(shape(stateFields)),
  comparisons: optional(array(comparison)), comparisonCount: optional(number), maxDifferenceMas: optional(number),
  scientificPrecisionQualified: optional(boolean), publishedFitReproduction: optional(shape({
    comparisons: array(historicalComparison), comparisonCount: number, maxDifferenceMas: number })) });
const horizonsRecord = shape({ ...bodyFields, solution: string, schema: literal('cssearth-body-epoch-ephemeris@1'), requestEpochJdUtc: number,
  ttMinusUtcSeconds: number, sources: shape({ relative: horizonPin, parent: horizonPin, heliocentricCheck: horizonPin }),
  parentHeliocentricState: shape(stateFields) });
const publishedRecord = shape({ ...bodyFields, schema: literal('cssearth-published-body-epoch-ephemeris@1'),
  source: shape(pinFields), sourcePins: optional(dictionary(sourcePin)), validation,
  parentHeliocentricState: optional(shape(stateFields)), parentHeliocentricSource: optional(parentPin) });
export function parseBodyEpochRecord(value: unknown) {
  return objectValue(value).schema === 'cssearth-published-body-epoch-ephemeris@1' ? publishedRecord(value) : horizonsRecord(value);
}
export const parsePublishedParameters = shape({ schema: literal('cssearth-published-mutual-orbit@1'), id: string,
  placement: optional(literal('approximate')),
  centerBodyId: string, referenceFrame: string, epochJd: number, timeQualification: string, citation: shape({ url: string }),
  semiMajorAxisKm: number, eccentricity: number, inclinationDegrees: number, ascendingNodeDegrees: number,
  argumentPeriapsisDegrees: number, meanAnomalyDegrees: number, meanMotionDegreesPerDay: number,
  quadraticMeanAnomalyDegreesPerYear2: number, sourceObservations: optional(shape({ table3ReportedRmsMas: number })),
  independentPlaneReference: optional(shape({ poleIcrfRightAscensionDegrees: number, poleIcrfDeclinationDegrees: number })) });
export type PublishedRecord = ReturnType<typeof publishedRecord>;
export type PublishedParameters = ReturnType<typeof parsePublishedParameters>;
export type SourcePin = ReturnType<typeof sourcePin>;
export type HorizonsPin = ReturnType<typeof horizonPin>;
export type ProjectionSample = ReturnType<typeof comparison> | ReturnType<typeof historicalComparison>;
export const parseSceneManifest = shape({ schema: literal('cssearth-scene-epoch-ephemeris@1'), epochJdTt: number,
  requestEpochJdUtc: number, ttMinusUtcSeconds: number, timeQualification: string, referenceFrame: string,
  units: string, correction: string, retrievedAt: string,
  records: array(shape({ id: string, target: number, center: number, centerBodyId: string, path: string, url: string })) });
