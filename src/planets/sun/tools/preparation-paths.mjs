import { createPlanetPreparationPaths } from "../../../platform/preparation-paths.mjs";

const paths = createPlanetPreparationPaths({
  planetId: "sun",
  toolModuleUrl: import.meta.url,
});

export const SUN_OBJECT_ROOT = paths.objectRoot;
export const SUN_SOURCE_ROOT = paths.sourceRoot;
export const SUN_PUBLIC_ROOT = paths.publicRoot;
export const ensureSunPreparationDirectories = paths.ensureDirectories;
