import type { PreparedResourceEntry, PreparedResourcePool } from "./prepared-residency.js";
export type PreparedResourcePoolOptions = Partial<Omit<PreparedResourcePool, "id">>;

export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

// Addresses are read from prepared data once when a definition is bound.
// No device-density input, asset generation, image owner, or eviction lives here.
export function preparedAssetAddress(url: unknown): string {
  if (typeof url !== "string" || !url.startsWith("/scenes/")) throw new TypeError("A prepared asset address is required.");
  return url;
}

// The retained sky's selected CSS background loads on demand. Preloading both
// modes here made every first visit download the unused high-contrast sky.
export function preparedSunResources(sun: { asset: { url: string } } | null | undefined, pool: string): PreparedResourceEntry[] {
  return sun ? [{ key: "directional-sun", url: preparedAssetAddress(sun.asset.url), pool }] : [];
}

export function preparedResourcePool(id: string, entries: readonly PreparedResourceEntry[], { retention = "mount", concurrency, capacity, reuse = false, ...policy }: PreparedResourcePoolOptions = {}): Readonly<PreparedResourcePool> {
  const count = new Set(entries.filter(entry => entry.pool === id).map(entry => entry.url)).size;
  return Object.freeze({ id, capacity: capacity ?? count, concurrency: concurrency ?? count, retention, reuse, ...policy });
}
