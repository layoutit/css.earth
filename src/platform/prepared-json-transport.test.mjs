import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readPreparedJson } from "./prepared-json-transport.mjs";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const decoded = Buffer.from(JSON.stringify({ places: [{id:"example"}] })), packed = gzipSync(decoded);
const ref = { bytes: packed.length, sha256: hash(packed), encoding:"gzip", decodedBytes:decoded.length, decodedSha256:hash(decoded) };
test("prepared gzip transport verifies both the compressed identity and bounded decoded data", async () => {
  assert.deepEqual(await readPreparedJson(new Response(packed),ref),JSON.parse(decoded));
  await assert.rejects(readPreparedJson(new Response(packed),{...ref,decodedBytes:1}),/size drifted/);
  await assert.rejects(readPreparedJson(new Response(packed),{...ref,decodedSha256:"0".repeat(64)}),/identity drifted/);
  await assert.rejects(readPreparedJson(new Response(packed),{...ref,decodedBytes:64*1024*1024}),/capacity/);
});
test("oversized prepared transport cancels the response before accepting the payload", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(16)); }, cancel() { cancelled = true; } }));
  await assert.rejects(readPreparedJson(response,{bytes:2,sha256:"0".repeat(64)}),/size drifted/);
  assert.equal(cancelled,true);
});
