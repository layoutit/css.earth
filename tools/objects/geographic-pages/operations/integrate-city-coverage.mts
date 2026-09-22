#!/usr/bin/env node
import { sha256 } from '../../../../src/platform/sha256.mts';
import type { AssetReference } from '../contracts.mts';
import { hasErrorCode, requireRecord } from '../../../sources/source-values.mts';
import { parseCitySource, parseRuntimePages, shape, text, array, optional, parseGeographicScene } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const PREPARED_SCENE=await context.readPrepared('scene',parseGeographicScene);
const PREPARED_PAGES=await context.readPrepared('pages',parseRuntimePages);
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";


import { cityCoverageRoots, planCityCoverage } from "./plan-coverage.mts";
import { expectedGlobalCityFace, validateGlobalCityFaceReceipt } from "./global-face-receipts.mts";
import { readWorldCoverCatalog } from "../worldcover-catalog.mts";
import { assembleCityCoveragePlan } from "./published-coverage.mts";

const root = context.projectRoot;
const source = parseCitySource(JSON.parse(await readFile(context.sourceUrl("city/manifest.json"),"utf8")));
const {pin,entries} = await readWorldCoverCatalog({directory:context.sourceUrl("city/")});
const expected = new Map(cityCoverageRoots().map(face => {
  const planned=expectedGlobalCityFace(face,[...planCityCoverage(PREPARED_SCENE,entries,[face])]);
  return [planned.face.key,planned] as const;
}).filter(([,face])=>face.jobs));
const directory=resolve(root,`output/${context.objectId}-city/global-faces`);
const faces=[];
for (const file of (await readdir(directory)).sort()) {
  if (!/^0-\d+-\d+\.json$/u.test(file)) throw new Error(`Unexpected receipt ${file}`);
  const receipt: unknown=JSON.parse(await readFile(resolve(directory,file),"utf8"));
  const planned = expected.get(file.slice(0,-5));
  if (!planned) throw new Error(`Unexpected face receipt ${file}`);
  faces.push(validateGlobalCityFaceReceipt(receipt,planned,source,pin.expectedSha256));
}

const cache=resolve(root,`.local/${context.objectId}-city-coverage-check`);
await mkdir(cache,{recursive:true});
let downloads=0;
async function asset(ref: AssetReference) {
  const path=resolve(cache,ref.sha256);
  let bytes=await readFile(path).catch(error=>hasErrorCode(error,"ENOENT")?null:Promise.reject(error));
  if (!bytes) {
    const response=await fetch(ref.url,{headers:{Origin:"http://127.0.0.1:4228"},signal:AbortSignal.timeout(30000)});
    if (!response.ok || response.headers.get("access-control-allow-origin")!=="http://127.0.0.1:4228") throw new Error(`City asset unavailable: ${ref.url}`);
    bytes=Buffer.from(await response.arrayBuffer()); downloads++;
  }
  if (bytes.length!==ref.bytes || sha256(bytes)!==ref.sha256) throw new Error(`City asset identity mismatch: ${ref.url}`);
  await writeFile(path,bytes);
  return bytes;
}
for (const receipt of faces) {
  const head=receipt.heads[0];
  const directory=shape({schema:text,dataset:text,key:text,nodes:array(shape({key:text,url:optional(text)}))})(JSON.parse((await asset(head.directory)).toString("utf8")));
  if (directory.schema!=="cssearth-city-index@1" || directory.dataset!==source.dataset ||
      directory.key!==head.key || !directory.nodes.some(node=>node.key===head.key && node.url)) {
    throw new Error(`Published region has no matching root: ${head.key}`);
  }
}
const snapshot={schema:"cssearth-published-city-coverage@1",dataset:source.dataset,
  catalogSha256:pin.expectedSha256,expectedFaces:expected.size,
  qualification:"Verified immutable region heads and source-window provenance; source gaps remain.",
  faces};
const bytes=gzipSync(Buffer.from(JSON.stringify(snapshot)+"\n"),{level:9});
await writeFile(context.sourceUrl("city/published-coverage.json.gz"),bytes);
const manifestPath=context.sourceUrl("manifest.json");
const manifest=shape({documents:array(requireRecord)})(JSON.parse(await readFile(manifestPath,"utf8")));
const path="city/published-coverage.json.gz";
manifest.documents=manifest.documents.filter(entry=>entry.path!==path);
manifest.documents.push({path,expectedSha256:sha256(bytes),expectedBytes:bytes.length,
  purpose:"Verified publication receipts, source-window provenance and immutable index heads for integrated geographic coverage"});
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
const plan=assembleCityCoveragePlan(PREPARED_PAGES,snapshot,{assetPath:context.assetPath});
await context.writePrepared('pages',plan);
console.log(JSON.stringify({faces:faces.length,pages:faces.reduce((sum,face)=>sum+face.pages,0),snapshotBytes:bytes.length,downloads}));
