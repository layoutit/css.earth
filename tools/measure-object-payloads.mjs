import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { OBJECTS } from "../site/objects.mjs";

const CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const compressionCache = new Map();
export const COMPRESSION_ESTIMATES = Object.freeze({
  evidence: "deterministic compression estimates of decoded response bodies; not measured wire transfer",
  gzip: { level: 9 }, brotli: { quality: 5 },
});

export function payloadCases(objects = OBJECTS) {
  return objects.flatMap(object => [1, 2].map(dpr => ({ id: object.id, route: object.route, dpr })));
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
export async function measureRoute(browser, baseUrl, { id, route, dpr }) {
  const result = { id, route, dpr, complete: false, bodyBytes: 0, gzipEstimateBytes: 0, brotliEstimateBytes: 0,
    responseCount: 0, bytesByType: {}, resources: [], errors: [], dom: null, layers: { available: false } };
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
  return result;
}
function comparison(baseline, candidate) {
  if (!Number.isFinite(baseline) || !Number.isFinite(candidate)) return null;
  const difference = candidate - baseline;
  return { baseline, candidate, difference, percent: baseline === 0 ? null : Number(((difference / baseline) * 100).toFixed(4)) };
}
export async function runPayloadComparison({ browser, baselineUrl, candidateUrl, outputRoot,
  objects = OBJECTS, measure = measureRoute }) {
  const report = { schema: "cssearth-object-payload@2", capturedAt: new Date().toISOString(),
    baselineUrl, candidateUrl, viewport: VIEWPORT, dprs: [1, 2], objects: objects.map(object => object.id),
    compression: COMPRESSION_ESTIMATES, browserLifecycle: { launches: 1, maxConcurrentContexts: 1 },
    complete: false, cases: [], errors: [] };
  const save = async () => {
    if (!outputRoot) return;
    await mkdir(outputRoot, { recursive: true });
    await writeFile(resolve(outputRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");
  };
  await save();
  for (const entry of payloadCases(objects)) {
    const row = { ...entry };
    for (const [name, url] of [["baseline", baselineUrl], ["candidate", candidateUrl]]) {
      try { row[name] = await measure(browser, url, entry); }
      catch (error) { row[name] = { complete: false, errors: [{ phase: "setup", error: error.message }] }; }
      if (!row[name].complete) report.errors.push({ id: entry.id, dpr: entry.dpr, side: name, errors: row[name].errors });
    }
    for (const key of ["bodyBytes", "responseCount", "gzipEstimateBytes", "brotliEstimateBytes"]) {
      row[key] = row.baseline.complete && row.candidate.complete ? comparison(row.baseline[key], row.candidate[key]) : null;
    }
    report.cases.push(row);
    await save();
  }
  report.complete = report.errors.length === 0 && report.cases.length === objects.length * 2 && objects.length > 0;
  report.finishedAt = new Date().toISOString();
  await save();
  return report;
}
export function localBaseUrl(value, label) {
  if (!value) throw new Error("Usage: node tools/measure-object-payloads.mjs <baseline-url> <candidate-url> [output-dir]");
  const url = new URL(value);
  assert.ok(["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, `${label} must be a local origin URL`);
  return `${url.origin}/`;
}
function argumentsForCli(positional) {
  assert.ok(positional.length <= 3, "Too many payload arguments");
  return { baselineUrl: localBaseUrl(positional[0], "baseline URL"), candidateUrl: localBaseUrl(positional[1], "candidate URL"),
    outputRoot: resolve(positional[2] ?? "output/playwright/object-payloads") };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = argumentsForCli(process.argv.slice(2));
  let browser, runStarted = false;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, executablePath: CHROME_EXECUTABLE,
      args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"] });
    runStarted = true;
    const report = await runPayloadComparison({ ...options, browser });
    console.log(JSON.stringify({ outputRoot: options.outputRoot, complete: report.complete,
      cases: report.cases.map(({ id, dpr, bodyBytes, responseCount }) => ({ id, dpr, bodyBytes, responseCount })), errors: report.errors }, null, 2));
    if (!report.complete) process.exitCode = 1;
  } catch (error) {
    await mkdir(options.outputRoot, { recursive: true });
    const failure = { schema: "cssearth-object-payload@2", complete: false,
      cases: [], errors: [{ phase: "setup", error: error.message }], capturedAt: new Date().toISOString() };
    await writeFile(resolve(options.outputRoot, "failure.json"), JSON.stringify(failure, null, 2) + "\n");
    if (!runStarted) await writeFile(resolve(options.outputRoot, "report.json"), JSON.stringify(failure, null, 2) + "\n");
    console.error(error); process.exitCode = 1;
  } finally { await browser?.close(); }
}
