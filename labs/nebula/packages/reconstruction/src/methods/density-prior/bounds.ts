import type { Bounds3 } from './filled-contracts.ts';

export function validateBounds(bounds: Bounds3, name: string): void {
  if (bounds.min.length !== 3 || bounds.max.length !== 3 || bounds.min.some((value, axis) =>
    !Number.isFinite(value) || !Number.isFinite(bounds.max[axis]) || value >= bounds.max[axis]!)) {
    throw new TypeError(`${name} must contain finite increasing XYZ intervals.`);
  }
}
