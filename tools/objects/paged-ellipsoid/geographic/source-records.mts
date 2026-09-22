import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../../sources/source-values.mts';
export type Decoder<T> = (value: unknown) => T;
export const text = requireString;
export const number = requireFiniteNumber;
export function numericSource(value: unknown): string | number {
  if (typeof value === "number") return number(value);
  const source = text(value);
  if (!source.trim() || !Number.isFinite(Number(source))) throw new TypeError("Expected finite source number");
  return source;
}
export const optional = <T,>(decode: Decoder<T>): Decoder<T | undefined> => value => value === undefined ? undefined : decode(value);
export const array = <T,>(decode: Decoder<T>): Decoder<T[]> => value => requireArray(value).map(decode);
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new TypeError('Expected source boolean'); return value; }
export function shape<const T extends Record<string, Decoder<unknown>>>(fields: T): Decoder<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
  return value => {
    const source = requireRecord(value), result: Record<string, unknown> = { ...source };
    for (const [key, decode] of Object.entries(fields)) {
      try { const field = decode(source[key]); if (field !== undefined || Object.hasOwn(source, key)) result[key] = field; }
      catch (error) { throw new TypeError(`Geographic source ${key}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return result as { -readonly [K in keyof T]: ReturnType<T[K]> };
  };
}
export const parseBodyAttitude = (value: unknown) => { const attitude = shape({ bodyMatrix: array(number) })(value); if (attitude.bodyMatrix.length !== 9) throw new TypeError('A body attitude is a 3 x 3 matrix.'); return attitude; };
export const parseGeographicScene = shape({ body: shape({ bands: array(shape({ latitudeIndex: number, leaves: array(shape({
  style: text, geographicFrameMatrix: optional(text), leafWidth: number })) })) }) });
export const parsePlacesConfig = shape({ namespace: text, publicBase: text, sceneBodyKey: text,
  camera: shape({ maximumControlPitchDegrees: number, maximumScenePitchDegrees: number }),
  geographic: shape({ places: shape({ directory: text, overviewZoom: number }) }) });
export const parsePlacesManifest = shape({ inputs: array(shape({ path: text, bytes: number })), source: text,
  snapshotDate: text, qualification: text, sourcePage: text, license: text });
export const dictionary = <T,>(decode: Decoder<T>): Decoder<Record<string,T>> => value => Object.fromEntries(Object.entries(requireRecord(value)).map(([key,value])=>[key,decode(value)]));
