// Structural decoding of retained source records. Semantic identities, epochs,
// hashes and numerical agreements are checked by the consuming ephemeris loader.
import { objectValue, stringValue, numberValue, arrayValue, numberVector } from './generator-records.mts';
export { stringValue as string, numberValue as number, numberVector as vector };
export type Parser<T> = (value: unknown) => T;
export function optional<T>(parse: Parser<T>): Parser<T | undefined> { return value => value === undefined ? undefined : parse(value); }
export function array<T>(parse: Parser<T>): Parser<T[]> { return value => arrayValue(value).map(parse); }
export function dictionary<T>(parse: Parser<T>): Parser<Record<string, T>> {
  return value => Object.fromEntries(Object.entries(objectValue(value)).map(([key, entry]) => [key, parse(entry)]));
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Source boolean field differs');
  return value;
}
export function literal<const T extends string>(expected: T): Parser<T> {
  return value => { if (value !== expected) throw new TypeError(`Expected source schema ${expected}`); return expected; };
}
export function shape<const T extends Record<string, Parser<unknown>>>(fields: T): Parser<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
  return value => {
    const source = objectValue(value);
    // Keep uninterpreted provenance fields exactly as supplied. Every exposed
    // typed field is decoded below; extra metadata never drives computation.
    const parsed: Record<string, unknown> = { ...source };
    for (const [key, parse] of Object.entries(fields)) {
      let decoded: unknown;
      try { decoded = parse(source[key]); } catch (error) { throw new TypeError(`Source field ${key}: ${error instanceof Error ? error.message : String(error)}`); }
      if (decoded !== undefined || Object.hasOwn(source, key)) parsed[key] = decoded;
    }
    return parsed as { -readonly [K in keyof T]: ReturnType<T[K]> };
  };
}
