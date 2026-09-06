import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "callisto",
  planetName: "Callisto",
  sourceRoot,
});

export function callistoSourceManifest() {
  return sourceManifest.manifest;
}

export function callistoSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateCallistoSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyCallistoSourceManifest() {
  return sourceManifest.verify();
}

export function assertCallistoSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
