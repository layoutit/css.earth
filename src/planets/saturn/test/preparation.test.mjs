import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { PREPARED_SATURN_TITLE } from "../site/preparedTitle.mjs";
import { verifySaturnSourceManifest } from "../tools/source-manifest.mjs";

const execFileAsync = promisify(execFile);

test("prepares Saturn from a complete checked source closure", async () => {
  assert.deepEqual(await verifySaturnSourceManifest(), {
    inputCount: 27,
    generatedIntermediateCount: 1,
    documentCount: 2,
  });
});

test("retains the prepared source encodings through both Saturn material passes", async () => {
  const source = await readFile(
    new URL("../tools/prepare.mjs", import.meta.url),
    "utf8",
  );
  const assets = source.indexOf('["prepare-assets.mjs"]');
  const baseScene = source.indexOf('["prepare-scene.mjs", "--base"]');
  const lenses = source.indexOf('["prepare-lenses.mjs"]');
  const completeScene = source.indexOf('["prepare-scene.mjs"]');
  assert.ok(assets >= 0);
  assert.ok(baseScene > assets);
  assert.ok(lenses > baseScene);
  assert.ok(completeScene > lenses);
  assert.equal(source.indexOf('["prepare-assets.mjs"]', assets + 1), -1);
  assert.equal(source.includes('["optimize-runtime-assets.mjs"]'), false);
});

test("executes every pinned Saturn acquisition verifier", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    fileURLToPath(new URL("../tools/acquire.mjs", import.meta.url)),
    "--verify-only",
  ]);
  assert.match(stdout, /Verified the pinned Saturn moon catalog snapshot/u);
  assert.match(stdout, /Verified the pinned Saturn observation lens sources/u);
  assert.match(stdout, /Verified the pinned Saturn moon surface sources/u);
  assert.match(stdout, /Saturn PSG configuration and raw response match/u);
});

test("prepares the Saturn shell title from its owned source", () => {
  assert.equal(PREPARED_SATURN_TITLE.label, "Saturn");
  assert.equal(PREPARED_SATURN_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.match(PREPARED_SATURN_TITLE.inputSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    PREPARED_SATURN_TITLE.generator,
    "src/planets/saturn/tools/prepare-title.mjs",
  );
  assert.doesNotMatch(PREPARED_SATURN_TITLE.path, /<text|font-family/iu);
});
