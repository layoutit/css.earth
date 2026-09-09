import {readFile} from 'node:fs/promises';
import {resolve, basename} from 'node:path';

const key = (label,name) => {
  const escaped=name.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
  const matches=[...label.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(new RegExp('^\\s*'+escaped+'\\s*=\\s*(?:"([^"]*)"|([^\\s]+))','gm'))];
  if(matches.length!==1) throw new Error('Missing or ambiguous PDS image label field: '+name);
  return matches[0][1]??matches[0][2];
};

/** Narrow authored policy: zero-offset, single-band, full-longitude PDS3 rasters.
 * Nearest-cell sampling preserves measured/modelled values and missing cells. */
export function validatePdsImagePolicy(lens) {
  const g=lens?.grid, pair=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]<v[1];
  if(lens?.schema!=='cssearth-pds-int16-cylindrical@1'||lens.format!=='pds-image'||lens.sampling!=='nearest'||
    !['datasetId','productId','productVersion','target','path','labelPath','sourceUnit'].every(k=>typeof lens[k]==='string'&&lens[k].length>0)||
    !g||!Number.isSafeInteger(g.width)||!Number.isSafeInteger(g.height)||g.width<=0||g.height<=0||
    !Number.isSafeInteger(g.width*g.height*2)||!pair(g.latitudeRange)||!pair(g.longitudeRange)||
    g.longitudeRange[0]!==0||g.longitudeRange[1]!==360||g.latitudeRange[0]!==-g.latitudeRange[1]||
    g.latitudeRange[1]>90||!Number.isFinite(g.pixelsPerDegree)||g.pixelsPerDegree<=0||
    !Number.isFinite(g.referenceRadiusMeters)||g.referenceRadiusMeters<=0||typeof g.frame!=='string'||!g.frame||
    ![g.scalingFactor,g.offset,lens.valueTransform?.scale,lens.valueTransform?.offset].every(Number.isFinite)||
    !(g.noData===null||(Number.isInteger(g.noData)&&g.noData>=-32768&&g.noData<=32767))||
    (lens.validRange!==undefined&&!pair(lens.validRange)))throw new Error('Unsupported PDS image policy.');
}

/** Original PDS3 signed-int16 cylindrical rasters, with no image-library
 * luminance conversion. Authored transforms explicitly select radius/height
 * or display units; the label's scale and reference offset are independently checked. */
export function parsePdsImage(bytes,label,lens) {
  validatePdsImagePolicy(lens);
  const g=lens.grid;
  const expected={PDS_VERSION_ID:'PDS3',DATA_SET_ID:lens.datasetId,PRODUCT_ID:lens.productId,
    PRODUCT_VERSION_ID:lens.productVersion,UNIT:lens.sourceUnit,
    TARGET_NAME:lens.target,'^IMAGE':basename(lens.path).toUpperCase(),SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:'16',
    LINES:String(g.height),LINE_SAMPLES:String(g.width),SCALING_FACTOR:String(g.scalingFactor),
    OFFSET:String(g.offset),CENTER_LATITUDE:'0',CENTER_LONGITUDE:'180',MAP_PROJECTION_ROTATION:'0',
    MAP_PROJECTION_TYPE:'SIMPLE CYLINDRICAL',POSITIVE_LONGITUDE_DIRECTION:'EAST',
    COORDINATE_SYSTEM_NAME:g.frame,MINIMUM_LATITUDE:String(g.latitudeRange[0]),MAXIMUM_LATITUDE:String(g.latitudeRange[1]),
    WESTERNMOST_LONGITUDE:String(g.longitudeRange[0]),EASTERNMOST_LONGITUDE:String(g.longitudeRange[1]),
    MAP_RESOLUTION:String(g.pixelsPerDegree),A_AXIS_RADIUS:String(g.referenceRadiusMeters/1000),
    B_AXIS_RADIUS:String(g.referenceRadiusMeters/1000),C_AXIS_RADIUS:String(g.referenceRadiusMeters/1000),
    LINE_PROJECTION_OFFSET:String(g.height/2-.5),SAMPLE_PROJECTION_OFFSET:String(g.width/2-.5)};
  const numeric=new Set(['CENTER_LATITUDE','CENTER_LONGITUDE','MAP_PROJECTION_ROTATION','SAMPLE_BITS','LINES','LINE_SAMPLES','SCALING_FACTOR','OFFSET','MINIMUM_LATITUDE','MAXIMUM_LATITUDE',
    'WESTERNMOST_LONGITUDE','EASTERNMOST_LONGITUDE','MAP_RESOLUTION','A_AXIS_RADIUS','B_AXIS_RADIUS','C_AXIS_RADIUS',
    'LINE_PROJECTION_OFFSET','SAMPLE_PROJECTION_OFFSET']);
  for(const [name,value] of Object.entries(expected)) {
    const actual=key(label,name);
    if(numeric.has(name)?Number(actual)!==Number(value):actual!==value)throw new Error('PDS image identity/georeference changed: '+name);
  }
  if(g.noData!==null && Number(key(label,'MISSING_CONSTANT'))!==g.noData)throw new Error('PDS missing-data constant changed.');
  if(g.noData===null && /^\s*MISSING_CONSTANT\s*=/m.test(label.replace(/\/\*[\s\S]*?\*\//g,'')))throw new Error('Unexpected PDS missing-data definition.');
  if(bytes.length!==g.width*g.height*2 || g.width!==(g.longitudeRange[1]-g.longitudeRange[0])*g.pixelsPerDegree ||
    g.height!==(g.latitudeRange[1]-g.latitudeRange[0])*g.pixelsPerDegree || ![lens.valueTransform?.scale,lens.valueTransform?.offset].every(Number.isFinite)) {
    throw new Error('PDS image dimensions or explicit display transform changed.');
  }
  const report={sourcePixels:g.width*g.height,validPixels:0,missingPixels:0,rejectedRangePixels:0,zeroPixels:0,minimum:Infinity,maximum:-Infinity};
  const valueAt=(x,y)=>{
    const raw=bytes.readInt16LE((y*g.width+x)*2);
    if(g.noData!==null && raw===g.noData)return null;
    const value=raw*lens.valueTransform.scale+lens.valueTransform.offset;
    return lens.validRange && (value<lens.validRange[0]||value>lens.validRange[1])?null:value;
  };
  for(let i=0;i<report.sourcePixels;i++){
    const raw=bytes.readInt16LE(i*2);
    if(g.noData!==null&&raw===g.noData){report.missingPixels++;continue;}
    const value=raw*lens.valueTransform.scale+lens.valueTransform.offset;
    if(lens.validRange&&(value<lens.validRange[0]||value>lens.validRange[1])){report.rejectedRangePixels++;continue;}
    report.validPixels++;if(value===0)report.zeroPixels++;
    report.minimum=Math.min(report.minimum,value);report.maximum=Math.max(report.maximum,value);
  }
  if(!report.validPixels){report.minimum=null;report.maximum=null;}
  return {report,sample(longitude,latitude) {
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||latitude>g.latitudeRange[1]||latitude<g.latitudeRange[0])return null;
    const lon=((longitude-g.longitudeRange[0])%360+360)%360+g.longitudeRange[0];
    if(lon<g.longitudeRange[0]||lon>=g.longitudeRange[1])return null;
    const x=(lon-g.longitudeRange[0])*g.pixelsPerDegree, y=(g.latitudeRange[1]-latitude)*g.pixelsPerDegree;
    return valueAt(Math.min(g.width-1,Math.floor(x)),Math.min(g.height-1,Math.floor(y)));
  }};
}
export async function loadPdsImage(root,lens){
  const [bytes,label]=await Promise.all([readFile(resolve(root,lens.path)),readFile(resolve(root,lens.labelPath),'utf8')]);
  return parsePdsImage(bytes,label,lens);
}
