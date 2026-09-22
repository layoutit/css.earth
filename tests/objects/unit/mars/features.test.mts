// Draft: keeps the unchanged Mars nomenclature recipe proven on the generic lane.
// Modelled on tests/objects/unit/mercury/features.test.mts (without the tectonic traces).
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import runtimeDefinition from "../../../../src/objects/mars/prepared/runtime.json" with { type: "json" };
import descriptor from "../../../../src/objects/mars/prepared/features.json" with { type: "json" };
import { parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";

const plan = runtimeDefinition.features;
const bytes = await readFile(new URL("../../../../public/scenes/mars/mars-features.json", import.meta.url));
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "mars");

test("the plan anchors labels to the body mesh for the three surface lenses", () => {
  const node = runtimeDefinition.tree.nodes[plan.target];
  assert.match(node.className ?? "", /(^|\s)mars-body(\s|$)/u);
  assert.deepEqual(plan.lensIds, ["normal", "elevation", "thermal"]);
  assert.equal(plan.meshRadiusUnits, runtimeDefinition.camera.logicalBodyDiameter / 2 / runtimeDefinition.camera.sceneScale);
  assert.deepEqual(plan.outline, { pieces: 256 });
  assert.equal(plan.policy.minimumZoomShare, 0, "the policy gate is open; every name carries its own discovery tier");
  assert.ok(catalog.features.some(feature => feature.minimumZoomShare === 0) && catalog.features.some(feature => feature.minimumZoomShare >= 0.99), "tiers span the zoom range");
});
