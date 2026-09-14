import type { PreparedResourceEntry, PreparedResourcePool } from "./prepared-residency.js";
export interface PreparedAssetPair { two?: string; url2x?: string; one?: string; url?: string; }
export interface PreparedSkyAssetPlan { faces: readonly { url: string; url2x?: string; highContrastUrl: string; highContrastUrl2x?: string }[]; }
export type PreparedResourcePoolOptions = Partial<Omit<PreparedResourcePool, "id">>;

export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

// Addresses are selected from prepared data once when a definition is bound.
// No device-density input, asset generation, image owner, or eviction lives here.
export function canonicalPreparedAsset(pair: string | PreparedAssetPair | null | undefined, high?: string) {
  if (typeof pair === "string") return high || pair;
  const url = [pair?.two, pair?.url2x, pair?.one, pair?.url].find(value => typeof value === "string");
  if (typeof url !== "string" || !url.startsWith("/scenes/")) throw new TypeError("A prepared asset address is required.");
  return url;
}

export function preparedResourcePool(id: string, entries: readonly PreparedResourceEntry[], { retention = "mount", concurrency, capacity, reuse = false, ...policy }: PreparedResourcePoolOptions = {}): Readonly<PreparedResourcePool> {
  const count = new Set(entries.filter(entry => entry.pool === id).map(entry => entry.url)).size;
  return Object.freeze({ id, capacity: capacity ?? count, concurrency: concurrency ?? count, retention, reuse, ...policy });
}
