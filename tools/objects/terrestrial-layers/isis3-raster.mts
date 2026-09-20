import {parseIsis3Grid} from './source-records.mts';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

/** Decode mapped ISIS3 Real cubes; preserve numeric values and special pixels. */
export function decodeIsis3Raster(input: Buffer, sourceGrid: unknown) {
  const grid=parseIsis3Grid(sourceGrid);
  const bytes = input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input;
  const label = bytes.subarray(0, 65536).toString('ascii').split('\0')[0];
  const group = (name: string) => {
    const text = label.match(new RegExp(`Group\\s*=\\s*${name}\\s+([\\s\\S]*?)End_Group`))?.[1];
    if (!text) throw new Error(`ISIS3 ${name} group is missing.`);
    return text;
  };
  const value = (text: string, key: string) => text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\s]+)`, 'm'))?.[1];
  const number = (text: string, key: string) => Number(value(text, key));
  const dimensions = group('Dimensions'), pixels = group('Pixels'), mapping = group('Mapping');
  const width = number(dimensions, 'Samples'), height = number(dimensions, 'Lines');
  const origin = [number(mapping, 'UpperLeftCornerX'), number(mapping, 'UpperLeftCornerY')];
  const resolution = number(mapping, 'PixelResolution');
  // Some published global cubes omit both longitude keywords. This explicit
  // opt-in verifies their native pixel footprint, including sub-pixel padding;
  // longitudeRange still denotes the geographic sampling domain, not a crop.
  if (grid.allowMissingLongitudeBounds !== undefined && typeof grid.allowMissingLongitudeBounds !== 'boolean') {
    throw new TypeError('ISIS3 allowMissingLongitudeBounds must be boolean.');
  }
  const minimumLongitude = value(mapping, 'MinimumLongitude');
  const maximumLongitude = value(mapping, 'MaximumLongitude');
  let longitudeBoundsMatch = Number(minimumLongitude) === grid.longitudeRange?.[0] &&
    Number(maximumLongitude) === grid.longitudeRange?.[1];
  if (grid.allowMissingLongitudeBounds === true && minimumLongitude === undefined && maximumLongitude === undefined) {
    const degreesPerMeter = 180 / (Math.PI * number(mapping, 'EquatorialRadius'));
    const left = number(mapping, 'CenterLongitude') + origin[0] * degreesPerMeter;
    const right = number(mapping, 'CenterLongitude') + (origin[0] + width * resolution) * degreesPerMeter;
    const pixelDegrees = resolution * degreesPerMeter;
    // Only demonstrated global 0..360 products: no missing partial-map bounds,
    // uncovered edge, extra full pixel, or broad inferred longitude convention.
    const epsilon = 1e-9;
    longitudeBoundsMatch = grid.longitudeRange?.[0] === 0 && grid.longitudeRange?.[1] === 360 &&
      Number.isFinite(pixelDegrees) && pixelDegrees > 0 && pixelDegrees <= 1 + epsilon &&
      left <= epsilon && left > -pixelDegrees - epsilon &&
      right >= 360 - epsilon && right < 360 + pixelDegrees + epsilon;
  }
  if (width !== grid.width || height !== grid.height || number(dimensions, 'Bands') !== 1 ||
      value(pixels, 'Type') !== 'Real' || value(pixels, 'ByteOrder') !== 'Lsb' ||
      number(pixels, 'Base') !== 0 || number(pixels, 'Multiplier') !== 1 ||
      value(mapping, 'ProjectionName') !== 'SimpleCylindrical' ||
      value(mapping, 'LatitudeType') !== 'Planetocentric' || value(mapping, 'LongitudeDirection') !== 'PositiveEast' ||
      value(mapping, 'TargetName') !== grid.targetName ||
      number(mapping, 'LongitudeDomain') !== 360 ||
      !longitudeBoundsMatch ||
      number(mapping, 'CenterLongitude') !== grid.centerLongitude ||
      number(mapping, 'EquatorialRadius') !== grid.referenceRadiusMeters ||
      number(mapping, 'PolarRadius') !== grid.polarRadiusMeters ||
      origin.some((n, i) => n !== grid.origin[i]) || resolution !== grid.resolutionMeters) {
    throw new Error('ISIS3 source grid or encoding differs from the authored recipe.');
  }
  const {data} = decodeIsis3Core(bytes);
  return {data, origin, resolution: [resolution, -resolution]};
}

export async function loadIsis3Raster(path: string, grid: unknown) {
  return decodeIsis3Raster(await readFile(path), grid);
}

/** Native numeric core shared by mapped rasters and telescope qualification. No projection is inferred. */
export function isis3CoreHeader(bytes: Buffer, requireTarget = true) {
  const label=bytes.subarray(0,128*1024).toString('latin1');
  if(!/^Object\s*=\s*IsisCube/mu.test(label)) throw new Error('Not an ISIS3 cube.');
  const core=/Object\s*=\s*Core\s+([\s\S]*?)End_Object/u.exec(label)?.[1];
  if(!core) throw new Error('Missing ISIS3 Core.');
  const field=(text:string,key:string)=>new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`,'m').exec(text)?.[1]?.trim().replace(/^"|"$/gu,'');
  const number=(key:string)=>Number(field(core,key));
  const width=number('Samples'),height=number('Lines'),bands=number('Bands'),start=number('StartByte')-1;
  const format=field(core,'Format'),tileWidth=format==='Tile'?number('TileSamples'):width,tileHeight=format==='Tile'?number('TileLines'):1;
  const base=number('Base'),multiplier=number('Multiplier');
  if(![width,height,bands,tileWidth,tileHeight].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(start)||start<0||!Number.isFinite(base)||!Number.isFinite(multiplier))throw new Error('Invalid ISIS3 core dimensions or scaling.');
  const order=field(core,'ByteOrder');
  if(!['Tile','BandSequential'].includes(format??'')||field(core,'Type')!=='Real'||!['Lsb','Msb'].includes(order??''))throw new Error('Unsupported ISIS3 core encoding.');
  const identity:Record<string,string>=Object.fromEntries(['TargetName','SpacecraftName','InstrumentId','ProductId'].flatMap(key=>{const v=field(label,key);return v===undefined?[]:[[key,v]];}));
  if(requireTarget&&!identity.TargetName)throw new Error('ISIS3 target identity is absent.');
  return {coreFile:field(core,'\\^Core'),width,height,bands,start,tileWidth,tileHeight,base,multiplier,littleEndian:order==='Lsb',identity};
}
export function decodeIsis3Core(bytes: Buffer, label: Buffer = bytes, requireTarget = true) {
  const h=isis3CoreHeader(label,requireTarget),columns=Math.ceil(h.width/h.tileWidth),rows=Math.ceil(h.height/h.tileHeight),plane=columns*rows*h.tileWidth*h.tileHeight;
  if(!Number.isSafeInteger(plane*h.bands*4)||h.start+plane*h.bands*4>bytes.length)throw new Error('Truncated ISIS3 raster.');
  const data=new Float32Array(h.width*h.height*h.bands),threshold=Buffer.from('faff7fff','hex').readFloatLE();
  for(let b=0;b<h.bands;b++)for(let y=0;y<h.height;y++)for(let x=0;x<h.width;x++){
    const tile=Math.floor(y/h.tileHeight)*columns+Math.floor(x/h.tileWidth),i=b*plane+tile*h.tileWidth*h.tileHeight+(y%h.tileHeight)*h.tileWidth+x%h.tileWidth;
    const n=h.littleEndian?bytes.readFloatLE(h.start+i*4):bytes.readFloatBE(h.start+i*4);
    data[(b*h.height+y)*h.width+x]=n<threshold?n:h.base+h.multiplier*n;
  }
  return {...h,data};
}
