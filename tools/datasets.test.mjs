import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dataReleaseBytes, readDataRelease, releaseInstallAssets, verifyDatasetSource } from "./datasets.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
test("release identities are order independent and installation admits only safe pinned object assets", () => {
  const assets = ["z.webp", "a.pack"].map(filename => ({ filename, bytes: 4, sha256: hash(filename) }));
  const observations = [{ id: "noise" }, { id: "land" }];
  const bytes = dataReleaseBytes("earth", assets, observations);
  assert.deepEqual(bytes, dataReleaseBytes("earth", assets.toReversed(), observations.toReversed()));
  const installed = releaseInstallAssets(bytes, "earth", "/owned-output");
  assert.equal(installed[0].file, "/owned-output/scenes/earth/a.pack");
  assert.match(installed[0].url, /^https:\/\/earth-assets\.lowpoly\.cc\/runtime-assets\/[a-f0-9]{64}\/a.pack$/u);
  assert.throws(() => releaseInstallAssets(bytes, "mars", "/owned-output"), /Incompatible/);
  for (const filename of ["../escape", "/escape", "x/escape", "x?query"]) {
    const invalid = JSON.parse(bytes); invalid.assets[0].filename = filename;
    assert.throws(() => releaseInstallAssets(JSON.stringify(invalid), "earth", "/owned-output"), /invalid runtime asset/);
  }
  assert.throws(() => dataReleaseBytes("earth", [assets[0], assets[0]], []), /repeats/);
});

test("remote release bodies stop at their admission limit and must match the requested hash", async () => {
  const bytes = Buffer.from("a pinned release");
  assert.deepEqual(await readDataRelease(new Response(bytes), hash(bytes)), bytes);
  await assert.rejects(readDataRelease(new Response(bytes), "0".repeat(64)), /identity mismatch/);
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  await assert.rejects(readDataRelease(new Response(stream), "0".repeat(64)), /byte limit/);
  assert.equal(cancelled, true);
});

test("acquire restores a missing pinned snapshot atomically and preserves existing source edits", async t => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-dataset-source-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("pinned source"), destination = join(root, "source.bin");
  const entry = { path: "source.bin", expectedBytes: bytes.length, expectedSha256: hash(bytes) };
  let restored = 0;
  const options = { destination, entry, objectId: "earth", restore: async () => { restored++; return bytes; } };
  await assert.rejects(verifyDatasetSource(options), { code: "ENOENT" });
  await verifyDatasetSource({ ...options, acquire: true });
  assert.deepEqual(await readFile(destination), bytes); assert.equal(restored, 1);
  await verifyDatasetSource({ ...options, acquire: true }); assert.equal(restored, 1);
  await writeFile(destination, "user edit");
  await assert.rejects(verifyDatasetSource({ ...options, acquire: true }));
  assert.equal(await readFile(destination, "utf8"), "user edit"); assert.equal(restored, 1);
  await rm(destination);
  await assert.rejects(verifyDatasetSource({ ...options, acquire: true, restore: async () => Buffer.from("wrong") }));
  await assert.rejects(readFile(destination), { code: "ENOENT" });
});
