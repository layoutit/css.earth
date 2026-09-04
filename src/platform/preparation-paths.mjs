import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createPlanetPreparationPaths({ planetId, toolModuleUrl }) {
  const moduleUrl = typeof toolModuleUrl === "string"
    ? new URL(toolModuleUrl)
    : toolModuleUrl;
  if (!/^[a-z][a-z0-9-]*$/u.test(planetId) ||
      !(moduleUrl instanceof URL) || moduleUrl.protocol !== "file:") {
    throw new TypeError("Planet preparation path request is incompatible.");
  }
  const objectRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const sourceRoot = resolve(objectRoot, "source");
  const stagingRoot = resolve(objectRoot, ".prepared");
  const publicRoot = resolve(objectRoot, `../../../public/scenes/${planetId}`);
  return Object.freeze({
    objectRoot,
    sourceRoot,
    stagingRoot,
    publicRoot,
    async ensureDirectories() {
      await Promise.all([sourceRoot, stagingRoot, publicRoot].map((directory) =>
        mkdir(directory, { recursive: true })));
    },
  });
}
