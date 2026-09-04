import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "uranus",
  toolModuleUrl: import.meta.url,
});

export const URANUS_OBJECT_ROOT = paths.objectRoot;
export const URANUS_SOURCE_ROOT = paths.sourceRoot;
export const URANUS_STAGING_ROOT = paths.stagingRoot;
export const URANUS_PUBLIC_ROOT = paths.publicRoot;
export const ensureUranusPreparationDirectories = paths.ensureDirectories;
