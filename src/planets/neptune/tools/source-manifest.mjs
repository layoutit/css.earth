import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceManifest = await createSourceManifest({
  planetId: "neptune",
  planetName: "Neptune",
  sourceRoot: resolve(import.meta.dirname, "../source"),
});

export function neptuneSourceManifest() { return sourceManifest.manifest; }
export function neptuneSourceInputsFor(consumer) { return sourceManifest.inputsFor(consumer); }
export function validateNeptuneSourceGroup(consumer) { return sourceManifest.validateGroup(consumer); }
export function validateNeptuneSourcePath(path) { return sourceManifest.validatePath(path); }
export function verifyNeptuneSourceManifest() { return sourceManifest.verify(); }
export function assertNeptuneSourceBytes(entry, bytes) { return sourceManifest.assertBytes(entry, bytes); }

