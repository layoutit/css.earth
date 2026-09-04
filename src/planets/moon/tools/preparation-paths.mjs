import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "moon",
  toolModuleUrl: import.meta.url,
});

export const MOON_OBJECT_ROOT = paths.objectRoot;
export const MOON_SOURCE_ROOT = paths.sourceRoot;
export const MOON_STAGING_ROOT = paths.stagingRoot;
export const MOON_PUBLIC_ROOT = paths.publicRoot;
export const ensureMoonPreparationDirectories = paths.ensureDirectories;
