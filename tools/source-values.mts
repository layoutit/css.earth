import { readFile } from 'node:fs/promises';

/** External source data stays unknown until its consumer checks the needed fields. */
export async function readJsonSource(path: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireRecord(value: unknown, label = 'Source value'): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}

export function requireArray(value: unknown, label = 'Source value'): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

export function requireString(value: unknown, label = 'Source value'): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  return value;
}

export function requireFiniteNumber(value: unknown, label = 'Source value'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

export function hasErrorCode(error: unknown, ...codes: readonly string[]): boolean {
  return isRecord(error) && typeof error.code === 'string' && codes.includes(error.code);
}
