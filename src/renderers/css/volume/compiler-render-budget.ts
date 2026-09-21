import type { RenderElementProfile } from '@cssearth/volume-core/contracts/render-element-budget';

/** One topology, at most 26 impostors, no separate occulting root. Conformance tests count the actual mounted DOM.
 * Current inclusive overhead is 46 elements; reserve one more element before allocating the retained XYZ slabs. */
export const CSS_COMPILER_RENDER_BUDGET: Readonly<RenderElementProfile> = Object.freeze({
  schema: 'cssearth-render-element-profile@1', id: 'css-volume-single-topology@1', maximumElements: 500,
  elementsPerSlab: 3, elementsPerStar: 1, reservedElements: 47,
});
