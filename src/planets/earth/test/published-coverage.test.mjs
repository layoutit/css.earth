import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readCityFixture } from "./city-fixture.mjs";
import { assembleCityCoveragePlan, readPublishedCoverage, publishedCoveragePath } from "../tools/city/published-coverage.mjs";
import { readWorldCoverCatalog } from "../tools/city/worldcover-catalog.mjs";
import { cityCoverageRoots, planCityCoverage } from "../tools/city/plan-coverage.mjs";
import { expectedGlobalCityFace, validateGlobalCityFaceReceipt } from "../tools/city/global-face-receipts.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";

const snapshot = await readPublishedCoverage();
const fixture = await readCityFixture();

test("published coverage is pinned and matches the reproducible source-window plans", async () => {
  const bytes = await readFile(publishedCoveragePath);
  const manifest = JSON.parse(await readFile(new URL("../source/manifest.json", import.meta.url)));
  const pin = manifest.documents.find(entry => entry.path === "city/published-coverage.json.gz");
  assert.equal(bytes.length, pin.expectedBytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.expectedSha256);
  const source = JSON.parse(await readFile(new URL("../source/city/manifest.json", import.meta.url)));
  const { pin: catalog, entries } = await readWorldCoverCatalog();
  const expected = new Map(cityCoverageRoots().map(face => {
    const value = expectedGlobalCityFace(face, [...planCityCoverage(PREPARED_EARTH_SCENE, entries, [face])]);
    return [value.face.key, value];
  }).filter(([, value]) => value.jobs));
  assert.equal(snapshot.expectedFaces, expected.size);
  for (const receipt of snapshot.faces) {
    validateGlobalCityFaceReceipt(receipt, expected.get(receipt.face.key), source, catalog.expectedSha256);
  }
});

test("preparation merges every published region with the local proof inputs", () => {
  const plan = assembleCityCoveragePlan(fixture.plan, snapshot);
  const roots = new Map(plan.roots.map(head => [head.key, head]));
  for (const receipt of snapshot.faces) assert.deepEqual(roots.get(receipt.face.key), receipt.heads[0]);
  for (const head of fixture.plan.roots) assert.ok(roots.has(head.key));
  assert.equal(roots.size, plan.roots.length);
  for (const field of ["poolSize", "maximumDecodedBytes", "index", "initialLayer"]) {
    assert.deepEqual(plan[field], fixture.plan[field]);
  }
  // A later whole-region publication must replace the same region's crop.
  const published = snapshot.faces[0].heads[0];
  const cropped = { ...published, directory: fixture.plan.roots[0].directory };
  const merged = assembleCityCoveragePlan({ ...fixture.plan, roots: [cropped] }, snapshot);
  assert.deepEqual(merged.roots.find(head => head.key === published.key), published);
});

test("preparation rejects mixed datasets, duplicate regions and unverified publications", () => {
  assert.throws(() => assembleCityCoveragePlan(fixture.plan, { ...snapshot, dataset: "other" }), /dataset mismatch/);
  assert.throws(() => assembleCityCoveragePlan(fixture.plan,
    { ...snapshot, faces: [...snapshot.faces, snapshot.faces[0]] }), /Invalid pinned/);
  const invalid = structuredClone(snapshot);
  invalid.faces[0].publish.mode = "plan-only";
  assert.throws(() => assembleCityCoveragePlan(fixture.plan, invalid), /verified published head/);
});
