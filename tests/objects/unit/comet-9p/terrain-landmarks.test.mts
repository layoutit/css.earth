import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePreparedObjectRuntime, parsePreparedSurfaceFeatureCatalog } from "../../../../src/renderers/css/dist/index.js";

const root = new URL("../../../../", import.meta.url);
const sourceFile = new URL("src/objects/comet-9p/source/features/landmarks.json", root);
const descriptorFile = new URL("src/objects/comet-9p/prepared/features.json", root);
const runtimeFile = new URL("src/objects/comet-9p/prepared/runtime.json", root);
const catalogFile = new URL("public/scenes/comet-9p/comet-9p-features.json", root);

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

const landmarks = object(JSON.parse(await readFile(sourceFile, "utf8")));
const entries = array(landmarks.entries);
const descriptor = object(JSON.parse(await readFile(descriptorFile, "utf8")));
const runtime = parsePreparedObjectRuntime(JSON.parse(await readFile(runtimeFile, "utf8")));
assert.ok(runtime.features, "Tempel 1 runtime declares its feature plan");
const plan = runtime.features;
const bytes = await readFile(catalogFile);
const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(bytes.toString("utf8")), plan, "comet-9p");

test("Tempel 1 Fig. 2b terrain anchors reproduce the published cylindrical-map axes", () => {
  const digitization = object(landmarks.digitization);
  assert.deepEqual(digitization.longitudeAxisPixels, [59, 922]);
  assert.deepEqual(digitization.longitudeAxisDegreesUnwrapped, [180, 540]);
  assert.deepEqual(digitization.latitudeAxisPixels, [566, 995]);
  assert.deepEqual(digitization.latitudeAxisDegrees, [90, -90]);
  const terrain = entries.slice(1);
  assert.equal(terrain.length, 4);
  for (const entry of terrain) {
    const row = object(entry), pixel = row.digitizedPixel;
    assert.ok(Array.isArray(pixel) && pixel.length === 2 && pixel.every(Number.isFinite));
    const position = object(row.position), x = Number(pixel[0]), y = Number(pixel[1]);
    const longitude = (180 + (x - 59) * 360 / (922 - 59)) % 360;
    const latitude = 90 - (y - 566) * 180 / (995 - 566);
    assert.ok(Math.abs(Number(position.longitudeDeg) - longitude) <= .051, `${row.name} longitude`);
    assert.ok(Math.abs(Number(position.latitudeDeg) - latitude) <= .051, `${row.name} latitude`);
    assert.match(String(row.qualification), /Approximate location from the published map/u);
  }
});

test("Tempel 1 publishes all five source-qualified landmarks with their captions", () => {
  assert.equal(bytes.length, plan.catalog.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.catalog.sha256);
  assert.deepEqual({ url: descriptor.url, bytes: descriptor.bytes, sha256: descriptor.sha256, count: descriptor.count }, plan.catalog);
  assert.deepEqual(catalog.features.map(feature => feature.id), ["83000000", "83000001", "83000002", "83000003", "83000004"]);
  assert.equal(catalog.features.length, 5);
  for (const feature of catalog.features.slice(1)) {
    assert.equal(feature.kind, "region");
    assert.equal(feature.type, "Mapped terrain");
    assert.ok(feature.minimumZoomShare <= .25, "broad terrain regions are discoverable while the whole nucleus fits on screen");
    assert.match(feature.note?.text ?? "", /Approximate location from the published map/u);
    assert.match(feature.note?.url ?? "", /^https:\/\/ntrs\.nasa\.gov\/api\/citations\/20140010174\/downloads\/20140010174\.pdf$/u);
  }
  assert.match(catalog.features[1]!.note!.text, /poorly constrained/u);
  assert.match(catalog.features[2]!.note!.text, /poorly constrained/u);
  assert.doesNotMatch(catalog.features[3]!.note!.text, /poorly constrained/u);
  assert.doesNotMatch(catalog.features[4]!.note!.text, /poorly constrained/u);
});
