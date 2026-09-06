import assert from "node:assert/strict";
import { constants } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { runtimeAssets } from "./runtime-assets.mjs";
import { installRuntimeAssets } from "./setup.mjs";

const { values } = parseArgs({ options: { output: { type: "string" } } });
assert.ok(values.output, "Choose a new owned fixture directory with --output.");
const root = resolve(import.meta.dirname,".."), source = resolve(root,"dist"), output = resolve(values.output);
await mkdir(output); // Never replace an existing output or a user's checkout.
const earth = resolve(source,"scenes/earth");
await cp(source,output,{recursive:true,mode:constants.COPYFILE_FICLONE,filter:path=>path!==earth});
const assets = (await runtimeAssets(root,["earth"])).map(asset=>({...asset,file:resolve(output,"scenes/earth",asset.filename)}));
const install = await installRuntimeAssets(assets,{onProgress:state=>{if(state.completed%100===0)console.log(state)}});
const reuse = await installRuntimeAssets(assets); assert.equal(reuse.installed,0);
const files = [];
async function inventory(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    assert.ok(!entry.isSymbolicLink(),"The built fixture may not reach outside through a symlink.");
    if(entry.isDirectory())await inventory(path);
    else {
      const rel=relative(output,path),bytes=await readFile(path),original=await readFile(resolve(source,rel));
      const sha256=createHash("sha256").update(bytes).digest("hex");
      assert.equal(sha256,createHash("sha256").update(original).digest("hex"),`Built bytes differ: ${rel}`);
      files.push({path:rel,bytes:bytes.length,sha256});
    }
  }
}
await inventory(output); files.sort((a,b)=>a.path.localeCompare(b.path));
assert.ok(!files.some(file=>file.path.includes("/wmts-")||file.path.includes(".local/")));
const receipt={source,output,commit:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),
  install,reuse,files,bytes:files.reduce((s,f)=>s+f.bytes,0),geometryMirror:false,appDeployed:false,createdAt:new Date().toISOString()};
await writeFile(resolve(output,"fixture-receipt.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({...receipt,files:files.length}));
