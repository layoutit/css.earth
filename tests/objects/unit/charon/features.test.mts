// Draft: keeps the unchanged Charon nomenclature recipe proven on the generic lane
// (same catalogue count and map edge as the retired terrestrial lane). Modelled on tests/objects/unit/pluto/features.test.mts.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import runtimeDefinition from "../../../../src/planets/charon/prepared/runtime.json" with { type: "json" };
import descriptor from "../../../../src/planets/charon/prepared/features.json" with { type: "json" };
import { parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";

const plan = runtimeDefinition.features;
const bytes = await readFile(new URL("../../../../public/scenes/charon/charon-features.json", import.meta.url));
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "charon");

test("the prepared Charon nomenclature catalogue is pinned by the runtime plan and the provenance descriptor", () => {
  assert.equal(bytes.length, plan.catalog.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
  assert.equal(catalog.features.length, plan.catalog.count);
  assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
  assert.equal(descriptor.mapLeftEdgeLongitudeDeg, 180);
  assert.equal(plan.catalog.count, 15, "the unchanged features recipe keeps the terrestrial-lane count");
  assert.deepEqual(descriptor.skipped, {}, "the same Gazetteer rows are skipped (unchanged recipe)");
});

test("the plan anchors labels to the single body mesh for every surface lens", () => {
  const node = runtimeDefinition.tree.nodes[plan.target];
  assert.match(node.className ?? "", /(^|\s)charon-body(\s|$)/u);
  assert.equal(runtimeDefinition.tree.nodes.filter(n => /(^|\s)charon-body(\s|$)/u.test(n.className ?? "")).length, 1);
  assert.deepEqual(plan.lensIds, ["normal","enhanced-color","elevation","albedo"]);
  assert.equal(plan.meshRadiusUnits, runtimeDefinition.camera.logicalBodyDiameter / 2 / runtimeDefinition.camera.sceneScale);
  assert.deepEqual(plan.outline, { pieces: 256 });
  assert.equal(plan.policy.minimumZoomShare, 1);
});
