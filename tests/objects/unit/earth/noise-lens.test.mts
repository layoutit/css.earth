import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { PREPARED_EARTH_LENSES, runtimeDefinition } from "./prepared-fixture.mts";

test("archived city noise source remains pinned but is absent from the globe MVP", async () => {
  const pin=JSON.parse(await readFile(new URL("../../../../src/planets/earth/source/noise/manifest.json",import.meta.url)));
  const source=gunzipSync(await readFile(new URL(`../../../../src/planets/earth/source/noise/${pin.file}`,import.meta.url)));
  assert.equal(createHash("sha256").update(source).digest("hex"),pin.decodedSha256);
  assert.equal(JSON.parse(source).features.length,181);
  assert.equal(PREPARED_EARTH_LENSES.controls.some(lens=>lens.id==="buenos-aires-noise"),false);
  assert.deepEqual(runtimeDefinition.pageLayers,[]);
  const assets=JSON.parse(await readFile(new URL("../../../../src/planets/earth/runtime-assets.json",import.meta.url)));
  assert.equal(assets.assets.some(asset=>/noise|places|city|wmts/.test(asset.filename)),false);
});
