import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authoredObject } from './authored-object.mjs';

import {
  validateRuntimeAssetManifest,
  verifyRuntimeAssetClosure,
} from "../src/platform/runtime-asset-closure.mjs";
import {
  validateSourceManifest,
  verifySourceManifest,
} from "../src/platform/source-manifest.mjs";

export function objectPackagePaths(objectRecord, projectRoot = process.cwd(), authored = false) {
  const root = resolve(projectRoot, "src", "planets", objectRecord.id);
  return Object.freeze({
    root,
    requiredFiles: Object.freeze([
      resolve(root, "SOURCE.md"),
      resolve(root, "NOTICE.md"),
      resolve(root, "source", "manifest.json"),
      resolve(root, "runtime-assets.json"),
      ...(authored ? [resolve(root, 'object.json'), resolve(root, 'prepared/runtime.json'),
        resolve(root, 'prepared/content.json'),
        resolve(projectRoot, 'tests/objects/browser', objectRecord.id, 'browser-profile.mjs')] : [
      resolve(root, "runtime", "client.mjs"),
      resolve(root, "site", `${objectRecord.name}Page.astro`),
      resolve(root, "site", "control-content.mjs"),
      resolve(root, "test", "browser-profile.mjs"),
      resolve(root, "tools", "acquire.mjs"),
      resolve(root, "tools", "prepare.mjs"),
      resolve(root, "tools", "navigation-marker.mjs"),
      resolve(root, "tools", "verify-source-manifest.mjs"),
      resolve(root, "tools", "compact-production-assets.mjs"),
      ]),
      resolve(projectRoot, "site", "pages", `${objectRecord.id}.astro`),
    ]),
    runtimeAssets: resolve(root, "runtime-assets.json"),
    sourceManifest: resolve(root, "source", "manifest.json"),
    sourceRoot: resolve(root, "source"),
    publicAssets: resolve(projectRoot, "public", "scenes", objectRecord.id),
  });
}

export async function validateObjectPackageFiles(
  objectRecord,
  { projectRoot = process.cwd(), accessFile = access } = {},
) {
  const paths = objectPackagePaths(objectRecord, projectRoot, Boolean(await authoredObject(objectRecord.id, projectRoot)));
  for (const file of paths.requiredFiles) {
    try {
      await accessFile(file);
    } catch (cause) {
      throw new Error(`Implemented object ${objectRecord.id} is missing ${file}.`, {
        cause,
      });
    }
  }
  return paths;
}

export { validateRuntimeAssetManifest };

export async function validatePlanetData(
  planet,
  { projectRoot = process.cwd() } = {},
) {
  const paths = await validateObjectPackageFiles(planet, { projectRoot });
  const [runtimeAssets, sourceManifest] = await Promise.all([
    readJson(paths.runtimeAssets),
    readJson(paths.sourceManifest),
  ]);
  validateRuntimeAssetManifest(planet.id, runtimeAssets);
  validateSourceManifest(planet.id, sourceManifest);
  await verifyRuntimeAssetClosure({
    planetId: planet.id,
    manifest: runtimeAssets,
    root: paths.publicAssets,
  });
  await verifySourceManifest({
    manifest: sourceManifest,
    planetName: planet.name,
    sourceRoot: paths.sourceRoot,
  });
  return Object.freeze({
    assetCount: runtimeAssets.assets.length,
    sourceInputCount: sourceManifest.inputs.length,
  });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
