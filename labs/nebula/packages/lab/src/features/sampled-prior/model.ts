/** Research path policy wraps the platform-neutral sampled-field contract. */
import { readSampledRecipe as readRecipe, type SampledRecipe } from '@cssearth/objects';
export * from '@cssearth/bake/volume';
export function readSampledRecipe(value: unknown): SampledRecipe {
  return readRecipe(value, path => /^(src\/objects\/[a-z0-9-]+\/(?:source|\.local)\/|\.local\/nebula-lab\/)/.test(path));
}
