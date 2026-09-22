import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('hyperion');
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {loadCameraShape,controlledShapeCamera,decodeCalibratedCamera} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
import {alignCameraBands} from '../../../../tools/objects/terrestrial-layers/band-alignment.mts';
const source=resolve(import.meta.dirname,'../../../../src/objects/hyperion/source');
const json=async (path: string)=>JSON.parse(await readFile(resolve(source,path),'utf8'));

test('Hyperion close observation retains native calibrated detector layout and independent numeric samples',async()=>{
 const image=decodeCalibratedCamera(await readFile(resolve(source,'observations/N1506391424_2_CALIB.IMG')));
 const label=await readFile(resolve(source,'observations/N1506391424_2_CALIB.LBL'),'utf8');
 assert.match(label,/INSTRUMENT_MODE_ID\s*=\s*"FULL"/);
 assert.match(label,/START_TIME\s*=\s*2005-269T01:35:17\.096/);
 assert.match(label,/UNITS\s*=\s*'I\/F'/);
 assert.deepEqual([image.width,image.height,image.offset],[1024,1024,8192]);
 // Independent NumPy little-endian float reads of the unchanged source payload.
 for(const [x,y,expected] of [[80,400,.12089376896619797],[600,550,.11889860033988953],[850,350,.09554952383041382]] as const)assert.equal(image.data[y*1024+x],expected);
});

test('Hyperion corrected close-frame camera reproduces terrain in independent Cassini observations',async()=>{
 const config=await json('preparation/terrestrial.json'),proof=await json('validation/n1506391424-registration.json');
 const frame=config.raster.surfaceObservations.find((lens: { id: string })=>lens.id==='normal').frames.find((f: { id: string; })=>f.id==='n1506391424');assert.ok(frame);
 for(const key of ['northAzimuthDegrees','center','rangeKm','pixelAngleMicroradians'])assert.deepEqual(frame[key],proof.acceptedCamera[key]);
 assert.ok(frame.coverageInsetPixels>=16);
 const camera=controlledShapeCamera(frame),mesh=await loadCameraShape(source,config.geometry.radialTerrain);
 const actual=decodeCalibratedCamera(await readFile(resolve(source,frame.path)));
 const refs:{camera:ReturnType<typeof controlledShapeCamera>;image:ReturnType<typeof decodeCalibratedCamera>}[]=[];
 for(const f of proof.referenceFrames)refs.push({camera:controlledShapeCamera(f),image:decodeCalibratedCamera(await readFile(resolve(source,f.path)))});
 function predicted(x: number,y: number){
  const ray=camera.ray(x,y),hit=mesh.intersect(camera.position,Array.from(ray));if(!hit)return null;
  const pt=camera.position.map((n,k)=>n+ray[k]*hit.radius);
  const candidates=refs.flatMap(r=>{const xy=r.camera.project(pt);return xy&&xy[0]>=1&&xy[1]>=1&&xy[0]<1022&&xy[1]<1022?[{r,xy}]:[];}).sort((a,b)=>Math.min(b.xy[0],1023-b.xy[0],b.xy[1],1023-b.xy[1])-Math.min(a.xy[0],1023-a.xy[0],a.xy[1],1023-a.xy[1]));
  for(const {r,xy} of candidates){
   const v=pt.map((n,k)=>n-r.camera.position[k]),d=Math.hypot(...v),h=mesh.intersect(r.camera.position,v.map(n=>n/d));if(!h||Math.abs(h.radius-d)>1000)continue;
   const [px,py]=xy,ix=Math.floor(px),iy=Math.floor(py),u=px-ix,w=py-iy;
   const vals=[r.image.data[iy*1024+ix],r.image.data[iy*1024+ix+1],r.image.data[(iy+1)*1024+ix],r.image.data[(iy+1)*1024+ix+1]];
   if(vals.some(n=>!Number.isFinite(n)||n<=0))continue;
   return (vals[0]*(1-u)+vals[1]*u)*(1-w)+(vals[2]*(1-u)+vals[3]*u)*w;
  }
  return null;
 }
 // These two disjoint regions were withheld from the camera fit. No image shift,
 // gain fit, blur, contrast normalization or optimization occurs in this test.
 // The lower-left patch contains sharp shadows and the measured 5.7px residual.
 for(const [x0,y0,minimum] of [[656,192,.975],[192,656,.88]] as const){
  let n=0,a=0,b=0,aa=0,bb=0,ab=0;
  for(let y=y0;y<y0+192;y+=4)for(let x=x0;x<x0+192;x+=4){const u=predicted(x,y),v=actual.data[y*1024+x];if(u===null||!(u>0)||!(v>0))continue;n++;a+=u;b+=v;aa+=u*u;bb+=v*v;ab+=u*v;}
  assert.equal(n,2304,'Every fixed held-out sample is covered');
  const correlation=(ab-a*b/n)/Math.sqrt((aa-a*a/n)*(bb-b*b/n));
  assert.ok(correlation>=minimum,`held-out patch ${x0},${y0}: unshifted source correlation ${correlation}`);
 }
});

test('filter colour preparation measures each committed camera against its reference and refuses a displaced one',async()=>{
 const config=await json('preparation/terrestrial.json'),colour=config.raster.surfaceObservations.find((m: {id: string})=>m.id==='filter-color');
 const mesh=await loadCameraShape(source,config.geometry.radialTerrain);
 const load=async (frame: {id: string; path: string})=>{const bytes=await readFile(resolve(source,frame.path));return {frame,image:decodeCalibratedCamera(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};};
 const reference=await load(colour.bandAlignment.references[0]),target=colour.frames[0][colour.bands[0].channel];
 const measure=async (frame: typeof target)=>alignCameraBands({mesh,camera:controlledShapeCamera,reference,targets:[{filter:'IR3',...await load(frame)}],checkOnly:true}).reports[0];
 assert.equal((await measure(target)).accepted,true,'the delivered IR3 camera is confirmed by its reference image');
 assert.equal((await measure({...target,center:[target.center[0]+3,target.center[1]]})).accepted,false,'a camera three detector pixels off fails the held-out budget');
});
