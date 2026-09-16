import {parseFloatMapGrid,parseFloatMapLens} from './source-records.mts';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pds3Keyword} from '../pds-labels.mts';

/** Formal PDS3 scalar maps: attached labels, PC_REAL, spherical unrotated
 * equirectangular projection. Keep missing pixels and the west/east convention. */
export function decodePdsFloatImage(input: Buffer, value: unknown) {
  const grid = parseFloatMapGrid(value);
  const bytes = input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input;
  const label = bytes.subarray(0,131072).toString('ascii');
  const field = (key: string) => {
    const raw = pds3Keyword(label, key);
    if (raw === undefined) throw new Error(`Missing PDS float field: ${key}`);
    return raw;
  };
  const number = (key: string) => {
    const n=Number.parseFloat(field(key));
    if (!Number.isFinite(n)) throw new Error(`Invalid PDS float number: ${key}`);
    return n;
  };
  const width=number('LINE_SAMPLES'), height=number('LINES');
  const recordBytes=number('RECORD_BYTES'), pointer=number('^IMAGE');
  const offset=(pointer-1)*recordBytes, ppd=number('MAP_RESOLUTION');
  const radiusKm=number('A_AXIS_RADIUS'), centerWest=number('CENTER_LONGITUDE');
  const left=((360-centerWest)*ppd-number('SAMPLE_PROJECTION_OFFSET')-0.5+360*ppd)%(360*ppd);
  const top=90*ppd-number('LINE_PROJECTION_OFFSET')-0.5;
  const missing=field('MISSING_CONSTANT').match(/^16#([0-9A-F]{8})#$/)?.[1];
  const labelEnd=label.search(/^END\s*$/m);
  if (field('PDS_VERSION_ID')!=='PDS3' || field('RECORD_TYPE')!=='FIXED_LENGTH' ||
      field('SAMPLE_TYPE')!=='PC_REAL' || number('SAMPLE_BITS')!==32 ||
      field('MAP_PROJECTION_TYPE')!=='EQUIRECTANGULAR' || number('CENTER_LATITUDE')!==0 ||
      field('COORDINATE_SYSTEM_NAME')!=='PLANETOGRAPHIC' || field('COORDINATE_SYSTEM_TYPE')!=='BODY-FIXED ROTATING' ||
      field('POSITIVE_LONGITUDE_DIRECTION')!=='WEST' ||
      !['0','0.0000000','NULL'].includes(field('MAP_PROJECTION_ROTATION')) ||
      field('PRODUCT_ID')!==grid.productId || field('DATA_SET_ID')!==grid.dataSetId || field('TARGET_NAME')!==grid.targetName ||
      width!==grid.width || height!==grid.height || ppd!==grid.pixelsPerDegree ||
      radiusKm*1000!==grid.referenceRadiusMeters || number('B_AXIS_RADIUS')!==radiusKm || number('C_AXIS_RADIUS')!==radiusKm ||
      centerWest!==grid.centerLongitudeWestDegrees || number('SAMPLE_PROJECTION_OFFSET')!==grid.sampleProjectionOffset ||
      number('LINE_PROJECTION_OFFSET')!==grid.lineProjectionOffset || field('MAP_PROJECTION_ROTATION')!==grid.projectionRotation ||
      missing!==grid.missingBits || number('MAXIMUM_LATITUDE')!==90 || number('MINIMUM_LATITUDE')!==-90 ||
      number('EASTERNMOST_LONGITUDE')!==grid.longitudeRangeWest?.[0] || number('WESTERNMOST_LONGITUDE')!==grid.longitudeRangeWest?.[1] ||
      number('SCALING_FACTOR')!==1 || number('OFFSET')!==0 ||
      [width,height,recordBytes,pointer].some(n=>!Number.isSafeInteger(n)||n<=0) || !(ppd>0) ||
      !Number.isInteger(left) || !Number.isInteger(top) || top<0 || top+height>180*ppd || width>360*ppd ||
      labelEnd<0 || offset<labelEnd+3 || offset+width*height*4!==bytes.length || number('FILE_RECORDS')*recordBytes!==bytes.length) {
    throw new Error('PDS float source layout, identity or projection differs from the authored recipe.');
  }
  if (!missing) throw new Error("Missing PDS float special pixel definition");
  const missingBits=Number.parseInt(missing,16), data=new Float32Array(width*height);
  for(let i=0;i<data.length;i++) {
    const at=offset+i*4;
    if (bytes.readUInt32LE(at)===missingBits) data[i]=NaN;
    else {
      data[i]=bytes.readFloatLE(at);
      if (!Number.isFinite(data[i]) || Math.abs(data[i])>1e30) throw new Error('Unexpected PDS float special pixel.');
    }
  }
  return {data,width,height,ppd,left,top,radiusKm,offset,missingBits};
}

export async function loadPdsFloatMap(root: string,value: unknown) {
  const lens=parseFloatMapLens(value);
  const source=decodePdsFloatImage(await readFile(resolve(root,lens.path)),lens.grid);
  if (lens.sampling!==undefined && lens.sampling!=='nearest') throw new TypeError('PDS float source cells require nearest sampling.');
  return {sample(longitude: number,latitude: number) {
    if (!Number.isFinite(longitude)||!Number.isFinite(latitude)||latitude < -90||latitude > 90) return null;
    const lon=((longitude%360)+360)%360;
    const globalX=lon*source.ppd, globalY=(90-latitude)*source.ppd;
    const x=(globalX-source.left+360*source.ppd)%(360*source.ppd), y=globalY-source.top;
    if(x<0||x>=source.width||y<0||y>=source.height)return null;
    const value=source.data[Math.floor(y)*source.width+Math.floor(x)];
    return Number.isFinite(value) ? value*(lens.valueTransform?.scale??1)+(lens.valueTransform?.offset??0) : null;
  }};
}
