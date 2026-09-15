/** Research path policy wraps the platform-neutral sampled-field contract. */
import { readSampledRecipe as readRecipe, type SampledRecipe } from '@cssearth/volume-core/contracts/sampled-recipe';
export * from '@cssearth/volume-core/contracts/sampled-recipe';
export function readSampledRecipe(value: unknown): SampledRecipe {
  return readRecipe(value, path => /^(labs\/nebula\/models\/|\.local\/nebula-lab\/)/.test(path));
}
