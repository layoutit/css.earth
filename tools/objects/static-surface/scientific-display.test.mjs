import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {prepareObservationLenses, observationRaster} from './raster.mts';

async function fixture() {
  const root=await mkdtemp(join(tmpdir(),'cssearth-scientific-display-'));
  const sourceDirectory=join(root,'source');await mkdir(sourceDirectory);
  const policy={schema:'cssearth-pds-int16-cylindrical@1',format:'pds-image',sampling:'nearest',displaySampling:'nearest',
    datasetId:'MOON-FIXTURE',productId:'GRID.IMG',productVersion:'V1.0',target:'MOON',path:'grid.img',labelPath:'grid.lbl',sourceUnit:'NONE',
    grid:{width:16,height:8,pixelsPerDegree:16/360,latitudeRange:[-90,90],longitudeRange:[0,360],referenceRadiusMeters:1737400,
      frame:'MEAN EARTH/POLAR AXIS OF DE421',scalingFactor:.01,offset:0,noData:-32768},
    valueTransform:{scale:.01,offset:0},validRange:[0,1],minimum:0,maximum:1,colors:['#f00000','#00f000'],outputLongitudeOrigin:-180};
  const fields={PDS_VERSION_ID:'PDS3',DATA_SET_ID:policy.datasetId,PRODUCT_ID:policy.productId,PRODUCT_VERSION_ID:'V1.0',
    TARGET_NAME:'MOON','^IMAGE':'GRID.IMG',SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:16,LINES:8,LINE_SAMPLES:16,UNIT:'NONE',
    SCALING_FACTOR:.01,OFFSET:0,MAP_PROJECTION_TYPE:'SIMPLE CYLINDRICAL',POSITIVE_LONGITUDE_DIRECTION:'EAST',
    COORDINATE_SYSTEM_NAME:policy.grid.frame,MINIMUM_LATITUDE:-90,MAXIMUM_LATITUDE:90,WESTERNMOST_LONGITUDE:0,EASTERNMOST_LONGITUDE:360,
    MAP_RESOLUTION:16/360,A_AXIS_RADIUS:1737.4,B_AXIS_RADIUS:1737.4,C_AXIS_RADIUS:1737.4,
    LINE_PROJECTION_OFFSET:3.5,SAMPLE_PROJECTION_OFFSET:7.5,CENTER_LATITUDE:0,CENTER_LONGITUDE:180,MAP_PROJECTION_ROTATION:0,MISSING_CONSTANT:-32768};
  const label=Object.entries(fields).map(([k,v])=>`${k} = ${typeof v==='string'?JSON.stringify(v):v}`).join('\n');
  const data=Buffer.alloc(16*8*2),image=Buffer.alloc(16*8*3);
  for(let y=0;y<8;y++)for(let x=0;x<16;x++){
    const raw=(x+y)%4===0?-32768:(x+y)%4<2?0:100;
    data.writeInt16LE(raw,(y*16+x)*2);
    image.set([x*15,y*30,(x+y)%2*230],(y*16+x)*3);
  }
  await writeFile(join(sourceDirectory,'grid.img'),data);await writeFile(join(sourceDirectory,'grid.lbl'),label);
  await sharp(image,{raw:{width:16,height:8,channels:3}}).png().toFile(join(sourceDirectory,'image.png'));
  const numeric={id:'numeric',input:'grid.img',output:'numeric',scientific:policy};
  const crust={id:'crust',input:'image.png',output:'crust'};
  const config={schema:'cssearth-static-surface-raster@1',kind:'observation-lenses',width:32,height:16,latitudeSegments:4,
    polarTile:16,densities:[1,2],surfaceProjection:'oriented-bands',thumbnail:'source-center-crop',
    material:{frameSize:8,limbFloor:.52,radiusScale:.505,output:'curvature'},lenses:[numeric,crust]};
  return {root,sourceDirectory,numeric,crust,config};
}

function expectedPoles(data,{width,height,channels},tileSize,boundary) {
  const output=Buffer.alloc(tileSize*4*tileSize*4);
  for(let tile=0;tile<4;tile++)for(let y=0;y<tileSize;y++)for(let x=0;x<tileSize;x++){
    const ux=(x+.5)*2/tileSize-1,uy=(y+.5)*2/tileSize-1,radius=Math.hypot(ux,uy);
    if(radius>1)continue;
    const sign=tile%2===0?1:-1;
    const latitude=sign*Math.acos((tile>=2?1:radius)*Math.cos(boundary));
    const longitude=(Math.atan2(uy,ux)+Math.PI*2)%(Math.PI*2);
    const sx=Math.floor(longitude/(Math.PI*2)*width)%width;
    const sy=Math.max(0,Math.min(height-1,Math.floor((Math.PI/2-latitude)/Math.PI*height)));
    const source=(sy*width+sx)*channels,target=(y*tileSize*4+tile*tileSize+x)*4;
    output.set([data[source],data[source+1],data[source+2],255],target);
  }
  return output;
}

const rgbSet=(data,channels)=>{
  const set=new Set();for(let i=0;i<data.length;i+=channels)if(channels===3||data[i+3])set.add(data.subarray(i,i+3).join(','));return set;
};

test('scientific display preserves exact palette and missing texels through encoded bands, poles and thumbnails',async()=>{
  const f=await fixture(),publicDirectory=join(f.root,'nearest');
  await prepareObservationLenses({...f,publicDirectory});
  const sourceColors=new Set();
  for(const density of [1,2]){
    const width=32*density,height=16*density,suffix=density===2?'@2x':'';
    const raster=await observationRaster({input:join(f.sourceDirectory,'grid.img'),plan:f.numeric,width,height});
    rgbSet(raster.data,3).forEach(color=>sourceColors.add(color));
    assert.ok(sourceColors.has('240,0,0'));assert.ok(sourceColors.has('0,240,0'));
    assert.ok([...sourceColors].some(color=>color!=='240,0,0'&&color!=='0,240,0'));
    const surface=await sharp(join(publicDirectory,`numeric${suffix}.webp`)).raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([surface.info.width,surface.info.height,surface.info.channels],[width,height,3]);
    for(let y=0;y<height;y++){
      const bandHeight=height/4,sy=Math.floor(y/bandHeight)*bandHeight+bandHeight-1-y%bandHeight;
      assert.deepEqual(surface.data.subarray(y*width*3,(y+1)*width*3),raster.data.subarray(sy*width*3,(sy+1)*width*3));
    }
    const poles=await sharp(join(publicDirectory,`numeric-poles${suffix}.webp`)).ensureAlpha().raw().toBuffer();
    assert.deepEqual(poles,expectedPoles(raster.data,raster.info,16*density,Math.PI/4));
    assert.ok([...poles].some((value,i)=>i%4===3&&value===0));
    for(let i=3;i<poles.length;i+=4)assert.ok(poles[i]===0||poles[i]===255);
  }
  const thumbnail=await sharp(join(publicDirectory,'numeric-thumbnail.webp')).raw().toBuffer();
  for(const color of rgbSet(thumbnail,3))assert.ok(sourceColors.has(color),`New color introduced: ${color}`);
});

test('adding a numeric nearest lens preserves every image-lens output byte',async()=>{
  const f=await fixture(),single=join(f.root,'single'),mixed=join(f.root,'mixed');
  await prepareObservationLenses({...f,publicDirectory:single,config:{...f.config,lenses:[f.crust]}});
  await prepareObservationLenses({...f,publicDirectory:mixed});
  const names=(await readdir(single)).filter(name=>name.startsWith('crust'));
  assert.equal(names.length,5);
  for(const name of names)assert.deepEqual(await readFile(join(single,name)),await readFile(join(mixed,name)),name);
});

test('unsupported numeric display sampling and interpolating atlas routes fail closed',async()=>{
  const f=await fixture();
  const bad={...f.numeric,scientific:{...f.numeric.scientific,displaySampling:'bilinear'}};
  await assert.rejects(prepareObservationLenses({...f,publicDirectory:join(f.root,'bad'),config:{...f.config,lenses:[bad]}}),/Unsupported scientific display sampling/);
  await assert.rejects(prepareObservationLenses({...f,publicDirectory:join(f.root,'inverse'),geometry:{rasterAtlas:{}},surfaceRasterCells:[{}],config:{...f.config,surfaceProjection:'inverse-homography',lenses:[f.numeric]}}),/requires oriented bands/);
});

test('categorical static-map legend contains discrete units without requiring a numeric scale',async()=>{
  const f=await fixture(),publicDirectory=join(f.root,'categories');
  const scientific={...f.numeric.scientific,categories:[
    {value:'A',label:'Unit A',color:'#f00000'}, {value:'B',label:'Unit B',color:'#00f000'},
  ]};
  delete scientific.minimum;delete scientific.maximum;delete scientific.colors;
  const plan={...f.numeric,scientific};
  await prepareObservationLenses({...f,publicDirectory,config:{...f.config,lenses:[plan]}});
  const legend=await sharp(join(publicDirectory,'numeric-legend.webp')).raw().toBuffer();
  for(let y=0;y<16;y++)for(let x=0;x<256;x++)
    assert.deepEqual([...legend.subarray((y*256+x)*3,(y*256+x)*3+3)],x<128?[240,0,0]:[0,240,0]);
  const map=await observationRaster({input:join(f.sourceDirectory,'grid.img'),plan,width:32,height:16});
  const allowed=rgbSet(map.data,3);
  for(const color of rgbSet(await sharp(join(publicDirectory,'numeric.webp')).raw().toBuffer(),3))
    assert.ok(allowed.has(color),`Unexpected interpolated category: ${color}`);
});
