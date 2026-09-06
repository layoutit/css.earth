import { normalizeDestinationQuery } from "../../site/destination-search.mjs";

// Prepared lexical postings reference rows in source ranking order. Searching
// these columns never constructs a new source index or decodes entity cards.
export function lowerBound(rows, value) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid][0] < value) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function searchDestinationIndex(index, value, limit = 8) {
  const query = normalizeDestinationQuery(value);
  if (!query) return [];
  limit = Math.max(0, Math.min(8, limit));
  const ranks = new Uint8Array(index.rows.length).fill(4);
  let prefixCount = 0;
  for (let i = lowerBound(index.aliases, query); i < index.aliases.length; i++) {
    const [name, postings] = index.aliases[i];
    if (!name.startsWith(query)) break;
    const rank = name === query ? 0 : 1;
    for (const id of postings) {
      if (ranks[id] === 4) prefixCount++;
      ranks[id] = Math.min(ranks[id], rank);
    }
  }
  // Exact/prefix matches outrank every substring/context match. Less common
  // queries inspect the prepared alias column, preserving the original rules.
  if (prefixCount < limit) {
    const tokens = query.split(" ");
    for (const [name, postings] of index.aliases) {
      if (name.includes(query)) {
        for (const id of postings) ranks[id] = Math.min(ranks[id], 2);
      } else if (tokens.some(token => name.includes(token))) {
        for (const id of postings) {
          if (ranks[id] > 3 && tokens.every(token => name.includes(token) || index.rows[id][3].includes(token))) ranks[id] = 3;
        }
      }
    }
  }
  const results = [];
  for (let rank = 0; rank < 4 && results.length < limit; rank++) {
    for (let i = 0; i < ranks.length && results.length < limit; i++) {
      if (ranks[i] !== rank) continue;
      const [id, name, context] = index.rows[i];
      results.push({ id, name, context });
    }
  }
  return results;
}
