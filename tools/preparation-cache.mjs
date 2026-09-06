import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const PREPARATION_RECEIPT_SCHEMA = "cssearth-preparation-receipt@1";

function safePath(root, path) {
  assert.equal(typeof path, "string");
  assert.ok(path && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), `Unsafe preparation path: ${path}`);
  const absolute = resolve(root, path);
  assert.ok(!relative(root, absolute).startsWith(".."), `Preparation path escaped its root: ${path}`);
  return absolute;
}

export async function fingerprintPreparationFiles(root, paths) {
  const canonicalRoot = await realpath(root);
  const files = {};
  for (const path of [...new Set(paths)].sort()) {
    const absolute = safePath(canonicalRoot, path);
    const canonicalFile = await realpath(absolute);
    assert.ok(!relative(canonicalRoot, canonicalFile).startsWith(".."), `Preparation input link escaped its root: ${path}`);
    const before = await stat(canonicalFile);
    assert.ok(before.isFile(), `Preparation input is not a file: ${path}`);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(canonicalFile)) {
      bytes += chunk.length;
      hash.update(chunk);
    }
    const after = await stat(canonicalFile);
    assert.equal(bytes, before.size, `Preparation file changed while hashing: ${path}`);
    assert.equal(after.size, before.size, `Preparation file changed while hashing: ${path}`);
    assert.equal(after.mtimeMs, before.mtimeMs, `Preparation file changed while hashing: ${path}`);
    files[path] = { bytes, sha256: hash.digest("hex") };
  }
  return files;
}

export async function writePreparationReceipt({ root, path, inputs, outputPaths, metadata = null }) {
  assert.ok(inputs && Object.keys(inputs).length, "Preparation needs bound input files");
  assert.ok(outputPaths.length && !outputPaths.includes(path), "Preparation needs outputs distinct from its receipt");
  assert.deepEqual(await fingerprintPreparationFiles(root, Object.keys(inputs)), inputs,
    "Preparation inputs changed during generation; outputs cannot be cached");
  const outputs = await fingerprintPreparationFiles(root, outputPaths);
  const receipt = { schema: PREPARATION_RECEIPT_SCHEMA, inputs, outputs, metadata };
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

export async function readPreparationReceipt({ root, path, inputPaths }) {
  try {
    const receipt = JSON.parse(await readFile(safePath(root, path), "utf8"));
    assert.equal(receipt.schema, PREPARATION_RECEIPT_SCHEMA);
    assert.ok(receipt.inputs && typeof receipt.inputs === "object" && !Array.isArray(receipt.inputs));
    assert.ok(receipt.outputs && typeof receipt.outputs === "object" && !Array.isArray(receipt.outputs));
    assert.deepEqual(Object.keys(receipt.inputs), [...new Set(inputPaths)].sort(), "Preparation input set changed");
    assert.ok(Object.keys(receipt.outputs).length, "Preparation receipt has no outputs");
    assert.ok(!Object.hasOwn(receipt.outputs, path), "Preparation receipt cannot verify itself");
    assert.deepEqual(await fingerprintPreparationFiles(root, inputPaths), receipt.inputs, "Preparation inputs changed");
    assert.deepEqual(await fingerprintPreparationFiles(root, Object.keys(receipt.outputs)), receipt.outputs,
      "Prepared outputs are missing or changed");
    return receipt;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR" || error instanceof SyntaxError || error.code === "ERR_ASSERTION") return null;
    throw error;
  }
}
