/** Historical manifests keep their original generator names and source hashes: a generator field records what made an
 * intermediate when it was made, not where that code lives now. Bind a recorded name (and its `.mjs` predecessor) to the
 * code that implements it today without rewriting pinned provenance. The radial snapshot and PDS constraint map are
 * recorded as `tools/objects/terrestrial-layers/*.mts` and live in `@cssearth/bake/objects/layers/terrestrial`. */
export function matchesPreparationGenerator(value: unknown, recorded: `${string}.mts`): boolean {
  return value === recorded || value === `${recorded.slice(0, -4)}.mjs`;
}
