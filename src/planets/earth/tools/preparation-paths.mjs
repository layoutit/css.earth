import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "earth",
  toolModuleUrl: import.meta.url,
});

export const EARTH_OBJECT_ROOT = paths.objectRoot;
export const EARTH_SOURCE_ROOT = paths.sourceRoot;
export const EARTH_STAGING_ROOT = paths.stagingRoot;
export const EARTH_PUBLIC_ROOT = paths.publicRoot;
export const ensureEarthPreparationDirectories = paths.ensureDirectories;
