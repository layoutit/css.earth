import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "neptune",
  toolModuleUrl: import.meta.url,
});

export const NEPTUNE_OBJECT_ROOT = paths.objectRoot;
export const NEPTUNE_SOURCE_ROOT = paths.sourceRoot;
export const NEPTUNE_STAGING_ROOT = paths.stagingRoot;
export const NEPTUNE_PUBLIC_ROOT = paths.publicRoot;
export const ensureNeptunePreparationDirectories = paths.ensureDirectories;
