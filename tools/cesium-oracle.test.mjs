import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { instrumentCss } from './cesium-oracle/instrument-css.mjs';
import { inverse3, point3, referenceCameraFrame } from './cesium-oracle/camera-match.mjs';
import { writeReport } from './cesium-oracle/report.mjs';
import { imageFixture } from './cesium-oracle/network.mjs';

test('oracle observation hooks match the current owner and fail on source drift',async()=>{
  for(const name of ['city-pages','city-index','api-image-transport']){
    const url=new URL(`../src/renderers/css/paging/${name}.ts`,import.meta.url),source=await readFile(url,'utf8');
    assert.notEqual(instrumentCss(source,url.pathname),source);
    assert.throws(()=>instrumentCss(source+source,url.pathname),/hook drift/);
  }
});

test('geographic registration reverses a projective face without guessing screen coordinates',()=>{
  const h=[22,3,41,-8,17,25,.003,-.001,1],inverse=inverse3(h);
  for(const point of [[0,0],[1,1],[.13,.85],[-3,6]]){
    const result=point3(inverse,...point3(h,...point));assert.ok(result.every((n,i)=>Math.abs(n-point[i])<1e-10));
  }
  assert.throws(()=>inverse3([0,0,0,0,0,0,0,0,0]),/Singular/);
});

test('rotating the source camera cannot alter its lens or manufacture a roll',()=>{
  const definition={perspective:1000000,bodyRadius:10000,ecefToBody:[[0,-1,0],[-1,0,0],[0,0,1]]};
  for(const angle of [-170,-90,-11.25,-.01,0,.01,11.25,90,170]){
    const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const projection=[.022*c,0,-s,0,0,.022,0,0,.022*s,0,c,0,0,0,0,1];
    const frame=referenceCameraFrame({projection,scale:2},definition,10000);
    assert.ok(Math.abs(frame.focalPixels-44000)<1e-8);
    assert.ok(Math.abs(frame.distanceBodyRadii-99)<1e-10);
    assert.ok(Math.abs(frame.up[0]-1)+Math.abs(frame.up[1])+Math.abs(frame.up[2])<1e-10);
    assert.ok(Math.abs(frame.direction.reduce((sum,v,i)=>sum+v*frame.up[i],0))<1e-12);
  }
});

test('physical camera observation preserves its actual eye and focal length',()=>{
  const definition={perspective:1000000,bodyRadius:10,ecefToBody:[[1,0,0],[0,1,0],[0,0,1]]};
  const projection=[2,0,0,0,0,2,0,0,0,0,2,0,2,-4,-60,1];
  const frame=referenceCameraFrame({projection,scale:1,viewport:{projection:{focalPixels:800,principalOffsetPixels:[35,-12]}}},definition,-40);
  assert.deepEqual(frame.positionBodyRadii,[-.1,.2,3]);
  assert.ok(frame.direction.every((value,index)=>Math.abs(value-[0,0,-1][index])<1e-12));
  assert.equal(frame.distanceBodyRadii,2);assert.equal(frame.focalPixels,800);
});

test('generated timeline is executable JavaScript and retains incomplete captures',async()=>{
  const directory=pathToFileURL(await mkdtemp(tmpdir()+'/cesium-report-')+'/');
  try {
    await writeReport({complete:false,qualification:'Incomplete test capture',actions:[],checkpoints:[],errors:['fixture'],traces:{css:null}},directory);
    const html=await readFile(new URL('index.html',directory),'utf8');
    const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1],file=new URL('script.mjs',directory);
    await writeFile(file,script);execFileSync(process.execPath,['--check',file.pathname]);
    assert.equal(JSON.parse(await readFile(new URL('timeline.json',directory))).complete,false);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('imagery replay fails closed on an unrecorded URL without network access',async()=>{
  const directory=pathToFileURL(await mkdtemp(tmpdir()+'/cesium-images-')+'/');
  try {
    const fixture=await imageFixture(directory,{mode:'replay',delayMs:0});let handler,aborted=false;
    await fixture.route({route:async(_pattern,callback)=>{handler=callback;}},'test');
    await handler({request:()=>({url:()=> 'https://example.invalid/0.png'}),abort:async()=>{aborted=true;}});
    await fixture.close();assert.ok(aborted);assert.match(fixture.errors[0].error,/Unrecorded oracle imagery/);assert.equal(fixture.stats().bytes,0);
  }finally{await rm(directory,{recursive:true,force:true});}
});
