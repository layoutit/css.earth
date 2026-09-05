import assert from "node:assert/strict";
import { readFile,writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { cityGeographicFrame } from "./city/page-geometry.mjs";
import { hashBytes } from "./city/prepare-wmts-tree.mjs";
import { refineWmtsStubs } from "./refine-wmts-stubs.mjs";
import { finalizeGlobalWmts } from "./finalize-global-wmts.mjs";

// One explicit migration for PR2's affine base-texture banks. The full globe
// recipe remains reproducible; this avoids duplicating its unchanged geometry.
const [directory,previousScenePath]=process.argv.slice(2);
if(!directory||!previousScenePath)throw new Error("Expected the verified release directory and its original prepared scene.");
const inputs=JSON.parse(await readFile(`${directory}/inputs.json`,"utf8"));
const manifest=JSON.parse(await readFile(`${directory}/manifest.json`,"utf8"));
assert.ok(manifest.complete&&manifest.packHashesVerified);assert.equal(manifest.version,inputs.version);
const previousBytes=await readFile(previousScenePath);
assert.equal(hashBytes(previousBytes),inputs.hashes["runtime/preparedScene.mjs"]);
const {PREPARED_EARTH_SCENE:previous}=await import(pathToFileURL(previousScenePath).href);
const frames=value=>value.body.bands.map(band=>({latitudeIndex:band.latitudeIndex,frames:band.leaves.map(cityGeographicFrame)}));
assert.deepEqual(frames(scene),frames(previous));
const changed=[],hashes={};
for(const [path,expected] of Object.entries(inputs.hashes)){
  const actual=hashBytes(await readFile(new URL(`../${path}`,import.meta.url)));hashes[path]=actual;
  if(actual!==expected)changed.push(path);
}
assert.deepEqual(changed.sort(),["runtime/preparedScene.mjs","tools/city/page-geometry.mjs"]);
const proof={schema:"cssearth-wmts-geographic-rebind@1",previousVersion:inputs.version,
  previousSceneSha256:hashBytes(previousBytes),sceneSha256:hashes["runtime/preparedScene.mjs"],
  geographicFrames:frames(scene).reduce((sum,b)=>sum+b.frames.length,0),
  geographicFramesSha256:hashBytes(JSON.stringify(frames(scene))),changedInputs:changed,
  qualification:"Every geographic face basis is byte-identical; the base raster representation changed. Pack hashes are reverified after rewriting versioned references."};
await writeFile(`${directory}/inputs-before-rebind.json`,JSON.stringify(inputs,null,2));
await writeFile(`${directory}/inputs.json`,JSON.stringify({...inputs,hashes},null,2));
const refined=await refineWmtsStubs(directory);
const result=await finalizeGlobalWmts(refined);proof.version=result.version;
await writeFile(`${refined}/geographic-rebind.json`,JSON.stringify(proof,null,2));
await writeFile(new URL("../../../../.local/wmts-global/latest.json",import.meta.url),JSON.stringify({version:result.version}));
await writeFile(new URL("../source/city/geographic-rebind.json",import.meta.url),JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify({...proof,directory:refined,tiles:result.tiles,bytes:result.bytes}));
