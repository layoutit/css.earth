import { createSourceManifest } from "../../../platform/source-manifest.mjs";

import { MARS_SOURCE_ROOT } from "./preparation-paths.mjs";

const sourceManifest = await createSourceManifest({
  planetId: "mars",
  planetName: "Mars",
  sourceRoot: MARS_SOURCE_ROOT,
});

export function marsSourceManifest() {
  return sourceManifest.manifest;
}

export function marsSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateMarsSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function validateMarsSourcePath(sourcePath) {
  return sourceManifest.validatePath(sourcePath);
}

export async function verifyMarsSourceManifest() {
  return sourceManifest.verify();
}

export function assertMarsSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
