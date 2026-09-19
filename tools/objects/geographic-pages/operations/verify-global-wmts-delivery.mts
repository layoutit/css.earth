import type { BlockReference } from '../contracts.mts';
import { shape, text, array, parseTileStub, parseBlockReference } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const plan=await context.readPrepared('pages',shape({geometryVersion:text,geometryOrigin:text,roots:array(parseTileStub)}));
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

import { readPreparedWmtsBlock } from "../../../../src/renderers/css/dist/preparation.js";

const root = context.projectRoot;
const output = resolve(root, `output/${context.objectId}-city/global-delivery/${Date.now()}`);
await mkdir(output, { recursive: true });
const rootNode = plan.roots.find(node => node.key === "wmts-tile-5-10-19");
assert.ok(rootNode,"Delivery proof root is missing");
const rootRef = rootNode.directory;
interface DeliveryReport { version:string; output:string; ranges:{url:string;visit:number;status:number;headers:Record<string,string>}[]; cors:{origin:string;url:string;result:{status:number;bytes:number;sha256:string;range:string|null;etag:string|null;cache:string|null}}[]; missing:{visit:number;status:number;cache:string|null}[]; complete:boolean; browser?:string; cacheHit?:boolean; error?:string }
const report: DeliveryReport = { version: plan.geometryVersion, output, ranges: [], cors: [], missing: [], complete: false };
let browser;
async function read(ref: BlockReference) {
  const url = new URL(ref.url, plan.geometryOrigin).href;
  let data;
  for (let visit = 0; visit < 3; visit++) {
    const response = await fetch(url, { headers: { Origin: "https://css.earth",
      Range: `bytes=${ref.offset}-${ref.offset + ref.bytes - 1}`, "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(30000) });
    const headers = Object.fromEntries(response.headers);
    report.ranges.push({ url, visit, status: response.status, headers });
    assert.equal(headers["access-control-allow-origin"], "https://css.earth");
    for (const name of ["content-range", "content-length", "accept-ranges", "etag"]) {
      assert.ok(headers["access-control-expose-headers"]?.toLowerCase().split(/\s*,\s*/u).includes(name), `CORS must expose ${name}`);
    }
    data = await readPreparedWmtsBlock(response, ref, AbortSignal.timeout(30000));
  }
  assert.ok(data,"Delivery proof produced no directory");
  return data;
}
try {
  const coarse = await read(rootRef);
  const regionNode = coarse.external.find(node => node.key === "wmts-tile-8-86-154");
  assert.ok(regionNode,"Delivery proof region is missing");
  const regionRef = parseBlockReference(regionNode.directory);
  const region = await read(regionRef);
  const detailNode = region.external.find(node => node.key === "wmts-tile-11-691-1234") ?? region.external[0];
  assert.ok(detailNode,"Delivery proof detail is missing");
  const detailRef = parseBlockReference(detailNode.directory);
  await read(detailRef);
  // Never retain a publication-time 404 on an immutable asset URL.
  const missingUrl = new URL(`${context.assetPath}wmts-${plan.geometryVersion}/0-0-0.pack?delivery-proof=${Date.now()}`, plan.geometryOrigin);
  for (let visit = 0; visit < 2; visit++) {
    const response = await fetch(missingUrl, { method: "HEAD", signal: AbortSignal.timeout(30000) });
    const cache = response.headers.get("cf-cache-status");
    report.missing.push({ visit, status: response.status, cache });
    assert.equal(response.status, 404);
    assert.ok(["BYPASS", "DYNAMIC"].includes(cache??""), "Missing geometry must bypass the CDN cache.");
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  report.browser = browser.version();
  // A minimal document on each permitted origin checks actual browser CORS.
  // Only the document is supplied locally; every pack goes to the public R2 domain.
  for (const origin of ["https://css.earth", "http://127.0.0.1:4228"]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route(`${origin}/delivery-proof`, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Geometry delivery proof</title>" }));
      await page.goto(`${origin}/delivery-proof`);
      for (const ref of [rootRef, regionRef, detailRef]) {
        const result = await page.evaluate(async ({ ref, geometryOrigin }) => {
          const response = await fetch(new URL(ref.url, geometryOrigin), { headers: { Range: `bytes=${ref.offset}-${ref.offset + ref.bytes - 1}` } });
          const bytes = await response.arrayBuffer();
          const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
          return { status: response.status, bytes: bytes.byteLength, sha256,
            range: response.headers.get("Content-Range"), etag: response.headers.get("ETag"), cache: response.headers.get("CF-Cache-Status") };
        }, { ref, geometryOrigin: plan.geometryOrigin });
        report.cors.push({ origin, url: ref.url, result });
        assert.equal(result.status, 206); assert.equal(result.bytes, ref.bytes);
        assert.equal(result.sha256, ref.sha256); assert.ok(result.range && result.etag);
      }
    } finally { await context.close(); }
  }
  report.cacheHit = report.ranges.some(r => r.headers["cf-cache-status"] === "HIT");
  assert.ok(report.cacheHit, "Public geometry ranges have not demonstrated a CDN cache HIT.");
  report.complete = true;
} catch (error) { report.error = error instanceof Error ? error.message : String(error); throw error; }
finally {
  await browser?.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, complete: report.complete, cacheHit: report.cacheHit, error: report.error }));
}
