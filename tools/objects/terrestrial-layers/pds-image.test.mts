import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {parsePdsImage} from './pds-image.mts';

function fixture({rock=false, values}: {rock?: boolean; values?: readonly number[]} = {}) {
  const width=rock?6:4, height=2, ppd=rock?1/60:1/90, latitude=rock?60:90;
  const policy={schema:'cssearth-pds-int16-cylindrical@1',format:'pds-image',sampling:'nearest',
    datasetId:'MOON-DATA',productId:'GRID.IMG',productVersion:'V1.0',target:'MOON',
    path:'grid.img',labelPath:'grid.lbl',sourceUnit:rock?'NONE':'METER',
    grid:{width,height,pixelsPerDegree:ppd,latitudeRange:[-latitude,latitude],longitudeRange:[0,360],
      referenceRadiusMeters:1737400,frame:'MEAN EARTH/POLAR AXIS OF DE421',
      scalingFactor:rock?.001:.5,offset:rock?0:1737400,noData:rock?-32768:null},
    valueTransform:{scale:rock?.1:.5,offset:0},...(rock?{validRange:[0,100]}:{})};
  const fields={PDS_VERSION_ID:'PDS3',DATA_SET_ID:policy.datasetId,PRODUCT_ID:policy.productId,
    PRODUCT_VERSION_ID:policy.productVersion,TARGET_NAME:'MOON','^IMAGE':'GRID.IMG',
    SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:16,LINES:height,LINE_SAMPLES:width,UNIT:policy.sourceUnit,
    SCALING_FACTOR:policy.grid.scalingFactor,OFFSET:policy.grid.offset,
    MAP_PROJECTION_TYPE:'SIMPLE CYLINDRICAL',POSITIVE_LONGITUDE_DIRECTION:'EAST',
    COORDINATE_SYSTEM_NAME:policy.grid.frame,MINIMUM_LATITUDE:-latitude,MAXIMUM_LATITUDE:latitude,
    WESTERNMOST_LONGITUDE:0,EASTERNMOST_LONGITUDE:360,MAP_RESOLUTION:ppd,
    A_AXIS_RADIUS:1737.4,B_AXIS_RADIUS:1737.4,C_AXIS_RADIUS:1737.4,
    LINE_PROJECTION_OFFSET:height/2-.5,SAMPLE_PROJECTION_OFFSET:width/2-.5,
    CENTER_LATITUDE:0,CENTER_LONGITUDE:180,MAP_PROJECTION_ROTATION:0,
    ...(rock?{MISSING_CONSTANT:-32768}:{})};
  const label=Object.entries(fields).map(([k,v])=>`${k} = ${typeof v==='string'?JSON.stringify(v):v}`).join('\n');
  const bytes=Buffer.alloc(width*height*2);
  (values??Array.from({length:width*height},(_,i)=>i-3)).forEach((v,i)=>bytes.writeInt16LE(v,i*2));
  return {bytes,label,policy};
}

test('LOLA heights retain signed half-metre values without the radius offset',()=>{
  const {bytes,label,policy}=fixture({values:[-17963,0,21371,2,-2,100,200,300]});
  const map=parsePdsImage(bytes,label,policy);
  assert.equal(map.sample(45,45),-8981.5);
  assert.equal(map.sample(135,45),0);
  assert.equal(map.sample(225,45),10685.5);
  assert.deepEqual(map.report,{sourcePixels:8,validPixels:8,missingPixels:0,rejectedRangePixels:0,
    zeroPixels:1,minimum:-8981.5,maximum:10685.5});
});

test('Diviner converts fraction to percent, preserves zero and rejects missing/physical outliers',()=>{
  const {bytes,label,policy}=fixture({rock:true,values:[0,4,-32768,1063,613,-1,2,3,4,5,6,7]});
  const map=parsePdsImage(bytes,label,policy);
  assert.equal(map.sample(30,30),0);
  assert.equal(map.sample(90,30),.4);
  assert.equal(map.sample(150,30),null);
  assert.equal(map.sample(210,30),null);
  assert.equal(map.sample(270,30),61.300000000000004);
  assert.equal(map.sample(330,30),null);
  assert.equal(map.report.missingPixels,1);
  assert.equal(map.report.rejectedRangePixels,2);
  assert.equal(map.report.validPixels,9);
});

test('nearest cells wrap longitude and preserve north-down registration and exact coverage',()=>{
  const {bytes,label,policy}=fixture({rock:true,values:[10,20,30,40,50,60,70,80,90,100,110,120]});
  const map=parsePdsImage(bytes,label,policy);
  assert.equal(map.sample(0,60),1);
  assert.equal(map.sample(360,60),1);
  assert.equal(map.sample(-.001,60),6);
  assert.equal(map.sample(0,-60),7);
  assert.equal(map.sample(0,60.001),null);
  assert.equal(map.sample(0,-60.001),null);
  assert.equal(map.sample(NaN,0),null);
  assert.equal(map.sample(0,Infinity),null);
});

test('identity, numeric units, reference frame and registration fail closed',()=>{
  const {bytes,label,policy}=fixture();
  for(const [from,to] of [['V1.0','V2.0'],['METER','KILOMETER'],['CENTER_LONGITUDE = 180','CENTER_LONGITUDE = 0'],
    ['CENTER_LATITUDE = 0','CENTER_LATITUDE = 1'],['MAP_PROJECTION_ROTATION = 0','MAP_PROJECTION_ROTATION = 1'],
    ['1737.4','1738.4'],['EAST','WEST'],['LSB_INTEGER','MSB_INTEGER'],['SCALING_FACTOR = 0.5','SCALING_FACTOR = 1'],
    ['DE421','DE440']]) assert.throws(()=>parsePdsImage(bytes,label.replace(from,to),policy),/changed/);
  assert.throws(()=>parsePdsImage(bytes,label+'\nLINES = 2',policy),/ambiguous/);
  assert.throws(()=>parsePdsImage(bytes.subarray(2),label,policy),/dimensions/);
});

test('self-contained policy requires nearest sampling and valid full-longitude grid',()=>{
  const {bytes,label,policy}=fixture();
  for(const replacement of [{sampling:'bilinear'},{sampling:'typo'},{schema:'unknown'},
    {grid:{...policy.grid,width:NaN}},{grid:{...policy.grid,longitudeRange:[-180,180]}},
    {grid:{...policy.grid,noData:undefined}},{validRange:[1,0]},
    {valueTransform:{scale:Infinity,offset:0}}])assert.throws(()=>parsePdsImage(bytes,label,{...policy,...replacement}),/policy/);
});

test('all-missing grids remain missing and never report infinite extrema',()=>{
  const {bytes,label,policy}=fixture({rock:true,values:Array(12).fill(-32768)});
  const map=parsePdsImage(bytes,label,policy);
  assert.equal(map.sample(0,0),null);
  assert.equal(map.report.validPixels,0);
  assert.equal(map.report.minimum,null);
  assert.equal(map.report.maximum,null);
});
