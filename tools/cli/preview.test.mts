import { required } from '../contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { previewSite } from "./preview.mts";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import type { AddressInfo } from "node:net";
function addressPort(address: string | AddressInfo | null) { assert.ok(address && typeof address !== "string"); return address.port; }
import { wmtsLocalMirror } from "../objects/geographic-pages/operations/wmts-local-server.mts";

test("standard preview serves built routes and bounded prepared ranges outside dist", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-preview-"));
  const version = "1111111111111111", bytes = Buffer.from("prepared-pack-fixture");
  let server;
  try {
    await mkdir(join(root, "dist/earth"), { recursive: true });
    await mkdir(join(root, "geometry", version), { recursive: true });
    await writeFile(join(root, "dist/earth/index.html"), "<h1>built Earth</h1>");
    await writeFile(join(root, "geometry", version, "8-86-154.pack"), bytes);
    server = await previewSite({ root, port: 0,
      geometryDirectory: pathToFileURL(join(root, "geometry") + "/") });
    const base = `http://127.0.0.1:${addressPort(server.httpServer.address())}`;
    assert.match(await (await fetch(`${base}/earth/`)).text(), /built Earth/u);
    assert.equal((await fetch(`${base}/missing/`)).status, 404);
    const url = `${base}/scenes/earth/wmts-${version}/8-86-154.pack`;
    const result = await fetch(url, { headers: { Range: "bytes=3-10" } });
    assert.equal(result.status, 206);
    assert.equal(result.headers.get("content-range"), `bytes 3-10/${bytes.length}`);
    assert.match(required(result.headers.get("cache-control")), /immutable/u);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes.subarray(3, 11));
    assert.equal((await fetch(url)).status, 416);
    assert.equal((await fetch(url, { headers: { Range: "bytes=0-999" } })).status, 416);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    const head = await fetch(url, { method: "HEAD", headers: { Range: "bytes=3-10" } });
    assert.equal(head.status, 206); assert.equal(await head.text(), "");
  } finally { await server?.close(); await rm(root, { recursive: true, force: true }); }
});

test("missing mirrors stream bounded published ranges and reject malformed upstream responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-remote-geometry-"));
  const requests: { url: string; headers: Headers }[] = [];
  let malformed = false;
  const vite = await createViteServer({root,configFile:false,server:{middlewareMode:true},plugins:[
  wmtsLocalMirror({objectId:"earth", directory: pathToFileURL(root + "/"), assetOrigin: "https://example.invalid",
    fetcher: async (url, options) => {
      requests.push({ url: String(url), headers: new Headers(options?.headers) });
      return new Response(required(options).method === "HEAD" ? null : "abcdefgh", {
        status: 206, headers: { "Content-Range": malformed ? "bytes 0-7/20" : "bytes 3-10/20" },
      });
    } })]});
  const server = createServer((req, res) => vite.middlewares(req, res, () => { res.statusCode = 404; res.end(); }));
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${addressPort(server.address())}/scenes/earth/wmts-1111111111111111/8-86-154.pack`;
    assert.equal((await fetch(url)).status, 416);
    assert.equal(requests.length, 0);
    const response = await fetch(url, { headers: { Range: "bytes=3-10" } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 3-10/20");
    assert.equal(await response.text(), "abcdefgh");
    assert.equal(requests[0].headers.get("Range"), "bytes=3-10");
    assert.equal(new URL(requests[0].url).origin, "https://example.invalid");
    const head = await fetch(url, { method: "HEAD", headers: { Range: "bytes=3-10" } });
    assert.equal(head.status, 206);
    assert.equal(await head.text(), "");
    malformed = true;
    assert.equal((await fetch(url, { headers: { Range: "bytes=3-10" } })).status, 502);
  } finally {
    await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
    await vite.close();
    await rm(root, { recursive: true, force: true });
  }
});
