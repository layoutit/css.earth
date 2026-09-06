export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

// Addresses are selected from prepared data once when a definition is bound.
// No device-density input, asset generation, image owner, or eviction lives here.
export function canonicalPreparedAsset(pair, high) {
  if (typeof pair === "string") return high || pair;
  const url = [pair?.two, pair?.url2x, pair?.one, pair?.url].find(value => typeof value === "string");
  if (typeof url !== "string" || !url.startsWith("/scenes/")) throw new TypeError("A prepared asset address is required.");
  return url;
}

export function preparedSkyResources(sky, sun, pool) {
  return [
    ...sky.faces.flatMap((face, index) => [
      { key: `sky:${index}:standard`, url: canonicalPreparedAsset(face.url, face.url2x), pool },
      { key: `sky:${index}:contrast`, url: canonicalPreparedAsset(face.highContrastUrl, face.highContrastUrl2x), pool },
    ]),
    ...(sun ? [{ key: "directional-sun", url: canonicalPreparedAsset(sun.asset), pool }] : []),
  ];
}

export function preparedResourcePool(id, entries, { retention = "mount", concurrency, capacity, reuse = false, ...policy } = {}) {
  const count = new Set(entries.filter(entry => entry.pool === id).map(entry => entry.url)).size;
  return Object.freeze({ id, capacity: capacity ?? count, concurrency: concurrency ?? count, retention, reuse, ...policy });
}
