import assert from "node:assert/strict";
import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { parsePreparedObjectRuntime, parsePreparedSurfaceFeatureCatalog } from "../../../src/renderers/css/dist/index.js";
import { isRecord } from "@cssearth/core";
import { mapDirection } from "../../../site/surface-minimap-math.mts";

// Every body that declares a prepared feature catalogue must ship it pinned, anchored on its
// mesh through its own map axes and edge, and validated by the runtime parser. Bodies without
// the capability are simply absent here; no body is allowed a broken one.
const roots = new URL("../../../src/objects/", import.meta.url);
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
    assert.ok(isRecord(descriptor));
    assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
    const bytes = await readFile(new URL(`../../../public/scenes/${id}/${plan.catalog.url.split("/").at(-1)}`, import.meta.url));
    assert.equal(bytes.length, plan.catalog.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
    const rawCatalog: unknown = JSON.parse(bytes.toString("utf8"));
    const baseCatalog = parsePreparedSurfaceFeatureCatalog(rawCatalog, plan, id);
    assert.equal(baseCatalog.features.length, plan.catalog.count);
    const catalogs = [baseCatalog];
    if (plan.selection) {
      assert.deepEqual(descriptor.selection, plan.selection);
      for (const bank of plan.selection.banks) {
        const bankBytes = await readFile(new URL(`../../../public/scenes/${id}/${bank.url.split("/").at(-1)}`, import.meta.url));
        assert.equal(bankBytes.length, bank.bytes);
        assert.equal(createHash("sha256").update(bankBytes).digest("hex"), bank.sha256);
        catalogs.push(parsePreparedSurfaceFeatureCatalog(JSON.parse(bankBytes.toString("utf8")), plan, id, bank));
      }
    }
    const catalog = { ...baseCatalog, features: catalogs.flatMap(part => part.features) };
    assert.equal(catalog.features.length, plan.catalog.count + (plan.selection?.count ?? 0));
    if (descriptor.totalCount !== undefined) assert.equal(descriptor.totalCount, catalog.features.length);
    const node = runtime.tree.nodes[plan.target];
    assert.match(node?.className ?? "", new RegExp(`(^|\\s)${id}-body(\\s|$)`, "u"));
    const edge = descriptor.mapLeftEdgeLongitudeDeg;
    assert.ok(edge === 0 || edge === 180, `${id} declares a verified map edge`);
    const map: unknown = JSON.parse(await readFile(new URL(`${id}/source/presentation/surface-map.json`, roots), "utf8"));
    assert.ok(isRecord(map));
    const axes = { prime: map.prime as [number, number, number], east: map.east as [number, number, number], north: map.north as [number, number, number] };
    // Shape-model bodies anchor on their picking mesh: the anchor keeps the map direction and its radius lies within the mesh.
    const objectDescriptor: unknown = JSON.parse(await readFile(new URL(`${id}/object.json`, roots), "utf8"));
    assert.ok(isRecord(objectDescriptor) && isRecord(objectDescriptor.properties) && isRecord(objectDescriptor.properties.recipe) && isRecord(objectDescriptor.properties.recipe.shape));
    const shaped = objectDescriptor.properties.recipe.shape.kind === "radial-terrain";
    const hit = (runtime as unknown as { surfaceHit?: { target: number; triangles: number[][][] } }).surfaceHit;
    const band = plan.surfaceRadiusUnits, ellipsoid = plan.surfaceEllipsoidUnits;
    // An oblate body on the paged lane anchors on its rendered leaf surface around the authored reference ellipsoid.
    assert.ok(Array.isArray(objectDescriptor.properties.recipe.sources));
    const paged = objectDescriptor.properties.recipe.sources.some((source: unknown) => isRecord(source) && source.id === "paged-ellipsoid");
    if (shaped) { assert.ok(hit, `${id} shape body carries a hit mesh`); assert.equal(plan.target, hit!.target); assert.ok(band, `${id} declares its radius band`); assert.equal(ellipsoid, undefined); }
    else if (paged && objectDescriptor.properties.recipe.shape.kind === "ellipsoid") {
      assert.ok(ellipsoid, `${id} declares its ellipsoid band`); assert.equal(band, undefined);
      const shape = objectDescriptor.properties.recipe.shape;
      assert.equal(ellipsoid!.equatorial, plan.meshRadiusUnits);
      assert.ok(Math.abs(ellipsoid!.polar - plan.meshRadiusUnits * Number(shape.polarRadiusKm) / Number(shape.radiusKm)) < 1e-6, `${id} polar semi-axis follows the authored shape`);
      assert.deepEqual(ellipsoid!.north, axes.north);
    } else { assert.equal(band, undefined, `${id} sphere declares no radius band`); assert.equal(ellipsoid, undefined); }
    const ids = new Set<string>();
    let previous = Number.POSITIVE_INFINITY, noted = 0;
    for (const feature of catalog.features) {
      assert.ok(!ids.has(feature.id), `${id}: ${feature.id} repeats`); ids.add(feature.id);
      assert.ok(feature.longitudeDeg >= 0 && feature.longitudeDeg < 360 && Math.abs(feature.latitudeDeg) <= 90, feature.name);
      const u = (((feature.longitudeDeg - Number(edge)) % 360) + 360) % 360 / 360;
      const expected = mapDirection(u, (90 - feature.latitudeDeg) / 180, axes);
      if (ellipsoid) {
        // Longitude is exact on the rendered leaf; latitude may shift by the leaf homography; the radius stays in the declared band.
        const anchor = feature.anchorUnits, up = anchor[0] * axes.north[0] + anchor[1] * axes.north[1] + anchor[2] * axes.north[2];
        const share = Math.sqrt(Math.max(0, anchor[0] ** 2 + anchor[1] ** 2 + anchor[2] ** 2 - up * up) / ellipsoid.equatorial ** 2 + up * up / ellipsoid.polar ** 2);
        assert.ok(share >= ellipsoid.minimumShare * (1 - 1e-3) && share <= ellipsoid.maximumShare * (1 + 1e-3), `${id}: ${feature.name} anchor lies in the ellipsoid band`);
        const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
        const longitude: number = ((Math.atan2(dot(anchor, axes.east), dot(anchor, axes.prime)) * 180 / Math.PI + Number(edge)) % 360 + 360) % 360;
        const separation: number = Math.abs(((longitude - feature.longitudeDeg) % 360 + 540) % 360 - 180) * Math.cos(feature.latitudeDeg * Math.PI / 180);
        assert.ok(separation < 0.05, `${id}: ${feature.name} anchor keeps its longitude (${longitude.toFixed(3)} vs ${feature.longitudeDeg})`);
        assert.ok(expected.every((n, i) => Math.abs(n - feature.normal[i]!) < 1e-5), `${id}: ${feature.name} normal is the geodetic normal`);
      } else if (shaped) {
        const length = Math.hypot(...feature.anchorUnits);
        assert.ok(expected.every((n, i) => Math.abs(n * length - feature.anchorUnits[i]) < 1e-2), `${id}: ${feature.name} anchor follows the body frame`);
        assert.ok(length >= band!.minimum * (1 - 1e-3) && length <= band!.maximum * (1 + 1e-3), `${id}: ${feature.name} anchor lies within the hit mesh band`);
      } else assert.ok(expected.every((n, i) => Math.abs(n * plan.meshRadiusUnits - feature.anchorUnits[i]) < 1e-2), `${id}: ${feature.name} anchor follows the map axes`);
      // Spacecraft sites rank as 20 km features and Natural Earth names by population or scale rank; the Gazetteer names around them keep diameter order.
      const site = ["LS", "IM", "SS", "RT"].includes(feature.code);
      if (site) assert.equal(feature.diameterKm, 0, `${id}: ${feature.name} site is unsized`);
      // Unsized Gazetteer names (diameter 0) are searchOnly since the default label recipe and carry no rank.
      else if (id !== "earth" && feature.diameterKm > 0) { assert.ok(feature.diameterKm <= previous, `${id}: prepared priority is diameter order`); previous = feature.diameterKm; }
      assert.ok(feature.minimumZoomShare >= 0 && feature.minimumZoomShare <= 1, `${id}: ${feature.name} discovery tier`);
      assert.ok(feature.searchNames.length > 0, feature.name);
      // A caption note is a short Wikipedia lead summary pinned with its article; the pinned document is the only source.
      if (feature.note) { assert.ok(feature.note.text.length <= 321 && /^https?:\/\//u.test(feature.note.url), `${id}: ${feature.name} note`); if (feature.note.credit.startsWith("Wikipedia")) noted++; }
    }
    assert.ok(isRecord(rawCatalog));
    if (rawCatalog.notes !== undefined) {
      assert.ok(isRecord(rawCatalog.notes) && rawCatalog.notes.count === noted && rawCatalog.notes.license === "CC BY-SA 4.0", `${id}: notes provenance`);
      const pinned: unknown = JSON.parse(await readFile(new URL(`${id}/source/features/notes.json`, roots), "utf8"));
      assert.ok(isRecord(pinned) && Array.isArray(pinned.entries), `${id}: pinned notes`);
      const byId = new Map((pinned.entries as { id: string; title: string; extract: string; url: string }[]).map(entry => [entry.id, entry]));
      for (const feature of catalog.features) if (feature.note) if (feature.note.credit.startsWith("Wikipedia")) assert.deepEqual(feature.note, { text: byId.get(feature.id)!.extract, title: byId.get(feature.id)!.title, url: byId.get(feature.id)!.url, credit: "Wikipedia, CC BY-SA 4.0" }, `${id}: ${feature.name} note matches its pin`);
    } else assert.equal(noted, 0, `${id}: notes without a pinned document`);
  });
}
