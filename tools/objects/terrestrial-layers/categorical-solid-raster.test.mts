import { required } from '../../contract/test-values.mts';
import { fixtureSource } from '../test-source-fixture.mts';
import { requireRecord, requireString } from '../../sources/source-values.mts';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {prepareSolidRasters, prepareSolidMaterial} from './solid-raster.mts';
import {reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster} from '../../../src/platform/prepare-solid-body-surface.mts';

const colors=['#ff0000','#00ff00'], rgb=colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
function assertPalette(bytes: Uint8Array, message: string) {
  let opaque=0;
  for(let i=0;i<bytes.length;i+=4) {
    if (!bytes[i+3]) continue;
    opaque++;
    assert.ok(rgb.some(c=>c.every((n,j)=>n===bytes[i+j])),message+' mixed color at '+i/4+': '+[...bytes.subarray(i,i+3)]);
  }
  assert.ok(opaque>0);
}
function fixture() {
  const records=[0,1].map(category=>{
    const rings=Array.from({length:16},(_,j)=>{
      const west=-180+(j*2+category)*11.25,east=west+11.25;
      return [[west,-90],[east,-90],[east,90],[west,90],[west,-90]];
    });
    const bytes=Buffer.alloc(44+rings.length*4+rings.length*5*16);
    bytes.writeInt32LE(5);[-180,-90,180,90].forEach((n,i)=>bytes.writeDoubleLE(n,4+i*8));
    bytes.writeInt32LE(rings.length,36);bytes.writeInt32LE(rings.length*5,40);
    rings.forEach((ring,i)=>{bytes.writeInt32LE(i*5,44+i*4);ring.forEach((point,j)=>point.forEach((n,k)=>bytes.writeDoubleLE(n,44+rings.length*4+(i*5+j)*16+k*8)))});
    return bytes;
  });
  const shp=Buffer.alloc(100+records.reduce((n,b)=>n+b.length+8,0));
  shp.writeInt32BE(9994);shp.writeInt32BE(shp.length/2,24);shp.writeInt32LE(1000,28);shp.writeInt32LE(5,32);
  [-180,-90,180,90].forEach((n,i)=>shp.writeDoubleLE(n,36+i*8));let offset=100;
  records.forEach((b,i)=>{shp.writeInt32BE(i+1,offset);shp.writeInt32BE(b.length/2,offset+4);b.copy(shp,offset+8);offset+=8+b.length});
  const dbf=Buffer.alloc(69);dbf[0]=3;dbf.writeUInt32LE(2,4);dbf.writeUInt16LE(65,8);dbf.writeUInt16LE(2,10);
  dbf.write('Unit',32);dbf[43]=67;dbf[48]=1;dbf[64]=13;dbf.write(' A B',65);
  const prj='GEOGCS["GCS_Fixture",DATUM["D",SPHEROID["S",1,0]],PRIMEM["Reference_Meridian",0.0],UNIT["Degree",0.0174532925199433]]';
  return {shp,dbf,prj};
}

test('category nearest is explicit while default solid and pole sampling stays bilinear',()=>{
  const width=64,height=32,bytes=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes.set([...rgb[(x+y)%2],255],(y*width+x)*4);
  const surface={width,height,latitudeSegments:8,longitudeSegments:16},pole={width,height,tileSize:16,latitudeSegments:8};
  assertPalette(reprojectSolidBodySurfaceRaster(bytes,{...surface,sampling:'nearest'}),'surface');
  assertPalette(prepareSolidBodyPoleRaster(bytes,{...pole,sampling:'nearest'}),'poles');
  assert.deepEqual(reprojectSolidBodySurfaceRaster(bytes,surface),reprojectSolidBodySurfaceRaster(bytes,{...surface,sampling:'bilinear'}));
  assert.deepEqual(prepareSolidBodyPoleRaster(bytes,pole),prepareSolidBodyPoleRaster(bytes,{...pole,sampling:'bilinear'}));
  assert.notDeepEqual(reprojectSolidBodySurfaceRaster(bytes,surface),reprojectSolidBodySurfaceRaster(bytes,{...surface,sampling:'nearest'}));
  assert.throws(()=>Reflect.apply(reprojectSolidBodySurfaceRaster, undefined, [bytes, {...surface,sampling:'cubic'}]),TypeError);
});

test('actual category pack, encoded atlases, poles, legend and thumbnail retain only source palette colors',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cssearth-category-raster-'));
  try {
    const {shp,dbf,prj}=fixture();
    await Promise.all([writeFile(join(root,'units.shp'),shp),writeFile(join(root,'units.dbf'),dbf),writeFile(join(root,'units.prj'),prj)]);
    const lens={id:'geology',label:'Geology',consumer:'geology',format:'geologic-shapefile',path:'units.shp',sampling:'nearest',overlapPolicy:'withhold-conflicts',
      categories:colors.map((color,i)=>({value:i?'B':'A',label:i?'B':'A',color})),
      grid:{attributePath:'units.dbf',projectionPath:'units.prj',coordinateSystem:'GCS_Fixture',referenceRadiusMeters:1,longitudeDirection:'east-positive',latitudeType:'planetocentric',longitudeDomain:[-180,180],expectedRecords:2,expectedBounds:[-180,-90,180,90],field:'Unit',unknownValues:[],withheldDegenerateRings:[]}};
    const entries=['units.shp','units.dbf','units.prj'].map(path=>({path,id:path,consumers:['geology']}));
    const pinned = await fixtureSource(root, entries);
    const source = {...pinned, async validateGroup(consumer: string) { assert.equal(consumer, 'geology'); return pinned.validateGroup(consumer); }};
    const config={namespace:'fixture',publicBase:'/scenes/fixture/',raster:{width:64,height:32,bandCount:8,gutter:1,poleSize:16,surfaceQuality:5,observations:[],scientific:[lens]},
      lighting:{frameSize:4,columns:1,frameCount:2,logicalSize:4,terminatorWidth:.1,directionalAmbient:.12,fullPhaseAmbient:.12,fullPhaseDiffuse:.88,maximumOpacity:1}};
    const surfaces=await prepareSolidRasters({sourceDirectory:root,publicDirectory:root,outputDirectory:root,config,source});
    await prepareSolidMaterial({surfaces,publicDirectory:root,outputDirectory:root,config});
    const surface=surfaces[0];assert.equal(surface.categorical,true);assert.equal(surface.missingPixels,0);
    for(const url of [surface.map.url,surface.surface.url,surface.thumbnail.url,requireString(requireRecord(surface.legend).url),surface.polesUrl]){
      const bytes=await sharp(await readFile(join(root,required(required(url).split('/').at(-1))))).ensureAlpha().raw().toBuffer();
      assertPalette(bytes,required(url));
    }
  } finally {await rm(root,{recursive:true,force:true})}
});

test('explicit nearest numeric display preserves missing-cell colors through encoded globe and poles',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cssearth-numeric-footprint-'));
  try {
    const lens={id:'height',label:'Relative height',consumer:'science',schema:'cssearth-pds-int16-cylindrical@1',format:'pds-image',sampling:'nearest',displaySampling:'nearest',
      datasetId:'FIXTURE',productId:'GRID.IMG',productVersion:'V1.0',target:'MOON',path:'grid.img',labelPath:'grid.lbl',sourceUnit:'METER',
      grid:{width:4,height:2,pixelsPerDegree:1/90,latitudeRange:[-90,90],longitudeRange:[0,360],referenceRadiusMeters:1000,frame:'FIXTURE',scalingFactor:1,offset:0,noData:-32768},
      valueTransform:{scale:1,offset:0},minimum:0,maximum:2,colors:['#ff0000','#ff0000']};
    const fields={PDS_VERSION_ID:'PDS3',DATA_SET_ID:'FIXTURE',PRODUCT_ID:'GRID.IMG',PRODUCT_VERSION_ID:'V1.0',TARGET_NAME:'MOON','^IMAGE':'GRID.IMG',
      SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:16,LINES:2,LINE_SAMPLES:4,UNIT:'METER',SCALING_FACTOR:1,OFFSET:0,
      MAP_PROJECTION_TYPE:'SIMPLE CYLINDRICAL',POSITIVE_LONGITUDE_DIRECTION:'EAST',COORDINATE_SYSTEM_NAME:'FIXTURE',MINIMUM_LATITUDE:-90,MAXIMUM_LATITUDE:90,
      WESTERNMOST_LONGITUDE:0,EASTERNMOST_LONGITUDE:360,MAP_RESOLUTION:1/90,A_AXIS_RADIUS:1,B_AXIS_RADIUS:1,C_AXIS_RADIUS:1,
      LINE_PROJECTION_OFFSET:.5,SAMPLE_PROJECTION_OFFSET:1.5,CENTER_LATITUDE:0,CENTER_LONGITUDE:180,MAP_PROJECTION_ROTATION:0,MISSING_CONSTANT:-32768};
    const bytes=Buffer.alloc(16);[1,-32768,1,-32768,-32768,1,-32768,1].forEach((n,i)=>bytes.writeInt16LE(n,i*2));
    const label=Object.entries(fields).map(([key,value])=>`${key} = ${typeof value==='string'?JSON.stringify(value):value}`).join('\n');
    await Promise.all([writeFile(join(root,'grid.img'),bytes),writeFile(join(root,'grid.lbl'),label)]);
    const entries=['grid.img','grid.lbl'].map(path=>({path,id:path,consumers:['science']}));
    const source = await fixtureSource(root, entries);
    const config={namespace:'fixture',publicBase:'/scenes/fixture/',raster:{width:64,height:32,bandCount:8,gutter:1,poleSize:16,surfaceQuality:5,observations:[],scientific:[lens]},
      lighting:{frameSize:4,columns:1,frameCount:2,logicalSize:4,terminatorWidth:.1,directionalAmbient:.12,fullPhaseAmbient:.12,fullPhaseDiffuse:.88,maximumOpacity:1}};
    const surfaces=await prepareSolidRasters({sourceDirectory:root,publicDirectory:root,outputDirectory:root,config,source});
    await prepareSolidMaterial({surfaces,publicDirectory:root,outputDirectory:root,config});
    const surface=surfaces[0];assert.equal(surface.displaySampling,'nearest');assert.equal(surface.categorical,undefined);assert.equal(surface.missingPixels,1024);
    const readRaster=async (url: string)=>sharp(await readFile(join(root,required(required(url).split('/').at(-1))))).ensureAlpha().raw().toBuffer();
    const map=await readRaster(surface.map.url),allowed=new Set();
    for(let i=0;i<map.length;i+=4)allowed.add([...map.subarray(i,i+3)].join(','));
    assert.ok(allowed.size>1,'Source includes both valid red and missing coverage');
    for(const url of [surface.surface.url,surface.thumbnail.url,surface.polesUrl]) {
      const output=await readRaster(required(url));
      for(let i=0;i<output.length;i+=4)if(output[i+3])assert.ok(allowed.has([...output.subarray(i,i+3)].join(',')),'Unsupported mixed coverage at '+url+': '+i/4);
    }
  } finally {await rm(root,{recursive:true,force:true})}
});
