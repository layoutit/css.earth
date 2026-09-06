import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { decodedBodyMetrics, loadBuildReceipt, localBaseUrl, measureRoute, payloadCases, runPayloadComparison, verifyBuildResponse } from "./measure-object-payloads.mjs";

const sha = value => createHash("sha256").update(value).digest("hex");
const baseUrl = "http://127.0.0.1:4321/";
async function buildFixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-build-receipt-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distRoot = resolve(root, "dist");
  await mkdir(resolve(distRoot, "moon"), { recursive: true });
  const bodies = { "index.html": Buffer.from("root document"), "moon/index.html": Buffer.from("moon document"), "bundle.js": Buffer.from("export const data = 42;\n") };
  for (const [file, bytes] of Object.entries(bodies)) await writeFile(resolve(distRoot, file), bytes);
  const sourceFiles = { "astro.config.mjs": sha("config"), "site/scene-router.mjs": sha("router") };
  const receipt = { schema: "cssearth-source-bound-build@1", distRoot, complete: true, exitCode: 0,
    sourceIdentity: { schema: "cssearth-audit-source@1", sourceRoot: resolve(root, "source"), files: sourceFiles, sha256: sha(JSON.stringify(sourceFiles)) },
    files: Object.fromEntries(Object.entries(bodies).map(([file, body]) => [file, sha(body)])) };
  const path = resolve(root, "SOURCE_BOUND_BUILD_RECEIPT.json");
  await writeFile(path, JSON.stringify(receipt));
  return { root, distRoot, path, bodies, receipt, build: await loadBuildReceipt(path) };
}
const response = path => ({ url: new URL(path, baseUrl).href, status: 200 });

test("payload coverage derives every OBJECTS route at DPR 1 and 2", () => {
  const cases = payloadCases();
  assert.equal(cases.length, OBJECTS.length * 2);
  for (const object of OBJECTS) assert.deepEqual(cases.filter(entry => entry.id === object.id), [1, 2].map(dpr => ({ id: object.id, route: object.route, dpr })));
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

test("build receipts bind actual document routes including root index and asset bytes", async t => {
  const fixture = await buildFixture(t);
  for (const [url, file] of [["/", "index.html"], ["/moon/", "moon/index.html"], ["/bundle.js", "bundle.js"]]) {
    assert.deepEqual(await verifyBuildResponse(response(url), fixture.bodies[file], baseUrl, fixture.build),
      { status: "MATCHED_BUILD_FILE", file, sha256: fixture.receipt.files[file] });
  }
  assert.equal((await loadBuildReceipt(fixture.root)).distRoot, await realpath(fixture.distRoot));
  assert.deepEqual(await verifyBuildResponse(response("/bundle.js"), fixture.bodies["bundle.js"], baseUrl, null),
    { status: "UNBOUND_NO_BUILD_RECEIPT", file: null });
});

test("loaded byte, built file, source fingerprint and path mismatches fail closed", async t => {
  const fixture = await buildFixture(t);
  await assert.rejects(verifyBuildResponse(response("/bundle.js"), Buffer.from("wrong"), baseUrl, fixture.build), /Loaded response differs/);
  await writeFile(resolve(fixture.distRoot, "bundle.js"), "replaced after build");
  await assert.rejects(verifyBuildResponse(response("/bundle.js"), fixture.bodies["bundle.js"], baseUrl, await loadBuildReceipt(fixture.path)), /Built file differs/);
  fixture.receipt.sourceIdentity.files["astro.config.mjs"] = sha("changed source");
  await writeFile(fixture.path, JSON.stringify(fixture.receipt));
  await assert.rejects(loadBuildReceipt(fixture.path), /source fingerprint differs/);
  fixture.receipt.sourceIdentity.sha256 = sha(JSON.stringify(fixture.receipt.sourceIdentity.files));
  fixture.receipt.files["../outside.js"] = sha("outside");
  await writeFile(fixture.path, JSON.stringify(fixture.receipt));
  await assert.rejects(loadBuildReceipt(fixture.path), /Invalid build receipt file/);
});

test("incomplete, failed or unrecorded build exits cannot establish source binding", async t => {
  const fixture = await buildFixture(t);
  for (const [complete, exitCode, error] of [[false, 0, /completed build/], [true, 1, /successful actual build exit/],
    [true, null, /successful actual build exit/], [undefined, undefined, /completed build/]]) {
    await writeFile(fixture.path, JSON.stringify({ ...fixture.receipt, complete, exitCode }));
    await assert.rejects(loadBuildReceipt(fixture.path), error);
  }
});

test("redirects, failures, unexpected external responses, development modules and unknown built files cannot qualify", async t => {
  const fixture = await buildFixture(t), bytes = fixture.bodies["bundle.js"];
  for (const [resource, error] of [
    [{ ...response("/bundle.js"), status: 301 }, /HTTP 200/],
    [{ ...response("/bundle.js"), status: 404 }, /HTTP 200/],
    [{ ...response("/bundle.js"), redirectedFrom: "http://127.0.0.1:4321/old.js" }, /Redirected/],
    [{ ...response("/bundle.js"), requestUrl: "http://127.0.0.1:4321/different.js" }, /changed request URL/],
    [{ ...response("/bundle.js"), url: "https://example.com/bundle.js" }, /Unexpected external/],
    [response("/@vite/client"), /Development response/],
    [response("/bundle.js?t=12"), /Development response/],
    [response("/unknown.js"), /absent from the build receipt/],
  ]) await assert.rejects(verifyBuildResponse(resource, bytes, baseUrl, fixture.build), error);
});

test("a failed route retains partial evidence, covers later objects and never computes a successful comparison", async t => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-payload-report-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const report = await runPayloadComparison({ browser: {}, baselineUrl: baseUrl, candidateUrl: "http://localhost:4322/", outputRoot: root,
    measure: async (_browser, url, entry) => {
      calls.push({ url, ...entry });
      if (url === baseUrl && entry.id === OBJECTS[0].id && entry.dpr === 1) throw new Error("deliberate route failure");
      return { complete: true, bodyBytes: 20, responseCount: 2, gzipEstimateBytes: 12, brotliEstimateBytes: 10, errors: [],
        sourceBinding: { status: "UNBOUND_NO_BUILD_RECEIPT" } };
    } });
  assert.equal(calls.length, OBJECTS.length * 4);
  assert.equal(report.cases.length, OBJECTS.length * 2);
  assert.equal(report.complete, false);
  assert.equal(report.errors.length, 1);
  assert.equal(report.cases[0].bodyBytes, null);
  assert.equal(report.cases.at(-1).bodyBytes.difference, 0);
  assert.equal(report.sourceBinding.status, "UNBOUND_NO_BUILD_RECEIPT");
  assert.match(report.compression.evidence, /not measured wire transfer/);
  assert.deepEqual(JSON.parse(await readFile(resolve(root, "report.json"), "utf8")), report);
});

test("route measurement checks the actual mounted object and single camera before reporting success", async () => {
  const entry = payloadCases()[0], metrics = [];
  for (const override of [{ objectId: "different-body" }, { cameras: 2 }, {}]) {
    const handlers = new Map();
    let closed = false;
    const request = { url: () => new URL(entry.route, baseUrl).href, redirectedFrom: () => null, resourceType: () => "document" };
    const nativeResponse = { url: request.url, status: () => 200, request: () => request, body: async () => Buffer.from("document") };
    const page = {
      on: (event, callback) => handlers.set(event, callback), off: event => handlers.delete(event),
      goto: async url => { assert.equal(url, request.url()); handlers.get("response")(nativeResponse); return nativeResponse; },
      waitForFunction: async (_predicate, id) => assert.equal(id, entry.id), waitForTimeout: async () => {},
      evaluate: async () => ({ stageCount: 1, objectId: entry.id, cameras: 1, scenes: 1, sceneElements: 20, ...override }),
    };
    const result = await measureRoute({ newContext: async options => {
      assert.equal(options.deviceScaleFactor, entry.dpr);
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

test("supplying build receipts cannot turn unbound measured sides into a qualified report", async t => {
  const fixture = await buildFixture(t);
  for (const status of ["UNBOUND_NO_BUILD_RECEIPT", "MATCHED_BUILD_RECEIPT"]) {
    const report = await runPayloadComparison({ browser: {}, baselineUrl: baseUrl, candidateUrl: baseUrl,
      baselineBuild: fixture.build, candidateBuild: fixture.build,
      measure: async () => ({ complete: true, bodyBytes: 1, responseCount: 1, gzipEstimateBytes: 10, brotliEstimateBytes: 10,
        errors: [], sourceBinding: { status } }) });
    assert.equal(report.complete, status === "MATCHED_BUILD_RECEIPT");
    assert.equal(report.sourceBinding.status, status === "MATCHED_BUILD_RECEIPT" ? "MATCHED_BUILD_RECEIPTS" : "INVALID");
    assert.equal(report.errors.length, status === "MATCHED_BUILD_RECEIPT" ? 0 : 1);
  }
});
