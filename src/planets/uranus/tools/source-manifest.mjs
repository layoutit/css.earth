import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "uranus",
  planetName: "Uranus",
  sourceRoot,
});

export function uranusSourceManifest() {
  return sourceManifest.manifest;
}

export function uranusSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export function validateUranusSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export function validateUranusSourcePath(sourcePath) {
  return sourceManifest.validatePath(sourcePath);
}

export function verifyUranusSourceManifest() {
  return sourceManifest.verify();
}

export function assertUranusSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
