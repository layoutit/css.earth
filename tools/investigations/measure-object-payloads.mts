import { sha256 } from '../../src/platform/sha256.mts';
import type { Browser, Page, BrowserContextOptions, CDPSession, Response, Request } from 'playwright';
import { requireArray, requireRecord } from '@cssearth/core';
interface PayloadObject {id: string; route: string;}
interface PayloadCase extends PayloadObject {dpr: number;}
interface BodyMetrics {sha256: string; bodyBytes: number; gzipEstimateBytes: number; brotliEstimateBytes: number;}
interface Resource extends Partial<BodyMetrics> {url: string; requestUrl?: string; redirectedFrom?: string | null; status: number; type: string; error?: string;}
interface MeasurementError {phase: string; url?: string; error: string;}
interface DomMetrics {stageCount: number; objectId: string | null; documentElements: number; sceneElements: number; cameras: number; scenes: number; projectiveTextures: number;}
interface SideMeasurement extends Partial<Omit<BodyMetrics, 'sha256'>> {complete: boolean; responseCount?: number; errors: MeasurementError[];}
interface RouteMeasurement extends PayloadCase, SideMeasurement {
  bodyBytes: number; gzipEstimateBytes: number; brotliEstimateBytes: number; responseCount: number;
  bytesByType: Record<string, number>; resources: Resource[]; dom: DomMetrics | null;
  layers: {available: boolean; reason?: string; count?: number; drawsContent?: number; evidence?: string};
}
type PayloadResponse = Pick<Response,'url'|'status'|'body'> & {
  request(): Pick<Request,'url'|'resourceType'> & {redirectedFrom(): Pick<Request,'url'> | null};
};
export interface PayloadPage {
  on(event:'response', callback:(response:PayloadResponse)=>void): unknown;
  on(event:'requestfailed', callback:(request:Pick<Request,'url'|'failure'>)=>void): unknown;
  on(event:'pageerror', callback:(error:Error)=>void): unknown;
  off(event:'response', callback:(response:PayloadResponse)=>void): unknown;
  goto(url:string, options:{waitUntil:'networkidle';timeout:number}): Promise<PayloadResponse|null>;
  waitForFunction(predicate:(expected:string)=>boolean, expected:string, options:{timeout:number}): Promise<unknown>;
  waitForTimeout(milliseconds:number): Promise<void>;
  evaluate(probe:()=>DomMetrics): Promise<DomMetrics>;
}
export interface PayloadBrowser<P extends PayloadPage = PayloadPage> {
  newContext(options?:BrowserContextOptions): Promise<{
    newPage():Promise<P>;
    newCDPSession(page:P):Promise<CDPSession>;
    close():Promise<void>;
  }>;
}
const metricKeys = ['bodyBytes', 'gzipEstimateBytes', 'brotliEstimateBytes'] as const;
const comparisonKeys = ['bodyBytes', 'responseCount', 'gzipEstimateBytes', 'brotliEstimateBytes'] as const;
type ComparisonMetric = typeof comparisonKeys[number];
type ComparisonRow = PayloadCase & {baseline: SideMeasurement; candidate: SideMeasurement} & Record<ComparisonMetric, ReturnType<typeof comparison>>;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { SCENE_OBJECTS } from "../../site/objects.mts";

const CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });

const compressionCache = new Map<string, Readonly<BodyMetrics>>();
export const COMPRESSION_ESTIMATES = Object.freeze({
  evidence: "deterministic compression estimates of decoded response bodies; not measured wire transfer",
  gzip: { level: 9 }, brotli: { quality: 5 },
});

export function payloadCases(objects: readonly PayloadObject[] = SCENE_OBJECTS) {
  return objects.flatMap(object => [1, 2].map(dpr => ({ id: object.id, route: object.route, dpr })));
}
export function decodedBodyMetrics(body: Uint8Array) {
  const hash = sha256(body);
  if (!compressionCache.has(hash)) compressionCache.set(hash, Object.freeze({
    sha256: hash, bodyBytes: body.byteLength,
    gzipEstimateBytes: gzipSync(body, { level: 9 }).byteLength,
    brotliEstimateBytes: brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).byteLength,
  }));
  return compressionCache.get(hash)!;
}
function requireLocalResponse(resource: Resource, baseUrl: string) {
  const url = new URL(resource.url);
  assert.equal(url.origin, new URL(baseUrl).origin, `Unexpected external response: ${resource.url}`);
  assert.equal(resource.status, 200, `Response did not return HTTP 200: ${resource.url} (${resource.status})`);
  assert.equal(resource.requestUrl ?? resource.url, resource.url, `Response changed request URL: ${resource.url}`);
  assert.ok(!resource.redirectedFrom, `Redirected response: ${resource.url}`);
  assert.ok(!/^\/(?:@(?:vite|fs|id)\/|src\/|site\/|node_modules\/\.vite\/)/.test(url.pathname) &&
    !/[?&](?:t|import|astro)(?:=|&|$)/.test(url.search), `Development response cannot measure a production build: ${resource.url}`);
  return url;
}
export async function measureRoute<P extends PayloadPage>(browser: PayloadBrowser<P>, baseUrl: string, { id, route, dpr }: PayloadCase) {
  const result: RouteMeasurement = { id, route, dpr, complete: false, bodyBytes: 0, gzipEstimateBytes: 0, brotliEstimateBytes: 0,
    responseCount: 0, bytesByType: {}, resources: [], errors: [], dom: null, layers: { available: false } };
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: dpr, reducedMotion: "no-preference", serviceWorkers: "block" });
  const pending: Promise<void>[] = [];
  let page: P | undefined, cdp: CDPSession | undefined;
  const layerState: {lastLayers: {drawsContent: boolean}[] | null} = {lastLayers: null};
  const responseListener = (response: PayloadResponse) => {
    const request = response.request();
    const resource: Resource = { url: response.url(), requestUrl: request.url(), redirectedFrom: request.redirectedFrom()?.url() ?? null,
      status: response.status(), type: request.resourceType() };
    result.resources.push(resource);
    pending.push((async () => {
      try {
        requireLocalResponse(resource, baseUrl);
        const body = await response.body();
        Object.assign(resource, decodedBodyMetrics(body));
      } catch (error) { resource.error = errorMessage(error); result.errors.push({ phase: "response", url: resource.url, error: errorMessage(error) }); }
    })());
  };
  try {
    page = await context.newPage();
    page.on("response", responseListener);
    page.on("requestfailed", request => result.errors.push({ phase: "request", url: request.url(), error: request.failure()?.errorText ?? "Request failed" }));
    page.on("pageerror", error => result.errors.push({ phase: "page", error: errorMessage(error) }));
    try {
      cdp = await context.newCDPSession(page);
      cdp.on("LayerTree.layerTreeDidChange", (event: unknown) => {
        const layers = requireRecord(event).layers;
        layerState.lastLayers = layers == null ? [] : requireArray(layers).map(layer => ({drawsContent: requireRecord(layer).drawsContent === true}));
      });
      await cdp.send("LayerTree.enable");
    } catch (error) { result.layers.reason = errorMessage(error); }
    const documentResponse = await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle", timeout: 120_000 });
    assert.equal(documentResponse?.status(), 200, `${id} document did not return HTTP 200`);
    await page.waitForFunction(expected => document.documentElement.dataset.ready === "true" &&
      document.querySelector<HTMLElement>(".object-stage")?.dataset.objectId === expected, id, { timeout: 120_000 });
    await page.waitForTimeout(500);
    result.dom = await page.evaluate(() => {
      const stages = [...document.querySelectorAll<HTMLElement>(".object-stage")], stage = stages[0];
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
  } catch (error) { result.errors.push({ phase: "route", error: errorMessage(error) }); }
  finally {
    page?.off("response", responseListener);
    await Promise.allSettled(pending);
    const {lastLayers} = layerState;
    if (lastLayers !== null) result.layers = { available: true, count: lastLayers.length,
      drawsContent: lastLayers.filter(layer => layer.drawsContent).length, evidence: "Chrome CDP LayerTree" };
    try { await cdp?.detach(); } catch (error) { result.errors.push({ phase: "cleanup", error: errorMessage(error) }); }
    try { await context.close(); } catch (error) { result.errors.push({ phase: "cleanup", error: errorMessage(error) }); }
  }
  result.resources.sort((left, right) => left.url.localeCompare(right.url));
  result.responseCount = result.resources.length;
  for (const resource of result.resources) {
    for (const key of metricKeys) result[key] += resource[key] ?? 0;
    result.bytesByType[resource.type] = (result.bytesByType[resource.type] ?? 0) + (resource.bodyBytes ?? 0);
  }
  if (!result.responseCount) result.errors.push({ phase: "response", error: "No response bodies were observed" });
  result.complete = result.errors.length === 0;
  return result;
}
function comparison(baseline: number | undefined, candidate: number | undefined) {
  if (typeof baseline !== 'number' || typeof candidate !== 'number' || !Number.isFinite(baseline) || !Number.isFinite(candidate)) return null;
  const difference = candidate - baseline;
  return { baseline, candidate, difference, percent: baseline === 0 ? null : Number(((difference / baseline) * 100).toFixed(4)) };
}
export async function runPayloadComparison<P extends PayloadPage>({ browser, baselineUrl, candidateUrl, outputRoot,
  objects = SCENE_OBJECTS, measure = measureRoute }: {
    browser: PayloadBrowser<P>; baselineUrl: string; candidateUrl: string; outputRoot?: string;
    objects?: readonly PayloadObject[];
    measure?: (browser: PayloadBrowser<P>, url: string, entry: PayloadCase) => Promise<SideMeasurement>;
  }) {
  const report = { schema: "cssearth-object-payload@2", capturedAt: new Date().toISOString(),
    baselineUrl, candidateUrl, viewport: VIEWPORT, dprs: [1, 2], objects: objects.map(object => object.id),
    compression: COMPRESSION_ESTIMATES, browserLifecycle: { launches: 1, maxConcurrentContexts: 1 },
    complete: false, cases: [] as ComparisonRow[], errors: [] as {id: string; dpr: number; side: 'baseline' | 'candidate'; errors: MeasurementError[]}[], finishedAt: undefined as string | undefined };
  const save = async () => {
    if (!outputRoot) return;
    await mkdir(outputRoot, { recursive: true });
    await writeFile(resolve(outputRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");
  };
  await save();
  for (const entry of payloadCases(objects)) {
    async function measureSide(name: 'baseline' | 'candidate', url: string): Promise<SideMeasurement> {
      let result: SideMeasurement;
      try { result = await measure(browser, url, entry); }
      catch (error) { result = {complete: false, errors: [{phase: 'setup', error: errorMessage(error)}]}; }
      if (!result.complete) report.errors.push({id: entry.id, dpr: entry.dpr, side: name, errors: result.errors});
      return result;
    }
    const baseline = await measureSide('baseline', baselineUrl), candidate = await measureSide('candidate', candidateUrl);
    const row: ComparisonRow = {...entry, baseline, candidate, bodyBytes: null, responseCount: null, gzipEstimateBytes: null, brotliEstimateBytes: null};
    for (const key of comparisonKeys) row[key] = baseline.complete && candidate.complete ? comparison(baseline[key], candidate[key]) : null;
    report.cases.push(row);
    await save();
  }
  report.complete = report.errors.length === 0 && report.cases.length === objects.length * 2 && objects.length > 0;
  report.finishedAt = new Date().toISOString();
  await save();
  return report;
}
export function localBaseUrl(value: string | undefined, label: string) {
  if (!value) throw new Error("Usage: node tools/investigations/measure-object-payloads.mts <baseline-url> <candidate-url> [output-dir]");
  const url = new URL(value);
  assert.ok(["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, `${label} must be a local origin URL`);
  return `${url.origin}/`;
}
function argumentsForCli(positional: readonly string[]) {
  assert.ok(positional.length <= 3, "Too many payload arguments");
  return { baselineUrl: localBaseUrl(positional[0], "baseline URL"), candidateUrl: localBaseUrl(positional[1], "candidate URL"),
    outputRoot: resolve(positional[2] ?? "output/playwright/object-payloads") };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = argumentsForCli(process.argv.slice(2));
  let browser: Browser | undefined, runStarted = false;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, executablePath: CHROME_EXECUTABLE,
      args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"] });
    runStarted = true;
    const report = await runPayloadComparison<Page>({ ...options, browser });
    console.log(JSON.stringify({ outputRoot: options.outputRoot, complete: report.complete,
      cases: report.cases.map(({ id, dpr, bodyBytes, responseCount }) => ({ id, dpr, bodyBytes, responseCount })), errors: report.errors }, null, 2));
    if (!report.complete) process.exitCode = 1;
  } catch (error) {
    await mkdir(options.outputRoot, { recursive: true });
    const failure = { schema: "cssearth-object-payload@2", complete: false,
      cases: [], errors: [{ phase: "setup", error: errorMessage(error) }], capturedAt: new Date().toISOString() };
    await writeFile(resolve(options.outputRoot, "failure.json"), JSON.stringify(failure, null, 2) + "\n");
    if (!runStarted) await writeFile(resolve(options.outputRoot, "report.json"), JSON.stringify(failure, null, 2) + "\n");
    console.error(error); process.exitCode = 1;
  } finally { await browser?.close(); }
}
