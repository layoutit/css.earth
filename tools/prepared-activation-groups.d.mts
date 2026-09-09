import type { PreparedTree, PreparedVariant } from '../src/renderers/css/rendering/prepared-presentation.js';

export function prepareActivationGroups(definition: {
  tree: PreparedTree;
  variants: readonly PreparedVariant[];
}): number[][];
