export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

// Addresses are selected from prepared data once when a definition is bound.
// No device-density input, asset generation, image owner, or eviction lives here.
export function canonicalPreparedAsset(pair, high) {
  if (typeof pair === "string") return high || pair;
  const url = [pair?.two, pair?.url2x, pair?.one, pair?.url].find(value => typeof value === "string");
  if (typeof url !== "string" || !url.startsWith("/scenes/")) throw new TypeError("A prepared asset address is required.");
  return url;
}

// The retained sky's selected CSS background loads on demand. Preloading both
// modes here made every first visit download the unused high-contrast sky.
export function preparedSunResources(sun, pool) {
  return sun ? [{ key: "directional-sun", url: canonicalPreparedAsset(sun.asset), pool }] : [];
}

export function preparedResourcePool(id, entries, { retention = "mount", concurrency, capacity, reuse = false, ...policy } = {}) {
  const count = new Set(entries.filter(entry => entry.pool === id).map(entry => entry.url)).size;
  return Object.freeze({ id, capacity: capacity ?? count, concurrency: concurrency ?? count, retention, reuse, ...policy });
}
