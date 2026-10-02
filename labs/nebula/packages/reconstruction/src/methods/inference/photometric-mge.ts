/** Fitting adapter: the deterministic density comes from bake; recipe validation comes from objects. */
import { samplePhotometricMge } from '@cssearth/bake/volume';
import { readPhotometricMgeRecipe, type PhotometricMgeRecipe } from '@cssearth/objects';

export function createPhotometricMgePrior(recipe: PhotometricMgeRecipe) {
  const parsed = readPhotometricMgeRecipe(recipe);
  // Named by its recipe; the mirrored line-of-sight solution is a different prior with its own name.
  return { identity: `${parsed.id}${parsed.lineOfSightTiltSign < 0 ? '-mirrored' : ''}`, ...samplePhotometricMge(parsed) };
}
