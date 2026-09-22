import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import runtimeDefinition from "../../../../src/objects/mercury/prepared/runtime.json" with { type: "json" };
import descriptor from "../../../../src/objects/mercury/prepared/features.json" with { type: "json" };
import surfaceMap from "../../../../src/objects/mercury/source/presentation/surface-map.json" with { type: "json" };
import { parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";
import { mapDirection } from "../../../../site/surface-minimap-math.mts";

const plan = runtimeDefinition.features;
const bytes = await readFile(new URL("../../../../public/scenes/mercury/mercury-features.json", import.meta.url));
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "mercury");
const byName = (name: string) => { const feature = catalog.features.find(feature => feature.name === name); assert.ok(feature, name); return feature; };

test("the plan anchors labels to the spinning body mesh for the surface lenses only", () => {
  const node = runtimeDefinition.tree.nodes[plan.target];
  assert.match(node.className ?? "", /(^|\s)mercury-body(\s|$)/u);
  assert.equal(runtimeDefinition.motion[0].target, plan.target, "labels ride the same node as the prepared spin");
  assert.deepEqual(plan.lensIds, ["normal", "enhanced", "topography"]);
  // The mesh is authored at 230 units and the camera's scene scale (0.02) renders it at the logical body diameter.
  assert.equal(plan.meshRadiusUnits, runtimeDefinition.camera.logicalBodyDiameter / 2 / runtimeDefinition.camera.sceneScale);
  assert.deepEqual(plan.outline, { pieces: 256 });
  assert.equal(plan.policy.minimumZoomShare, 0, "the policy gate is open; every name carries its own discovery tier");
  assert.ok(catalog.features.some(feature => feature.minimumZoomShare === 0) && catalog.features.some(feature => feature.minimumZoomShare >= 0.99), "tiers span the zoom range");
});

test("every feature is an IAU-adopted centre point on the body sphere with prepared priority and caption facts", () => {
  const axes = { prime: surfaceMap.prime as [number, number, number], east: surfaceMap.east as [number, number, number], north: surfaceMap.north as [number, number, number] };
  let previous = Number.POSITIVE_INFINITY;
  for (const feature of catalog.features) {
    assert.ok(Math.abs(Math.hypot(...feature.anchorUnits) - plan.meshRadiusUnits) < 1e-2, feature.name);
    // Independent check through the shell minimap's own map convention.
    const u = (((feature.longitudeDeg - descriptor.mapLeftEdgeLongitudeDeg) % 360) + 360) % 360 / 360;
    const expected = mapDirection(u, (90 - feature.latitudeDeg) / 180, axes);
    assert.ok(expected.every((n, i) => Math.abs(n * plan.meshRadiusUnits - feature.anchorUnits[i]) < 1e-2), feature.name);
    assert.ok(Math.abs(feature.radiusUnits - feature.diameterKm / 2 * plan.meshRadiusUnits / 2439.7) < 1e-3, feature.name);
    if (feature.outline.kind === "circle") {
      const theta = Math.min(Math.PI / 2, feature.radiusUnits / plan.meshRadiusUnits);
      assert.ok(Math.abs(Math.hypot(...feature.outline.center) - plan.meshRadiusUnits * Math.cos(theta)) < 0.01 && Math.abs(Math.hypot(...feature.outline.east) - plan.meshRadiusUnits * Math.sin(theta)) < 0.01, feature.name);
      assert.equal(feature.kind, "point", feature.name);
    } else if (feature.outline.kind === "box") {
      assert.ok(feature.outline.points.length === plan.outline.pieces && feature.outline.points.every(point => Math.abs(Math.hypot(...point) - plan.meshRadiusUnits) < 0.01), feature.name);
    } else {
      assert.ok(feature.outline.paths.reduce((sum, path) => sum + path.length, 0) <= plan.outline.pieces && feature.outline.paths.every(path => path.every(point => Math.abs(Math.hypot(...point) - plan.meshRadiusUnits) < 0.01)), feature.name);
    }
    // Spacecraft sites rank as 20 km features; the named features around them keep diameter order.
    if (['LS', 'IM', 'SS', 'RT'].includes(feature.code)) continue;
    assert.ok(feature.diameterKm <= previous, "prepared priority is diameter order");
    previous = feature.diameterKm;
    assert.ok(feature.origin.length > 0 && /^\d{4}-\d{2}-\d{2}$/u.test(feature.approved), feature.name);
    assert.notEqual(feature.code, "AL");
  }
});

test("landmark features keep their Gazetteer coordinates and label kinds", () => {
  const caloris = byName("Caloris Planitia");
  assert.equal(caloris.kind, "region");
  assert.ok(Math.abs(caloris.longitudeDeg - 161.9848) < 1e-4 && Math.abs(caloris.latitudeDeg - 31.6525) < 1e-4);
  assert.equal(caloris.diameterKm, 1500);
  assert.equal(caloris.outline.kind, "box", "planitiae trace their published extent, not a nominal circle");
  const rembrandt = byName("Rembrandt");
  assert.equal(rembrandt.kind, "point");
  assert.equal(rembrandt.outline.kind, "circle", "craters trace their rim diameter");
  assert.ok(Math.abs(rembrandt.longitudeDeg - 87.8657) < 1e-4 && Math.abs(rembrandt.latitudeDeg + 32.8916) < 1e-4);
  assert.equal(byName("Enterprise Rupes").kind, "linear");
  assert.equal(byName("Enterprise Rupes").outline.kind, "trace", "rupes trace their mapped scarp segments");
  assert.deepEqual({ traces: descriptor.traces.traces, matched: descriptor.traces.matched, unmatched: descriptor.traces.unmatched.length }, { traces: 18451, matched: 66, unmatched: 9 });
  assert.equal(byName("Hokusai").type, "Crater");
  assert.equal(catalog.features[0].name, "Borealis Planitia");
  assert.equal(catalog.source, "IAU/USGS Gazetteer of Planetary Nomenclature, Mercury centre points");
  assert.equal(catalog.snapshotDate, "2026-09-11");
});
