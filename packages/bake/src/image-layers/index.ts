// `@cssearth/bake/image-layers`: the extruded image-layer bake (Node only). Image-layer recipes, the diffuse Lanczos3
// resampler and the retained image layers compiled as PolyCSS volume leaves.
export * from './config.ts';
export * from './resize-rgba.ts';
export * from './prepare.ts';
export { imageLayerDisc, imageLayerDiscDistanceKpc, imageLayerView } from './disc.ts';
export { imageLayerBulgeModel } from './bulge.ts';
export { imageLayerShapeModel, lowerEnvelope } from './shape.ts';
export { imageLayerBodyModel } from './body.ts';
export { imageLayerRingsModel, imageLayerRingsSheet, RINGS_OPACITY_REACH_PIXELS } from './rings.ts';
export { removeForegroundStars, removeCompanionGalaxies } from './foreground.ts';
