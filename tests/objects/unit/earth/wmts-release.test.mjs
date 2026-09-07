import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releaseFiles, verifyLocalPack, publishedPackMatches, WMTS_CACHE_CONTROL } from "../../../../tools/objects/geographic-pages/wmts-release.mjs";
import { verifyWmtsListing } from "../../../../tools/objects/geographic-pages/operations/wmts-s3-publish.mjs";

const bytes = Buffer.from("verified prepared pack");
const file = { filename: "8-86-154.pack", bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex") };
const release = { schema: "cssearth-global-wmts-release@1", version: "1111111111111111", bytes: bytes.length, files: [file] };

test("S3 listing accepts rclone hash names and rejects incomplete or conflicting releases", () => {
  const asset = { ...file, md5: createHash("md5").update(bytes).digest("hex") };
  const entry = { Path: asset.filename, Size: asset.bytes, Hashes: { md5: asset.md5 } };
  verifyWmtsListing([asset], [entry]);
  verifyWmtsListing([asset], [{ ...entry, Hashes: { MD5: asset.md5 } }]);
  for (const listing of [[], [entry, entry], [{ ...entry, Size: asset.bytes + 1 }],
    [{ ...entry, Hashes: { md5: "wrong" } }]]) assert.throws(() => verifyWmtsListing([asset], listing));
});

test("release inventory rejects path escapes, duplicates and inconsistent totals", () => {
  assert.deepEqual(releaseFiles(release), [file]);
  for (const bad of [
    { ...release, files: [{ ...file, filename: "../8-86-154.pack" }] },
    { ...release, files: [{ ...file, filename: "8-256-154.pack" }] },
    { ...release, files: [file, file], bytes: bytes.length * 2 },
    { ...release, bytes: bytes.length + 1 },
  ]) assert.throws(() => releaseFiles(bad));
  assert.throws(() => releaseFiles(release, true), /sample packs/u);
});

test("publication verifies exact local bytes and refuses conflicting immutable objects", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wmts-release-"));
  try {
    await writeFile(join(dir, file.filename), bytes);
    const asset = await verifyLocalPack(dir, file);
    const headers = { "content-length": file.bytes, etag: `"${asset.md5}"`,
      "content-type": "application/octet-stream", "cache-control": WMTS_CACHE_CONTROL };
    const matches = (status, changes = {}) => publishedPackMatches("https://example.com/pack", asset,
      { fetcher: async () => new Response(null, { status, headers: { ...headers, ...changes } }) });
    assert.equal(await matches(404), false);
    assert.equal(await matches(200), true);
    await assert.rejects(matches(403), /differs/u);
    await assert.rejects(matches(200, { etag: '"wrong"' }), /differs/u);
    await assert.rejects(matches(200, { "content-encoding": "gzip" }), /differs/u);
    await writeFile(join(dir, file.filename), Buffer.alloc(bytes.length));
    await assert.rejects(verifyLocalPack(dir, file), /hash mismatch/u);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
