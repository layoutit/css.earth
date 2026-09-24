import { isRecord } from './validate.js';
/** Structural guards: predicates that narrow a value to the type they describe. `parse` runs one and throws
 * `Invalid <label> structure at <path> (<value>).`, naming the deepest field that failed. */
export type Guard<T> = (value: unknown, path?: string) => value is T;
export type Infer<G> = G extends Guard<infer T> ? T : never;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
export const number: Guard<number> = (value): value is number => typeof value === 'number' && Number.isFinite(value);
export const string: Guard<string> = (value): value is string => typeof value === 'string';
export const boolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';
export const nil: Guard<null> = (value): value is null => value === null;
export const record: Guard<Record<string, unknown>> = isRecord;
export function literal<const T extends string | number | boolean>(...values: readonly T[]): Guard<T> {
  return (value): value is T => values.some(expected => expected === value);
}
export function optional<T>(guard: Guard<T>): Guard<T | undefined> { return (value, path): value is T | undefined => value === undefined || guard(value, path); }
export function array<T>(guard: Guard<T>): Guard<T[]> { return (value, path = 'recipe'): value is T[] => isArray(value) && value.every((item, index) => guard(item, `${path}[${index}]`)); }
export function dictionary<T>(guard: Guard<T>): Guard<Record<string, T>> { return (value, path = 'recipe'): value is Record<string, T> => isRecord(value) && Object.entries(value).every(([key, child]) => guard(child, `${path}.${key}`)); }
export function union<const G extends readonly Guard<unknown>[]>(...guards: G): Guard<Infer<G[number]>> { return (value, path): value is Infer<G[number]> => guards.some(guard => guard(value, path)); }
export function tuple<const G extends readonly Guard<unknown>[]>(...guards: G): Guard<{ -readonly [K in keyof G]: Infer<G[K]> }> {
  return (value, path = 'recipe'): value is { -readonly [K in keyof G]: Infer<G[K]> } => isArray(value) && value.length === guards.length && guards.every((guard, index) => guard(value[index], `${path}[${index}]`));
}
type ObjectValue<S extends Record<string, Guard<unknown>>> = { [K in keyof S as undefined extends Infer<S[K]> ? never : K]: Infer<S[K]> } & { [K in keyof S as undefined extends Infer<S[K]> ? K : never]?: Infer<S[K]> };
/** The deepest field that failed during the current parse, so a refusal names it. */
let deepestFailure: { path: string; value: unknown } | null = null;
export function object<const S extends Record<string, Guard<unknown>>>(shape: S): Guard<ObjectValue<S>> {
  return (value, path = 'recipe'): value is ObjectValue<S> => {
    if (!isRecord(value)) return false;
    for (const [key, guard] of Object.entries(shape)) if (!guard(value[key], `${path}.${key}`)) {
      if (!deepestFailure || `${path}.${key}`.length > deepestFailure.path.length) deepestFailure = { path: `${path}.${key}`, value: value[key] };
      return false;
    }
    return true;
  };
}
export function parse<T>(value: unknown, guard: Guard<T>, label = 'recipe'): T {
  deepestFailure = null;
  if (!guard(value, label)) {
    const failure = deepestFailure as { path: string; value: unknown } | null;
    throw new TypeError(`Invalid ${label} structure${failure ? ` at ${failure.path} (${JSON.stringify(failure.value)?.slice(0, 80) ?? 'missing'})` : ''}.`);
  }
  return value;
}
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};
export const json: Guard<JsonValue> = (value): value is JsonValue => value === null || string(value) || number(value) || boolean(value) || (isArray(value) ? value.every(item => json(item)) : isRecord(value) && Object.values(value).every(item => json(item)));
