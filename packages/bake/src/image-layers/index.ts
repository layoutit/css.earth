// `@cssearth/bake/image-layers`: the extruded image-layer bake (Node only). Image-layer recipes, the diffuse Lanczos3
// resampler and the retained image layers compiled as PolyCSS volume leaves.
export * from './config.ts';
export * from './resize-rgba.ts';
export * from './prepare.ts';
export { prepareImageLayerFace } from './face/face.ts';
export { imageLayerDisc, imageLayerDiscDistanceKpc, imageLayerView } from './disc.ts';
export { imageLayerBulgeModel } from './bulge.ts';
export { filamentMap, lineStrengths, type FilamentSettings } from './filaments.ts';
export { imageLayerShapeModel, lowerEnvelope } from './shape.ts';
export { imageLayerShapeWalls } from './shape-walls.ts';
export { densityGrid, imageLayerDensityModel } from './density-grid.ts';
export { imageLayerBodyModel } from './body.ts';
export { imageLayerCollision, imageLayerCollisionAccount, imageLayerCollisionLeaves } from './collision/collision.ts';
export { imageLayerGalaxies } from './collision/galaxies.ts';
export { openedLight, removeCompactSources, standsOver } from './collision/compact-sources.ts';
export { imageLayerSurfaceCrossings, imageLayerSurfaceWalls, stlTriangles } from './surface/surface.ts';
export { imageLayerRingsCover, imageLayerRingsModel, imageLayerRingsSheet, RINGS_OPACITY_REACH_PIXELS } from './rings/rings.ts';
export { imageLayerRingsCells, imageLayerRingsCurtains, imageLayerRingsGlow, imageLayerRingsSheets } from './rings/rings-volume.ts';
export { removeForegroundStars, removeCompanionGalaxies } from './face/foreground.ts';
export { prepareCloudOverlays, prepareImageLayerOverlays, readCloudSource, readTubeSource, readKinematicsSource } from './cloud-overlays.ts';
