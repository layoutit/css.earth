import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewSite } from "./preview.mts";
import type { AddressInfo } from "node:net";
function addressPort(address: string | AddressInfo | null) { assert.ok(address && typeof address !== "string"); return address.port; }

test("standard preview serves built routes from dist", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-preview-"));
  let server;
  try {
    await mkdir(join(root, "dist/earth"), { recursive: true });
    await writeFile(join(root, "dist/earth/index.html"), "<h1>built Earth</h1>");
    server = await previewSite({ root, port: 0 });
    const base = `http://127.0.0.1:${addressPort(server.httpServer.address())}`;
    assert.match(await (await fetch(`${base}/earth/`)).text(), /built Earth/u);
    assert.equal((await fetch(`${base}/missing/`)).status, 404);
  } finally { await server?.close(); await rm(root, { recursive: true, force: true }); }
});
