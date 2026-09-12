export type RecordValue = Record<string, unknown>;
export function fail(message: string): never { throw new TypeError(`Prepared presentation: ${message}.`); }
function plainRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
export function record(value: unknown, label: string, fields?: readonly string[]): RecordValue {
  if (!plainRecord(value)) fail(`${label} must be a plain record`);
  if (fields) for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`unsupported ${label} field ${key}`);
  return value;
}
export function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}
export function text(value: unknown, label: string, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.length)) fail(`${label} must be a string${empty ? '' : ' with content'}`);
  return value;
}
export function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}
export function positive(value: unknown, label: string): number {
  const result = finite(value, label); if (!(result > 0)) fail(`${label} must be positive`); return result;
}
export function integer(value: unknown, label: string, minimum = 0): number {
  const result = finite(value, label); if (!Number.isSafeInteger(result) || result < minimum) fail(`${label} must be an integer at least ${minimum}`); return result;
}
export function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`); return value;
}
export function choice<const T extends readonly (string | number | boolean | null)[]>(value: unknown, choices: T, label: string): T[number] {
  for (const item of choices) if (item === value) return item;
  return fail(`unsupported ${label}`);
}
export function unique(values: readonly unknown[], label: string): void {
  if (new Set(values).size !== values.length) fail(`${label} has duplicate identities`);
}
export function numbers(value: unknown, label: string, length?: number): number[] {
  const result = array(value, label).map(item => finite(item, label));
  if (length !== undefined && result.length !== length) fail(`${label} has incompatible dimensions`);
  return result;
}
export function direction(value: unknown, label: string, tolerance = 1e-9): number[] {
  const result = numbers(value, label, 3);
  if (Math.abs(Math.hypot(...result) - 1) > tolerance) fail(`${label} must be a unit direction`);
  return result;
}
export function attribute(value: unknown): string {
  const name = text(value, 'attribute');
  if (!/^(?:data-[a-z0-9-]+|aria-[a-z0-9-]+)$/.test(name)) fail(`unsupported attribute ${name}`);
  return name;
}
export function requireJsonData(value: unknown, label = 'data', seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { finite(value, label); return; }
  if (!value || typeof value !== 'object' || seen.has(value) ||
      ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) fail(`${label} must contain only acyclic JSON data`);
  if (Object.getOwnPropertySymbols(value).length) fail(`${label} cannot contain symbols`);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))) fail(`${label} must be a dense JSON array`);
  seen.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${label}.${key} cannot be executable`);
    requireJsonData(descriptor.value, `${label}.${key}`, seen);
  }
  seen.delete(value);
}
/** The requireJsonData check for a direct JSON.parse result. JSON.parse builds
 * only acyclic plain objects, dense arrays and data properties; an overflowing
 * literal can still yield an infinite number, the one value left to reject. */
export function parsedJsonNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const item: unknown = value[index];
      if ((typeof item === 'number' || typeof item === 'object') && !parsedJsonNumbersFinite(item)) return false;
    }
    return true;
  }
  for (const key in value) {
    const item: unknown = (value as Record<string, unknown>)[key];
    if ((typeof item === 'number' || typeof item === 'object') && !parsedJsonNumbersFinite(item)) return false;
  }
  return true;
}
