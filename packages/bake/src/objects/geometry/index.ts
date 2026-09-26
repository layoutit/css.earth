// `@cssearth/bake/objects/geometry` (Node only): the source geometry preparation reads. Shape models (OBJ, STL, PDS plate,
// vertex-facet and radius tables, FITS facet fields) with their records and indexed surface queries; radial meshes, their
// simplification and open-surface checks; controlled shape cameras and their band alignment; ellipsoid geometry; the Lambert
// attenuation atlas; and the radial-layer contract.
export * from './contracts.ts';
export * from './shape-records.ts';
export * from './obj-shape.ts';
export * from './fits-facet-field.ts';
export * from './mesh-face-pairs.ts';
export * from './open-surface.ts';
export * from './image-dem-reduction.ts';
export * from './radial-mesh.ts';
export * from './pds-radial-table.ts';
export * from './band-alignment.ts';
export * from './shape-camera-mosaic.ts';
export * from './ellipsoid.ts';
export * from './lambert-atlas.ts';
export * from './radial-contract.ts';
