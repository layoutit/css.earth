import { parseGeographicScene, parseGlobalInputs, parseGlobalManifest } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const scene=await context.readPrepared('scene',parseGeographicScene);
import assert from "node:assert/strict";
import { readFile,writeFile } from "node:fs/promises";

import { cityGeographicFrame } from "../page-geometry.mts";
import { hashBytes } from "../prepare-wmts-tree.mts";
import { refineWmtsStubs } from "./refine-wmts-stubs.mts";
import { finalizeGlobalWmts } from "./finalize-global-wmts.mts";

// Rebind a prepared JSON scene only when every geographic face is unchanged.
// Historical body-relative caches remain pinned inputs: do not reinterpret their
// executable-source hashes as proof for a different compiler/source closure.
const [directory,previousScenePath]=context.args;
if(!directory||!previousScenePath)throw new Error("Expected the verified release directory and its original prepared scene.");
const inputs=parseGlobalInputs(JSON.parse(await readFile(`${directory}/inputs.json`,"utf8")));
const manifest=parseGlobalManifest(JSON.parse(await readFile(`${directory}/manifest.json`,"utf8")));
assert.ok(manifest.complete&&manifest.packHashesVerified);assert.equal(manifest.version,inputs.version);
const previousBytes=await readFile(previousScenePath);
const sceneInput=context.relativeProject(context.preparedPath("scene.json"));
assert.ok(inputs.hashes[sceneInput],"Rebinding requires a project-relative preparation cache and its original scene JSON; restore historical pinned releases through prepare-pinned-global-wmts instead.");
assert.equal(hashBytes(previousBytes),inputs.hashes[sceneInput]);
const previous=parseGeographicScene(JSON.parse(previousBytes.toString("utf8")));
const frames=(value: ReturnType<typeof parseGeographicScene>)=>value.body.bands.map(band=>({latitudeIndex:band.latitudeIndex,frames:band.leaves.map(cityGeographicFrame)}));
assert.deepEqual(frames(scene),frames(previous));
const changed: string[]=[],hashes: Record<string,string>={};
for(const [path,expected] of Object.entries(inputs.hashes)){
  const actual=hashBytes(await readFile(context.projectUrl(path)));hashes[path]=actual;
  if(actual!==expected)changed.push(path);
}
assert.ok(changed.length > 0 && changed.every(path =>
  [sceneInput,"tools/objects/geographic-pages/page-geometry.mts"].includes(path)));
const proof={version:"",schema:"cssearth-wmts-geographic-rebind@1",previousVersion:inputs.version,
  previousSceneSha256:hashBytes(previousBytes),sceneSha256:hashes[sceneInput],
  geographicFrames:frames(scene).reduce((sum,b)=>sum+b.frames.length,0),
  geographicFramesSha256:hashBytes(JSON.stringify(frames(scene))),changedInputs:changed,
  qualification:"Every geographic face basis is byte-identical; the base raster representation changed. Pack hashes are reverified after rewriting versioned references."};
await writeFile(`${directory}/inputs-before-rebind.json`,JSON.stringify(inputs,null,2));
await writeFile(`${directory}/inputs.json`,JSON.stringify({...inputs,hashes},null,2));
const refined=await refineWmtsStubs(directory,{context});
const result=await finalizeGlobalWmts(refined,{context});proof.version=result.version;
await writeFile(`${refined}/geographic-rebind.json`,JSON.stringify(proof,null,2));
await writeFile(context.projectUrl(".local/wmts-global/latest.json"),JSON.stringify({version:result.version}));
await writeFile(context.sourceUrl("city/geographic-rebind.json"),JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify({...proof,directory:refined,tiles:result.tiles,bytes:result.bytes}));
