/** Historical manifests keep their original generator names and source hashes.
 * Bind those records to the migrated owner without rewriting pinned provenance. */
export function matchesPreparationGenerator(value: unknown, owner: `${string}.mts`): boolean {
  return value === owner || value === `${owner.slice(0, -4)}.mjs`;
}
