// Feature coordinates follow the current raster lane, whose first column is 0 degrees east.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import runtimeDefinition from "../../../../src/objects/charon/prepared/runtime.json" with { type: "json" };
import descriptor from "../../../../src/objects/charon/prepared/features.json" with { type: "json" };
import { parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";

const plan = runtimeDefinition.features;
const bytes = await readFile(new URL("../../../../public/scenes/charon/charon-features.json", import.meta.url));
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "charon");

test("the prepared Charon nomenclature catalogue is pinned by the runtime plan and the provenance descriptor", () => {
  assert.equal(bytes.length, plan.catalog.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
  assert.equal(catalog.features.length, plan.catalog.count);
  assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
  assert.equal(descriptor.mapLeftEdgeLongitudeDeg, 0);
  assert.equal(plan.catalog.count, 16, "15 Gazetteer features plus the published Organa coordinate");
  const organa = catalog.features.find(feature => feature.name === 'Organa');
  assert.ok(organa);
  assert.ok(Math.abs(organa.longitudeDeg-310.9)<1e-10 && Math.abs(organa.latitudeDeg-54.3)<1e-10);
  assert.equal(organa.diameterKm, 0, 'a coordinate is not an invented crater boundary');
  assert.match(organa.type, /Informal/);
  const lon = 310.9 * Math.PI / 180, lat = 54.3 * Math.PI / 180;
  const expected = [Math.sin(lon)*Math.cos(lat), Math.cos(lon)*Math.cos(lat), Math.sin(lat)];
  assert.ok(organa.anchorUnits.every((v, i) => Math.abs(v/plan.meshRadiusUnits-expected[i]!) < 1e-7), 'Organa follows the existing raster sphere axes, without the retired 180-degree texture shift');
  assert.deepEqual(descriptor.skipped, {}, "the same Gazetteer rows are skipped (unchanged recipe)");
});

test("the plan anchors labels to the single body mesh for every surface lens", () => {
  const node = runtimeDefinition.tree.nodes[plan.target];
  assert.match(node.className ?? "", /(^|\s)charon-body(\s|$)/u);
  assert.equal(runtimeDefinition.tree.nodes.filter(n => /(^|\s)charon-body(\s|$)/u.test(n.className ?? "")).length, 1);
  assert.deepEqual(plan.lensIds, ["normal","enhanced-color","elevation","albedo","water-ice","ammonia"]);
  assert.equal(plan.meshRadiusUnits, runtimeDefinition.camera.logicalBodyDiameter / 2 / runtimeDefinition.camera.sceneScale);
  assert.deepEqual(plan.outline, { pieces: 256 });
  assert.equal(plan.policy.minimumZoomShare, 0);
});
