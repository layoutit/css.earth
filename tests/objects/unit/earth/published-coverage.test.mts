import {parseCitySource,parseIndexHead,shape,array,text,number} from '../../../../tools/objects/geographic-pages/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readCityFixture } from "./city-fixture.mts";
import { assembleCityCoveragePlan, readPublishedCoverage } from "../../../../tools/objects/geographic-pages/operations/published-coverage.mts";
import { readWorldCoverCatalog } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mts";
import { cityCoverageRoots, planCityCoverage } from "../../../../tools/objects/geographic-pages/operations/plan-coverage.mts";
import { expectedGlobalCityFace, validateGlobalCityFaceReceipt } from "../../../../tools/objects/geographic-pages/operations/global-face-receipts.mts";
import { PREPARED_EARTH_SCENE } from "./prepared-fixture.mts";

const publishedCoveragePath=new URL("../../../../src/objects/earth/source/city/published-coverage.json.gz",import.meta.url);
const snapshot = required(await readPublishedCoverage(publishedCoveragePath));
const fixture = await readCityFixture();

test("published coverage is pinned and matches the reproducible source-window plans", async () => {
  const bytes = await readFile(publishedCoveragePath);
  const manifest = shape({documents:array(shape({path:text,expectedBytes:number,expectedSha256:text}))})(JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/manifest.json", import.meta.url))).toString('utf8')));
  const pin = required(manifest.documents.find(entry => entry.path === "city/published-coverage.json.gz"));
  assert.equal(bytes.length, pin.expectedBytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.expectedSha256);
  const source = parseCitySource(JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/city/manifest.json", import.meta.url))).toString('utf8')));
  const { pin: catalog, entries } = await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)});
  const expected = new Map(cityCoverageRoots().map(face => {
    const value = expectedGlobalCityFace(face, [...planCityCoverage(PREPARED_EARTH_SCENE, entries, [face])]);
    return [value.face.key, value] as const;
  }).filter(([, value]) => value.jobs));
  assert.equal(snapshot.expectedFaces, expected.size);
  for (const receipt of snapshot.faces) {
    validateGlobalCityFaceReceipt(receipt, required(expected.get(receipt.face.key)), source, catalog.expectedSha256);
  }
});

test("preparation merges every published region with the local proof inputs", () => {
  const plan = assembleCityCoveragePlan(fixture.plan, snapshot);
  const roots = new Map(plan.roots.map(head => [head.key, head]));
  for (const receipt of snapshot.faces) assert.deepEqual(roots.get(receipt.face.key), receipt.heads[0]);
  for (const head of fixture.plan.roots) assert.ok(roots.has(head.key));
  assert.equal(roots.size, plan.roots.length);
  for (const field of ["poolSize", "maximumDecodedBytes", "index", "initialLayer"] as const) {
    assert.deepEqual(Reflect.get(plan,field), fixture.plan[field]);
  }
  // A later whole-region publication must replace the same region's crop.
  const published = parseIndexHead(snapshot.faces[0].heads[0]);
  const cropped = { ...published, directory: fixture.plan.roots[0].directory };
  const merged = assembleCityCoveragePlan({ ...fixture.plan, roots: [cropped] }, snapshot);
  assert.deepEqual(merged.roots.find((head: { key: string; }) => head.key === published.key), published);
});

test("preparation rejects mixed datasets, duplicate regions and unverified publications", () => {
  assert.throws(() => assembleCityCoveragePlan(fixture.plan, { ...snapshot, dataset: "other" }), /dataset mismatch/);
  assert.throws(() => assembleCityCoveragePlan(fixture.plan,
    { ...snapshot, faces: [...snapshot.faces, snapshot.faces[0]] }), /Invalid pinned/);
  const invalid = structuredClone(snapshot);
  invalid.faces[0].publish.mode = "plan-only";
  assert.throws(() => assembleCityCoveragePlan(fixture.plan, invalid), /verified published head/);
});
