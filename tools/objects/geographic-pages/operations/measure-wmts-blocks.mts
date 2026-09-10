import { parseGeographicScene } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const scene=await context.readPrepared('scene',parseGeographicScene);
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { decodePreparedBlock, restoreWmtsRecords } from "../../../../src/platform/prepared-map/prepared-block.mts";
import { encodePreparedBlock, packWmtsRecords } from "../encode-prepared-block.mts";
import { prepareWmtsTile, wmtsAddress } from "../wmts-page-geometry.mts";

const root = context.projectUrl("");
const output = new URL(`output/${context.objectId}-city/wmts-compression-${Date.now()}/`, root);
await mkdir(output, { recursive: true });
const quick = context.args.includes("--quick");
interface MeasuredBlock { zoom:number;longitude:number;latitude:number;kind:string;tiles:number;leaves:number;jsonBytes:number;gzipJsonBytes:number;binaryBytes:number;gzipBinaryBytes:number;encodeMs:number;decodeMs:number;exact:boolean }
const report: {createdAt:string;schema:string;qualification:string;sceneSha256:string;blocks:MeasuredBlock[];total?:Record<string,number>} = { createdAt: new Date().toISOString(), schema: "cssearth-wmts-compression-audit@1",
  qualification: "Stratified geometry-block sample, not a prepared global index or a global storage measurement. No imagery requested.",
  sceneSha256: createHash("sha256").update(await readFile(context.preparedUrl("scene.json"))).digest("hex"),
  blocks: [] };
const samples = [];
for (const zoom of quick ? [14] : [8, 11, 14]) {
  for (let band = 1; band <= 14; band++) for (let face = 0; face < 32; face += quick ? 16 : 4) {
    samples.push({ zoom, longitude: -180 + (face + .5) * 11.25, latitude: -90 + (band + .5) * 11.25, kind: "face-interior" });
  }
  for (const [longitude, latitude] of [[112.5, 33.75], [180, -16.78], [0, 0], [-58.3816, -34.6037], [24.94, 60.17]]) samples.push({ zoom, longitude, latitude, kind: "seam-or-reference" });
}
for (const sample of samples) {
  const center = wmtsAddress(sample.longitude, sample.latitude, sample.zoom), n = 2 ** sample.zoom, pages = [];
  for (let dy = -4; dy < 4; dy++) for (let dx = -4; dx < 4; dx++) pages.push(...prepareWmtsTile({ zoom: sample.zoom, x: (center.x + dx + n) % n, y: center.y + dy }, scene));
  pages.sort((a, b) => a.coarseKey.localeCompare(b.coarseKey) || a.y - b.y || a.sourceCrop.v0 - b.sourceCrop.v0 || a.x - b.x);
  const start = performance.now(), encoded = encodePreparedBlock(packWmtsRecords(pages)), encodeMs = performance.now() - start;
  const decodeStart = performance.now(), decoded = restoreWmtsRecords(decodePreparedBlock(encoded)), decodeMs = performance.now() - decodeStart;
  assert.deepEqual(decoded, pages);
  const json = Buffer.from(JSON.stringify(pages)), compressed = gzipSync(encoded, { level: 9 });
  report.blocks.push({ ...sample, tiles: 64, leaves: pages.length, jsonBytes: json.length, gzipJsonBytes: gzipSync(json, { level: 9 }).length,
    binaryBytes: encoded.length, gzipBinaryBytes: compressed.length, encodeMs, decodeMs, exact: true });
  if (report.blocks.length % 32 === 0) console.log(JSON.stringify({ completed: report.blocks.length, total: samples.length }));
}
const sum = (key: "tiles" | "leaves" | "jsonBytes" | "gzipJsonBytes" | "binaryBytes" | "gzipBinaryBytes") => report.blocks.reduce((total, block) => total + block[key], 0);
report.total = Object.fromEntries((["tiles", "leaves", "jsonBytes", "gzipJsonBytes", "binaryBytes", "gzipBinaryBytes"] as const).map(key => [key, sum(key)]));
report.total.ratioToJson = report.total.jsonBytes / report.total.gzipBinaryBytes;
report.total.ratioToGzipJson = report.total.gzipJsonBytes / report.total.gzipBinaryBytes;
report.total.maximumBlockBytes = Math.max(...report.blocks.map(block => block.gzipBinaryBytes));
report.total.maximumDecodeMs = Math.max(...report.blocks.map(block => block.decodeMs));
await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output: output.pathname, ...report.total }));
