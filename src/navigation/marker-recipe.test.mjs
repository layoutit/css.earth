import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import marsMarker from "../planets/mars/tools/navigation-marker.mjs";
import { loadMarkerDescriptors } from "../../tools/prepare-navigation.mjs";
import {
  validateMarkerDescriptor,
  validateMarkerSourceBytes,
} from "./marker-recipe.mjs";

test("accepts every object-owned marker recipe", async () => {
  for (const descriptor of await loadMarkerDescriptors()) {
    assert.equal(validateMarkerDescriptor(descriptor), descriptor);
    assert.match(descriptor.source.expectedSha256, /^[0-9a-f]{64}$/u);
    assert.ok(descriptor.source.origin.length > 0);
    assert.ok(descriptor.source.credit.length > 0);
  }
});

test("rejects unsafe recipes and drifted source bytes", async (context) => {
  assert.throws(() => validateMarkerDescriptor({
    ...marsMarker,
    source: { ...marsMarker.source, path: "../outside.jpg" },
  }), /source/u);
  assert.throws(() => validateMarkerDescriptor({
    ...marsMarker,
    operations: [{ type: "planet-specific-filter" }, { type: "png" }],
  }), /operation/u);
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-marker-source-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourcePath = resolve(root, "marker.jpg");
  await writeFile(sourcePath, "drifted");
  await assert.rejects(
    validateMarkerSourceBytes(marsMarker.source, sourcePath),
    /size drifted/u,
  );
});
