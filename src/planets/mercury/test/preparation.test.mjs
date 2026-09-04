import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  renderMarker,
  validateMarkerDescriptor,
} from "../../../navigation/marker-recipe.mjs";
import { PREPARED_MERCURY_TITLE } from "../site/preparedTitle.mjs";
import mercuryNavigationMarker from "../tools/navigation-marker.mjs";
import { verifyMercurySourceManifest } from "../tools/source-manifest.mjs";

const execFileAsync = promisify(execFile);

test("prepares Mercury from a complete checked source closure", async () => {
  assert.deepEqual(await verifyMercurySourceManifest(), {
    inputCount: 22,
    generatedIntermediateCount: 0,
    documentCount: 3,
  });
});

test("executes the pinned Mercury acquisition verifier", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    fileURLToPath(new URL("../tools/acquire.mjs", import.meta.url)),
    "--verify-only",
  ]);
  assert.deepEqual(JSON.parse(stdout), {
    inputCount: 22,
    generatedIntermediateCount: 0,
    documentCount: 3,
  });
});

test("prepares the Mercury shell title from its owned source", () => {
  assert.equal(PREPARED_MERCURY_TITLE.label, "Mercury");
  assert.equal(PREPARED_MERCURY_TITLE.viewBox, "0 0 102.991 35");
  assert.equal(PREPARED_MERCURY_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.match(PREPARED_MERCURY_TITLE.inputSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    PREPARED_MERCURY_TITLE.generator,
    "src/planets/mercury/tools/prepare-title.mjs",
  );
  assert.doesNotMatch(PREPARED_MERCURY_TITLE.path, /<text|font-family/iu);
});

test("prepares the Mercury navigation marker through the generic recipe", async () => {
  assert.equal(validateMarkerDescriptor(mercuryNavigationMarker),
    mercuryNavigationMarker);
  const bytes = await renderMarker(mercuryNavigationMarker, {
    sourcePath: fileURLToPath(new URL(
      "../source/navigation/mercury.jpg",
      import.meta.url,
    )),
    tileSize: 32,
  });
  assert.ok(bytes.byteLength > 1_000);
});
