export function removeOppositeFacePairs(indices) {
  const seen = new Map(), removed = new Set();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3)), sorted = [...triangle].sort((a, b) => a - b);
    const key = sorted.join(','), previous = seen.get(key);
    if (!previous) { seen.set(key, { offset: i, triangle }); continue; }
    const index = previous.triangle.indexOf(triangle[0]);
    if (removed.has(previous.offset) || previous.triangle[(index + 2) % 3] !== triangle[1]) {
      throw new Error('Source mesh has ambiguous duplicate faces.');
    }
    removed.add(previous.offset); removed.add(i);
  }
  return indices.filter((_, i) => !removed.has(i - i % 3));
}
