// Draft: keeps the unchanged Triton nomenclature recipe proven on the generic lane
// (same catalogue count and map edge as the retired terrestrial lane). Modelled on tests/objects/unit/pluto/features.test.mts.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import runtimeDefinition from "../../../../src/planets/triton/prepared/runtime.json" with { type: "json" };
import descriptor from "../../../../src/planets/triton/prepared/features.json" with { type: "json" };
import { parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";

const plan = runtimeDefinition.features;
const bytes = await readFile(new URL("../../../../public/scenes/triton/triton-features.json", import.meta.url));
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "triton");

test("the prepared Triton nomenclature catalogue is pinned by the runtime plan and the provenance descriptor", () => {
  assert.equal(bytes.length, plan.catalog.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
  assert.equal(catalog.features.length, plan.catalog.count);
  assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
  assert.equal(descriptor.mapLeftEdgeLongitudeDeg, 180);
  assert.equal(plan.catalog.count, 4, "the unchanged features recipe keeps the terrestrial-lane count");
  assert.deepEqual(descriptor.skipped, {"diameter:AA":{"count":8,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:CB":{"count":10,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:MA":{"count":7,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:PM":{"count":3,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:DO":{"count":1,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:RE":{"count":3,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:SU":{"count":11,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:PU":{"count":2,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:PE":{"count":5,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:FO":{"count":3,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:PL":{"count":4,"reason":"Features without a published diameter cannot be ranked or outlined."},"diameter:CA":{"count":2,"reason":"Features without a published diameter cannot be ranked or outlined."}}, "the same Gazetteer rows are skipped (unchanged recipe)");
});

test("the plan anchors labels to the single body mesh for every surface lens", () => {
  const node = runtimeDefinition.tree.nodes[plan.target];
  assert.match(node.className ?? "", /(^|\s)triton-body(\s|$)/u);
  assert.equal(runtimeDefinition.tree.nodes.filter(n => /(^|\s)triton-body(\s|$)/u.test(n.className ?? "")).length, 1);
  assert.deepEqual(plan.lensIds, ["normal","enhanced"]);
  assert.equal(plan.meshRadiusUnits, runtimeDefinition.camera.logicalBodyDiameter / 2 / runtimeDefinition.camera.sceneScale);
  assert.deepEqual(plan.outline, { pieces: 256 });
  assert.equal(plan.policy.minimumZoomShare, 1);
});
