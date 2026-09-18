/**
 * Pure, dependency-free: kept out of `objects.ts` so a direct, unbundled
 * `node --test` run (the nebula CI job never builds the renderer's compiled
 * `.js` output) can still import and check this function without pulling in
 * the whole bake pipeline.
 */
// The staged bake directory embeds this process's pid so two concurrent bakes
// never collide on disk; that name must never leak into recorded provenance,
// or every bake of the same object would produce a different `lenses.json`
// hash. Recorded paths substitute a fixed, reproducible placeholder instead.
const STAGING_DIRECTORY_NAME = /\.prepared-\d+(?=[\\/])/;
export function sanitizeVolumeProvenance<T extends { provenance: unknown }>(volume: T): T {
  const provenance = volume.provenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) return volume;
  const sourceVolume = (provenance as Record<string, unknown>).sourceVolume;
  if (!sourceVolume || typeof sourceVolume !== 'object' || Array.isArray(sourceVolume)) return volume;
  const path = (sourceVolume as Record<string, unknown>).path;
  if (typeof path !== 'string') return volume;
  const stable = path.replace(STAGING_DIRECTORY_NAME, '.prepared-compact');
  if (stable === path) return volume;
  return { ...volume, provenance: { ...provenance, sourceVolume: { ...sourceVolume, path: stable } } };
}
