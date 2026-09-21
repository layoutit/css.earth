import { objectPageStyles } from '../site/object-page-contract.mts';
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ObjectEntry } from "../site/object-schema.mts";
import { authoredObject } from './authored-object.mts';

import {
  validateRuntimeAssetManifest,
  requireRuntimeAssetManifest,
  verifyRuntimeAssetClosure,
} from "../src/platform/runtime-asset-closure.mts";
import {
  validateSourceManifest,
  verifySourceManifest,
} from "../src/platform/source-manifest.mts";

export function objectPackagePaths(objectRecord: Pick<ObjectEntry, "id" | "name">, projectRoot = process.cwd(), authored = false) {
  const root = resolve(projectRoot, "src", "objects", objectRecord.id);
  return Object.freeze({
    root,
    requiredFiles: Object.freeze([
      resolve(root, "README.md"),
      resolve(root, "NOTICE.md"),
      resolve(root, "source", "manifest.json"),
      resolve(root, "runtime-assets.json"),
      ...(authored ? [resolve(root, 'object.json'), resolve(root, 'prepared/runtime.json'),
        resolve(root, 'prepared/content.json'), resolve(root, 'text.json'), resolve(root, 'prepared/text.json')] : [
      resolve(root, "runtime", "client.mjs"),
      resolve(root, "site", `${objectRecord.name}Page.astro`),
      resolve(root, "site", "control-content.mjs"),
      resolve(root, "tools", "acquire.mjs"),
      resolve(root, "tools", "prepare.mjs"),
      resolve(root, "tools", "navigation-marker.mjs"),
      resolve(root, "tools", "verify-source-manifest.mjs"),
      resolve(root, "tools", "compact-production-assets.mjs"),
      ]),
      resolve(root, 'prepared/page.json'),
      resolve(projectRoot, 'site/pages/[id].astro'),
    ]),
    // These are repository-completeness files: their absence does not change what the
    // application ships, so they are tracked as a ratcheted backlog rather than a merge
    // gate (see docs/ci-cd.md).
    backlogFiles: Object.freeze([
      authored ? resolve(projectRoot, 'tests/objects/browser', objectRecord.id, 'browser-profile.mts')
        : resolve(root, "test", "browser-profile.mts"),
    ]),
    runtimeAssets: resolve(root, "runtime-assets.json"),
    sourceManifest: resolve(root, "source", "manifest.json"),
    sourceRoot: resolve(root, "source"),
    publicAssets: resolve(projectRoot, "public", "scenes", objectRecord.id),
  });
}

export async function validateObjectPackageFiles(
  objectRecord: Pick<ObjectEntry, "id" | "name">,
  { projectRoot = process.cwd(), accessFile = access }: {projectRoot?: string; accessFile?: typeof access} = {},
) {
  const paths = objectPackagePaths(objectRecord, projectRoot, Boolean(await authoredObject(objectRecord.id, projectRoot)));
  const descriptor = JSON.parse(await readFile(resolve(paths.root, 'object.json'), 'utf8'));
  for (const path of objectPageStyles(descriptor)) await accessFile(resolve(projectRoot, path));
  for (const file of paths.requiredFiles) {
    try {
      await accessFile(file);
    } catch (cause) {
      throw new Error(`Implemented object ${objectRecord.id} is missing ${file}.`, {
        cause,
      });
    }
  }
  const missingBacklogFiles: string[] = [];
  for (const file of paths.backlogFiles) {
    try {
      await accessFile(file);
    } catch {
      missingBacklogFiles.push(file);
    }
  }
  return Object.freeze({ ...paths, missingBacklogFiles: Object.freeze(missingBacklogFiles) });
}

export { validateRuntimeAssetManifest };

export async function validatePlanetData(
  planet: Pick<ObjectEntry, "id" | "name">,
  { projectRoot = process.cwd() } = {},
) {
  const paths = await validateObjectPackageFiles(planet, { projectRoot });
  const [runtimeInput, sourceInput] = await Promise.all([
    readJson(paths.runtimeAssets),
    readJson(paths.sourceManifest),
  ]);
  const runtimeAssets = requireRuntimeAssetManifest(planet.id, runtimeInput);
  const sourceManifest = validateSourceManifest(planet.id, sourceInput);
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

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}
