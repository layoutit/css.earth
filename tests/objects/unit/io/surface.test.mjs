import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {verifyRuntimeAssetClosure} from '../../../../src/platform/runtime-asset-closure.mts';
import {publishedObservation,canonicalPoint,assertDisplayClose,countInteriorPixels} from '../observed-atlas-proof.mjs';
const source=await createSourceManifest({planetId:'io',planetName:'Io',sourceRoot:new URL('../../../../src/planets/io/source/',import.meta.url).pathname});
const root=new URL('../../../../public/scenes/io/',import.meta.url);
let normal,color;
async function observations(){normal??=await publishedObservation('io','normal');color??=await publishedObservation('io','enhanced');}

test('Io binds its independent source and prepared runtime closure',async()=>{
 assert.equal((await source.verify()).inputCount,9);
 const manifest=JSON.parse(await readFile(new URL('../../../../src/planets/io/runtime-assets.json',import.meta.url)));
 await verifyRuntimeAssetClosure({planetId:'io',manifest,root:root.pathname});
 assert.ok(manifest.assets.some(a=>a.filename==='io-parent-jupiter.webp'));
});

test('Io withholds interpolated polar color and retains observed monochrome',async()=>{
 await observations();assert.equal(color.record.layout.width,4096);assert.equal(color.record.layout.height,2048);
 for(const y of [0,20,45,2002,2027,2047])for(let x=0;x<4096;x+=32){
  const p=canonicalPoint(x,y,4096,2048);
  assertDisplayClose(color.sample(p.longitude,p.latitude).rgb,normal.sample(p.longitude,p.latitude).rgb,`polar ${x},${y} retains monochrome in the actual pole atlas`);
 }
 assert.ok(color.record.monochromePixels>450000,'The source polar exclusion is represented before encoding');
 const gray=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b)<=8;
 assert.ok(countInteriorPixels(normal,gray,3,12)>4_000_000);
 assert.ok(countInteriorPixels(normal,(r,g,b)=>gray(r,g,b)&&r>0&&r<35,3,12)>1000,'Observed dark terrain survives in the actual runtime atlas');
});

test('Pele is south of the equator at the independently published positive-west longitude',async()=>{
 await observations();
 // IAU/USGS Gazetteer 4638: 18.71 S, 255.28 W = 104.72 E.
 // Use actual prepared CSS texture frames, never a discarded equirectangular map.
 function redFraction(lon){let red=0,count=0;for(let lat=-30;lat<-6;lat+=.3)for(let x=lon-12;x<lon+12;x+=.3){
  const [r,g,b]=color.sample(x,lat).rgb;if(r>g*1.35&&r>b*1.5)red++;count++;
 }return red/count;}
 assert.ok(redFraction(104.72)>.45);assert.ok(redFraction(255.28)<.05);
});
