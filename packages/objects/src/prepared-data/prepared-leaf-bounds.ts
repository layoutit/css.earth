/** Bounds of the final compiled image rectangle, in its scene's CSS coordinates. */
export interface PreparedLeafBounds { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number]; }

export function validatePreparedLeafBounds(value: unknown): void {
  const bounds = value as PreparedLeafBounds | undefined;
  if (!bounds || Object.keys(bounds).length !== 2 || !Array.isArray(bounds.min) || !Array.isArray(bounds.max) ||
      bounds.min.length !== 3 || bounds.max.length !== 3 ||
      !bounds.min.every((n, axis) => Number.isFinite(n) && Number.isFinite(bounds.max[axis]) && n <= bounds.max[axis]!)) {
    throw new TypeError('Prepared leaf bounds must be finite ordered CSS coordinates.');
  }
}

