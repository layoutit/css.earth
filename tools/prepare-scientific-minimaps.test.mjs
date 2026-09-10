import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {prepareSurfaceMinimaps} from './prepare-surface-minimaps.mts';
import {observationRaster, prepareObservationLenses} from './objects/static-surface/raster.mts';

const legacyEncoding={quality:90,alphaQuality:100,effort:4,smartSubsample:true};
const colors=[[231,21,41],[13,211,31],[82,84,82]];
const pixelSet=data=>{
  const set=new Set();for(let i=0;i<data.length;i+=3)set.add(data.subarray(i,i+3).join(','));return set;
};
async function directories(t) {
  const root=await mkdtemp(resolve(tmpdir(),'scientific-minimap-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const source=resolve(root,'source'),publicDirectory=resolve(root,'public'),outputDirectory=resolve(root,'prepared');
  for(const p of ['preparation','presentation'])await mkdir(resolve(source,p),{recursive:true});
  await mkdir(publicDirectory);await mkdir(outputDirectory);
  return {root,source,objectDirectory:root,publicDirectory,outputDirectory};
}
async function stripedImage(path,width=1280,height=8) {
  const data=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++)data.set(colors[(i%width)%3],i*3);
  await sharp(data,{raw:{width,height,channels:3}}).png().toFile(path);
}
function shiftHalf(data,info) {
  const out=Buffer.alloc(data.length),half=info.width/2,rowBytes=info.width*info.channels;
  for(let y=0;y<info.height;y++){
    const row=y*rowBytes,split=half*info.channels;
    data.copy(out,row,row+split,row+rowBytes);data.copy(out,row+split,row,row+split);
  }
  return out;
}

async function numericStaticFixture(source) {
  const scientific={schema:'cssearth-pds-int16-cylindrical@1',format:'pds-image',sampling:'nearest',displaySampling:'nearest',
    path:'grid.img',labelPath:'grid.lbl',datasetId:'MOON-FIXTURE',productId:'GRID.IMG',productVersion:'V1.0',target:'MOON',sourceUnit:'NONE',
    grid:{width:16,height:8,pixelsPerDegree:16/360,latitudeRange:[-90,90],longitudeRange:[0,360],referenceRadiusMeters:1737400,
      frame:'MEAN EARTH/POLAR AXIS OF DE421',scalingFactor:.01,offset:0,noData:-32768},
    valueTransform:{scale:.01,offset:0},validRange:[0,1],minimum:0,maximum:1,colors:['#e71529','#0dd31f'],outputLongitudeOrigin:-180};
  const fields={PDS_VERSION_ID:'PDS3',DATA_SET_ID:scientific.datasetId,PRODUCT_ID:'GRID.IMG',PRODUCT_VERSION_ID:'V1.0',TARGET_NAME:'MOON',
    '^IMAGE':'GRID.IMG',SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:16,LINES:8,LINE_SAMPLES:16,UNIT:'NONE',SCALING_FACTOR:.01,OFFSET:0,
    MAP_PROJECTION_TYPE:'SIMPLE CYLINDRICAL',POSITIVE_LONGITUDE_DIRECTION:'EAST',COORDINATE_SYSTEM_NAME:scientific.grid.frame,
    MINIMUM_LATITUDE:-90,MAXIMUM_LATITUDE:90,WESTERNMOST_LONGITUDE:0,EASTERNMOST_LONGITUDE:360,MAP_RESOLUTION:16/360,
    A_AXIS_RADIUS:1737.4,B_AXIS_RADIUS:1737.4,C_AXIS_RADIUS:1737.4,LINE_PROJECTION_OFFSET:3.5,SAMPLE_PROJECTION_OFFSET:7.5,
    CENTER_LATITUDE:0,CENTER_LONGITUDE:180,MAP_PROJECTION_ROTATION:0,MISSING_CONSTANT:-32768};
  const label=Object.entries(fields).map(([key,value])=>`${key} = ${typeof value==='string'?JSON.stringify(value):value}`).join('\n');
  const bytes=Buffer.alloc(16*8*2);
  for(let i=0;i<128;i++)bytes.writeInt16LE(i%3===0?-32768:i%3===1?0:100,i*2);
  await writeFile(resolve(source,'grid.img'),bytes);await writeFile(resolve(source,'grid.lbl'),label);
  return {id:'numeric',input:'grid.img',scientific};
}

test('static scientific minimaps retain nearest colors and missing cells while image bytes stay unchanged',async t=>{
  const f=await directories(t),numeric=await numericStaticFixture(f.source);
  await stripedImage(resolve(f.source,'image.png'));
  const image={id:'image',input:'image.png'};
  const recipe={kind:'observation-lenses',width:1280,height:640,densities:[1],lenses:[numeric,image]};
  const recipeBytes=Buffer.from(JSON.stringify(recipe));
  await writeFile(resolve(f.source,'preparation/raster.json'),recipeBytes);
  const rows=await prepareSurfaceMinimaps(f);
  assert.deepEqual(rows.map(({id,width,height})=>[id,width,height]),[['numeric',640,320],['image',640,320]]);
  for(const plan of [numeric,image]){
    const raster=await observationRaster({input:resolve(f.source,plan.input),plan,width:1280,height:640});
    const actual=await readFile(resolve(f.outputDirectory,`minimaps/${plan.id}.webp`));
    if(plan===numeric){
      const expected=await sharp(raster.data,{raw:raster.info}).resize({width:640,withoutEnlargement:true,kernel:'nearest'}).raw().toBuffer();
      const decoded=await sharp(actual).removeAlpha().raw().toBuffer();
      assert.deepEqual(decoded,expected);
      const allowed=pixelSet(raster.data);for(const color of pixelSet(decoded))assert.ok(allowed.has(color),color);
      assert.ok(pixelSet(decoded).has('231,21,41'));assert.ok(pixelSet(decoded).has('13,211,31'));
      assert.ok([...pixelSet(decoded)].some(color=>!['231,21,41','13,211,31'].includes(color)),'Missing-data styling retained');
    }else{
      const expected=await sharp(raster.data,{raw:raster.info}).resize({width:640,withoutEnlargement:true}).webp(legacyEncoding).toBuffer();
      assert.deepEqual(actual,expected,'Default image minimap must remain byte-identical');
    }
  }
  assert.deepEqual(await readFile(resolve(f.source,'preparation/raster.json')),recipeBytes);
});

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


test('denser oriented scientific atlases unwarp into the same bounded minimap',async t=>{
  const f=await directories(t),numeric={...await numericStaticFixture(f.source),output:'numeric',rasterScale:2};
  const recipe={schema:'cssearth-static-surface-raster@1',kind:'observation-lenses',width:320,height:160,densities:[1,2],
    latitudeSegments:4,polarTile:16,surfaceProjection:'oriented-bands',thumbnail:'prepared-centered',
    material:{frameSize:8,limbFloor:.52,radiusScale:.505,output:'curvature'},lenses:[numeric]};
  await writeFile(resolve(f.source,'preparation/raster.json'),JSON.stringify(recipe));
  await prepareObservationLenses({sourceDirectory:f.source,publicDirectory:f.publicDirectory,config:recipe});
  const rows=await prepareSurfaceMinimaps(f);
  assert.deepEqual(rows.map(({width,height})=>[width,height]),[[640,320]]);
  const interpreted=await observationRaster({input:resolve(f.source,numeric.input),plan:numeric,width:1280,height:640});
  const expected=await sharp(interpreted.data,{raw:interpreted.info}).resize({width:640,kernel:'nearest'}).raw().toBuffer();
  const actual=await sharp(resolve(f.outputDirectory,rows[0].path)).removeAlpha().raw().toBuffer();
  assert.deepEqual(actual,expected);
  await writeFile(resolve(f.source,'preparation/raster.json'),JSON.stringify({...recipe,lenses:[{...numeric,rasterScale:1}]}));
  await assert.rejects(prepareSurfaceMinimaps(f),/preview dimensions drifted/);
});
