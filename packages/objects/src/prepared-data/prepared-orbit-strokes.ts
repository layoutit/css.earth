/** Prepared source materials and maximum clipped chord count. This legacy
 * metadata remains readable; it never selects a renderer. All context orbit
 * paint uses retained CSS line instances. */
export interface PreparedOrbitStrokes { readonly weights: readonly number[]; readonly segmentCapacity: number; }
