/** Runtime checks for native oracle manifests and JSON event streams. */
export function object(value: unknown, label = "value"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function array(value: unknown, label = "value"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}
export function text(value: unknown, label = "value"): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  return value;
}
export function finite(value: unknown, label = "value"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}
export function integer(value: unknown, label = "value"): number {
  const result = finite(value, label);
  if (!Number.isSafeInteger(result)) throw new TypeError(`${label} must be a safe integer.`);
  return result;
}
export function boolean(value: unknown, label = "value"): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
  return value;
}
export function strings(value: unknown, label = "value"): string[] {
  return array(value, label).map((entry, index) => text(entry, `${label}[${index}]`));
}
export function numbers(value: unknown, label = "value"): number[] {
  return array(value, label).map((entry, index) => finite(entry, `${label}[${index}]`));
}
export function parseJson(value: string): unknown { return JSON.parse(value); }
export function isNodeError(value: unknown, code: string): boolean {
  return value instanceof Error && "code" in value && value.code === code;
}
