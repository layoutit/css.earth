import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  LICENSE_FILE,
  OWNED_FILES,
  PROVENANCE_FILE,
  VENDOR_DIR,
  buildManifest,
  listVendoredFiles,
  manifestProblems,
  readProvenance,
} from "./sync-astronomy.mjs";

const REQUIRED_MODULES = [
  "index.ts",
  "frames.ts",
  "solarSystem.ts",
  "vsop87.ts",
  "elp2000.ts",
  "data/vsop87a.data.ts",
  "data/elp2000.data.ts",
  "__fixtures__/horizons.ts",
];

test("every vendored astronomy file matches its recorded SHA-256", async () => {
  assert.deepEqual(await manifestProblems(VENDOR_DIR), []);
});

test("the manifest lists the whole package, not a subset", async () => {
  const { files } = await readProvenance(VENDOR_DIR);
  for (const path of REQUIRED_MODULES) {
    assert.ok(path in files, `${path} is vendored`);
  }
  const testFiles = Object.keys(files).filter((path) => path.endsWith(".test.ts"));
  assert.ok(testFiles.length >= 10, `upstream tests are carried across (${testFiles.length})`);
  assert.equal(Object.keys(files).length, (await listVendoredFiles(VENDOR_DIR)).length);
});

test("the manifest is derived from disk, so a local edit would change it", async () => {
  const { files, fileCount, byteCount } = await readProvenance(VENDOR_DIR);
  const rebuilt = await buildManifest(VENDOR_DIR);
  assert.deepEqual(rebuilt, files);
  assert.equal(fileCount, Object.keys(rebuilt).length);
  assert.equal(
    byteCount,
    Object.values(rebuilt).reduce((sum, entry) => sum + entry.bytes, 0),
  );
});

test("provenance records the upstream commit and the open import question", async () => {
  const provenance = await readProvenance(VENDOR_DIR);
  assert.equal(provenance.package, "@galaxio/astronomy");
  assert.equal(provenance.license, "MIT");
  assert.match(provenance.subtreeCommit, /^[0-9a-f]{40}$/);
  assert.match(provenance.headCommit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.upstreamDirty, false);
  assert.ok(Number.isFinite(Date.parse(provenance.syncedAt)));
  assert.equal(provenance.transform, "none: every file is byte-identical to upstream");
  assert.match(provenance.importNote, /Node does not/);
  assert.match(provenance.importNote, /specifier rewrite|resolver hook|build step/);
});

test("the MIT licence and attribution travel with the copy", async () => {
  const license = await readFile(join(VENDOR_DIR, LICENSE_FILE), "utf8");
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Juan Cruz Fortunatti/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  for (const owned of OWNED_FILES) {
    assert.ok(existsSync(join(VENDOR_DIR, owned)), `${owned} exists`);
  }
  const notice = await readFile(join(VENDOR_DIR, "NOTICE.md"), "utf8");
  assert.match(notice, /MIT License/);
  assert.match(notice, new RegExp(LICENSE_FILE.replaceAll(".", "\\.")));
});

test("the vendored tree is verbatim upstream: specifiers are untouched", async () => {
  const index = await readFile(join(VENDOR_DIR, "index.ts"), "utf8");
  assert.match(index, /export \* from '\.\/frames\.js'/);
  assert.doesNotMatch(index, /\.ts'/);
  assert.ok(!existsSync(join(VENDOR_DIR, "package.json")), "no package manifest is fabricated");
  assert.equal(PROVENANCE_FILE, "upstream.json");
});
