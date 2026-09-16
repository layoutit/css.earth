import { sha256 } from '../../../../src/platform/sha256.mts';
import { parseGeographicScene, parseRegionReceipt, text } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const scene=await context.readPrepared('scene',parseGeographicScene);
import { Worker } from "node:worker_threads";
import { mkdir, readFile, writeFile,rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { readWorldCoverCatalog } from "../worldcover-catalog.mts";
import { prepareWmtsCoverage } from "../wmts-coverage.mts";
import { coverageLookup,prepareTreeSection,tileKey } from "../prepare-wmts-tree.mts";
import {geographicPreparationInputs} from './preparation-inputs.mts';
const root=context.projectUrl(""),arg=(name: string,fallback: string)=>context.args.find(v=>v.startsWith(`--${name}=`))?.split("=").slice(1).join("=")??fallback;
const lastLevel=Number(arg("last-level","14")),workers=Number(arg("workers","4")),limit=Number(arg("limit","Infinity"));
if(!Number.isInteger(lastLevel)||lastLevel<8||lastLevel>14||!Number.isInteger(workers)||workers<1||workers>6)throw new Error("Invalid bounded preparation settings.");
const catalog=await readWorldCoverCatalog({directory:context.sourceUrl("city/")}),entries=[...catalog.entries.values()];
const levels=Array.from({length:lastLevel-4},(_,i)=>prepareWmtsCoverage(entries,i+5,{includePolar:true}));
const inputs=geographicPreparationInputs(context);
const hashes=Object.fromEntries(await Promise.all(inputs.map(async path=>[path,sha256(await readFile(context.projectUrl(path)))] as const)));
const version=sha256(JSON.stringify({schema:1,lastLevel,source:catalog.pin.expectedSha256,hashes})).slice(0,16);
const directory=new URL(`.local/wmts-global/${version}/`,root).pathname;await mkdir(directory,{recursive:true});
const hasTile=coverageLookup(levels),addresses=[];
for(const band of levels.find(l=>l.zoom===8)!.bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b] of band.ranges)for(let x=a;x<b;x++)addresses.push({zoom:8,x,y});
// Deterministic spatial build order. No destination controls dataset coverage.
const selected=addresses.slice(0,limit),results: ReturnType<typeof parseRegionReceipt>[]=[],start=Date.now();
await writeFile(`${directory}/inputs.json`,JSON.stringify({version,dataset:catalog.pin.dataset,sourceSha256:catalog.pin.expectedSha256,hashes,lastLevel,levels,regions:addresses.length},null,2));
console.log(JSON.stringify({directory,version,regions:addresses.length,selected:selected.length,tiles:levels.reduce((sum,l)=>sum+l.tileCount,0),workers}));
let cursor=0;const failure: {error?:string}={};
await Promise.all(Array.from({length:Math.min(workers,selected.length)},()=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(new URL("./wmts-region-worker.mts",import.meta.url),{workerData:{scene,assetPath:context.assetPath,directory,levels,dataset:catalog.pin.dataset,version,lastLevel,reserveBytes:8*1024**3}});
  const next=()=>{if(failure.error||cursor===selected.length){worker.terminate().then(()=>resolve(),reject);return;}worker.postMessage(selected[cursor++]);};
  worker.on("message",async (value: unknown)=>{
    if(value && typeof value === "object" && "error" in value){failure.error??=text(value.error);console.error(JSON.stringify(value));}
    else results.push(parseRegionReceipt(value));
    if(results.length%100===0||failure.error){
      const progress={completed:results.length,total:selected.length,bytes:results.reduce((s,r)=>s+r.bytes,0),elapsedSeconds:(Date.now()-start)/1000,error:failure.error};
      console.log(JSON.stringify(progress));await writeFile(`${directory}/progress.json`,JSON.stringify(progress));
    }
    next();
  });
  worker.on("error",error=>{failure.error??=error instanceof Error ? error.stack : String(error);reject(error);});next();
})));
if(failure.error)throw new Error(failure.error);
if(results.length===addresses.length){
  const {finalizeGlobalWmts}=await import("./finalize-global-wmts.mts");
  const {refineWmtsStubs}=await import("./refine-wmts-stubs.mts");
  const refined=await refineWmtsStubs(directory,{workers,context});
  const result=await finalizeGlobalWmts(refined,{context});
  const latest=new URL(".local/wmts-global/latest.json",root);
  await writeFile(new URL(".local/wmts-global/latest.json.part",root),JSON.stringify({version:result.version}));
  await rename(new URL(".local/wmts-global/latest.json.part",root),latest);
  console.log(JSON.stringify({...result,roots:result.roots.length,files:result.files.length}));
}else{
  await writeFile(`${directory}/preflight.json`,JSON.stringify({version,complete:false,regions:results.length,bytes:results.reduce((s,r)=>s+r.bytes,0)}));
}
