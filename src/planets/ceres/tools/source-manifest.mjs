import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "ceres",
  planetName: "Ceres",
  sourceRoot,
});

export function ceresSourceManifest() {
  return sourceManifest.manifest;
}

export function ceresSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateCeresSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyCeresSourceManifest() {
  return sourceManifest.verify();
}

export function assertCeresSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
