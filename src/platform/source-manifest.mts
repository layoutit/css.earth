import { sha256 } from './sha256.mts';
import { isArray } from './is-array.mts';
import { parseSourceBinding } from './source-catalog.mts';
import type { SourceBinding } from './source-catalog.mts';
export interface SourceEntry { path: string; expectedBytes: number; expectedSha256: string; sourceBinding?: SourceBinding; }
export interface SourceInput extends SourceEntry { id: string; origin: string; credit: string; license: string; acquisition: string; redistribution: string; consumers: readonly string[]; licenseEvidence?: readonly string[]; sourceBinding: SourceBinding; }
export interface SourceManifest { schema: string; inputs: readonly SourceInput[]; generatedIntermediates: readonly (SourceEntry & { generator: string })[]; documents: readonly (SourceEntry & { purpose?: string })[]; }
export interface SourceManifestLocation { planetId: string; planetName: string; sourceRoot: string; }
export interface SourceVerification { entry: SourceEntry; planetName: string; sourceRoot: string; }
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { posix, relative, resolve, win32 } from "node:path";

const SHA256 = /^[0-9a-f]{64}$/u;
const COLLECTIONS = Object.freeze([
  "inputs",
  "generatedIntermediates",
  "documents",
] as const);

export async function createSourceManifest({ planetId, planetName, sourceRoot }: SourceManifestLocation) {
  const manifest = validateSourceManifest(
    planetId,
    JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8")),
  );
  const inputsByPath = new Map(manifest.inputs.map((entry) => [entry.path, entry]));

  return Object.freeze({
    manifest,
    inputsFor(consumer: string) {
      const entries = manifest.inputs.filter(({ consumers }) =>
        consumers.includes(consumer));
      if (entries.length === 0) {
        throw new Error(`${planetName} source manifest has no inputs for ${consumer}.`);
      }
      return Object.freeze(entries);
    },
    async validateGroup(consumer: string) {
      const entries = this.inputsFor(consumer);
      for (const entry of entries) {
        await validateSourceEntry({ entry, planetName, sourceRoot });
      }
      return entries;
    },
    async validatePath(sourcePath: string) {
      const normalized = sourcePath.replaceAll("\\", "/");
      const entry = inputsByPath.get(normalized);
      if (!entry) throw new Error(`${planetName} source is not declared: ${normalized}.`);
      await validateSourceEntry({ entry, planetName, sourceRoot });
      return entry;
    },
    assertBytes(entry: SourceEntry, bytes: Uint8Array) {
      return assertSourceBytes({ entry, bytes, planetName });
    },
    verify() {
      return verifySourceManifest({ manifest, planetName, sourceRoot });
    },
  });
}

export function validateSourceManifest(planetId: string, input: unknown): Readonly<SourceManifest> {
  const value = input as SourceManifest;
  if (!value || typeof value !== "object" || isArray(value) ||
      value.schema !== `css${planetId}-authoritative-sources@2`) {
    throw new TypeError(`Planet ${planetId} source manifest is incompatible.`);
  }
  for (const collection of COLLECTIONS) {
    if (!isArray(value[collection])) {
      throw new TypeError(`Planet ${planetId} source manifest ${collection} is missing.`);
    }
  }
  if (value.inputs.length === 0) {
    throw new TypeError(`Planet ${planetId} source manifest inputs are empty.`);
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const input of value.inputs) {
    parseSourceBinding(input.sourceBinding);
    validateEntryBase(planetId, input, "input", paths);
    for (const field of [
      "id",
      "origin",
      "credit",
      "license",
      "acquisition",
      "redistribution",
    ] as const) {
      if (!nonEmpty(input[field])) {
        throw new TypeError(`Planet ${planetId} source ${input.path} has no ${field}.`);
      }
    }
    if (input.licenseEvidence !== undefined &&
        (!isArray(input.licenseEvidence) || input.licenseEvidence.length === 0 ||
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
    if (!isArray(input.consumers) || input.consumers.length === 0 ||
        new Set(input.consumers).size !== input.consumers.length ||
        input.consumers.some((consumer) => !nonEmpty(consumer))) {
      throw new TypeError(`Planet ${planetId} source ${input.path} has invalid consumers.`);
    }
  }

  for (const generated of value.generatedIntermediates) {
    if (generated.sourceBinding) parseSourceBinding(generated.sourceBinding);
    validateEntryBase(planetId, generated, "generated intermediate", paths);
    if (!nonEmpty(generated.generator)) {
      throw new TypeError(
        `Planet ${planetId} generated intermediate ${generated.path} has no generator.`,
      );
    }
  }

  for (const document of value.documents) {
    if (document.sourceBinding) parseSourceBinding(document.sourceBinding);
    validateEntryBase(planetId, document, "document", paths);
    if (document.purpose !== undefined && !nonEmpty(document.purpose)) {
      throw new TypeError(`Planet ${planetId} document ${document.path} has an empty purpose.`);
    }
  }
  return Object.freeze(value);
}

export async function verifySourceManifest({ manifest, planetName, sourceRoot }: { manifest: SourceManifest; planetName: string; sourceRoot: string }) {
  const declared = new Set(COLLECTIONS.flatMap((collection) =>
    manifest[collection].map(({ path }) => path)));
  const actual = new Set((await walk(sourceRoot))
    .map((filePath) => relative(sourceRoot, filePath).replaceAll("\\", "/"))
    .filter((sourcePath) => sourcePath !== "manifest.json"));
  const placeholders = new Set(manifest.generatedIntermediates.filter((entry) => isPlaceholderDigest(entry.expectedSha256)).map((entry) => entry.path));
  const undeclared = [...actual].filter((sourcePath) => !declared.has(sourcePath));
  const missing = [...declared].filter((sourcePath) => !actual.has(sourcePath) && !placeholders.has(sourcePath));
  if (undeclared.length > 0 || missing.length > 0) {
    throw new Error(
      `${planetName} source manifest coverage failed. Undeclared: ${
        undeclared.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }
  for (const collection of COLLECTIONS) {
    for (const entry of manifest[collection]) {
      // A generated intermediate pinned with an all-zero digest is declared but not yet produced: preparation writes it and
      // reports the pin to record. Nothing else may carry a placeholder.
      if (collection === "generatedIntermediates" && isPlaceholderDigest(entry.expectedSha256)) continue;
      await validateSourceEntry({ entry, planetName, sourceRoot });
    }
  }
  return Object.freeze({
    inputCount: manifest.inputs.length,
    generatedIntermediateCount: manifest.generatedIntermediates.length,
    documentCount: manifest.documents.length,
  });
}

export function assertSourceBytes({ entry, bytes, planetName }: { entry: SourceEntry; bytes: Uint8Array; planetName: string }) {
  return assertSourceDigest({ entry, size: bytes.byteLength,
    actual: sha256(bytes), planetName });
}

function assertSourceDigest({ entry, size, actual, planetName }: { entry: SourceEntry; size: number; actual: string; planetName: string }) {
  if (size !== entry.expectedBytes) {
    throw new Error(
      `${planetName} source size drifted for ${entry.path}: expected ${
        entry.expectedBytes}, received ${size}.`,
    );
  }
  if (actual !== entry.expectedSha256) {
    throw new Error(
      `${planetName} source hash drifted for ${entry.path}: expected ${
        entry.expectedSha256}, received ${actual}.`,
    );
  }
  return actual;
}

export const isPlaceholderDigest = (digest: string) => /^0{64}$/u.test(digest);

async function validateSourceEntry({ entry, planetName, sourceRoot }: SourceVerification) {
  // Original scientific rasters can be hundreds of MB. Verification requires
  // their bytes and digest, not a resident copy of every source file.
  const digest = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(resolve(sourceRoot, entry.path))) {
    size += chunk.length;
    digest.update(chunk);
  }
  assertSourceDigest({ entry, size, actual: digest.digest("hex"), planetName });
}

function validateEntryBase(planetId: string, entry: SourceEntry, kind: string, paths: Set<string>) {
  if (!entry || typeof entry !== "object" || isArray(entry) ||
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

function safeRelativePath(value: unknown) {
  return nonEmpty(value) && !value.includes("\\") && !value.includes("\0") &&
    !posix.isAbsolute(value) && !win32.isAbsolute(value) &&
    posix.normalize(value) === value && value !== "." && !value.startsWith("../");
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function walk(root: string): Promise<string[]> {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filePath));
    else if (entry.isFile()) files.push(filePath);
    else throw new Error(`Source tree contains unsupported entry: ${filePath}.`);
  }
  return files;
}
