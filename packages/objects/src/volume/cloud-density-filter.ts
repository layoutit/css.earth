export interface CloudDensityFilter { cutoff: number; softness: number; showRemoved: boolean }
export function validateCloudDensityFilter(value: CloudDensityFilter): CloudDensityFilter {
  if (!value || !Number.isFinite(value.cutoff) || value.cutoff < 0 || value.cutoff > 1 ||
      !Number.isFinite(value.softness) || value.softness < 0 || value.softness > 1 ||
      typeof value.showRemoved !== 'boolean') throw new TypeError('Cloud density filter is invalid.');
  return { cutoff: value.cutoff, softness: value.softness, showRemoved: value.showRemoved };
}

/** Smooth high-density membership; softness is the transition width relative to cutoff. */
export function cloudDensityWeight(density: number, filter: CloudDensityFilter): number {
  const { cutoff, softness } = validateCloudDensityFilter(filter);
  if (cutoff === 0) return 1;
  const value = Math.max(0, Math.min(1, density));
  if (softness === 0) return value >= cutoff ? 1 : 0;
  const width = cutoff * softness, low = cutoff - width / 2, t = Math.max(0, Math.min(1, (value - low) / width));
  return t * t * (3 - 2 * t);
}
