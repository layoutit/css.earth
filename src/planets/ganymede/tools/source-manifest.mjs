import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "ganymede",
  planetName: "Ganymede",
  sourceRoot,
});

export function ganymedeSourceManifest() {
  return sourceManifest.manifest;
}

export function ganymedeSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateGanymedeSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyGanymedeSourceManifest() {
  return sourceManifest.verify();
}

export function assertGanymedeSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
