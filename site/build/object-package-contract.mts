import { objectPageStyles } from '../object-page-contract.mts';
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ObjectEntry } from '@cssearth/objects';
import { authoredObject } from '@cssearth/bake/sources';

import { validateInventory, requireInventory, verifyInventory } from '@cssearth/objects/node';
import {
  validateSourceManifest,
  verifySourceManifest,
} from "@cssearth/objects/node";

export function objectPackagePaths(objectRecord: Pick<ObjectEntry, "id" | "name">, projectRoot = process.cwd()) {
  const root = resolve(projectRoot, "src", "objects", objectRecord.id);
  return Object.freeze({
    root,
    requiredFiles: Object.freeze([
      resolve(root, "README.md"),
      resolve(root, "NOTICE.md"),
      resolve(root, "source", "manifest.json"),
      resolve(root, "inventory.json"),
      resolve(root, 'object.json'), resolve(root, 'prepared/runtime.json'),
      resolve(root, 'prepared/content.json'), resolve(root, 'text.json'), resolve(root, 'prepared/text.json'),
      // `prepared/page.json` is not listed: it is a transport built from the restored runtime when
      // read (prepared-transport), never a file in a checkout.
      resolve(projectRoot, 'site/pages/[id].astro'),
    ]),
    inventory: resolve(root, "inventory.json"),
    sourceManifest: resolve(root, "source", "manifest.json"),
    sourceRoot: resolve(root, "source"),
    publicAssets: resolve(projectRoot, "public", "scenes", objectRecord.id),
  });
}

export async function validateObjectPackageFiles(
  objectRecord: Pick<ObjectEntry, "id" | "name">,
  { projectRoot = process.cwd(), accessFile = access }: {projectRoot?: string; accessFile?: typeof access} = {},
) {
  if (!await authoredObject(objectRecord.id, projectRoot))
    throw new TypeError(`src/objects/${objectRecord.id}/object.json: implemented object ${objectRecord.id} has no authored recipe (properties.recipe).`);
  const paths = objectPackagePaths(objectRecord, projectRoot);
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
  return paths;
}

export { validateInventory };

export async function validateObjectData(
  planet: Pick<ObjectEntry, "id" | "name">,
  { projectRoot = process.cwd() } = {},
) {
  const paths = await validateObjectPackageFiles(planet, { projectRoot });
  const [runtimeInput, sourceInput] = await Promise.all([
    readJson(paths.inventory),
    readJson(paths.sourceManifest),
  ]);
  const inventory = requireInventory(planet.id, runtimeInput);
  // An object whose recipe declares no surface prepares nothing from input files: its manifest may list none.
  const authored = await authoredObject(planet.id, projectRoot);
  const sourceManifest = validateSourceManifest(planet.id, sourceInput, { inputs: authored && !authored.recipe.surfaces.length ? 'optional' : 'required' });
  await verifyInventory({ objectId: planet.id, inventory, publicRoot: paths.publicAssets, locations: ['public'] });
  await verifySourceManifest({
    manifest: sourceManifest,
    objectName: planet.name,
    sourceRoot: paths.sourceRoot,
  });
  return Object.freeze({
    assetCount: inventory.assets.filter(asset => asset.location === "public").length,
    sourceInputCount: sourceManifest.inputs.length,
  });
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}
