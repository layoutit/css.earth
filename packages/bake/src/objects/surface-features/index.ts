// `@cssearth/bake/objects/surface-features` (Node only): named surface features and their prepared banks (IAU
// nomenclature from its shapefile and DBF archives, Natural Earth vectors, landing sites, landmarks placed on shape models,
// ellipsoid projection and discovery zoom shares), source-backed feature notes, and the image-control fits that place
// encounter and orthophoto landmarks and check published controls in native pixels. `packages/bake/cli/` holds the
// landmark and control-check commands. `attach.ts` attaches the banks to a prepared globe for the host.
export * from '../gis/index.ts';
export * from './atlas-edge.ts';
export * from './attach.ts';
export * from './catalog.ts';
export * from './check-projected-controls.ts';
export * from './ellipsoid.ts';
export * from './geometry.ts';
export * from './image-controls.ts';
export * from './landmarks.ts';
export * from './natural-earth.ts';
export * from './notes-schema.ts';
export * from './notes.ts';
export * from './project-encounter-landmarks.ts';
export * from './project-orthophoto-landmarks.ts';
export * from './sites.ts';
export * from './surface-features.ts';
