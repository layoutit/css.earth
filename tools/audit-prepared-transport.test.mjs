import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { encodePreparedBlock } from "../src/planets/earth/tools/city/encode-prepared-block.mjs";
import { loadAuditPreparedTransports, verifyAuditPreparedTransportResponses } from "./audit-prepared-transport.mjs";

const sha = value => createHash("sha256").update(value).digest("hex");
const baseUrl = "http://127.0.0.1:4210", version = "0123456789abcdef";
const identity = { sha256: "a".repeat(64), session: "source-session" };
const source = { path: "src/planets/earth/runtime/preparedPresentation.mjs", sha256: "b".repeat(64), export: "PREPARED_PRESENTATION", selector: "pageLayers[0].plan" };
const localHeaders = { "x-cssearth-audit-source": identity.sha256, "x-cssearth-audit-session": identity.session };
const page = { key: "child", rasterSource: "terrascope-wmts@1", url: "https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/webmercator/14/5535/9872.png", width: 256, height: 256 };
const png = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 12, g: 30, b: 60, alpha: 1 } } }).png().toBuffer();
function packed(key, nodes, external = [], dataset = "source-dataset", offset = 27) {
  const decoded = encodePreparedBlock([{ metadataOnly: true }], { envelope: { schema: "cssearth-city-index@1", dataset, metadataOnly: true, nodes, external } });
  const body = gzipSync(decoded), ref = { encoding: "gzip-cssearth-prepared-columns@1", bytes: body.length, sha256: sha(body), decodedBytes: decoded.length, decodedSha256: sha(decoded), url: `/scenes/earth/wmts-${version}/${key}.pack`, offset };
  const response = { url: new URL(ref.url, baseUrl).href, status: 206, body,
    requestHeaders: { range: `bytes=${offset}-${offset + body.length - 1}` }, headers: { ...localHeaders, "content-range": `bytes ${offset}-${offset + body.length - 1}/${offset + body.length}` } };
  return { ref, response };
}
function fixture() {
  const child = packed("8-1-1", [{ ...page, level: 8, children: [], pages: [] }]);
  const root = packed("5-1-1", [{ key: "root", level: 5, children: ["child"], pages: [] }], [{ key: "child", level: 6, stub: true, directory: child.ref }]);
  const plan = { schema: "cssearth-prepared-map-pages@1", dataset: "source-dataset", assetPath: "/scenes/earth/", assetOrigin: "https://earth-assets.lowpoly.cc", geometryOrigin: "https://earth-assets.lowpoly.cc", geometryVersion: version,
    roots: [{ key: "root", directory: root.ref }], initialLayer: null, index: { maximumDirectoryBytes: 2 * 1024 * 1024 } };
  const image = { url: page.url, status: 200, headers: { "content-type": "image/png" }, body: png };
  return { plan, child, root, image, responses: [image, child.response, root.response] };
}
const verify = (f, responses = f.responses) => verifyAuditPreparedTransportResponses({ plans: [{ source, plan: f.plan }], responses, baseUrl, identity });

test("audit verifies child-before-parent ranges and only metadata-reachable dataset image bytes", async () => {
  const f = fixture(), report = await verify(f);
  assert.equal(report.receipts.length, 3);
  assert.equal(report.loadedAssets[page.url], sha(png));
  const image = report.receipts.find(receipt => receipt.kind === "image");
  assert.equal(image.sourceByteIdentity, "observed-response-sha256");
  assert.equal(image.proof.directory, `${f.child.ref.url}#${f.child.response.requestHeaders.range}`);
  const root = report.receipts.find(receipt => receipt.url.startsWith(f.root.ref.url));
  assert.equal(root.decodedSha256, f.root.ref.decodedSha256);
  assert.equal(root.offset, 27);
  assert.equal(report.responses.length, 3);
});

test("initial prepared imagery qualifies without authorizing unrelated URLs on the same provider", async () => {
  const f = fixture(); f.plan = { ...f.plan, roots: [], initialLayer: page };
  assert.equal((await verify(f, [f.image])).receipts.length, 1);
  await assert.rejects(verify(f, [{ ...f.image, url: page.url.replace("5535", "5536") }]), /Undeclared or unreachable/);
  await assert.rejects(verify(f, [{ ...f.image, url: page.url.replace("mapproxy.terrascope.be", "example.com") }]), /Undeclared or unreachable/);
  await assert.rejects(verify(f, [{ ...f.image, url: `${page.url}?arbitrary=true` }]), /Undeclared or unreachable/);
});

test("unverified parents do not authorize descendant responses", async () => {
  const f = fixture();
  await assert.rejects(verify(f, [f.image, f.child.response]), /Undeclared or unreachable/);
});

for (const [name, change, message] of [
  ["full 200", response => ({ ...response, status: 200 }), /status mismatch/],
  ["wrong request range", response => ({ ...response, requestHeaders: { range: "bytes=0-17" } }), /Undeclared or unreachable/],
  ["wrong Content-Range", response => ({ ...response, headers: { ...response.headers, "content-range": "bytes 0-17/18" } }), /exact range/],
  ["missing source headers", response => ({ ...response, headers: { "content-range": response.headers["content-range"] } }), /not bound/],
  ["other source session", response => ({ ...response, headers: { ...response.headers, "x-cssearth-audit-session": "other-session" } }), /another audit/],
  ["encoded corruption", response => ({ ...response, body: Buffer.from(response.body).fill(1, 0, 1) }), /hash mismatch/],
  ["truncated bytes", response => ({ ...response, body: response.body.subarray(1) }), /byte length mismatch/],
  ["redirect", response => ({ ...response, redirectedFrom: "https://example.com/initial.pack" }), /Redirected/],
  ["changed request URL", response => ({ ...response, requestUrl: `${response.url}?original` }), /changed request URL/],
]) test(`audit rejects ${name} transport`, async () => {
  const f = fixture();
  await assert.rejects(verify(f, [change(f.root.response)]), message);
});

test("decoded hash and source geometry version remain independent requirements", async () => {
  const f = fixture();
  f.plan = { ...f.plan, roots: [{ key: "root", directory: { ...f.root.ref, decodedSha256: "0".repeat(64) } }] };
  await assert.rejects(verify(f, [f.root.response]), /hash mismatch/);
  f.plan.geometryVersion = "fedcba9876543210";
  await assert.rejects(verify(f, [f.root.response]), /version mismatch/);
});

test("hash-bound metadata cannot change the declared dataset", async () => {
  const f = fixture(), other = packed("5-1-1", [{ key: "root", level: 5, children: [], pages: [] }], [], "other-dataset");
  f.plan.roots = [{ key: "root", directory: other.ref }];
  await assert.rejects(verify(f, [other.response]), /dataset or topology/);
});

test("unreachable source nodes cannot smuggle image authorization into a decoded directory", async () => {
  const f = fixture(), other = packed("5-1-1", [{ key: "root", level: 5, children: [], pages: [] }, { ...page, level: 5, children: [], pages: [] }]);
  f.plan.roots = [{ key: "root", directory: other.ref }];
  await assert.rejects(verify(f, [f.image, other.response]), /unreachable nodes/);
});

test("dataset responses require exact dimensions, PNG bodies and consistent repeated bytes", async () => {
  const f = fixture(); f.plan = { ...f.plan, roots: [], initialLayer: page };
  await assert.rejects(verify(f, [{ ...f.image, headers: { "content-type": "application/xml" } }]), /not a PNG/);
  const small = await sharp({ create: { width: 128, height: 256, channels: 4, background: "black" } }).png().toBuffer();
  await assert.rejects(verify(f, [{ ...f.image, body: small }]), /width mismatch/);
  const other = await sharp({ create: { width: 256, height: 256, channels: 4, background: "white" } }).png().toBuffer();
  await assert.rejects(verify(f, [f.image, { ...f.image, body: other }]), /changed during capture/);
});

test("pinned relative raster metadata still requires recorded audit source identity and exact bytes", async () => {
  const f = fixture(), url = "/scenes/earth/noise-fixture.png";
  f.plan = { ...f.plan, roots: [], initialLayer: { ...page, rasterSource: "prepared-noise@1", url, bytes: png.length, sha256: sha(png) } };
  const response = { ...f.image, url: new URL(url, baseUrl).href, headers: { ...localHeaders, "content-type": "image/png" } };
  const report = await verify(f, [response]);
  assert.equal(report.receipts[0].sourceByteIdentity, "prepared-sha256");
  await assert.rejects(verify(f, [{ ...response, body: Buffer.from(png).fill(0, 8, 12) }]), /hash mismatch/);
});

test("discovery uses mounted normalized page layers and pins old literal source metadata without executing it", async t => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-audit-transport-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "src/planets/earth/runtime"); await mkdir(directory, { recursive: true });
  const f = fixture(), old = JSON.stringify({ ...f.plan, assetPath: undefined });
  await writeFile(join(directory, "preparedCityPages.mjs"), `export const PREPARED_PAGES = ${old};\n`);
  await writeFile(join(directory, "preparedRowCache.mjs"), "throw new Error('legacy code must never execute');\n");
  const legacy = await loadAuditPreparedTransports({ root, objectId: "earth" });
  assert.equal(legacy.length, 1); assert.equal(legacy[0].plan.assetPath, "/scenes/earth/");
  assert.equal(legacy[0].source.export, "PREPARED_PAGES");
  await writeFile(join(directory, "preparedPresentation.mjs"), `export const PREPARED_PRESENTATION = ${JSON.stringify({ pageLayers: [{ plan: f.plan }] })};\n`);
  const normalized = await loadAuditPreparedTransports({ root, objectId: "earth" });
  assert.equal(normalized.length, 1); assert.equal(normalized[0].source.selector, "pageLayers[0].plan");
  await writeFile(join(directory, "preparedPresentation.mjs"), "export const PREPARED_PRESENTATION = {\"pageLayers\":[]};\n");
  assert.deepEqual(await loadAuditPreparedTransports({ root, objectId: "earth" }), [], "Unused legacy plans cannot authorize images");
  await assert.rejects(loadAuditPreparedTransports({ root, objectId: "earth", sourceSnapshot: { files: {} } }), /source changed/);
});


test("decoded blob images must match a verified reachable upstream response byte for byte", async () => {
  const f = fixture(); f.plan = { ...f.plan, roots: [], initialLayer: page };
  const blob = { url: `blob:${baseUrl}/native-image-id`, status: 200, resourceType: "image", headers: { "content-type": "image/png" }, body: png };
  const report = await verify(f, [blob, f.image]);
  assert.equal(report.decodedImages.length, 1);
  assert.deepEqual(report.decodedImages[0].sources, [page.url]);
  assert.equal(report.loadedAssets[page.url], sha(png));
  assert.equal(Object.keys(report.loadedAssets).length, 1);
  await assert.rejects(verify(f, [blob]), /no verified source response/);
  await assert.rejects(verify(f, [f.image, { ...blob, body: Buffer.from(png).fill(1, 0, 1) }]), /no verified source response/);
  await assert.rejects(verify(f, [f.image, { ...blob, url: "blob:https://example.com/native-image-id" }]), /another origin/);
  await assert.rejects(verify(f, [f.image, { ...blob, resourceType: "script" }]), /direct, complete image/);
});

test("inventoried prepared images still require graph reachability before authorizing decoded blobs", async () => {
  const f = fixture(), url = "/scenes/earth/noise-fixture.png";
  f.plan = { ...f.plan, roots: [], initialLayer: { ...page, rasterSource: "prepared-noise@1", url, bytes: png.length, sha256: sha(png) } };
  const sourceImage = { ...f.image, url: new URL(url, baseUrl).href,
    headers: { ...localHeaders, "content-type": "image/png" } };
  const blob = { url: `blob:${baseUrl}/inventory-image-id`, status: 200, resourceType: "image", headers: {}, body: png };
  const check = (sourceAssetResponses, plans = [{ source, plan: f.plan }]) =>
    verifyAuditPreparedTransportResponses({ plans, responses: [blob], sourceAssetResponses, baseUrl, identity });
  const result = await check([sourceImage]);
  assert.equal(result.loadedAssets[url], sha(png));
  assert.equal(result.responses[0].sourceInventory, true);
  assert.deepEqual(result.decodedImages[0].sources, [url]);
  await assert.rejects(check([sourceImage], []), /no verified source response/);
  await assert.rejects(check([{ ...sourceImage, url: new URL("/scenes/earth/unrelated.png", baseUrl).href }]), /no verified source response/);
  await assert.rejects(check([{ ...sourceImage, headers: {} }]), /not bound/);
  await assert.rejects(check([{ ...sourceImage, body: Buffer.from(png).fill(0, 8, 12) }]), /hash mismatch/);
});

test("an inventoried image becomes reachable only after its declared parent directory verifies", async () => {
  const f = fixture(), url = "/scenes/earth/noise-fixture.png";
  const localPage = { ...page, rasterSource: "prepared-noise@1", url, bytes: png.length, sha256: sha(png), level: 6, children: [], pages: [] };
  const directory = packed("5-1-1", [{ key: "root", level: 5, children: ["child"], pages: [] }, localPage]);
  f.plan = { ...f.plan, roots: [{ key: "root", directory: directory.ref }] };
  const sourceImage = { ...f.image, url: new URL(url, baseUrl).href, headers: { ...localHeaders, "content-type": "image/png" } };
  const blob = { url: `blob:${baseUrl}/late-declaration`, status: 200, resourceType: "image", headers: {}, body: png };
  const report = await verifyAuditPreparedTransportResponses({ plans: [{ source, plan: f.plan }],
    responses: [blob, directory.response], sourceAssetResponses: [sourceImage], baseUrl, identity });
  assert.equal(report.receipts.length, 2);
  assert.equal(report.loadedAssets[url], sha(png));
  await assert.rejects(verifyAuditPreparedTransportResponses({ plans: [{ source, plan: f.plan }],
    responses: [blob], sourceAssetResponses: [sourceImage], baseUrl, identity }), /no verified source response/);
});
