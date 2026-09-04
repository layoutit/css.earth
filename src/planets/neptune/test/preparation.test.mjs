import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { PREPARED_NEPTUNE_TITLE } from "../site/preparedTitle.mjs";
import { verifyNeptuneSourceManifest } from "../tools/source-manifest.mjs";

const execFileAsync = promisify(execFile);

test("prepares Neptune from a complete checked source closure", async () => {
  assert.deepEqual(await verifyNeptuneSourceManifest(), {
    inputCount: 20,
    generatedIntermediateCount: 0,
    documentCount: 2,
  });
});

test("executes the pinned Neptune acquisition verifier", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    fileURLToPath(new URL("../tools/acquire.mjs", import.meta.url)),
    "--verify-only",
  ]);
  assert.match(stdout, /Verified the pinned Neptune source closure \(20 inputs\)/u);
});

test("prepares the Neptune shell title from its owned source", () => {
  assert.equal(PREPARED_NEPTUNE_TITLE.label, "Neptune");
  assert.equal(PREPARED_NEPTUNE_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.match(PREPARED_NEPTUNE_TITLE.inputSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    PREPARED_NEPTUNE_TITLE.generator,
    "src/planets/neptune/tools/prepare-title.mjs",
  );
  assert.doesNotMatch(PREPARED_NEPTUNE_TITLE.path, /<text|font-family/iu);
});
