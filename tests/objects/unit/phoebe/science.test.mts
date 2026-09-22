import {shape,array,dictionary,number,text,optional,boolean,parseIsis3Grid} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {decodeIsis3Raster} from '../../../../tools/objects/terrestrial-layers/isis3-raster.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/phoebe/source');
const sha=(b: string|NodeJS.ArrayBufferView<ArrayBufferLike>|NonSharedBuffer)=>createHash('sha256').update(b).digest('hex');
test('Phoebe paired cubes retain every native value and actual missing-maplet sentinel',async()=>{
 const proof=proofShape(JSON.parse((await readFile(resolve(root,'validation/2023-source-statistics.json'))).toString('utf8')));
 for(const [key,p] of Object.entries(proof.products)){
  const bytes=await readFile(resolve(root,'science/2023',p.path));assert.equal(bytes.length,p.bytes);
  const {data,origin,resolution}=decodeIsis3Raster(bytes,p.grid);assert.equal(data.length,p.allPixels);assert.deepEqual(origin,p.grid.origin);assert.equal(resolution[0],p.grid.resolutionMeters);
  let low=Infinity,high=-Infinity,finite=0;const counts:Record<string,number>={};
  for(const v of data){if(Number.isFinite(v))finite++;low=Math.min(low,v);high=Math.max(high,v);if(p.histogram)counts[String(v)]=(counts[String(v)]??0)+1;}
  assert.equal(finite,p.finitePixels);assert.equal(low,p.minimum);assert.equal(high,p.maximum);
  if(p.histogram)assert.deepEqual(counts,Object.fromEntries(Object.entries(p.histogram).map(([v,n])=>[String(Number(v)),n])));
  if(key==='bestmap'){assert.equal(counts['99999'],6714);assert.equal(counts['9999'],undefined);}
 }
});
test('Phoebe support policy rejects filled albedo at zero/few images or missing maplet; thresholds remain exact',async()=>{
 const config=JSON.parse((await readFile(resolve(root,'preparation/terrestrial.json'))).toString('utf8')),proof=proofShape(JSON.parse((await readFile(resolve(root,'validation/2023-source-statistics.json'))).toString('utf8')));
 const lens=config.raster.scientific.find((x: { id: string; })=>x.id==='normal'),albedo=await loadScienceSurface(root,lens),raw=await loadScienceSurface(root,{...lens,qualityMasks:undefined});
 const count=await loadScienceSurface(root,config.raster.scientific.find((x: { id: string; })=>x.id==='image-count'));
 const maplet=await loadScienceSurface(root,config.raster.scientific.find((x: { id: string; })=>x.id==='maplet-resolution'));
 for(const f of proof.fixtures){
  assert.equal(count.sample(f.longitudeDegrees,f.latitudeDegrees),f.imageCount,f.kind);
  assert.equal(maplet.sample(f.longitudeDegrees,f.latitudeDegrees),f.bestMapletMeters===99999?null:f.bestMapletMeters,f.kind);
  assert.equal(raw.sample(f.longitudeDegrees,f.latitudeDegrees),f.rawAlbedo,f.kind);
  assert.equal(albedo.sample(f.longitudeDegrees,f.latitudeDegrees),f.accepted?f.rawAlbedo:null,f.kind);
 }
 // All 64,800 independent one-degree source cells, not a few declaration-only samples.
 let accepted=0;
 for(let y=0;y<180;y++)for(let x=0;x<360;x++){
  const lon=x+.5,lat=89.5-y,c=required(count.sample(lon,lat)),m=maplet.sample(lon,lat),v=albedo.sample(lon,lat),pass=c>=5&&m!==null&&m<=1500;
  assert.equal(v!==null,pass,`${lon}E ${lat}N`);if(pass)accepted++;
 }
 assert.equal(accepted,57328);assert.equal(albedo.sample(360.1,0),null);assert.equal(albedo.sample(0,-90.1),null);
});

const proofShape=shape({products:dictionary(shape({path:text,bytes:number,grid:parseIsis3Grid,allPixels:number,finitePixels:number,minimum:number,maximum:number,histogram:optional(dictionary(number))})),fixtures:array(shape({longitudeDegrees:number,latitudeDegrees:number,imageCount:number,bestMapletMeters:number,rawAlbedo:number,accepted:boolean,kind:text}))});
