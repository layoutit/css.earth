/** The merged slab's actual mounted opacity, shared with offline picture preparation. */
export function mergedOpticalOpacity(opticalGain: number): number {
  return Math.min(0.999, Math.max(0.001, Math.round(Math.min(3, opticalGain) / 3 * 255) / 255));
}
