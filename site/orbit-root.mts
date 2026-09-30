/** Follow authored orbit parents to their root, rejecting cyclic chains. An acyclic chain takes at most one step per
 * parent entry, so a longer walk has revisited a body: no per-call set is needed. */
export function orbitRoot(id: string, parents: ReadonlyMap<string, string>): string {
  let current = id;
  for (let steps = 0; steps <= parents.size; steps++) {
    if (!parents.has(current)) return current;
    current = parents.get(current)!;
  }
  throw new TypeError(`${id} has a cyclic orbit chain.`);
}
