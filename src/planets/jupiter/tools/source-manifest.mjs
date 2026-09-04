import { createSourceManifest } from "../../../platform/source-manifest.mjs";

import { JUPITER_SOURCE_ROOT } from "./preparation-paths.mjs";

const sourceManifest = await createSourceManifest({
  planetId: "jupiter",
  planetName: "Jupiter",
  sourceRoot: JUPITER_SOURCE_ROOT,
});

export function jupiterSourceManifest() {
  return sourceManifest.manifest;
}

export function jupiterSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateJupiterSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function validateJupiterSourcePath(sourcePath) {
  return sourceManifest.validatePath(sourcePath);
}

export async function verifyJupiterSourceManifest() {
  return sourceManifest.verify();
}

export function assertJupiterSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
