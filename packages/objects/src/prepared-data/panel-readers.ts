/** Shared prepared-panel primitive admission and diagnostics. */
import { isRecord } from '@cssearth/core';
export const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new TypeError(`Prepared ${label} must be an object.`);
  return value;
};
export const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`Prepared ${label} must be text.`);
  return value;
};
export const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Prepared ${label} must be finite.`);
  return value;
};
export const optionalText = (value: unknown, label: string) => value === undefined ? undefined : text(value, label);
export const optionalBoolean = (value: unknown, label: string) => {
  if (value !== undefined && typeof value !== 'boolean') throw new TypeError(`Prepared ${label} must be boolean.`);
  return value;
};
export const array = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`Prepared ${label} must be an array.`);
  return value;
};
