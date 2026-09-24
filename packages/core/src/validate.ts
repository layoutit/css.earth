/** Runtime checks for values that arrive from outside the type system: JSON files, prepared payloads, archive records
 * and command-line input. No dependencies and no host globals, so browser bundles and Node tools share one copy. */

/** Reports a failed check. The message names the value and has no closing full stop. */
export type Fail = (message: string) => never;
/** A `Fail` that throws `TypeError(prefix + message + '.')`. */
export function failure(prefix = ''): Fail {
  return message => { throw new TypeError(`${prefix}${message}.`); };
}
const report: Fail = failure();

/** A JSON object: not null and not an array. Class instances pass; see `isPlainRecord`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** An object literal or `JSON.parse` object: its prototype is `Object.prototype`. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
/** A thrown Node system error, such as ENOENT, carries a string `code`. */
export function hasErrorCode(error: unknown, ...codes: readonly string[]): boolean {
  return isRecord(error) && typeof error.code === 'string' && codes.includes(error.code);
}

function recordOr(fail: Fail, value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}
function arrayOr(fail: Fail, value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}
function stringOr(fail: Fail, value: unknown, label: string, empty = true): string {
  if (typeof value !== 'string' || (!empty && !value.length)) fail(`${label} must be a string${empty ? '' : ' with content'}`);
  return value;
}
function finiteOr(fail: Fail, value: unknown, label: string): number {
  if (!isFiniteNumber(value)) fail(`${label} must be finite`);
  return value;
}
function positiveOr(fail: Fail, value: unknown, label: string): number {
  const result = finiteOr(fail, value, label);
  if (!(result > 0)) fail(`${label} must be positive`);
  return result;
}
function booleanOr(fail: Fail, value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
  return value;
}

// Getters throw `TypeError('<label> must be …')`. Each takes at most two parameters, because callers map them over arrays:
// `requireArray(value).map(requireString)` passes each element's index as its label.
export function requireRecord(value: unknown, label = 'Source value'): Record<string, unknown> { return recordOr(report, value, label); }
export function requireArray(value: unknown, label = 'Source value'): unknown[] { return arrayOr(report, value, label); }
export function requireString(value: unknown, label = 'Source value'): string { return stringOr(report, value, label); }
export function requireFiniteNumber(value: unknown, label = 'Source value'): number { return finiteOr(report, value, label); }
export function requirePositive(value: unknown, label = 'Source value'): number { return positiveOr(report, value, label); }
export function requireBoolean(value: unknown, label = 'Source value'): boolean { return booleanOr(report, value, label); }
/** A string with at least one character: `<label> must be nonempty text.` */
export function requireNonemptyText(value: unknown, label = 'Source value'): string {
  if (typeof value !== 'string' || !value) report(`${label} must be nonempty text`);
  return value;
}

/** Labelled checks that report through `fail`. `record` accepts only plain records and, given `fields`, only those keys;
 * `text` requires content unless `empty` is set. */
export function checks(fail: Fail) {
  const finite = (value: unknown, label: string): number => finiteOr(fail, value, label);
  const array = (value: unknown, label: string): unknown[] => arrayOr(fail, value, label);
  return {
    record(value: unknown, label: string, fields?: readonly string[]): Record<string, unknown> {
      if (!isPlainRecord(value)) fail(`${label} must be a plain record`);
      if (fields) for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`unsupported ${label} field ${key}`);
      return value;
    },
    array,
    text: (value: unknown, label: string, empty = false): string => stringOr(fail, value, label, empty),
    finite,
    positive: (value: unknown, label: string): number => positiveOr(fail, value, label),
    integer(value: unknown, label: string, minimum = 0): number {
      const result = finite(value, label);
      if (!Number.isSafeInteger(result) || result < minimum) fail(`${label} must be an integer at least ${minimum}`);
      return result;
    },
    boolean: (value: unknown, label: string): boolean => booleanOr(fail, value, label),
    choice<const T extends readonly (string | number | boolean | null)[]>(value: unknown, choices: T, label: string): T[number] {
      for (const item of choices) if (item === value) return item;
      return fail(`unsupported ${label}`);
    },
    unique(values: readonly unknown[], label: string): void {
      if (new Set(values).size !== values.length) fail(`${label} has duplicate identities`);
    },
    numbers(value: unknown, label: string, length?: number): number[] {
      const result = array(value, label).map(item => finite(item, label));
      if (length !== undefined && result.length !== length) fail(`${label} has incompatible dimensions`);
      return result;
    },
  };
}
export type Checks = ReturnType<typeof checks>;
