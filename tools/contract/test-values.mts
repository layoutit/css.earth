import assert from 'node:assert/strict';
import { requireRecord, requireArray } from '../sources/source-values.mts';

/** Require the fixture or result under test to exist before inspecting it. */
export function required<T>(value: T, message = 'Expected test value to exist'): NonNullable<T> {
  assert.ok(value !== null && value !== undefined, message);
  return value;
}

/** Reach a real fixture record before deliberately corrupting a validation input. */
export function fixtureRecord(value: unknown, ...path: (string | number)[]): Record<string, unknown> {
  let current = value;
  for (const key of path) current = typeof key === 'number' ? requireArray(current)[key] : requireRecord(current)[key];
  return requireRecord(current);
}
