import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "venus",
  toolModuleUrl: import.meta.url,
});

export const VENUS_OBJECT_ROOT = paths.objectRoot;
export const VENUS_SOURCE_ROOT = paths.sourceRoot;
export const VENUS_STAGING_ROOT = paths.stagingRoot;
export const VENUS_PUBLIC_ROOT = paths.publicRoot;
export const ensureVenusPreparationDirectories = paths.ensureDirectories;
