import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "jupiter",
  toolModuleUrl: import.meta.url,
});

export const JUPITER_OBJECT_ROOT = paths.objectRoot;
export const JUPITER_SOURCE_ROOT = paths.sourceRoot;
export const JUPITER_STAGING_ROOT = paths.stagingRoot;
export const JUPITER_PUBLIC_ROOT = paths.publicRoot;
export const ensureJupiterPreparationDirectories = paths.ensureDirectories;
