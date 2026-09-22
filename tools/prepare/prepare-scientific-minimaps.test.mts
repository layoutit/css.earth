import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import {prepareSurfaceMinimaps} from './prepare-surface-minimaps.mts';

const legacyEncoding={quality:90,alphaQuality:100,effort:4,smartSubsample:true};
const colors=[[231,21,41],[13,211,31],[82,84,82]];
const pixelSet=(data: Uint8Array)=>{
  const set=new Set<string>();for(let i=0;i<data.length;i+=3)set.add(data.subarray(i,i+3).join(','));return set;
};
async function directories(t: test.TestContext) {
  const root=await mkdtemp(resolve(tmpdir(),'scientific-minimap-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const source=resolve(root,'source'),publicDirectory=resolve(root,'public'),outputDirectory=resolve(root,'prepared');
  for(const p of ['preparation','presentation'])await mkdir(resolve(source,p),{recursive:true});
  await mkdir(publicDirectory);await mkdir(outputDirectory);
  return {root,source,objectDirectory:root,publicDirectory,outputDirectory};
}
async function stripedImage(path: string,width=1280,height=8) {
  const data=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++)data.set(colors[(i%width)%3],i*3);
  await sharp(data,{raw:{width,height,channels:3}}).png().toFile(path);
}
function shiftHalf(data: Buffer<ArrayBuffer>,info: OutputInfo) {
  const out=Buffer.alloc(data.length),half=info.width/2,rowBytes=info.width*info.channels;
  for(let y=0;y<info.height;y++){
    const row=y*rowBytes,split=half*info.channels;
    data.copy(out,row,row+split,row+rowBytes);data.copy(out,row+split,row,row+split);
  }
  return out;
}

test('solid nearest, categorical and facet minimaps preserve framing and attribution without changing images',async t=>{
  const f=await directories(t),path=resolve(f.publicDirectory,'map.png');await stripedImage(path);
  const original=await readFile(path),attribution={label:'Pinned mission product',url:'https://example.test/source'};
  const surfaces=[
    {id:'nearest',displaySampling:'nearest'},
    {id:'categorical',categorical:true},
    {id:'facet',scientific:true,scalarMap:{sourceFormat:'facet-scalars',sourceTable:'source.csv.zip',field:'Slope'}},
    {id:'image'},
  ].map(surface=>({...surface,map:{url:'/scenes/fixture/map.png'},attribution}));
  const sourceBytes=Buffer.from(JSON.stringify({surfaces}));
  await writeFile(resolve(f.outputDirectory,'surfaces.json'),sourceBytes);
  await writeFile(resolve(f.source,'presentation/minimap.json'),JSON.stringify({centerLongitudeDegrees:0}));
  const result=await prepareSurfaceMinimaps(f);
  for(const entry of result){
    assert.deepEqual(entry.attribution,attribution);assert.equal(entry.width,640);assert.equal(entry.height,4);
    const actual=await readFile(resolve(f.outputDirectory,entry.path));
    const nearest=entry.id!=='image';
    const resized=await sharp(original).resize({width:640,withoutEnlargement:true,...(nearest?{kernel:'nearest'}:{})}).raw().toBuffer({resolveWithObject:true});
    const shifted=shiftHalf(resized.data,resized.info);
    if(nearest){
      const decoded=await sharp(actual).raw().toBuffer();assert.deepEqual(decoded,shifted,entry.id);
      const allowed=new Set(colors.map(color=>color.join(',')));
      for(const color of pixelSet(decoded))assert.ok(allowed.has(color),`${entry.id}: ${color}`);
    }else{
      const expected=await sharp(shifted,{raw:resized.info}).webp(legacyEncoding).toBuffer();assert.deepEqual(actual,expected);
    }
  }
  assert.deepEqual(await readFile(path),original);
  assert.deepEqual(await readFile(resolve(f.outputDirectory,'surfaces.json')),sourceBytes);
});

