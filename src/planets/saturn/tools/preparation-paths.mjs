import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "saturn",
  toolModuleUrl: import.meta.url,
});

export const SATURN_OBJECT_ROOT = paths.objectRoot;
export const SATURN_SOURCE_ROOT = paths.sourceRoot;
export const SATURN_STAGING_ROOT = paths.stagingRoot;
export const SATURN_PUBLIC_ROOT = paths.publicRoot;
export const ensureSaturnPreparationDirectories = paths.ensureDirectories;
