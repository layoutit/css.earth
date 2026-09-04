import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source");
const sourceManifest = await createSourceManifest({
  planetId: "earth",
  planetName: "Earth",
  sourceRoot,
});

export const earthSourceManifest = () => sourceManifest.manifest;
export const earthSourceInputsFor = (consumer) => sourceManifest.inputsFor(consumer);
export const validateEarthSourceGroup = (consumer) => sourceManifest.validateGroup(consumer);
export const validateEarthSourcePath = (path) => sourceManifest.validatePath(path);
export const verifyEarthSourceManifest = () => sourceManifest.verify();
export const assertEarthSourceBytes = (entry, bytes) => sourceManifest.assertBytes(entry, bytes);
