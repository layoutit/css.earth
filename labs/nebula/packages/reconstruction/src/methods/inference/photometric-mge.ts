/** Fitting adapter: the deterministic density and validation are shared with cold bake replay. */
import { createHash } from 'node:crypto';
import { readPhotometricMgeRecipe, samplePhotometricMge, type PhotometricMgeRecipe } from '@cssearth/volume-core/fields/photometric-mge';
export { readPhotometricMgeRecipe, type PhotometricMgeRecipe, type PhotometricGaussian } from '@cssearth/volume-core/fields/photometric-mge';
export function createPhotometricMgePrior(recipe: PhotometricMgeRecipe) {
  const parsed = readPhotometricMgeRecipe(recipe);
  return { identity: createHash('sha256').update(JSON.stringify(parsed)).digest('hex'), ...samplePhotometricMge(parsed) };
}
