function objectValue(value: unknown, label = 'record'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function stringValue(value: unknown, label = 'value'): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  return value;
}
function numberValue(value: unknown, label = 'value'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}
function arrayValue(value: unknown, label = 'value'): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}
function numberVector(value: unknown): [number, number, number] {
  const values = arrayValue(value);
  if (values.length !== 3) throw new TypeError('A source vector requires exactly three components');
  return [numberValue(values[0]), numberValue(values[1]), numberValue(values[2])];
}
// Structural decoding of retained source records. Semantic identities, epochs,
// numerical agreements are checked by the consuming ephemeris loader.

const string = stringValue, number = numberValue, vector = numberVector;
type Parser<T> = (value: unknown) => T;
function optional<T>(parse: Parser<T>): Parser<T | undefined> { return value => value === undefined ? undefined : parse(value); }
function array<T>(parse: Parser<T>): Parser<T[]> { return value => arrayValue(value).map(parse); }
function dictionary<T>(parse: Parser<T>): Parser<Record<string, T>> {
  return value => Object.fromEntries(Object.entries(objectValue(value)).map(([key, entry]) => [key, parse(entry)]));
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Source boolean field differs');
  return value;
}
function literal<const T extends string>(expected: T): Parser<T> {
  return value => { if (value !== expected) throw new TypeError(`Expected source schema ${expected}`); return expected; };
}
function shape<const T extends Record<string, Parser<unknown>>>(fields: T): Parser<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
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

export const sourceRecordReaders = { objectValue, stringValue, numberValue, arrayValue, numberVector, string, number, vector, optional, array, dictionary, boolean, literal, shape };
export type { Parser };
