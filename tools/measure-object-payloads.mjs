import assert from "node:assert/strict";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { OBJECTS } from "../site/objects.mjs";

const CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });
const RECEIPT_NAME = "SOURCE_BOUND_BUILD_RECEIPT.json";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const validSha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const compressionCache = new Map();
export const COMPRESSION_ESTIMATES = Object.freeze({
  evidence: "deterministic compression estimates of decoded response bodies; not measured wire transfer",
  gzip: { level: 9 }, brotli: { quality: 5 },
});

export function payloadCases(objects = OBJECTS) {
  return objects.flatMap(object => [1, 2].map(dpr => ({ id: object.id, route: object.route, dpr })));
}
function requireRelativeFile(file) {
  assert.ok(typeof file === "string" && file && !isAbsolute(file) && !/[\\\0?#]/.test(file) &&
    file.split("/").every(part => part && part !== "." && part !== ".."), `Invalid build receipt file: ${file}`);
}
export async function loadBuildReceipt(input) {
  if (!input) return null;
  const path = resolve(input);
  const receiptPath = (await stat(path)).isDirectory() ? resolve(path, RECEIPT_NAME) : path;
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.schema, "cssearth-source-bound-build@1", "Incompatible source-bound build receipt");
  assert.equal(receipt.complete, true, "Build receipt must describe a completed build");
  assert.equal(receipt.exitCode, 0, "Build receipt must record a successful actual build exit");
  const source = receipt.sourceIdentity;
  assert.equal(source?.schema, "cssearth-audit-source@1", "Build receipt requires a snapshotAuditSources identity");
  assert.ok(isAbsolute(source.sourceRoot ?? "") && source.files?.["astro.config.mjs"] && source.files?.["site/scene-router.mjs"], "Build receipt source identity is incomplete");
  for (const [file, hash] of Object.entries(source.files)) { requireRelativeFile(file); assert.ok(validSha(hash), `Invalid source hash: ${file}`); }
  assert.equal(sha(JSON.stringify(source.files)), source.sha256, "Build receipt source fingerprint differs");
  assert.ok(receipt.files && Object.getPrototypeOf(receipt.files) === Object.prototype && Object.keys(receipt.files).length, "Build receipt has no built files");
  for (const [file, hash] of Object.entries(receipt.files)) { requireRelativeFile(file); assert.ok(validSha(hash), `Invalid build hash: ${file}`); }
  const distRoot = await realpath(receipt.distRoot ? resolve(dirname(receiptPath), receipt.distRoot) : dirname(receiptPath));
  return { receiptPath, distRoot, receipt, verifiedFiles: new Map() };
}
export function decodedBodyMetrics(body) {
  const hash = sha(body);
  if (!compressionCache.has(hash)) compressionCache.set(hash, Object.freeze({
    sha256: hash, bodyBytes: body.byteLength,
    gzipEstimateBytes: gzipSync(body, { level: 9 }).byteLength,
    brotliEstimateBytes: brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).byteLength,
  }));
  return compressionCache.get(hash);
}
function requireLocalResponse(resource, baseUrl) {
  const url = new URL(resource.url);
  assert.equal(url.origin, new URL(baseUrl).origin, `Unexpected external response: ${resource.url}`);
  assert.equal(resource.status, 200, `Response did not return HTTP 200: ${resource.url} (${resource.status})`);
  assert.equal(resource.requestUrl ?? resource.url, resource.url, `Response changed request URL: ${resource.url}`);
  assert.ok(!resource.redirectedFrom, `Redirected response: ${resource.url}`);
  assert.ok(!/^\/(?:@(?:vite|fs|id)\/|src\/|site\/|node_modules\/\.vite\/)/.test(url.pathname) &&
    !/[?&](?:t|import|astro)(?:=|&|$)/.test(url.search), `Development response cannot measure a production build: ${resource.url}`);
  return url;
}
export async function verifyBuildResponse(resource, body, baseUrl, build) {
  const url = requireLocalResponse(resource, baseUrl);
  if (!build) return { status: "UNBOUND_NO_BUILD_RECEIPT", file: null };
  let file = decodeURIComponent(url.pathname).slice(1);
  if (!file || file.endsWith("/")) file += "index.html";
  requireRelativeFile(file);
  const expected = build.receipt.files[file];
  assert.ok(expected, `Loaded response is absent from the build receipt: ${file}`);
  if (!build.verifiedFiles.has(file)) {
    const actual = sha(await readFile(resolve(build.distRoot, file)));
    assert.equal(actual, expected, `Built file differs from its receipt: ${file}`);
    build.verifiedFiles.set(file, actual);
  }
  assert.equal(sha(body), expected, `Loaded response differs from its built file: ${file}`);
  return { status: "MATCHED_BUILD_FILE", file, sha256: expected };
}

export async function measureRoute(browser, baseUrl, { id, route, dpr }, build = null) {
  const result = { id, route, dpr, complete: false, bodyBytes: 0, gzipEstimateBytes: 0, brotliEstimateBytes: 0,
    responseCount: 0, bytesByType: {}, resources: [], errors: [], dom: null, layers: { available: false },
    sourceBinding: build ? { status: "INCOMPLETE", sourceSha256: build.receipt.sourceIdentity.sha256, receiptPath: build.receiptPath }
      : { status: "UNBOUND_NO_BUILD_RECEIPT" } };
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: dpr, reducedMotion: "no-preference", serviceWorkers: "block" });
  const pending = [];
  let page, cdp, lastLayers = null;
  const responseListener = response => {
    const request = response.request();
    const resource = { url: response.url(), requestUrl: request.url(), redirectedFrom: request.redirectedFrom()?.url() ?? null,
      status: response.status(), type: request.resourceType() };
    result.resources.push(resource);
    pending.push((async () => {
      try {
        requireLocalResponse(resource, baseUrl);
        const body = await response.body();
        Object.assign(resource, decodedBodyMetrics(body));
        resource.build = await verifyBuildResponse(resource, body, baseUrl, build);
      } catch (error) { resource.error = error.message; result.errors.push({ phase: "response", url: resource.url, error: error.message }); }
    })());
  };
  try {
    page = await context.newPage();
    page.on("response", responseListener);
    page.on("requestfailed", request => result.errors.push({ phase: "request", url: request.url(), error: request.failure()?.errorText ?? "Request failed" }));
    page.on("pageerror", error => result.errors.push({ phase: "page", error: error.message }));
    try {
      cdp = await context.newCDPSession(page);
      cdp.on("LayerTree.layerTreeDidChange", event => { lastLayers = event.layers ?? []; });
      await cdp.send("LayerTree.enable");
    } catch (error) { result.layers.reason = error.message; }
    const documentResponse = await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle", timeout: 120_000 });
    assert.equal(documentResponse?.status(), 200, `${id} document did not return HTTP 200`);
    await page.waitForFunction(expected => document.documentElement.dataset.ready === "true" &&
      document.querySelector(".planet-stage")?.dataset.objectId === expected, id, { timeout: 120_000 });
    await page.waitForTimeout(500);
    result.dom = await page.evaluate(() => {
      const stages = [...document.querySelectorAll(".planet-stage")], stage = stages[0];
      return { stageCount: stages.length, objectId: stage?.dataset.objectId ?? null,
        documentElements: document.querySelectorAll("*").length, sceneElements: stage?.querySelectorAll("*").length ?? 0,
        cameras: stage?.querySelectorAll(".polycss-camera").length ?? 0,
        scenes: stage?.querySelectorAll(".polycss-scene").length ?? 0,
        projectiveTextures: stage?.querySelectorAll(".polycss-projective-texture").length ?? 0 };
    });
    assert.equal(result.dom.stageCount, 1, "Exactly one object stage must be mounted");
    assert.equal(result.dom.objectId, id, "The mounted object differs from the measured route");
    assert.equal(result.dom.cameras, 1, "Exactly one actual camera must be mounted");
    assert.equal(result.dom.scenes, 1, "Exactly one actual scene must be mounted");
  } catch (error) { result.errors.push({ phase: "route", error: error.message }); }
  finally {
    page?.off("response", responseListener);
    await Promise.allSettled(pending);
    if (lastLayers !== null) result.layers = { available: true, count: lastLayers.length,
      drawsContent: lastLayers.filter(layer => layer.drawsContent).length, evidence: "Chrome CDP LayerTree" };
    try { await cdp?.detach(); } catch (error) { result.errors.push({ phase: "cleanup", error: error.message }); }
    try { await context.close(); } catch (error) { result.errors.push({ phase: "cleanup", error: error.message }); }
  }
  result.resources.sort((left, right) => left.url.localeCompare(right.url));
  result.responseCount = result.resources.length;
  for (const resource of result.resources) {
    for (const key of ["bodyBytes", "gzipEstimateBytes", "brotliEstimateBytes"]) result[key] += resource[key] ?? 0;
    result.bytesByType[resource.type] = (result.bytesByType[resource.type] ?? 0) + (resource.bodyBytes ?? 0);
  }
  if (!result.responseCount) result.errors.push({ phase: "response", error: "No response bodies were observed" });
  result.complete = result.errors.length === 0;
  if (build) result.sourceBinding.status = result.complete ? "MATCHED_BUILD_RECEIPT" : "INVALID";
  return result;
}
function comparison(baseline, candidate) {
  if (!Number.isFinite(baseline) || !Number.isFinite(candidate)) return null;
  const difference = candidate - baseline;
  return { baseline, candidate, difference, percent: baseline === 0 ? null : Number(((difference / baseline) * 100).toFixed(4)) };
}
export async function runPayloadComparison({ browser, baselineUrl, candidateUrl, outputRoot, baselineBuild = null, candidateBuild = null,
  objects = OBJECTS, measure = measureRoute }) {
  const report = { schema: "cssearth-object-payload@2", capturedAt: new Date().toISOString(),
    baselineUrl, candidateUrl, viewport: VIEWPORT, dprs: [1, 2], objects: objects.map(object => object.id),
    compression: COMPRESSION_ESTIMATES, browserLifecycle: { launches: 1, maxConcurrentContexts: 1 },
    sourceBinding: { status: baselineBuild && candidateBuild ? "INCOMPLETE" : "UNBOUND_NO_BUILD_RECEIPT",
      baseline: baselineBuild ? { receiptPath: baselineBuild.receiptPath, sourceIdentity: baselineBuild.receipt.sourceIdentity } : null,
      candidate: candidateBuild ? { receiptPath: candidateBuild.receiptPath, sourceIdentity: candidateBuild.receipt.sourceIdentity } : null },
    complete: false, cases: [], errors: [] };
  const save = async () => {
    if (!outputRoot) return;
    await mkdir(outputRoot, { recursive: true });
    await writeFile(resolve(outputRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");
  };
  await save();
  for (const entry of payloadCases(objects)) {
    const row = { ...entry };
    for (const [name, url, build] of [["baseline", baselineUrl, baselineBuild], ["candidate", candidateUrl, candidateBuild]]) {
      try { row[name] = await measure(browser, url, entry, build); }
      catch (error) { row[name] = { complete: false, errors: [{ phase: "setup", error: error.message }] }; }
      if (!row[name].complete) report.errors.push({ id: entry.id, dpr: entry.dpr, side: name, errors: row[name].errors });
    }
    for (const key of ["bodyBytes", "responseCount", "gzipEstimateBytes", "brotliEstimateBytes"]) {
      row[key] = row.baseline.complete && row.candidate.complete ? comparison(row.baseline[key], row.candidate[key]) : null;
    }
    report.cases.push(row);
    await save();
  }
  if (baselineBuild && candidateBuild && report.cases.some(row =>
    [row.baseline, row.candidate].some(side => side.sourceBinding?.status !== "MATCHED_BUILD_RECEIPT"))) {
    report.errors.push({ phase: "binding", error: "Every measured side must match its supplied build receipt" });
  }
  report.complete = report.errors.length === 0 && report.cases.length === objects.length * 2 && objects.length > 0;
  if (baselineBuild && candidateBuild) report.sourceBinding.status = report.complete ? "MATCHED_BUILD_RECEIPTS" : "INVALID";
  report.finishedAt = new Date().toISOString();
  await save();
  return report;
}
export function localBaseUrl(value, label) {
  if (!value) throw new Error("Usage: node tools/measure-object-payloads.mjs <baseline-url> <candidate-url> [output-dir] [--baseline-build <receipt-or-dist>] [--candidate-build <receipt-or-dist>]");
  const url = new URL(value);
  assert.ok(["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, `${label} must be a local origin URL`);
  return `${url.origin}/`;
}
function argumentsForCli(args) {
  const positional = [], flags = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      assert.ok(["--baseline-build", "--candidate-build"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--") && !flags[arg], `Invalid payload argument: ${arg}`);
      flags[arg] = args[++index];
    } else positional.push(arg);
  }
  assert.ok(positional.length <= 3, "Too many payload arguments");
  return { baselineUrl: localBaseUrl(positional[0], "baseline URL"), candidateUrl: localBaseUrl(positional[1], "candidate URL"),
    outputRoot: resolve(positional[2] ?? "output/playwright/object-payloads"), baselineReceipt: flags["--baseline-build"], candidateReceipt: flags["--candidate-build"] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = argumentsForCli(process.argv.slice(2));
  let browser, runStarted = false;
  try {
    const baselineBuild = await loadBuildReceipt(options.baselineReceipt), candidateBuild = await loadBuildReceipt(options.candidateReceipt);
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, executablePath: CHROME_EXECUTABLE,
      args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"] });
    runStarted = true;
    const report = await runPayloadComparison({ ...options, browser, baselineBuild, candidateBuild });
    console.log(JSON.stringify({ outputRoot: options.outputRoot, complete: report.complete, sourceBinding: report.sourceBinding.status,
      cases: report.cases.map(({ id, dpr, bodyBytes, responseCount }) => ({ id, dpr, bodyBytes, responseCount })), errors: report.errors }, null, 2));
    if (!report.complete) process.exitCode = 1;
  } catch (error) {
    await mkdir(options.outputRoot, { recursive: true });
    const failure = { schema: "cssearth-object-payload@2", complete: false, sourceBinding: { status: "INVALID" },
      cases: [], errors: [{ phase: "setup", error: error.message }], capturedAt: new Date().toISOString() };
    await writeFile(resolve(options.outputRoot, "failure.json"), JSON.stringify(failure, null, 2) + "\n");
    if (!runStarted) await writeFile(resolve(options.outputRoot, "report.json"), JSON.stringify(failure, null, 2) + "\n");
    console.error(error); process.exitCode = 1;
  } finally { await browser?.close(); }
}
