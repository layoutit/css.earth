/** Follow authored orbit parents to their root, rejecting cyclic chains. */
export function orbitRoot(id: string, parents: ReadonlyMap<string, string>): string {
  const seen = new Set<string>();
  for (let current = id; ; current = parents.get(current)!) {
    if (seen.has(current)) throw new TypeError(`${id} has a cyclic orbit chain.`);
    seen.add(current);
    if (!parents.has(current)) return current;
  }
}
