#!/usr/bin/env node
import { sha256 } from '../../../../src/platform/sha256.mts';
import {commandContext} from './context.mts';
const context=commandContext();

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { WORLDCOVER_BUCKET, WORLDCOVER_PREFIX, parseWorldCoverInventory,
  worldCoverTileBounds } from "../worldcover-catalog.mts";

import { parseCatalogPin } from '../source-records.mts';
import { hasErrorCode } from '../../../sources/source-values.mts';
const root=context.projectRoot;
const output=resolve(root,`.local/${context.objectId}-city-source/catalog`);
const snapshotPath=resolve(output,"worldcover-rgbnir-2021.json.gz");
const sourceDirectory=context.sourcePath("city");
const pin=parseCatalogPin(JSON.parse(await readFile(resolve(sourceDirectory,"catalog-pin.json"),"utf8")));
const offline=context.args.includes("--offline");

await mkdir(output,{recursive:true});
const entries=[];
const pages: {file:string;sha256:string;bytes:number;next:string|null}[]=[];
let next=null,downloadedBytes=0;
for(let index=0;;index++) {
  if(index>=65)throw new Error("WorldCover inventory exceeded the global 1-degree grid bound.");
  const url=new URL(WORLDCOVER_BUCKET);
  url.searchParams.set("list-type","2");url.searchParams.set("prefix",WORLDCOVER_PREFIX);url.searchParams.set("max-keys","1000");
  if(next)url.searchParams.set("continuation-token",next);
  const filename=`${String(index).padStart(2,'0')}-${sha256(url.href).slice(0,16)}.xml`;
  const path=resolve(output,filename);
  let bytes;
  try { bytes=await readFile(path); }
  catch(error) {
    if(!hasErrorCode(error,"ENOENT")||offline)throw error;
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(response.status!==200||response.headers.has("x-amz-request-charged")) {
      await response.body?.cancel();throw new Error(`WorldCover inventory request failed: ${response.status}`);
    }
    const chunks=[];let length=0;
    if (!response.body) throw new Error("WorldCover inventory body is missing");
    for await(const chunk of response.body) {
      length+=chunk.length;
      if(length>1024*1024)throw new Error("WorldCover inventory page exceeded 1 MiB.");
      chunks.push(chunk);
    }
    bytes=Buffer.concat(chunks);
    parseWorldCoverInventory(bytes.toString());
    await writeFile(path,bytes);
    downloadedBytes+=bytes.length;
  }
  const page=parseWorldCoverInventory(bytes.toString());
  if(page.next&&pages.some(p=>p.next===page.next))throw new Error("Repeated WorldCover inventory cursor.");
  pages.push({file:filename,sha256:sha256(bytes),bytes:bytes.length,next:page.next});
  entries.push(...page.entries);next=page.next;
  console.log(JSON.stringify({inventoryPage:index+1,objects:entries.length,downloadedBytes}));
  if(!next)break;
}
const keys=new Set(entries.map(e=>e.tile));
if(keys.size!==entries.length)throw new Error("Duplicate WorldCover inventory tile.");
entries.sort((a,b)=>a.tile.localeCompare(b.tile));
const snapshot={schema:"cssearth-worldcover-inventory@1",dataset:pin.dataset,
  sourcePage:"https://esa-worldcover.org/en/data-access",bucket:WORLDCOVER_BUCKET,prefix:WORLDCOVER_PREFIX,
  qualification:"Complete publisher object listing; not pixel-validity or prepared runtime coverage.",entries};
const bytes=gzipSync(Buffer.from(`${JSON.stringify(snapshot)}\n`),{level:9});
if(bytes.length!==pin.expectedBytes||sha256(bytes)!==pin.expectedSha256||
  entries.length!==pin.tileCount||entries.reduce((sum,e)=>sum+e.sourceBytes,0)!==pin.sourceBytes) {
  throw new Error("The WorldCover inventory changed; review and explicitly repin it before publication.");
}
await writeFile(snapshotPath,bytes);
if(context.args.includes("--write-source-snapshot"))await writeFile(resolve(sourceDirectory,pin.path),bytes);
const bounds=entries.map(entry=>worldCoverTileBounds(entry.tile));
const report={snapshotPath,sha256:sha256(bytes),bytes:bytes.length,decodedBytes:gunzipSync(bytes).length,
  tiles:entries.length,sourceBytes:entries.reduce((sum,entry)=>sum+entry.sourceBytes,0),
  south:Math.min(...bounds.map(b=>b.south)),north:Math.max(...bounds.map(b=>b.north)),
  downloadedBytes,pages:pages.map(({next,...page})=>page)};
await writeFile(resolve(output,"inventory-evidence.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report));
