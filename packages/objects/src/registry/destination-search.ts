// Search only prepared labels. Geometry and source normalization are prepared
// by the supplying object; the shell owns input, ranking and retained results.
export function normalizeDestinationQuery(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchDestinations<T extends { names: readonly string[]; searchContext: string }>(places: readonly T[], value: string, limit = 8) {
  const query = normalizeDestinationQuery(value);
  if (!query) return [];
  const tokens = query.split(" ");
  const matches = [];
  for (const place of places) {
    let rank = Infinity;
    for (const name of place.names) {
      if (name === query) { rank = 0; break; }
      if (name.startsWith(query)) rank = Math.min(rank, 1);
      else if (name.includes(query)) rank = Math.min(rank, 2);
      else if (tokens.every(token => name.includes(token) || place.searchContext.includes(token)) &&
          tokens.some(token => name.includes(token))) rank = Math.min(rank, 3);
    }
    if (Number.isFinite(rank)) matches.push({ place, rank });
  }
  // The catalogue is already sorted by population, then source id.
  matches.sort((a, b) => a.rank - b.rank);
  return matches.slice(0, limit).map(({ place }) => place);
}
