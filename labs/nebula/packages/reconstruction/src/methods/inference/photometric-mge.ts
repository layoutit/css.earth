/** Fitting adapter: the deterministic density and validation are shared with cold bake replay. */
import { readPhotometricMgeRecipe, samplePhotometricMge, type PhotometricMgeRecipe } from '@cssearth/bake/volume';
export { readPhotometricMgeRecipe, type PhotometricMgeRecipe, type PhotometricGaussian } from '@cssearth/bake/volume';
export function createPhotometricMgePrior(recipe: PhotometricMgeRecipe) {
  const parsed = readPhotometricMgeRecipe(recipe);
  // Named by its recipe; the mirrored line-of-sight solution is a different prior with its own name.
  return { identity: `${parsed.id}${parsed.lineOfSightTiltSign < 0 ? '-mirrored' : ''}`, ...samplePhotometricMge(parsed) };
}
