/** Follow each body's host to the root of its chain, rejecting a cyclic one. An acyclic chain takes at most one step per
 * entry, so a longer walk has revisited a body: no per-call set is needed. */
export function orbitRoot(id: string, parents: ReadonlyMap<string, string>): string {
  let current = id;
  for (let steps = 0; steps <= parents.size; steps++) {
    if (!parents.has(current)) return current;
    current = parents.get(current)!;
  }
  throw new TypeError(`${id} is inside a system that is inside its own: the chain of hosts is cyclic.`);
}
