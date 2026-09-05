import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { previewSite } from "./preview.mjs";

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
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    assert.match(await (await fetch(`${base}/earth/`)).text(), /built Earth/u);
    assert.equal((await fetch(`${base}/missing/`)).status, 404);
    const url = `${base}/scenes/earth/wmts-${version}/8-86-154.pack`;
    const result = await fetch(url, { headers: { Range: "bytes=3-10" } });
    assert.equal(result.status, 206);
    assert.equal(result.headers.get("content-range"), `bytes 3-10/${bytes.length}`);
    assert.match(result.headers.get("cache-control"), /immutable/u);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes.subarray(3, 11));
    assert.equal((await fetch(url)).status, 416);
    assert.equal((await fetch(url, { headers: { Range: "bytes=0-999" } })).status, 416);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    const head = await fetch(url, { method: "HEAD", headers: { Range: "bytes=3-10" } });
    assert.equal(head.status, 206); assert.equal(await head.text(), "");
  } finally { await server?.close(); await rm(root, { recursive: true, force: true }); }
});
