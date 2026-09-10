import { isArray } from '../src/platform/is-array.mts';
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { parseObjectDescriptor } from '@cssearth/objects';

export interface PreparationFingerprint { bytes: number; sha256: string; }
export type PreparationFingerprints = Record<string, PreparationFingerprint>;
export type PreparationInputKinds = Readonly<Record<string, 'object-descriptor-authored@1'>>;
export interface PreparationReceipt {schema: string; inputs: PreparationFingerprints; outputs: PreparationFingerprints; inputKinds?: PreparationInputKinds; metadata: Readonly<Record<string, unknown>> | null;}
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !isArray(value);

export const PREPARATION_RECEIPT_SCHEMA = "cssearth-preparation-receipt@1";

function safePath(root: string, path: string) {
  assert.equal(typeof path, "string");
  assert.ok(path && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), `Unsafe preparation path: ${path}`);
  const absolute = resolve(root, path);
  assert.ok(!relative(root, absolute).startsWith(".."), `Preparation path escaped its root: ${path}`);
  return absolute;
}

export async function fingerprintPreparationFiles(root: string, paths: readonly string[], inputKinds: PreparationInputKinds = {}) {
  assert.ok(inputKinds && typeof inputKinds === 'object' && !isArray(inputKinds), 'Preparation input kinds must be keyed data');
  for (const [path, kind] of Object.entries(inputKinds)) {
    assert.ok(paths.includes(path) && kind === 'object-descriptor-authored@1', 'Unsupported preparation input kind');
  }
  const canonicalRoot = await realpath(root);
  const files: PreparationFingerprints = {};
  for (const path of [...new Set(paths)].sort()) {
    const absolute = safePath(canonicalRoot, path);
    const canonicalFile = await realpath(absolute);
    assert.ok(!relative(canonicalRoot, canonicalFile).startsWith(".."), `Preparation input link escaped its root: ${path}`);
    const before = await stat(canonicalFile);
    assert.ok(before.isFile(), `Preparation input is not a file: ${path}`);
    const hash = createHash("sha256");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    for await (const value of createReadStream(canonicalFile)) {
      const chunk: unknown = value;
      assert.ok(chunk instanceof Uint8Array, "Preparation stream must contain bytes");
      bytes += chunk.length;
      if (inputKinds[path] === 'object-descriptor-authored@1') chunks.push(chunk);
      else hash.update(chunk);
    }
    const after = await stat(canonicalFile);
    assert.equal(bytes, before.size, `Preparation file changed while hashing: ${path}`);
    assert.equal(after.size, before.size, `Preparation file changed while hashing: ${path}`);
    assert.equal(after.mtimeMs, before.mtimeMs, `Preparation file changed while hashing: ${path}`);
    if (inputKinds[path] === 'object-descriptor-authored@1') {
      const { schema, id, type, properties } = parseObjectDescriptor(Buffer.concat(chunks).toString('utf8'));
      const { worldFrame, ...authoredProperties } = properties;
      const authored = JSON.stringify({ schema, id, type, properties: properties.recipe ? authoredProperties : properties });
      bytes = Buffer.byteLength(authored);
      hash.update(authored);
    }
    files[path] = { bytes, sha256: hash.digest("hex") };
  }
  return files;
}

export async function writePreparationReceipt({ root, path, inputs, inputKinds = {}, outputPaths, metadata = null }: {root: string; path: string; inputs: PreparationFingerprints; inputKinds?: PreparationInputKinds; outputPaths: readonly string[]; metadata?: Readonly<Record<string, unknown>> | null}) {
  assert.ok(inputs && Object.keys(inputs).length, "Preparation needs bound input files");
  assert.ok(outputPaths.length && !outputPaths.includes(path), "Preparation needs outputs distinct from its receipt");
  assert.deepEqual(await fingerprintPreparationFiles(root, Object.keys(inputs), inputKinds), inputs,
    "Preparation inputs changed during generation; outputs cannot be cached");
  const outputs = await fingerprintPreparationFiles(root, outputPaths);
  const receipt = { schema: PREPARATION_RECEIPT_SCHEMA, inputs, inputKinds, outputs, metadata };
  const destination = safePath(root, path);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(receipt) + "\n", { flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return receipt;
}

export async function readPreparationReceipt({ root, path, inputPaths, inputKinds = {} }: {root: string; path: string; inputPaths: readonly string[]; inputKinds?: PreparationInputKinds}): Promise<PreparationReceipt | null> {
  try {
    const receipt: unknown = JSON.parse(await readFile(safePath(root, path), "utf8"));
    assert.ok(isRecord(receipt));
    assert.equal(receipt.schema, PREPARATION_RECEIPT_SCHEMA);
    assert.ok(isRecord(receipt.inputs));
    assert.ok(isRecord(receipt.outputs));
    assert.ok(receipt.metadata === null || isRecord(receipt.metadata));
    assert.deepEqual(Object.keys(receipt.inputs), [...new Set(inputPaths)].sort(), "Preparation input set changed");
    assert.ok(Object.keys(receipt.outputs).length, "Preparation receipt has no outputs");
    assert.ok(!Object.hasOwn(receipt.outputs, path), "Preparation receipt cannot verify itself");
    assert.deepEqual(receipt.inputKinds ?? {}, inputKinds, 'Preparation input kinds changed');
    assert.deepEqual(await fingerprintPreparationFiles(root, inputPaths, inputKinds), receipt.inputs, "Preparation inputs changed");
    assert.deepEqual(await fingerprintPreparationFiles(root, Object.keys(receipt.outputs)), receipt.outputs,
      "Prepared outputs are missing or changed");
    // Fingerprint equality above validates every input/output record, not just the map shape.
    return receipt as unknown as PreparationReceipt;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && "code" in error && ["ENOENT", "ENOTDIR", "ERR_ASSERTION"].includes(String(error.code))) return null;
    throw error;
  }
}
