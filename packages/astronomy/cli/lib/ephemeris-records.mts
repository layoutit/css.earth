import { PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA, parsePublishedBodyEpochRecord } from '@cssearth/objects';
import { array, boolean, literal, number, shape, string, vector } from './source-validation.mts';
import { objectValue } from './generator-records.mts';
const stateFields = { positionKm: vector, velocityKmPerDay: vector };
const pinFields = { path: string, bytes: number };
const urlPinFields = { ...pinFields, url: string };
const horizonPinFields = { ...urlPinFields, target: number, center: number };
const horizonPin = shape(horizonPinFields);
const bodyFields = { id: string, centerBodyId: string, epochJdTt: number, referenceFrame: string, units: string,
  correction: string, runtimeExtrapolation: boolean, limitations: array(string), ...stateFields,
  gravitationalParametersKm3PerS2: shape({ body: number, parent: number, combined: number }) };
const horizonsRecord = shape({ ...bodyFields, solution: string, schema: literal('cssearth-body-epoch-ephemeris@1'), requestEpochJdUtc: number,
  ttMinusUtcSeconds: number, sources: shape({ relative: horizonPin, parent: horizonPin, heliocentricCheck: horizonPin }),
  parentHeliocentricState: shape(stateFields) });
export function parseBodyEpochRecord(value: unknown) {
  return objectValue(value).schema === PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA ? parsePublishedBodyEpochRecord(value) : horizonsRecord(value);
}
export const parseSceneManifest = shape({ schema: literal('cssearth-scene-epoch-ephemeris@1'), epochJdTt: number,
  requestEpochJdUtc: number, ttMinusUtcSeconds: number, timeQualification: string, referenceFrame: string,
  units: string, correction: string, retrievedAt: string,
  records: array(shape({ id: string, target: number, center: number, centerBodyId: string, path: string, url: string })) });
