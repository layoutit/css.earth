// `@cssearth/bake/objects/layers/paged-ellipsoid` (Node only): the paged-ellipsoid layer pipeline, from its recipe contracts
// to the asset preparation and the paged object (`object.ts`), which the host calls with its content preparer, the solar
// geometry and its asset worker (`packages/bake/cli/paged-ellipsoid-asset-worker.mts`). Earth's MUR and CoralTemp
// acquisition commands stay in packages/bake/authoring/earth for its per-body authoring.
export * from './assets.ts';
export * from './contracts.ts';
export * from './deep-ocean-fill.ts';
export * from './display-tone.ts';
export * from './elevation.ts';
export * from './enso-advisory.ts';
export * from './geographic/contracts.ts';
export * from './geographic/page-geometry.ts';
export * from './geographic/places.ts';
export * from './geographic/prepare-location.ts';
export * from './geographic/source-records.ts';
export * from './geographic/wms-page-geometry.ts';
export * from './geographic/wmts-polar-geometry.ts';
export * from './globe/asset-contract.ts';
export * from './globe/atmosphere.ts';
export * from './globe/attitude.ts';
export * from './globe/context.ts';
export * from './globe/mur-image.ts';
export * from './globe/profile-source.ts';
export * from './globe/scene.ts';
export * from './interior-poles.ts';
export * from './night-lights.ts';
export * from './object.ts';
export * from './parallel-assets.ts';
export * from './presentation.ts';
export * from './refresh-source.ts';
export * from './scene-contract.ts';
export * from './source-contract.ts';
export * from './sst-anomaly.ts';
export * from './surface-banks.ts';
export * from './surface-raster.ts';
export * from './texture-levels.ts';
export * from './tomography.ts';
export type { PagedSceneInput, PagedSceneContext } from './globe/scene-context.ts';
