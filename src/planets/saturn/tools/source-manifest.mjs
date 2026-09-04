import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSourceManifest } from "../../../platform/source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source");
const sourceManifest = await createSourceManifest({
  planetId: "saturn",
  planetName: "Saturn",
  sourceRoot,
});
const editorialEntry = Object.freeze({
  id: "nasa-saturn-editorial-snapshot",
  path: "data/planets/saturn.json",
  expectedSha256:
    "f8edb3a3a3f5d88b9865fa526080baed5fe5260bedd8f491dca084646404fe29",
  expectedBytes: 8643,
  origin: "NASA Science Saturn editorial snapshot",
  credit: "NASA Science",
  license: "NASA media usage guidelines",
  acquisition: "checked repository editorial snapshot",
  redistribution: "source facts and attribution retained",
  consumers: Object.freeze(["panel"]),
});
const editorialPath = resolve(objectRoot, "../../../data/planets/saturn.json");

export function saturnSourceManifest() {
  return Object.freeze({
    ...sourceManifest.manifest,
    inputs: Object.freeze([
      ...sourceManifest.manifest.inputs,
      editorialEntry,
    ]),
  });
}

export function saturnSourceInputsFor(consumer) {
  if (consumer === "panel") return Object.freeze([editorialEntry]);
  return sourceManifest.inputsFor(consumer);
}

export async function validateSaturnSourceGroup(consumer) {
  if (consumer === "panel") return validateEditorialSnapshot();
  return sourceManifest.validateGroup(consumer);
}

export async function validateSaturnSourcePath(sourcePath) {
  return sourceManifest.validatePath(sourcePath);
}

export async function verifySaturnSourceManifest() {
  const result = await sourceManifest.verify();
  await validateEditorialSnapshot();
  return Object.freeze({
    ...result,
    inputCount: result.inputCount + 1,
  });
}

export function assertSaturnSourceBytes(entry, bytes) {
  return sourceManifest.assertBytes(entry, bytes);
}

async function validateEditorialSnapshot() {
  const bytes = await readFile(editorialPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== editorialEntry.expectedBytes ||
      sha256 !== editorialEntry.expectedSha256) {
    throw new Error("Saturn editorial snapshot changed outside preparation.");
  }
  return true;
}
