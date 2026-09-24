import { requireArray, requireFiniteNumber, requireRecord, requireString } from './validate.js';

/** Decoders check an unknown value and return it typed, or throw a TypeError. */
export type Decoder<T> = (value: unknown) => T;
export const text = requireString;
export const number = requireFiniteNumber;
export const optional = <T,>(decode: Decoder<T>): Decoder<T | undefined> => value => value === undefined ? undefined : decode(value);
export const nullable = <T,>(decode: Decoder<T>): Decoder<T | null> => value => value === null ? null : decode(value);
/** Elements decode with `Array.prototype.map`, so a getter such as `number` names a failing element by its index. */
export const array = <T,>(decode: Decoder<T>): Decoder<T[]> => value => requireArray(value).map(decode);
export const dictionary = <T,>(decode: Decoder<T>): Decoder<Record<string, T>> => value => Object.fromEntries(Object.entries(requireRecord(value)).map(([key, value]) => [key, decode(value)]));
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new TypeError('Expected source boolean'); return value; }
export function choice<const T extends readonly string[]>(...values: T): Decoder<T[number]> {
  return value => { const match = values.find(item => item === value); if (match === undefined) throw new TypeError('Unsupported source choice'); return match; };
}
/** The field-error prefix the source records have always reported. */
export const SOURCE_FIELD_CONTEXT = 'Terrestrial source';
/** Decodes the named fields and keeps every other field as supplied. A failing field is reported as
 * `<context> <key>: <reason>`; nested shapes repeat the prefix for each level. */
export function shape<const T extends Record<string, Decoder<unknown>>>(fields: T, context = SOURCE_FIELD_CONTEXT): Decoder<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
  return value => {
    const source = requireRecord(value), result: Record<string, unknown> = { ...source };
    for (const [key, decode] of Object.entries(fields)) {
      try { const field = decode(source[key]); if (field !== undefined || Object.hasOwn(source, key)) result[key] = field; }
      catch (error) { throw new TypeError(`${context} ${key}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return result as { -readonly [K in keyof T]: ReturnType<T[K]> };
  };
}
