// `@cssearth/bake/prepared-presentation` (Node only): the passes that rewrite a compiled prepared presentation. Depth
// partitions split a body's projected surface into leaves drawn in a proven visibility order, and a cascade check (in
// Playwright's Chromium) keeps each moved leaf's computed style; the interior fill paints the inner disc of a cut-open body
// with its surface mean. It imports `presentation`.
export * from './prepared-depth-partitions.ts';
export * from './prepared-depth-styles.ts';
export * from './prepared-interior-fill.ts';
export * from './prepared-visibility-order.ts';
