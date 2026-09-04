import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { posix, relative, resolve, win32 } from "node:path";

const SHA256 = /^[0-9a-f]{64}$/u;
const COLLECTIONS = Object.freeze([
  "inputs",
  "generatedIntermediates",
  "documents",
]);

export async function createSourceManifest({ planetId, planetName, sourceRoot }) {
  const manifest = validateSourceManifest(
    planetId,
    JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8")),
  );
  const inputsByPath = new Map(manifest.inputs.map((entry) => [entry.path, entry]));

  return Object.freeze({
    manifest,
    inputsFor(consumer) {
      const entries = manifest.inputs.filter(({ consumers }) =>
        consumers.includes(consumer));
      if (entries.length === 0) {
        throw new Error(`${planetName} source manifest has no inputs for ${consumer}.`);
      }
      return Object.freeze(entries);
    },
    async validateGroup(consumer) {
      const entries = this.inputsFor(consumer);
      for (const entry of entries) {
        await validateSourceEntry({ entry, planetName, sourceRoot });
      }
      return entries;
    },
    async validatePath(sourcePath) {
      const normalized = sourcePath.replaceAll("\\", "/");
      const entry = inputsByPath.get(normalized);
      if (!entry) throw new Error(`${planetName} source is not declared: ${normalized}.`);
      await validateSourceEntry({ entry, planetName, sourceRoot });
      return entry;
    },
    assertBytes(entry, bytes) {
      return assertSourceBytes({ entry, bytes, planetName });
    },
    verify() {
      return verifySourceManifest({ manifest, planetName, sourceRoot });
    },
  });
}

export function validateSourceManifest(planetId, value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.schema !== `css${planetId}-authoritative-sources@1`) {
    throw new TypeError(`Planet ${planetId} source manifest is incompatible.`);
  }
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(value[collection])) {
      throw new TypeError(`Planet ${planetId} source manifest ${collection} is missing.`);
    }
  }
  if (value.inputs.length === 0) {
    throw new TypeError(`Planet ${planetId} source manifest inputs are empty.`);
  }

  const ids = new Set();
  const paths = new Set();
  for (const input of value.inputs) {
    validateEntryBase(planetId, input, "input", paths);
    for (const field of [
      "id",
      "origin",
      "credit",
      "license",
      "acquisition",
      "redistribution",
    ]) {
      if (!nonEmpty(input[field])) {
        throw new TypeError(`Planet ${planetId} source ${input.path} has no ${field}.`);
      }
    }
    if (input.licenseEvidence !== undefined &&
        (!Array.isArray(input.licenseEvidence) || input.licenseEvidence.length === 0 ||
         new Set(input.licenseEvidence).size !== input.licenseEvidence.length ||
         input.licenseEvidence.some((evidence) => !nonEmpty(evidence)))) {
      throw new TypeError(
        `Planet ${planetId} source ${input.path} has invalid license evidence.`,
      );
    }
    if (ids.has(input.id)) {
      throw new TypeError(`Planet ${planetId} repeats source id ${input.id}.`);
    }
    ids.add(input.id);
    if (!Array.isArray(input.consumers) || input.consumers.length === 0 ||
        new Set(input.consumers).size !== input.consumers.length ||
        input.consumers.some((consumer) => !nonEmpty(consumer))) {
      throw new TypeError(`Planet ${planetId} source ${input.path} has invalid consumers.`);
    }
  }

  for (const generated of value.generatedIntermediates) {
    validateEntryBase(planetId, generated, "generated intermediate", paths);
    if (!nonEmpty(generated.generator)) {
      throw new TypeError(
        `Planet ${planetId} generated intermediate ${generated.path} has no generator.`,
      );
    }
  }

  for (const document of value.documents) {
    validateEntryBase(planetId, document, "document", paths);
    if (!nonEmpty(document.purpose)) {
      throw new TypeError(`Planet ${planetId} document ${document.path} has no purpose.`);
    }
  }
  return Object.freeze(value);
}

export async function verifySourceManifest({ manifest, planetName, sourceRoot }) {
  const declared = new Set(COLLECTIONS.flatMap((collection) =>
    manifest[collection].map(({ path }) => path)));
  const actual = new Set((await walk(sourceRoot))
    .map((filePath) => relative(sourceRoot, filePath).replaceAll("\\", "/"))
    .filter((sourcePath) => sourcePath !== "manifest.json"));
  const undeclared = [...actual].filter((sourcePath) => !declared.has(sourcePath));
  const missing = [...declared].filter((sourcePath) => !actual.has(sourcePath));
  if (undeclared.length > 0 || missing.length > 0) {
    throw new Error(
      `${planetName} source manifest coverage failed. Undeclared: ${
        undeclared.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }
  for (const collection of COLLECTIONS) {
    for (const entry of manifest[collection]) {
      await validateSourceEntry({ entry, planetName, sourceRoot });
    }
  }
  return Object.freeze({
    inputCount: manifest.inputs.length,
    generatedIntermediateCount: manifest.generatedIntermediates.length,
    documentCount: manifest.documents.length,
  });
}

export function assertSourceBytes({ entry, bytes, planetName }) {
  if (bytes.byteLength !== entry.expectedBytes) {
    throw new Error(
      `${planetName} source size drifted for ${entry.path}: expected ${
        entry.expectedBytes}, received ${bytes.byteLength}.`,
    );
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== entry.expectedSha256) {
    throw new Error(
      `${planetName} source hash drifted for ${entry.path}: expected ${
        entry.expectedSha256}, received ${actual}.`,
    );
  }
  return actual;
}

async function validateSourceEntry({ entry, planetName, sourceRoot }) {
  const bytes = await readFile(resolve(sourceRoot, entry.path));
  assertSourceBytes({ entry, bytes, planetName });
}

function validateEntryBase(planetId, entry, kind, paths) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      !safeRelativePath(entry.path) ||
      !Number.isSafeInteger(entry.expectedBytes) || entry.expectedBytes <= 0 ||
      !SHA256.test(entry.expectedSha256 ?? "")) {
    throw new TypeError(`Planet ${planetId} has an invalid source ${kind}.`);
  }
  if (paths.has(entry.path)) {
    throw new TypeError(`Planet ${planetId} repeats source path ${entry.path}.`);
  }
  paths.add(entry.path);
}

function safeRelativePath(value) {
  return nonEmpty(value) && !value.includes("\\") && !value.includes("\0") &&
    !posix.isAbsolute(value) && !win32.isAbsolute(value) &&
    posix.normalize(value) === value && value !== "." && !value.startsWith("../");
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

async function walk(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filePath));
    else if (entry.isFile()) files.push(filePath);
    else throw new Error(`Source tree contains unsupported entry: ${filePath}.`);
  }
  return files;
}
