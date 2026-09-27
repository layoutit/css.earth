// `@cssearth/bake/objects/layers/giant` (Node only): the giant layer pipeline, from its recipe contracts to the layered giant
// object (`object.ts`), which the host calls with its content preparer. The material atlas tile, bilinear samplers and
// relative-path check sit here, below material-composition, which reads them too.
export * from './ellipsoid-materials.ts';
export * from './geometry-contract.ts';
export * from './geometry.ts';
export * from './giant-layers.ts';
export * from './layered-surface-presentation.ts';
export * from './material-atlas.ts';
export * from './material-contract.ts';
export * from './normalized-disc-presentation.ts';
export * from './normalized-presentation-contract.ts';
export * from './object.ts';
export * from './observed-polar.ts';
export * from './photometric-contract.ts';
export * from './photometric-disc.ts';
export * from './polar-continuation.ts';
export * from './polar-dome.ts';
export * from './polar-source-contract.ts';
export * from './presentation-contract.ts';
export * from './relative-path.ts';
export * from './rings.ts';
