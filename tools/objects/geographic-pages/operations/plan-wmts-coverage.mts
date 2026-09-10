import {commandContext} from './context.mts';
const context=commandContext();

import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { prepareWmtsCoverage } from "../wmts-coverage.mts";
import { readWorldCoverCatalog } from "../worldcover-catalog.mts";

const root = context.projectUrl("");
const catalog = await readWorldCoverCatalog({directory:context.sourceUrl("city/")});
const entries = [...catalog.entries.values()];
const output = new URL(`output/${context.objectId}-city/wmts-global-plan-${Date.now()}/`,root);
await mkdir(output,{recursive:true});
const plan = { schema:"cssearth-wmts-coverage-plan@1",dataset:catalog.pin.dataset,
  qualification:"All published source footprints in fully regular WMTS rows. Includes water and nodata within source footprints. Polar and transition rows are excluded. Geometry blocks are not yet generated.",
  sourceSha256:catalog.pin.expectedSha256,sourceEntries:entries.length,
  levels:Array.from({length:10},(_,i)=>prepareWmtsCoverage(entries,i+5)) };
const decoded=Buffer.from(JSON.stringify(plan)),encoded=gzipSync(decoded,{level:9});
await writeFile(new URL("coverage.json.gz",output),encoded);
const summary={output:output.pathname,qualification:plan.qualification,sourceEntries:plan.sourceEntries,
  decodedBytes:decoded.length,compressedBytes:encoded.length,
  tileCount:plan.levels.reduce((sum,level)=>sum+level.tileCount,0),
  spatialBlocks:plan.levels.reduce((sum,level)=>sum+level.blockCount,0),
  levels:plan.levels.map(({bands,...level})=>({...level,bands:bands.length}))};
await writeFile(new URL("summary.json",output),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
