import { resolve } from "node:path";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const sourceManifest = await createSourceManifest({
  planetId: "pluto",
  planetName: "Pluto",
  sourceRoot,
});

export const plutoSourceManifest = () => sourceManifest.manifest;
export const plutoSourceInputsFor = (consumer) => sourceManifest.inputsFor(consumer);
export const validatePlutoSourceGroup = (consumer) => sourceManifest.validateGroup(consumer);
export const verifyPlutoSourceManifest = () => sourceManifest.verify();
export const assertPlutoSourceBytes = (entry, bytes) => sourceManifest.assertBytes(entry, bytes);
