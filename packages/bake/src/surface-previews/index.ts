// `@cssearth/bake/surface-previews` (Node only): the prepared records a surface preview is drawn from (an object's preview
// controls, polar, observed and spectral lens reports, geometry parameters and surfaces), read and checked; the surface
// minimaps of the sidebar map drawn from them through the decoder that packed each surface (`surface-minimaps.ts`, with the
// generated solar geometry the host passes in) and the preview rasters of their lenses (`surface-preview-rasters.ts`). It
// imports `raster`, `scene`, `objects/scene`, `objects/interpretation` and the observation, giant and paged-ellipsoid layers.
// `packages/bake/cli/prepare-surface-minimaps.mts` is its command.
export * from './surface-preview-source.ts';
export * from './surface-preview-rasters.ts';
export * from './surface-minimaps.ts';
