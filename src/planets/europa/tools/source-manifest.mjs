import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "europa",
  planetName: "Europa",
  sourceRoot,
});

export function europaSourceManifest() {
  return sourceManifest.manifest;
}

export function europaSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateEuropaSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyEuropaSourceManifest() {
  return sourceManifest.verify();
}

export function assertEuropaSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
