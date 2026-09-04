import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "pluto",
  toolModuleUrl: import.meta.url,
});

export const PLUTO_OBJECT_ROOT = paths.objectRoot;
export const PLUTO_SOURCE_ROOT = paths.sourceRoot;
export const PLUTO_STAGING_ROOT = paths.stagingRoot;
export const PLUTO_PUBLIC_ROOT = paths.publicRoot;
export const ensurePlutoPreparationDirectories = paths.ensureDirectories;
