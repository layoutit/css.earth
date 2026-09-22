import {shape,array,text} from "../../../../tools/objects/geographic-pages/source-records.mts";
import {requireRecord} from "../../../../tools/sources/source-values.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { PREPARED_EARTH_LENSES, runtimeDefinition } from "./prepared-fixture.mts";

test("archived city noise source remains pinned but is absent from the globe MVP", async () => {
  const pin=shape({file:text,decodedSha256:text})(JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/noise/manifest.json",import.meta.url))).toString('utf8')));
  const source=gunzipSync(await readFile(new URL(`../../../../src/objects/earth/source/noise/${pin.file}`,import.meta.url)));
  assert.equal(createHash("sha256").update(source).digest("hex"),pin.decodedSha256);
  assert.equal(shape({features:array(requireRecord)})(JSON.parse(source.toString('utf8'))).features.length,181);
  assert.equal(PREPARED_EARTH_LENSES.controls.some(lens=>lens.id==="buenos-aires-noise"),false);
  assert.deepEqual(runtimeDefinition.pageLayers,[]);
  const assets=shape({assets:array(shape({filename:text}))})(JSON.parse((await readFile(new URL("../../../../src/objects/earth/inventory.json",import.meta.url))).toString('utf8')));
  assert.equal(assets.assets.some((asset: { filename: string; })=>/noise|places|city|wmts/.test(asset.filename)),false);
});
