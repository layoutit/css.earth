import {parseFloatMapGrid,parseFloatMapLens} from './source-records.mts';
import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import { pds3Keyword } from '@cssearth/telescope';

/** Formal PDS3 scalar maps: 32-bit floats in a spherical, unrotated equirectangular projection, with an attached
 * label or a detached one beside the image. Byte order, west/east convention, latitude extent and missing value all
 * come from the label and must match the authored recipe. Missing pixels stay missing. */
export function decodePdsFloatImage(input: Buffer, value: unknown, detachedLabel?: {text: string; imageName: string}) {
  const grid = parseFloatMapGrid(value);
  const bytes = input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input;
  const label = detachedLabel?.text ?? bytes.subarray(0,131072).toString('ascii');
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
  const east = grid.centerLongitudeEastDegrees !== undefined;
  const sampleType = grid.sampleType ?? 'PC_REAL', littleEndian = sampleType === 'PC_REAL';
  const [minimumLatitude, maximumLatitude] = grid.latitudeRange ?? [-90, 90];
  const width=number('LINE_SAMPLES'), height=number('LINES');
  const recordBytes=number('RECORD_BYTES'), ppd=number('MAP_RESOLUTION');
  const pointer = detachedLabel ? field('^IMAGE') : number('^IMAGE');
  const offset = detachedLabel ? 0 : (Number(pointer)-1)*recordBytes;
  const radiusKm=number('A_AXIS_RADIUS'), center=number('CENTER_LONGITUDE');
  const sampleOffset=number('SAMPLE_PROJECTION_OFFSET'), lineOffset=number('LINE_PROJECTION_OFFSET');
  // West-positive maps keep their established whole-pixel placement; east-positive maps place fractional grids.
  const left=((360-center)*ppd-sampleOffset-0.5+360*ppd)%(360*ppd);
  const top=90*ppd-lineOffset-0.5;
  const missingText = field('MISSING_CONSTANT');
  const missing = grid.missingBits === undefined ? undefined : missingText.match(/^16#([0-9A-F]{8})#$/)?.[1];
  const labelEnd = detachedLabel ? 0 : label.search(/^END\s*$/m);
  const rotation = field('MAP_PROJECTION_ROTATION');
  const direction = field('POSITIVE_LONGITUDE_DIRECTION');
  const [westernmost, easternmost] = east ? grid.longitudeRangeEast ?? [] : [grid.longitudeRangeWest?.[1], grid.longitudeRangeWest?.[0]];
  const layout = detachedLabel
    ? pointer===detachedLabel.imageName && recordBytes===width*4 && bytes.length===width*height*4
    : Number.isSafeInteger(pointer) && Number(pointer)>0 && labelEnd>=0 && offset>=labelEnd+3 && offset+width*height*4===bytes.length && number('FILE_RECORDS')*recordBytes===bytes.length;
  const placement = east
    // The first column and row begin at the label's westernmost longitude and maximum latitude; the last row ends at its minimum.
    ? Math.abs(sampleOffset+0.5+ppd*((westernmost??NaN)-center)) < 1e-3 && Math.abs(lineOffset+0.5-ppd*maximumLatitude) < 1e-3 &&
      Math.abs(lineOffset+0.5-ppd*minimumLatitude-height) < 1e-3 && width>=360*ppd && width<360*ppd+1
    : Number.isInteger(left) && Number.isInteger(top) && top>=0 && top+height<=180*ppd && width<=360*ppd;
  if (field('PDS_VERSION_ID')!=='PDS3' || field('RECORD_TYPE')!=='FIXED_LENGTH' ||
      !['PC_REAL','IEEE_REAL'].includes(sampleType) || field('SAMPLE_TYPE')!==sampleType || number('SAMPLE_BITS')!==32 ||
      field('MAP_PROJECTION_TYPE')!=='EQUIRECTANGULAR' || number('CENTER_LATITUDE')!==0 ||
      field('COORDINATE_SYSTEM_NAME')!==(grid.coordinateSystem ?? 'PLANETOGRAPHIC') || field('COORDINATE_SYSTEM_TYPE')!=='BODY-FIXED ROTATING' ||
      direction!==(east ? 'EAST' : 'WEST') || (east ? grid.centerLongitudeWestDegrees!==undefined || grid.longitudeRangeWest!==undefined : grid.longitudeRangeEast!==undefined) ||
      !(rotation==='NULL' || Number.parseFloat(rotation)===0) || rotation!==grid.projectionRotation ||
      field('PRODUCT_ID')!==grid.productId || field('DATA_SET_ID')!==grid.dataSetId || field('TARGET_NAME')!==grid.targetName ||
      width!==grid.width || height!==grid.height || ppd!==grid.pixelsPerDegree ||
      radiusKm*1000!==grid.referenceRadiusMeters || number('B_AXIS_RADIUS')!==radiusKm || number('C_AXIS_RADIUS')!==radiusKm ||
      center!==(east ? grid.centerLongitudeEastDegrees : grid.centerLongitudeWestDegrees) || sampleOffset!==grid.sampleProjectionOffset ||
      lineOffset!==grid.lineProjectionOffset ||
      (grid.missingBits===undefined)===(grid.missingValue===undefined) ||
      (grid.missingBits!==undefined ? missing!==grid.missingBits : Number.parseFloat(missingText)!==grid.missingValue) ||
      number('MAXIMUM_LATITUDE')!==maximumLatitude || number('MINIMUM_LATITUDE')!==minimumLatitude || !(minimumLatitude<maximumLatitude) ||
      number('EASTERNMOST_LONGITUDE')!==easternmost || number('WESTERNMOST_LONGITUDE')!==westernmost ||
      number('SCALING_FACTOR')!==1 || number('OFFSET')!==0 ||
      [width,height,recordBytes].some(n=>!Number.isSafeInteger(n)||n<=0) || !(ppd>0) || !placement || !layout) {
    throw new Error('PDS float source layout, identity or projection differs from the authored recipe.');
  }
  const missingBits = missing === undefined ? undefined : Number.parseInt(missing,16);
  const missingFloat = grid.missingValue === undefined ? undefined : Math.fround(grid.missingValue);
  const data=new Float32Array(width*height);
  for(let i=0;i<data.length;i++) {
    const at=offset+i*4;
    const bits=littleEndian ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at);
    const sample=littleEndian ? bytes.readFloatLE(at) : bytes.readFloatBE(at);
    if (bits===missingBits || sample===missingFloat) data[i]=NaN;
    else {
      data[i]=sample;
      if (!Number.isFinite(data[i]) || Math.abs(data[i])>1e30) throw new Error('Unexpected PDS float special pixel.');
    }
  }
  /** Continuous pixel coordinates of an east longitude and latitude, or null outside the grid. */
  const pixel = (longitude: number, latitude: number): [number, number] | null => {
    let x: number, y: number;
    if (east) {
      const west = westernmost ?? 0, lon = ((longitude-west)%360+360)%360+west;
      x = sampleOffset+0.5+ppd*(lon-center); y = lineOffset+0.5-ppd*latitude;
    } else {
      const lon=((longitude%360)+360)%360;
      x = (lon*ppd-left+360*ppd)%(360*ppd); y = (90-latitude)*ppd-top;
    }
    return x<0||x>=width||y<0||y>=height ? null : [x,y];
  };
  return {data,width,height,ppd,left,top,radiusKm,offset,missingBits,pixel};
}

export async function loadPdsFloatMap(root: string,value: unknown) {
  const lens=parseFloatMapLens(value);
  const detached = lens.labelPath === undefined ? undefined
    : {text: await readFile(resolve(root,lens.labelPath),'ascii'), imageName: basename(lens.path)};
  const source=decodePdsFloatImage(await readFile(resolve(root,lens.path)),lens.grid,detached);
  if (lens.sampling!==undefined && lens.sampling!=='nearest') throw new TypeError('PDS float source cells require nearest sampling.');
  return {sample(longitude: number,latitude: number) {
    if (!Number.isFinite(longitude)||!Number.isFinite(latitude)||latitude < -90||latitude > 90) return null;
    const at=source.pixel(longitude,latitude);
    if(!at)return null;
    const value=source.data[Math.floor(at[1])*source.width+Math.floor(at[0])];
    return Number.isFinite(value) ? value*(lens.valueTransform?.scale??1)+(lens.valueTransform?.offset??0) : null;
  }};
}
