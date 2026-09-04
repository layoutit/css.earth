import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "mercury",
  planetName: "Mercury",
  sourceRoot,
});

export function mercurySourceManifest() {
  return sourceManifest.manifest;
}

export function mercurySourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateMercurySourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyMercurySourceManifest() {
  return sourceManifest.verify();
}

export function assertMercurySourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
