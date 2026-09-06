import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from'node:fs/promises';
import {parseEllipsoidMaterialRecipe,rasterEllipsoidMaterial,writeMaterialAtlasTile}from'./materials.mjs';
test('ellipsoid material rejects unsupported physical, shading and residency input',async()=>{
 const config=JSON.parse(await readFile(new URL('../../../src/planets/uranus/source/preparation/materials.json',import.meta.url),'utf8'));
 for(const change of[c=>c.raster.shape.polarRadius=NaN,c=>c.raster.light.operations[0]={kind:'script'},c=>c.bank.columns=17,c=>c.raster.atmosphere.model='invented-clouds',c=>c.raster.lighting.ambient=2,c=>c.lenses[0].rowOutput='../escape-{row}.webp',c=>c.lenses[0].fixed[0].filename=c.lenses[1].fixed[0].filename]){const copy=structuredClone(config);change(copy);assert.throws(()=>parseEllipsoidMaterialRecipe(copy));}
});
test('an unregistered ellipsoid retains transparent exterior and source-lit material',async()=>{
 const config=JSON.parse(await readFile(new URL('../../../src/planets/neptune/source/preparation/materials.json',import.meta.url),'utf8'));
 config.raster.shape={equatorialRadius:100,polarRadius:80,arithmetic:'reciprocal',rootSelection:'positive'};
 const frame=rasterEllipsoidMaterial(config.raster,{size:32,state:{scenePitchDegrees:20,systemObliquityDegrees:10},palette:{atmosphere:[100,160,210]},textureUrl:'/hypothetical/material.webp'});
 assert.equal(frame.rgba[3],0);assert.ok(frame.rgba.some((value,index)=>index%4===3&&value>0));assert.match(frame.leaf.style,/hypothetical\/material.webp/);
});
test('material row gutters copy the source frame edge exactly',()=>{
 const source=Buffer.from([1,2,3,255,4,5,6,128,7,8,9,64,10,11,12,0]),output=Buffer.alloc(4*4*4);
 writeMaterialAtlasTile({output,outputWidth:4,source,sourceSize:2,frameX:1,frameY:1,gutter:1});
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){const sourceX=Math.max(0,Math.min(1,x-1)),sourceY=Math.max(0,Math.min(1,y-1)),offset=(sourceY*2+sourceX)*4;assert.deepEqual(output.subarray((y*4+x)*4,(y*4+x)*4+4),source.subarray(offset,offset+4));}
});
