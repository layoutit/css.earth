/** Check arrays without erasing known element types or trusting unknown elements. */
export function isArray<T>(value: readonly T[] | null | undefined): value is T[];
export function isArray(value: unknown): value is unknown[];
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
