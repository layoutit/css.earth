import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "moon",
  planetName: "Moon",
  sourceRoot,
});

export const moonSourceManifest = () => sourceManifest.manifest;
export const moonSourceInputsFor = (consumer) => sourceManifest.inputsFor(consumer);
export const validateMoonSourceGroup = (consumer) => sourceManifest.validateGroup(consumer);
export const verifyMoonSourceManifest = () => sourceManifest.verify();
export const assertMoonSourceBytes = (entry, bytes) => sourceManifest.assertBytes(entry, bytes);
