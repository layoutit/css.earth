// `@cssearth/bake/prepared-presentation` (Node only): the passes that rewrite a compiled prepared presentation. Depth
// partitions split a body's projected surface into leaves drawn in a proven visibility order, and a cascade check (in
// Playwright's Chromium) keeps each moved leaf's computed style; the interior fill paints the inner disc of a cut-open body
// with its surface mean; and the authored-motion bindings, which resolve a presentation's motion, activation groups,
// leaf boxes, depth partitions and interior fill offline in Chromium against the object's page styles (the application passes
// the function that lists them). It imports `presentation` and `raster`.
export * from './prepared-depth-partitions.ts';
export * from './prepared-depth-styles.ts';
export * from './prepared-image-sizes.ts';
export * from './prepared-interior-fill.ts';
export * from './prepared-presentation-bindings.ts';
export * from './prepared-visibility-order.ts';
