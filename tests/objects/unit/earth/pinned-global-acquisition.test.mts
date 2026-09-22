import {parseCitySource,parseCatalogPin} from '../../../../tools/objects/geographic-pages/source-records.mts';
import {validateSourceManifest, type SourceEntry} from '../../../../src/platform/source-manifest.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { acquirePinnedGlobalWmts } from "../../../../tools/objects/geographic-pages/operations/acquire-pinned-global-wmts.mts";

const version = "1111111111111111", sourcePath = "src/objects/earth/source/";
const fixtureOrigin = "https://wmts-fixture.invalid";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const actualManifest = validateSourceManifest('earth',JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/manifest.json", import.meta.url))).toString('utf8')));
const catalogPin = await readFile(new URL("../../../../src/objects/earth/source/city/catalog-pin.json", import.meta.url));
const catalogBytes = await readFile(new URL("../../../../src/objects/earth/source/city/worldcover-rgbnir-2021.json.gz", import.meta.url));
const actualContent = parseCitySource(JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/city/manifest.json", import.meta.url))).toString('utf8')));

async function fixture(t: test.TestContext) {
  const projectRoot = await mkdtemp(resolve(tmpdir(), "cssearth-acquire-pinned-"));
  const packs = new Map(["5-0-0.pack", "8-0-0.pack", "8-0-1.pack", "8-1-0.pack"]
    .map((filename, i) => [filename, Buffer.from(`pinned pack ${i}: ${"x".repeat(20 + i)}`)]));
  const plans = new Map<string,{status?:number;body?:Buffer;chunked?:boolean;length?:number;location?:string;delay?:number}>(), requests: { url: string|undefined; method: string|undefined; encoding: string|undefined; }[] = [];
  let active = 0, maximumActive = 0, requested:()=>void=()=>{throw new Error('Request gate was not initialized');};
  const firstRequest = new Promise<void>(done => { requested = done; });
  const server = createServer(async (request, response) => {
    active++; maximumActive = Math.max(active, maximumActive);
    response.once("close", () => active--);
    requests.push({ url: request.url, method: request.method, encoding: request.headers["accept-encoding"] });
    const filename = required(required(request.url).split("/").at(-1)), plan = plans.get(filename) ?? {};
    response.statusCode = plan.status ?? 200;
    const body = plan.body ?? packs.get(filename) ?? Buffer.from("not found");
    if (!plan.chunked) response.setHeader("Content-Length", plan.length ?? body.length);
    if (plan.location) response.setHeader("Location", plan.location);
    requested();
    if (plan.chunked) response.write(body.subarray(0, 2));
    await delay(plan.delay ?? 25);
    response.end(plan.chunked ? body.subarray(2) : body);
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address=server.address();assert.ok(address&&typeof address==="object");
  const localOrigin = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((done,reject) => server.close(error=>error?reject(error):done()));
    await rm(projectRoot, { recursive: true, force: true });
  });
  const files = [...packs].map(([filename, bytes]) => ({ filename, bytes: bytes.length, sha256: hash(bytes) }));
  const release = { schema: "cssearth-global-wmts-release@1", version, dataset: actualContent.dataset,
    sourceSha256: parseCatalogPin(JSON.parse(catalogPin.toString('utf8'))).expectedSha256, bytes: files.reduce((n, file) => n + file.bytes, 0), files };
  const content = { ...actualContent, delivery: { ...actualContent.delivery, assetOrigin: fixtureOrigin } };
  const records = new Map([
    ["city/wmts-release.json", Buffer.from(JSON.stringify(release))],
    ["city/manifest.json", Buffer.from(JSON.stringify(content))],
    ["city/catalog-pin.json", catalogPin], ["city/worldcover-rgbnir-2021.json.gz", catalogBytes],
  ]);
  const rewriteSources = async () => {
    const pinned = <T extends SourceEntry,>(entries: readonly T[]) => entries.filter(entry => records.has(entry.path)).map(entry => ({ ...entry,
      expectedBytes: required(records.get(entry.path)).length, expectedSha256: hash(required(records.get(entry.path))) }));
    const manifest = { ...actualManifest, inputs: pinned(actualManifest.inputs),
      generatedIntermediates: pinned(actualManifest.generatedIntermediates), documents: pinned(actualManifest.documents) };
    await mkdir(resolve(projectRoot, sourcePath, "city"), { recursive: true });
    for (const [path, bytes] of records) await writeFile(resolve(projectRoot, sourcePath, path), bytes);
    await writeFile(resolve(projectRoot, sourcePath, "manifest.json"), JSON.stringify(manifest));
  };
  await rewriteSources();
  const path = (filename: string) => resolve(projectRoot, ".local/wmts-global", version, filename);
  const seed = async (selected = packs, targetVersion = version) => {
    const directory = resolve(projectRoot, ".local/wmts-global", targetVersion);
    await mkdir(directory, { recursive: true });
    for (const [filename, bytes] of selected) await writeFile(resolve(directory, filename), bytes);
  };
  const fetcher: typeof fetch = (url, options) => {
    const requestedUrl = new URL(url instanceof Request?url.url:url);
    assert.equal(requestedUrl.origin, fixtureOrigin);
    assert.equal(required(options).redirect, "error");
    return fetch(localOrigin + requestedUrl.pathname, options);
  };
  return { projectRoot, packs, plans, requests, files, release, content, records, rewriteSources, fetcher, path, seed,
    firstRequest, maximumActive: () => maximumActive, localOrigin };
}

test("an empty checkout acquires exact pinned packs with bounded concurrency and resumes without network", async t => {
  const f = await fixture(t), report = await acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, fetcher: f.fetcher, concurrency: 2 });
  assert.equal(report.verifiedPacks, f.files.length); assert.equal(report.downloadedPacks, f.files.length);
  assert.equal(report.downloadedBytes, f.release.bytes); assert.equal(report.version, version);
  assert.equal(report.geometry, "verified-pinned-input-not-regenerated");
  assert.equal(f.maximumActive(), 2);
  assert.deepEqual(f.requests.map(request => request.url).sort(), f.files.map(file => `/scenes/earth/wmts-${version}/${file.filename}`).sort());
  for (const request of f.requests) { assert.equal(request.method, "GET"); assert.equal(request.encoding, "identity"); }
  for (const [filename, bytes] of f.packs) assert.deepEqual(await readFile(f.path(filename)), bytes);
  assert.deepEqual((await readdir(resolve(f.projectRoot, ".local/wmts-global", version))).sort(), [...f.packs.keys()].sort());
  const noNetwork = () => { throw new Error("verification must not access the network"); };
  for (const verifyOnly of [true, false]) {
    const reused = await acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, verifyOnly, fetcher: noNetwork });
    assert.equal(reused.verifiedPacks, f.files.length); assert.equal(reused.downloadedPacks, 0);
  }
});

test("verify-only rejects missing, corrupt, wrong-size and other-version packs without writes or requests", async t => {
  for (const kind of ["missing", "corrupt", "wrong-size", "other-version"]) {
    const f = await fixture(t), [filename, valid] = [...f.packs][0];
    if (kind === "other-version") await f.seed(f.packs, "2222222222222222");
    else if (kind !== "missing") {
      await f.seed(); const broken = kind === "corrupt" ? Buffer.from(valid) : Buffer.from("short");
      broken[0] ^= 1; await writeFile(f.path(filename), broken);
    }
    const previous = kind === "corrupt" || kind === "wrong-size" ? await readFile(f.path(filename)) : null;
    await assert.rejects(acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, verifyOnly: true, fetcher: f.fetcher }));
    assert.equal(f.requests.length, 0);
    if (previous) assert.deepEqual(await readFile(f.path(filename)), previous);
    else await assert.rejects(readFile(f.path(filename)), { code: "ENOENT" });
  }
});

test("invalid downloads cannot replace a corrupt existing pack or leave a partial file", async t => {
  for (const kind of ["wrong-hash", "wrong-size", "oversized-body", "http-error", "redirect"]) {
    const f = await fixture(t), [filename, valid] = [...f.packs][0], corrupt = Buffer.from(valid);
    corrupt[0] ^= 1; await f.seed(); await writeFile(f.path(filename), corrupt);
    const bad = Buffer.from(valid); bad[1] ^= 1;
    f.plans.set(filename, kind === "wrong-hash" ? { body: bad } : kind === "wrong-size" ? { body: Buffer.from("short") } :
      kind === "oversized-body" ? { body: Buffer.concat([valid, Buffer.from("extra")]), chunked: true } :
      kind === "http-error" ? { status: 503 } : { status: 302, location: f.localOrigin + "/other-version.pack" });
    await assert.rejects(acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, fetcher: f.fetcher, concurrency: 2 }));
    assert.deepEqual(await readFile(f.path(filename)), corrupt);
    assert.deepEqual((await readdir(resolve(f.projectRoot, ".local/wmts-global", version))).sort(), [...f.packs.keys()].sort());
    assert.equal(f.requests.length, 1);
  }
});

test("a corrupt pack remains intact until its complete valid replacement is ready", async t => {
  const f = await fixture(t), [filename, valid] = [...f.packs][0], corrupt = Buffer.from(valid);
  corrupt[0] ^= 1; await f.seed(); await writeFile(f.path(filename), corrupt);
  f.plans.set(filename, { chunked: true, delay: 80 });
  const pending = acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, fetcher: f.fetcher });
  await f.firstRequest;
  assert.deepEqual(await readFile(f.path(filename)), corrupt);
  const report = await pending;
  assert.equal(report.downloadedPacks, 1); assert.equal(report.downloadedBytes, valid.length);
  assert.deepEqual(await readFile(f.path(filename)), valid);
});

test("source drift, invalid versions and paths fail before any acquisition", async t => {
  for (const kind of ["untrusted-bytes", "invalid-version", "wrong-catalog", "wrong-dataset", "unsafe-prefix", "unsafe-origin"]) {
    const f = await fixture(t);
    if (kind === "untrusted-bytes") await writeFile(resolve(f.projectRoot, sourcePath, "city/wmts-release.json"), "{}");
    else {
      if (kind === "invalid-version") f.release.version = "../other-version";
      if (kind === "wrong-catalog") f.release.sourceSha256 = "0".repeat(64);
      if (kind === "wrong-dataset") f.release.dataset = "another-dataset";
      if (kind === "unsafe-prefix") f.content.delivery.keyPrefix = "../other";
      if (kind === "unsafe-origin") f.content.delivery.assetOrigin = f.localOrigin;
      f.records.set("city/wmts-release.json", Buffer.from(JSON.stringify(f.release)));
      f.records.set("city/manifest.json", Buffer.from(JSON.stringify(f.content)));
      await f.rewriteSources();
    }
    await assert.rejects(acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, fetcher: f.fetcher }));
    assert.equal(f.requests.length, 0);
    await assert.rejects(readdir(resolve(f.projectRoot, ".local/wmts-global")), { code: "ENOENT" });
  }
});

test("acquisition drains in-flight writers and stops scheduling new packs after a failure", async t => {
  const f = await fixture(t), [first, second] = f.files;
  f.plans.set(first.filename, { status: 503, delay: 0 });
  f.plans.set(second.filename, { delay: 60 });
  await assert.rejects(acquirePinnedGlobalWmts({objectId:"earth", projectRoot: f.projectRoot, fetcher: f.fetcher, concurrency: 2 }));
  assert.equal(f.requests.length, 2); assert.ok(f.maximumActive() <= 2);
  assert.deepEqual(await readFile(f.path(second.filename)), f.packs.get(second.filename));
  assert.deepEqual(await readdir(resolve(f.projectRoot, ".local/wmts-global", version)), [second.filename]);
});
