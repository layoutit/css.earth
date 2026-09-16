import { fitEmissionField as fit } from '@cssearth/nebula-reconstruction/methods/inference/fit';
import { readDepthRecipe } from './depth-model.ts';
/** Preserve the lab's source-path policy while the scientific method remains host-independent. */
export function fitEmissionField(...args: Parameters<typeof fit>): ReturnType<typeof fit> {
  if (args[2]?.depthRecipe) readDepthRecipe(args[2].depthRecipe);
  return fit(...args);
}
