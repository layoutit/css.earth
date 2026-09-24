import { safeRelativePath } from './source-path.mts';
import { isArray } from './is-array.mts';
import { parseSourceBinding } from './source-catalog.mts';
import type { SourceBinding } from './source-catalog.mts';
/** One byte range of a remote member, for archive files too large to keep whole. The pin covers exactly the kept bytes. */
export interface SourceRange { offset: number; length: number; }
/** A declared source file. Git holds authored files; a download is fetched by its origin. Nothing here carries a hash. */
export interface SourceEntry { path: string; range?: SourceRange; sourceBinding?: SourceBinding; }
export interface SourceInput extends SourceEntry { id: string; origin: string; credit: string; license: string; acquisition: string; redistribution: string; consumers: readonly string[]; licenseEvidence?: readonly string[]; sourceBinding: SourceBinding; }
export interface SourceManifest { schema: string; inputs: readonly SourceInput[]; generatedIntermediates: readonly (SourceEntry & { generator: string })[]; documents: readonly (SourceEntry & { purpose?: string })[]; }
export interface SourceManifestLocation { objectId: string; objectName: string; sourceRoot: string; }
export interface SourceVerification { entry: SourceEntry; objectName: string; sourceRoot: string; }
import { access, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const COLLECTIONS = Object.freeze([
  "inputs",
  "generatedIntermediates",
  "documents",
] as const);

export async function createSourceManifest({ objectId, objectName, sourceRoot }: SourceManifestLocation) {
  const manifest = validateSourceManifest(
    objectId,
    JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8")),
  );
  // A lens may read an acquired input or a file this repository generates from one, such as a spectrum sampled here from the
  // archive's coefficients. Both are pinned the same way, and both are verified by their bytes before they are read.
  const inputsByPath = new Map<string, SourceEntry>([
    ...manifest.documents.map((entry) => [entry.path, entry] as const),
    ...manifest.generatedIntermediates.map((entry) => [entry.path, entry] as const),
    ...manifest.inputs.map((entry) => [entry.path, entry] as const),
  ]);

  return Object.freeze({
    manifest,
    inputsFor(consumer: string) {
      const entries = manifest.inputs.filter(({ consumers }) =>
        consumers.includes(consumer));
      if (entries.length === 0) {
        throw new Error(`${objectName} source manifest has no inputs for ${consumer}.`);
      }
      return Object.freeze(entries);
    },
    async validateGroup(consumer: string) {
      const entries = this.inputsFor(consumer);
      for (const entry of entries) await validateSourceEntry({ entry, objectName, sourceRoot });
      return entries;
    },
    async validatePath(sourcePath: string) {
      const normalized = sourcePath.replaceAll("\\", "/");
      const entry = inputsByPath.get(normalized);
      if (!entry) throw new Error(`${objectName} source is not declared: ${normalized}.`);
      await validateSourceEntry({ entry, objectName, sourceRoot });
      return entry;
    },
    /** The one way a preparation reads a source file: a download is verified against its manifest pin, a file
     * authored here is read as it is. Nothing else needs to remember a hash. */
    async readSource(sourcePath: string): Promise<Buffer> {
      const normalized = sourcePath.replaceAll("\\", "/");
      if (normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error(`${objectName} source path escapes the package: ${normalized}.`);
      const entry = inputsByPath.get(normalized);
      if (!entry) throw new Error(`${objectName} source is not declared: ${normalized}.`);
      return readFile(resolve(sourceRoot, normalized));
    },
    verify() {
      return verifySourceManifest({ manifest, objectName, sourceRoot });
    },
  });
}

/** Every source manifest, of an object or of a shared kernel bank, has this one format name. */
export const SOURCE_MANIFEST_SCHEMA = "cssearth-authoritative-sources@2";

export function validateSourceManifest(objectId: string, input: unknown): Readonly<SourceManifest> {
  const value = input as SourceManifest;
  if (!value || typeof value !== "object" || isArray(value) ||
      value.schema !== SOURCE_MANIFEST_SCHEMA) {
    throw new TypeError(`Object ${objectId} source manifest is incompatible.`);
  }
  for (const collection of COLLECTIONS) {
    if (!isArray(value[collection])) {
      throw new TypeError(`Object ${objectId} source manifest ${collection} is missing.`);
    }
  }
  if (value.inputs.length === 0) {
    throw new TypeError(`Object ${objectId} source manifest inputs are empty.`);
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const input of value.inputs) {
    parseSourceBinding(input.sourceBinding);
    validateEntryBase(objectId, input, "input", paths);
    for (const field of [
      "id",
      "origin",
      "credit",
      "license",
      "acquisition",
      "redistribution",
    ] as const) {
      if (!nonEmpty(input[field])) {
        throw new TypeError(`Object ${objectId} source ${input.path} has no ${field}.`);
      }
    }
    if (input.licenseEvidence !== undefined &&
        (!isArray(input.licenseEvidence) || input.licenseEvidence.length === 0 ||
         new Set(input.licenseEvidence).size !== input.licenseEvidence.length ||
         input.licenseEvidence.some((evidence) => !nonEmpty(evidence)))) {
      throw new TypeError(
        `Object ${objectId} source ${input.path} has invalid license evidence.`,
      );
    }
    if (ids.has(input.id)) {
      throw new TypeError(`Object ${objectId} repeats source id ${input.id}.`);
    }
    ids.add(input.id);
    if (!isArray(input.consumers) || input.consumers.length === 0 ||
        new Set(input.consumers).size !== input.consumers.length ||
        input.consumers.some((consumer) => !nonEmpty(consumer))) {
      throw new TypeError(`Object ${objectId} source ${input.path} has invalid consumers.`);
    }
  }

  for (const generated of value.generatedIntermediates) {
    if (generated.sourceBinding) parseSourceBinding(generated.sourceBinding);
    validateEntryBase(objectId, generated, "generated intermediate", paths);
    if (!nonEmpty(generated.generator)) {
      throw new TypeError(
        `Object ${objectId} generated intermediate ${generated.path} has no generator.`,
      );
    }
  }

  for (const document of value.documents) {
    if (document.sourceBinding) parseSourceBinding(document.sourceBinding);
    validateEntryBase(objectId, document, "document", paths);
    if (document.purpose !== undefined && !nonEmpty(document.purpose)) {
      throw new TypeError(`Object ${objectId} document ${document.path} has an empty purpose.`);
    }
  }
  return Object.freeze(value);
}

export async function verifySourceManifest({ manifest, objectName, sourceRoot }: { manifest: SourceManifest; objectName: string; sourceRoot: string }) {
  const declared = new Set(COLLECTIONS.flatMap((collection) =>
    manifest[collection].map(({ path }) => path)));
  const actual = new Set((await walk(sourceRoot))
    .map((filePath) => relative(sourceRoot, filePath).replaceAll("\\", "/"))
    .filter((sourcePath) => sourcePath !== "manifest.json"));
  const undeclared = [...actual].filter((sourcePath) => !declared.has(sourcePath));
  const missing = [...declared].filter((sourcePath) => !actual.has(sourcePath));
  if (undeclared.length > 0 || missing.length > 0) {
    throw new Error(
      `${objectName} source manifest coverage failed. Undeclared: ${
        undeclared.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }
  return Object.freeze({
    inputCount: manifest.inputs.length,
    generatedIntermediateCount: manifest.generatedIntermediates.length,
    documentCount: manifest.documents.length,
  });
}

/** A ranged input asks for exactly its pinned bytes. Acquisition owns the request; this owns what the request must say. */
export const rangeRequestHeader = (range: SourceRange) => `bytes=${range.offset}-${range.offset + range.length - 1}`;
/**
 * A ranged member is far too large to fetch whole, so a full-body answer is refused rather than consumed: the server
 * must honour the request as 206 Partial Content over exactly the pinned offset and length.
 */
export function assertRangeResponse(
  response: { status: number; headers: { get(name: string): string | null } },
  range: SourceRange,
  url: string,
) {
  if (response.status !== 206) {
    throw new Error(`Ranged source request answered ${response.status} instead of 206 Partial Content: ${url}.`);
  }
  const expected = `bytes ${range.offset}-${range.offset + range.length - 1}/`;
  const actual = (response.headers.get("content-range") ?? "").trim();
  if (!actual.startsWith(expected)) {
    throw new Error(`Ranged source request returned content range ${actual || "(none)"} instead of ${expected}*: ${url}.`);
  }
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) !== range.length) {
    throw new Error(`Ranged source request returned ${length} bytes instead of ${range.length}: ${url}.`);
  }
}

async function validateSourceEntry({ entry, objectName, sourceRoot }: SourceVerification) {
  await access(resolve(sourceRoot, entry.path)).catch(() => { throw new Error(`${objectName} source is missing: ${entry.path}.`); });
}

function validateEntryBase(objectId: string, entry: SourceEntry, kind: string, paths: Set<string>) {
  if (!entry || typeof entry !== "object" || isArray(entry) ||
      !safeRelativePath(entry.path)) {
    throw new TypeError(`Object ${objectId} has an invalid source ${kind}.`);
  }
  if (paths.has(entry.path)) {
    throw new TypeError(`Object ${objectId} repeats source path ${entry.path}.`);
  }
  assertSourceRange(entry, `Object ${objectId} source ${kind} ${entry.path}`);
  paths.add(entry.path);
}

/**
 * An input may pin one byte range of a remote member instead of the whole file: acquisition asks for exactly those
 * bytes and the pin covers exactly those bytes, so local verification keeps streaming the local file unchanged.
 */
export function assertSourceRange(entry: { path: string; range?: SourceRange; origin?: string }, label: string) {
  const range = entry.range;
  if (range === undefined) return;
  if (!range || typeof range !== "object" || isArray(range) ||
      Object.keys(range).some((key) => !["offset", "length"].includes(key)) ||
      !Number.isSafeInteger(range.offset) || range.offset < 0 ||
      !Number.isSafeInteger(range.length) || range.length <= 0 ||
      !Number.isSafeInteger(range.offset + range.length)) {
    throw new TypeError(`${label} has an invalid byte range.`);
  }
  if (!nonEmpty(entry.origin) || !/^https?:\/\//u.test(entry.origin)) {
    throw new TypeError(`${label} ranges a member with no remote origin.`);
  }
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
