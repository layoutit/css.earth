import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "sun",
  planetName: "Sun",
  sourceRoot,
});

export const sunSourceManifest = () => sourceManifest.manifest;
export const sunSourceInputsFor = (consumer) => sourceManifest.inputsFor(consumer);
export const validateSunSourceGroup = (consumer) => sourceManifest.validateGroup(consumer);
export const verifySunSourceManifest = () => sourceManifest.verify();
export const assertSunSourceBytes = (entry, bytes) => sourceManifest.assertBytes(entry, bytes);
