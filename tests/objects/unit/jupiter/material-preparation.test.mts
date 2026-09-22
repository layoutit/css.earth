import assert from 'node:assert/strict';
import test from 'node:test';
import{readFile}from'node:fs/promises';
import{preparePhotometricDisc}from'../../../../tools/objects/giant-layers/photometric-disc.mts';
test('source-derived normalized Minnaert material reproduces every accepted light phase row',async()=>{
 const sourceDirectory=new URL('../../../../src/objects/jupiter/source/',import.meta.url).pathname,config=JSON.parse(await readFile(new URL('preparation/materials.json',`file://${sourceDirectory}`),'utf8'));
 const result=await preparePhotometricDisc({sourceDirectory,config}),manifest=JSON.parse(await readFile(new URL('../../../../src/objects/jupiter/inventory.json',import.meta.url),'utf8'));
 assert.deepEqual(result.config.minnaertChannels,[0.999,0.95,0.85]);assert.equal(result.assets.length,47);assert.equal(result.presentations.length,181);
 for(const{filename,bytes,sha256,data}of result.assets){assert.deepEqual({filename,bytes,sha256},manifest.assets.find((asset: { filename: string; })=>asset.filename===filename));assert.ok(data.equals(await readFile(new URL(`../../../../public/scenes/jupiter/${filename}`,import.meta.url))));}
});
