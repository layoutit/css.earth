import { checks, failure, type Fail } from '@cssearth/core';
export type RecordValue = Record<string, unknown>;
/** Prepared presentation checks report `Prepared presentation: <message>.`; `record` accepts only plain records. */
export const fail: Fail = failure('Prepared presentation: ');
export const { record, array, text, finite, positive, integer, boolean, choice, unique, numbers } = checks(fail);
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
function validateJsonData(value: unknown, label: string, seen: Set<object>, preparation: boolean): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (preparation && !Number.isFinite(value)) fail(`${label} must contain only acyclic JSON data`);
    finite(value, label); return;
  }
  if (!value || typeof value !== 'object' || seen.has(value) ||
      ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) fail(`${label} must contain only acyclic JSON data`);
  if (Object.getOwnPropertySymbols(value).length) fail(`${label} cannot contain symbols`);
  if (!preparation && Array.isArray(value) && (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))) fail(`${label} must be a dense JSON array`);
  seen.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${label}.${key} cannot be executable`);
    validateJsonData(descriptor.value, `${label}.${key}`, seen, preparation);
  }
  seen.delete(value);
}
/** Runtime and preparation share one JSON traversal; retain their pinned nonfinite-number diagnostics. */
export function requireJsonData(value: unknown, label = 'data', seen = new Set<object>()): void {
  validateJsonData(value, label, seen, false);
}
export function requirePreparedData<T>(value: T, label = 'data', seen = new Set<object>()): T {
  validateJsonData(value, label, seen, true);
  return value;
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
