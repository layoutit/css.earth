import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "mars",
  toolModuleUrl: import.meta.url,
});

export const MARS_OBJECT_ROOT = paths.objectRoot;
export const MARS_SOURCE_ROOT = paths.sourceRoot;
export const MARS_STAGING_ROOT = paths.stagingRoot;
export const MARS_PUBLIC_ROOT = paths.publicRoot;
export const ensureMarsPreparationDirectories = paths.ensureDirectories;
