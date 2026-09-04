import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source");
const sourceManifest = await createSourceManifest({
  planetId: "venus",
  planetName: "Venus",
  sourceRoot,
});

export function venusSourceManifest() {
  return sourceManifest.manifest;
}

export function venusSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateVenusSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function validateVenusSourcePath(sourcePath) {
  return sourceManifest.validatePath(sourcePath);
}

export async function verifyVenusSourceManifest() {
  return sourceManifest.verify();
}

export function assertVenusSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
