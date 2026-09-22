import {array,shape,number,boolean} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('callisto');
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {fromFile} from 'geotiff';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {prepareMaskedObservation} from '../../../../tools/objects/terrestrial-layers/observed-geotiff.mts';
import {parseInterpreterRecipe} from '../../../../tools/objects/observation/interpret.mts';
const root=new URL('../../../../src/objects/callisto/source/',import.meta.url);
const json=async (path: string|URL)=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const hash=(b: string|NodeJS.ArrayBufferView<ArrayBufferLike>|Buffer<ArrayBufferLike>)=>createHash('sha256').update(b).digest('hex');
const recipe=await json('preparation/galileo-color-conversion.json');
const registration=await json('validation/galileo-color-registration.json');
const proof=await json('validation/galileo-color-conversion-proof.json');
const manifest=await json('manifest.json');
const entry=manifest.inputs.find((e: { id: string; })=>e.id==='galileo-pia03456-registered-color');
const sourcePhoto=await sharp(new URL(recipe.input.path,root).pathname).raw().toBuffer({resolveWithObject:true});
const tiff=await fromFile(new URL(entry.path,root).pathname), image=await tiff.getImage();
const rgba=await image.readRasters({interleave:true});
const geo={keys:image.getGeoKeys(),origin:image.getOrigin(),resolution:image.getResolution(),noData:image.getGDALNoData()};
await tiff.close();

// Scalar expanded camera basis is independent of the NumPy vector implementation.
function cameraPoint(longitude: number,latitude: number){
 const r=Math.PI/180,c=registration.camera,lat=c.observerLatitudeDegrees*r,lon=c.observerEastLongitudeDegrees*r,roll=c.northAzimuthDegrees*r;
 const a=longitude*r,b=latitude*r,R=c.radiusMeters,d=c.distanceMeters;
 const x=R*Math.cos(b)*Math.cos(a),y=R*Math.cos(b)*Math.sin(a),z=R*Math.sin(b);
 const toward=x*Math.cos(lat)*Math.cos(lon)+y*Math.cos(lat)*Math.sin(lon)+z*Math.sin(lat);
 const east=-x*Math.sin(lon)+y*Math.cos(lon);
 const north=-x*Math.sin(lat)*Math.cos(lon)-y*Math.sin(lat)*Math.sin(lon)+z*Math.cos(lat);
 const scale=c.projectedRadiusPixels*d/R/(d-toward);
 return {x:c.centerSample+scale*(east*Math.cos(roll)+north*Math.sin(roll)),
  y:c.centerLine+scale*(east*Math.sin(roll)-north*Math.cos(roll)),
  emission:Math.acos((d*toward/R-R)/Math.sqrt(d*d+R*R-2*d*toward))/r};
}
function originalSample(p:ReturnType<typeof cameraPoint>){
 if(p.emission>65||p.x<1||p.y<1||p.x>=644||p.y>=651)return null;
 const x=Math.floor(p.x),y=Math.floor(p.y),u=p.x-x,v=p.y-y,result=[0,0,0];
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const weight=(dx?u:1-u)*(dy?v:1-v),i=((y+dy)*646+x+dx)*4;
  if(weight&&sourcePhoto.data[i+3]!==255)return null;
  for(let c=0;c<3;c++)result[c]+=sourcePhoto.data[i+c]*weight;
 }
 return result;
}

test('Callisto color source, frozen camera, generator and declared derivative have exact closure',async()=>{
 const source=await createSourceManifest({planetId:'callisto',planetName:'Callisto',sourceRoot:root.pathname});await source.verify();
 for(const pin of [recipe.input,recipe.registration]){const b=await readFile(new URL(pin.path,root));assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);}
 assert.equal(hash(await readFile(new URL('preparation/prepare-galileo-color.py',root))),proof.generatorSha256);
 assert.equal(hash(await readFile(new URL('preparation/galileo-color-conversion.json',root))),proof.recipeSha256);
 assert.equal(hash(Buffer.from(rgba.buffer,rgba.byteOffset,rgba.byteLength)),proof.output.rgbaSha256);
 assert.deepEqual(array(shape({diagnosticOffsetPixels:array(number)}))(registration.fit.holdouts).map(h=>h.diagnosticOffsetPixels),[[0,0],[0,0]]);
 assert.ok(array(shape({searchBoundary:boolean}))(registration.fit.holdouts).every(h=>!h.searchBoundary));
 assert.equal(entry.falseColor,true);assert.equal(recipe.maximumEmissionDegrees,65);
 assert.deepEqual(required(geo.keys).GeogSemiMajorAxisGeoKey,2410300);assert.equal(required(geo.keys).GeogSemiMinorAxisGeoKey,2410300);
 assert.equal(required(geo.keys).GTRasterTypeGeoKey,1);assert.equal(required(geo.keys).ProjCenterLongGeoKey,180);assert.equal(geo.noData,0);
 assert.equal(rgba.length,1440*720*4);assert.ok(Math.abs(geo.origin[0]+Math.PI*2410300)<1e-7);
 assert.ok(Math.abs(geo.resolution[0]-Math.PI*2410300/720)<1e-8);
});

test('independent Gazetteer landmarks constrain the accepted photo orientation without refitting',()=>{
 const anchors=[[145.4,41.5,306.6776856186616,113.49757000809834],
  [183.4,42.5,451.1564585704688,97.76591242269612],[154.4,-24.2,380.5121035161871,452.459121236193],
  [166.6,12.1,431.7527883165745,248.83362514617403],[145.7,-3.6,327.5800479635476,344.97679941290426],
  [137.3,-9.9,284.34825239601963,383.670376054459],[113,-1.3,153.44455672517694,346.4369257098719],
  [144.1,32.6,303.8993652691588,153.4386799933491]];
 for(const[longitude,latitude,x,y]of anchors){const p=cameraPoint(longitude,latitude);assert.ok(Math.abs(p.x-x)<1e-8);assert.ok(Math.abs(p.y-y)<1e-8);}
 assert.equal(registration.independentReview.namedFeatures.length,8);
 assert.ok(array(shape({unshiftedLocalNcc:number,diagnosticSearchBoundary:boolean}))(registration.independentReview.namedFeatures).every(f=>f.unshiftedLocalNcc>.6&&!f.diagnosticSearchBoundary));
});

test('every derived texel obeys the 65-degree camera footprint and original opaque RGB contributors',()=>{
 let valid=0,weight=0,totalWeight=0,dark=0,maxDifference=0;
 for(let y=0;y<720;y++){
  const latitude=90-(y+.5)/4,w=Math.cos(latitude*Math.PI/180);totalWeight+=w*1440;
  for(let x=0;x<1440;x++){
   const i=(y*1440+x)*4,expected=originalSample(cameraPoint((x+.5)/4,latitude));
   if(expected===null){assert.deepEqual([...rgba.subarray(i,i+4)],[0,0,0,0]);continue;}
   assert.equal(rgba[i+3],255);valid++;weight+=w;if(Math.max(...expected)<65)dark++;
   for(let c=0;c<3;c++)maxDifference=Math.max(maxDifference,Math.abs(rgba[i+c]-expected[c]));
  }
 }
 assert.equal(valid,226549);assert.equal(valid,proof.output.validPixels);assert.ok(dark>1000,'Dark observations were retained');
 assert.ok(maxDifference<=.50000001,'Only byte quantization changes the original bilinear display values');
 assert.ok(Math.abs(weight/totalWeight-.2873524865681023)<1e-11);
 for(const [x,y]of [[0,360],[1439,360],[580,0],[580,719],[1300,360]] as const)assert.equal(rgba[(y*1440+x)*4+3],0);
});

test('the shared observation decoder honors this actual GeoTIFF footprint and geographic pixel centers',async()=>{
 const config=parseInterpreterRecipe(await json('preparation/raster.json'));const lens=required(config.surfaces.find(s=>s.id==='enhanced')?.science,'enhanced science');
 // The lens focus moved out of the raster recipe into the shared presentation profile.
 const presentation=shape({lensFocus:shape({enhanced:shape({longitudeDegrees:number,latitudeDegrees:number,zoom:number})})})(await json('preparation/presentation.json'));
 assert.deepEqual(presentation.lensFocus.enhanced,{longitudeDegrees:145.2,latitudeDegrees:-.15,zoom:1.1});
 const result=await prepareMaskedObservation(new URL(entry.path,root).pathname,entry,lens.validity,360,180);
 let valid=0,edge=0;
 for(let y=0;y<180;y++)for(let x=0;x<360;x++){
  // A 4x coarser target center lies at native x*4+1.5, y*4+1.5.
  const indices=[0,1,1440,1441].map(n=>((y*4+1)*1440+x*4+1+n)*4);
  const supported=indices.every(i=>rgba[i+3]===255),i=y*360+x;
  assert.equal(result.missing[i],supported?0:1);
  if(!supported){if(indices.some(j=>rgba[j+3]))edge++;continue;}valid++;
  // Meter-to-degree roundoff may choose either integer at an exact half-byte.
  for(let c=0;c<3;c++)assert.ok(Math.abs(result.rgb[i*3+c]-indices.reduce((sum,j)=>sum+rgba[j+c],0)/4)<=.50000001);
 }
 assert.ok(valid>13000&&valid<15000);assert.ok(edge>100,'Mixed valid/no-data contributor footprints are withheld');
});
