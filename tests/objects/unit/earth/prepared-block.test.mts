import {required} from "../../../../tools/contract/test-values.mts";
import {pagePlanFixture} from "./page-plan-fixture.mts";
import {shape,array,number} from "../../../../tools/objects/geographic-pages/source-records.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { encodePreparedBlock, packWmtsRecords } from "../../../../tools/objects/geographic-pages/encode-prepared-block.mts";
import { createPreparedBlockDecoder, decodePreparedBlock, decodePreparedBlockAsync, restoreWmtsRecords } from "../../../../src/renderers/css/dist/testing.js";
import { PREPARED_EARTH_SCENE as scene } from "../../unit/earth/prepared-fixture.mts";
import { prepareWmtsTile, wmtsAddress } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { prepareWmtsBlocks } from "../../../../tools/objects/geographic-pages/operations/prepare-wmts-blocks.mts";
import { isPreparedBlockReference, readPreparedWmtsBlock } from "../../../../src/renderers/css/dist/testing.js";
import { createCityIndex } from "../../../../src/renderers/css/dist/testing.js";
import { prepareWmtsCoverage } from "../../../../tools/objects/geographic-pages/wmts-coverage.mts";
import { wmtsLatitude } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { worldCoverTileBounds } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mts";

test("independent columns preserve finished double bits, including negative zero and extreme values", () => {
  const values = [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, Math.PI, 1 / 3];
  const records = values.map((value, i) => ({ value, nested: [value, { id: `row-${i}`, fixed: true }], empty: [], missing: null }));
  const encoded = encodePreparedBlock(records);
  assert.deepEqual(decodePreparedBlock(encoded), records);
  const decoder = createPreparedBlockDecoder(encoded);
  assert.throws(() => decoder.result(), /incomplete/);
  while (!decoder.step(1)) {}
  assert.deepEqual(decoder.result(), records);
  assert.deepEqual(decodePreparedBlock(encodePreparedBlock([{ value: -0 }])), [{ value: -0 }]);
});

test("spatial WMTS blocks round-trip full records exactly at seams, the date line and multiple scales", () => {
  for (const zoom of [5, 8, 12, 14]) for (const [longitude, latitude] of [[-58.38, -34.6], [112.5, 33.75], [180, -16.78], [24.94, 60.17]]) {
    const center = wmtsAddress(longitude, latitude, zoom), n = 2 ** zoom, pages = [];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) pages.push(...prepareWmtsTile({ zoom, x: (center.x + dx) % n, y: center.y + dy }, scene));
    const encoded = gzipSync(encodePreparedBlock(packWmtsRecords(pages)));
    assert.deepEqual(restoreWmtsRecords(decodePreparedBlock(gunzipSync(encoded))), pages);
  }
});

test("truncation, oversized descriptors, bad templates and trailing bytes fail before publication", () => {
  const encoded = encodePreparedBlock([{ n: 1 }, { n: 2 }]);
  assert.throws(() => decodePreparedBlock(encoded.slice(0, -1)), /length/);
  assert.throws(() => decodePreparedBlock(new Uint8Array(encoded.length + 1)), /header/);
  const headerShape=shape({rows:number,columns:array(shape({bytes:number})),template:(value:unknown)=>value});
  const withHeader = (update:(header:ReturnType<typeof headerShape>)=>unknown) => {
    const view = new DataView(encoded.buffer), size = view.getUint32(8, true);
    const header = headerShape(JSON.parse(new TextDecoder().decode(encoded.slice(16, 16 + size))));
    update(header);
    const bytes = new TextEncoder().encode(JSON.stringify(header));
    const result = new Uint8Array(16 + bytes.length + encoded.length - 16 - size);
    result.set(encoded.subarray(0, 16)); result.set(bytes, 16); result.set(encoded.subarray(16 + size), 16 + bytes.length);
    new DataView(result.buffer).setUint32(8, bytes.length, true);
    return result;
  };
  for (const update of [(h: { rows: number; }) => h.rows = 1e9, (h: { columns: { bytes: number; }[]; }) => h.columns[0].bytes = 1e9, (h: { template: unknown; }) => h.template = ["field", 999]]) assert.throws(() => decodePreparedBlock(withHeader(update)), /Invalid/);
  assert.throws(() => encodePreparedBlock([{ n: NaN }]), /types/);
  assert.throws(() => encodePreparedBlock([{ n: 1 }, { other: 2 }]), /shapes/);
});

test("bounded asynchronous decode can be cancelled between slices", async () => {
  const bytes = encodePreparedBlock(Array.from({ length: 1024 }, (_, i) => ({ x: i / 3, y: i * i / 7, label: `row-${i}` })));
  const controller = new AbortController(); let yields = 0;
  await assert.rejects(decodePreparedBlockAsync(bytes, { signal: controller.signal, yieldTask: async () => { yields++; controller.abort(); } }), /abort/i);
  assert.equal(yields, 1);
  assert.deepEqual(await decodePreparedBlockAsync(bytes, { yieldTask: async () => {} }), decodePreparedBlock(bytes));
});

test("content-addressed spatial blocks verify both compressed and expanded bytes before restoring topology", async () => {
  const pages = prepareWmtsTile(wmtsAddress(112.5, 33.75, 12), scene);
  const blocks = prepareWmtsBlocks(pages, "test-dataset", {assetPath:"/scenes/earth/"});
  const recovered = [];
  for (const file of blocks.files) {
    assert.ok(isPreparedBlockReference(file.ref));
    const data = await readPreparedWmtsBlock(new Response(file.bytes), file.ref);
    assert.equal(data.dataset, "test-dataset");
    assert.deepEqual(data.nodes[0].children, data.nodes.slice(1).map(page => page.key));
    recovered.push(...data.nodes.slice(1));
    const corrupt = Uint8Array.from(file.bytes); corrupt[corrupt.length - 1] ^= 1;
    await assert.rejects(readPreparedWmtsBlock(new Response(corrupt), file.ref), /hash/);
    await assert.rejects(readPreparedWmtsBlock(new Response(file.bytes), { ...file.ref, decodedBytes: file.ref.decodedBytes - 1 }), /byte length/);
    assert.equal(isPreparedBlockReference({ ...file.ref, url: `https://example.com${file.ref.url}` }), false);
  }
  assert.deepEqual(recovered.sort((a,b)=>a.key.localeCompare(b.key)), pages.sort((a,b)=>a.key.localeCompare(b.key)));
});

test("the shared index loads compressed blocks and budgets expanded metadata before fetching", async () => {
  const pages = prepareWmtsTile(wmtsAddress(-58.38, -34.6, 12), scene);
  const { roots, files } = prepareWmtsBlocks(pages, "test-dataset", {assetPath:"/scenes/earth/"});
  let changed:()=>void=()=>{throw new Error("Index gate not initialized");};const ready=new Promise<void>(resolve=>{changed=resolve;});
  const plan = pagePlanFixture({ assetPath: "/scenes/earth/", dataset: "test-dataset", roots, index: { maximumDirectories: 8, maximumBytes: 3 * 1024 * 1024, maximumDirectoryBytes: 131072, maximumConcurrentLoads: 3 } });
  const index = createCityIndex(plan, changed, async url => new Response(required(files.find(file=>file.ref.url===url)).bytes));
  index.update(files.map(file=>file.ref)); await ready;
  assert.equal(required(index.nodes().get(pages[0].key)).frameMatrix, pages[0].frameMatrix);
  assert.ok(index.stats().reservedDecodedBytes > index.stats().reservedEncodedBytes);
  index.update([]); assert.equal(index.nodes().size, roots.length); index.destroy();
  const blocked = createCityIndex({ ...plan, index: { ...plan.index, maximumBytes: files[0].ref.decodedBytes - 1 } }, ()=>{}, ()=>assert.fail("Expanded metadata exceeds budget"));
  blocked.update([files[0].ref]); assert.equal(blocked.stats().budgetBlocked, 1); assert.equal(blocked.stats().requests, 0); blocked.destroy();
});

test("compact global address runs equal independently enumerated source-footprint intersections", () => {
  const entries = ["S35W059", "S35W058", "N33E112", "N00E000", "S01W180", "N00E179", "N82W030"].map(tile=>({tile}));
  for (const zoom of [5,8]) {
    const plan=prepareWmtsCoverage(entries,zoom),n=2**zoom,expected=[],actual=[];
    for(let y=0;y<n;y++){
      const north=wmtsLatitude(y,zoom),south=wmtsLatitude(y+1,zoom);
      if(north>78.75||south< -78.75)continue;
      for(let x=0;x<n;x++){
        const west=-180+x/n*360,east=-180+(x+1)/n*360;
        if(entries.some(entry=>{const b=worldCoverTileBounds(entry.tile);return west<b.east&&east>b.west&&south<b.north&&north>b.south;}))expected.push(`${x}/${y}`);
      }
    }
    for(const band of plan.bands)for(let y=band.y0;y<band.y1;y++)for(const [start,end] of band.ranges)for(let x=start;x<end;x++)actual.push(`${x}/${y}`);
    assert.deepEqual(actual,expected);assert.equal(plan.tileCount,expected.length);
    assert.equal(plan.blockCount,new Set(actual.map(key=>key.split("/").map(Number).map(n=>Math.floor(n/8)).join("/"))).size);
  }
});
