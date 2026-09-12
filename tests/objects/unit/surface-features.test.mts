import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { parsePreparedObjectRuntime, parsePreparedSurfaceFeatureCatalog } from "../../../src/renderers/css/dist/index.js";
import { record } from "../../../site/browser-types.mts";
import { mapDirection } from "../../../site/surface-minimap-math.mts";

// Every body that declares a prepared feature catalogue must ship it pinned, anchored on its
// mesh through its own map axes and edge, and validated by the runtime parser. Bodies without
// the capability are simply absent here; no body is allowed a broken one.
const roots = new URL("../../../src/planets/", import.meta.url);
const bodies: string[] = [];
for (const entry of await readdir(roots, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const descriptor = await readFile(new URL(`${entry.name}/prepared/features.json`, roots), "utf8").catch(() => null);
  if (descriptor !== null) bodies.push(entry.name);
}

test("at least Mercury declares a prepared feature catalogue", () => { assert.ok(bodies.includes("mercury")); assert.ok(bodies.length >= 45, bodies.join(",")); });

for (const id of bodies) {
  test(`${id}: the prepared feature catalogue is pinned, anchored on its mesh and parses at the runtime boundary`, async () => {
    const runtime = parsePreparedObjectRuntime(JSON.parse(await readFile(new URL(`${id}/prepared/runtime.json`, roots), "utf8")));
    const plan = runtime.features;
    assert.ok(plan, `${id} runtime declares features`);
    const descriptor: unknown = JSON.parse(await readFile(new URL(`${id}/prepared/features.json`, roots), "utf8"));
    assert.ok(record(descriptor));
    assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
    const bytes = await readFile(new URL(`../../../public/scenes/${id}/${plan.catalog.url.split("/").at(-1)}`, import.meta.url));
    assert.equal(bytes.length, plan.catalog.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
    const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, id);
    assert.equal(catalog.features.length, plan.catalog.count);
    const node = runtime.tree.nodes[plan.target];
    assert.match(node?.className ?? "", new RegExp(`(^|\\s)${id}-body(\\s|$)`, "u"));
    const edge = descriptor.mapLeftEdgeLongitudeDeg;
    assert.ok(edge === 0 || edge === 180, `${id} declares a verified map edge`);
    const map: unknown = JSON.parse(await readFile(new URL(`${id}/source/presentation/surface-map.json`, roots), "utf8"));
    assert.ok(record(map));
    const axes = { prime: map.prime as [number, number, number], east: map.east as [number, number, number], north: map.north as [number, number, number] };
    // Shape-model bodies anchor on their picking mesh: the anchor keeps the map direction and its radius lies within the mesh.
    const objectDescriptor: unknown = JSON.parse(await readFile(new URL(`${id}/object.json`, roots), "utf8"));
    assert.ok(record(objectDescriptor) && record(objectDescriptor.properties) && record(objectDescriptor.properties.recipe) && record(objectDescriptor.properties.recipe.shape));
    const shaped = objectDescriptor.properties.recipe.shape.kind === "radial-terrain";
    const hit = (runtime as unknown as { surfaceHit?: { target: number; triangles: number[][][] } }).surfaceHit;
    const band = plan.surfaceRadiusUnits;
    if (shaped) { assert.ok(hit, `${id} shape body carries a hit mesh`); assert.equal(plan.target, hit!.target); assert.ok(band, `${id} declares its radius band`); }
    else assert.equal(band, undefined, `${id} sphere declares no radius band`);
    const ids = new Set<string>();
    let previous = Number.POSITIVE_INFINITY;
    for (const feature of catalog.features) {
      assert.ok(!ids.has(feature.id), `${id}: ${feature.id} repeats`); ids.add(feature.id);
      assert.ok(feature.longitudeDeg >= 0 && feature.longitudeDeg < 360 && Math.abs(feature.latitudeDeg) <= 90, feature.name);
      const u = (((feature.longitudeDeg - Number(edge)) % 360) + 360) % 360 / 360;
      const expected = mapDirection(u, (90 - feature.latitudeDeg) / 180, axes);
      if (shaped) {
        const length = Math.hypot(...feature.anchorUnits);
        assert.ok(expected.every((n, i) => Math.abs(n * length - feature.anchorUnits[i]) < 1e-2), `${id}: ${feature.name} anchor follows the body frame`);
        assert.ok(length >= band!.minimum * (1 - 1e-3) && length <= band!.maximum * (1 + 1e-3), `${id}: ${feature.name} anchor lies within the hit mesh band`);
      } else assert.ok(expected.every((n, i) => Math.abs(n * plan.meshRadiusUnits - feature.anchorUnits[i]) < 1e-2), `${id}: ${feature.name} anchor follows the map axes`);
      assert.ok(feature.diameterKm <= previous, `${id}: prepared priority is diameter order`);
      previous = feature.diameterKm;
      assert.ok(feature.searchNames.length > 0 && feature.origin.length >= 0, feature.name);
    }
  });
}
