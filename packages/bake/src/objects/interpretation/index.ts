// `@cssearth/bake/objects/interpretation` (Node only): the observation interpreter the raster lane packs surfaces through.
// `createSurfaceInterpreter` picks each surface's decoder (solar synoptic maps, terrestrial, shape-model, stellar and static
// observations, the Akatsuki UVI Level 3b grid) from its recipe, with the solar geometry the host passes in. It is a topic of
// its own, not part of `objects/layers/observation`, whose code the nebula lab's compiler identity reaches.
export * from './akatsuki-uvi-l3b.ts';
export * from './interpret.ts';
