import { array, number, optional, shape as sourceShape, text, type Decoder } from '@cssearth/core';
export function numericSource(value: unknown): string | number {
  if (typeof value === "number") return number(value);
  const source = text(value);
  if (!source.trim() || !Number.isFinite(Number(source))) throw new TypeError("Expected finite source number");
  return source;
}
const shape = <const T extends Record<string, Decoder<unknown>>>(fields: T) => sourceShape(fields, 'Geographic source');
export const parseBodyAttitude = (value: unknown) => { const attitude = shape({ bodyMatrix: array(number) })(value); if (attitude.bodyMatrix.length !== 9) throw new TypeError('A body attitude is a 3 x 3 matrix.'); return attitude; };
export const parseGeographicScene = shape({ body: shape({ bands: array(shape({ latitudeIndex: number, leaves: array(shape({
  style: text, geographicFrameMatrix: optional(text), leafWidth: number })) })) }) });
export const parsePlacesConfig = shape({ namespace: text, publicBase: text, sceneBodyKey: text,
  camera: shape({ maximumControlPitchDegrees: number, maximumScenePitchDegrees: number }),
  geographic: shape({ places: shape({ directory: text, overviewZoom: number }) }) });
export const parsePlacesManifest = shape({ inputs: array(shape({ path: text, bytes: number })), source: text,
  snapshotDate: text, qualification: text, sourcePage: text, license: text });
