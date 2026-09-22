import { required } from '../contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { type PayloadPage, decodedBodyMetrics, localBaseUrl, measureRoute, payloadCases, runPayloadComparison } from "./measure-object-payloads.mts";

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const baseUrl = "http://127.0.0.1:4321/";
test("payload coverage derives every SCENE_OBJECTS route at DPR 1 and 2", () => {
  const cases = payloadCases();
  assert.equal(cases.length, SCENE_OBJECTS.length * 2);
  for (const object of SCENE_OBJECTS) assert.deepEqual(cases.filter(entry => entry.id === object.id), [1, 2].map(dpr => ({ id: object.id, route: object.route, dpr })));
  assert.equal(localBaseUrl("http://localhost:4321", "base"), "http://localhost:4321/");
  for (const value of ["https://example.com/", "file:///tmp/", "http://localhost:4321/wrong/", "http://user@localhost:4321/"]) assert.throws(() => localBaseUrl(value, "base"), /local origin/);
});

test("decoded body measurements retain exact bytes and hash with reproducible labeled compression estimates", () => {
  const bytes = Buffer.from("retained prepared response\n".repeat(200));
  const metrics = decodedBodyMetrics(bytes);
  assert.equal(metrics.bodyBytes, bytes.byteLength);
  assert.equal(metrics.sha256, sha(bytes));
  assert.deepEqual(decodedBodyMetrics(Buffer.from(bytes)), metrics);
  assert.ok(metrics.gzipEstimateBytes > 0 && metrics.gzipEstimateBytes < metrics.bodyBytes);
  assert.ok(metrics.brotliEstimateBytes > 0 && metrics.brotliEstimateBytes < metrics.bodyBytes);
  assert.notEqual(decodedBodyMetrics(Buffer.concat([bytes, Buffer.from("changed")])).sha256, metrics.sha256);
});

test("a failed route retains partial evidence, covers later objects and never computes a successful comparison", async t => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-payload-report-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const report = await runPayloadComparison({ browser: {newContext: async () => {throw new Error("Comparison fixture must use supplied measure");}}, baselineUrl: baseUrl, candidateUrl: "http://localhost:4322/", outputRoot: root,
    measure: async (_browser, url, entry) => {
      calls.push({ url, ...entry });
      if (url === baseUrl && entry.id === SCENE_OBJECTS[0].id && entry.dpr === 1) throw new Error("deliberate route failure");
      return { complete: true, bodyBytes: 20, responseCount: 2, gzipEstimateBytes: 12, brotliEstimateBytes: 10, errors: [] };
    } });
  assert.equal(calls.length, SCENE_OBJECTS.length * 4);
  assert.equal(report.cases.length, SCENE_OBJECTS.length * 2);
  assert.equal(report.complete, false);
  assert.equal(report.errors.length, 1);
  assert.equal(report.cases[0].bodyBytes, null);
  assert.equal(required(required(report.cases.at(-1)).bodyBytes).difference, 0);
  assert.match(report.compression.evidence, /not measured wire transfer/);
  assert.deepEqual(JSON.parse(await readFile(resolve(root, "report.json"), "utf8")), report);
});

test("route measurement checks the actual mounted object and single camera before reporting success", async () => {
  const entry = payloadCases()[0], metrics = [];
  for (const override of [{ objectId: "different-body" }, { cameras: 2 }, {}]) {
    const responses = new Set<(response: Parameters<Parameters<PayloadPage['off']>[1]>[0]) => void>();
    let closed = false;
    const request = { url: () => new URL(entry.route, baseUrl).href, redirectedFrom: () => null, resourceType: () => "document" };
    const nativeResponse = { url: request.url, status: () => 200, request: () => request, body: async () => Buffer.from("document") };
    const page: PayloadPage = {
      on(event: string, callback: unknown) {
        if(event==='response') { assert.ok(typeof callback==='function'); const receiver = (value:Parameters<Parameters<PayloadPage['off']>[1]>[0]) => callback(value); responses.add(receiver); }
      },
      off: () => responses.clear(),
      goto: async (url) => { assert.equal(url, request.url()); responses.forEach(callback=>callback(nativeResponse)); return nativeResponse; },
      waitForFunction: async (_predicate, id) => assert.equal(id, entry.id), waitForTimeout: async () => {},
      evaluate: async () => ({ documentElements:30,projectiveTextures:0,stageCount: 1, objectId: entry.id, cameras: 1, scenes: 1, sceneElements: 20, ...override }),
    };
    const result = await measureRoute({ newContext: async (options) => {
      assert.equal(required(options).deviceScaleFactor, entry.dpr);
      return { newPage: async () => page, newCDPSession: async () => { throw new Error("CDP unavailable in this fixture"); }, close: async () => { closed = true; } };
    } }, baseUrl, entry);
    assert.equal(closed, true);
    assert.equal(result.resources[0].sha256, sha("document"));
    metrics.push(result);
  }
  assert.match(metrics[0].errors[0].error, /mounted object differs/);
  assert.match(metrics[1].errors[0].error, /one actual camera/);
  assert.equal(metrics[2].complete, true);
  assert.equal(metrics[2].layers.available, false);
});
