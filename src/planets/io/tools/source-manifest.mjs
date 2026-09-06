import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "io",
  planetName: "Io",
  sourceRoot,
});

export function ioSourceManifest() {
  return sourceManifest.manifest;
}

export function ioSourceInputsFor(consumer) {
  return sourceManifest.inputsFor(consumer);
}

export async function validateIoSourceGroup(consumer) {
  return sourceManifest.validateGroup(consumer);
}

export async function verifyIoSourceManifest() {
  return sourceManifest.verify();
}

export function assertIoSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}
