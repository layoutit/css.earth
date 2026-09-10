import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprintPreparationFiles, readPreparationReceipt, writePreparationReceipt } from "./preparation-cache.mts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "cssearth-preparation-cache-"));
  try {
    await writeFile(join(root, "input"), "source");
    await writeFile(join(root, "output"), "prepared");
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const options = (root: string) => ({ root, path: "receipt.json", inputPaths: ["input"] });
async function seal(root: string) {
  return writePreparationReceipt({ root, path: "receipt.json", inputs: await fingerprintPreparationFiles(root, ["input"]),
    outputPaths: ["output"], metadata: { width: 8, height: 16 } });
}

test("verified preparation records are deterministic and retain metadata", async () => fixture(async root => {
  const first = await seal(root), bytes = await readFile(join(root, "receipt.json"), "utf8");
  assert.deepEqual(await readPreparationReceipt(options(root)), first);
  await seal(root);
  assert.equal(await readFile(join(root, "receipt.json"), "utf8"), bytes);
}));
test("changed or missing source, outputs and input sets invalidate preparation", async () => fixture(async root => {
  await seal(root);
  assert.equal(await readPreparationReceipt({ ...options(root), inputPaths: ["input", "other"] }), null);
  await writeFile(join(root, "output"), "tampered");
  assert.equal(await readPreparationReceipt(options(root)), null);
  await seal(root);
  await writeFile(join(root, "input"), "changed");
  assert.equal(await readPreparationReceipt(options(root)), null);
  await seal(root);
  await rm(join(root, "output"));
  assert.equal(await readPreparationReceipt(options(root)), null);
}));
test("a source edit during generation cannot create a valid cache entry", async () => fixture(async root => {
  const inputs = await fingerprintPreparationFiles(root, ["input"]);
  await writeFile(join(root, "input"), "changed");
  await assert.rejects(writePreparationReceipt({ root, path: "receipt.json", inputs, outputPaths: ["output"] }),
    /inputs changed during generation/);
  assert.equal(await readPreparationReceipt(options(root)), null);
}));
test("cache receipts reject path traversal and source links outside the project", async () => fixture(async root => {
  await assert.rejects(fingerprintPreparationFiles(root, ["../outside"]), /Unsafe preparation path/);
  await symlink(import.meta.filename, join(root, "escaped"));
  await assert.rejects(fingerprintPreparationFiles(root, ["escaped"]), /link escaped/);
}));
