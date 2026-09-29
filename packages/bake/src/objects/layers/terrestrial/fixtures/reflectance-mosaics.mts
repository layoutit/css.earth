/** Compare the native monochrome sampler with independent ISIS-label byte reads.
 * node tests/oracles/reflectance-mosaics.mts <body-id> <report.json>
 * The labels define coordinates and float32 byte offsets; no GeoTIFF decoder is
 * used by the reference. This checks decoding, display transfer and source gaps,
 * not the mission's calibration or the map's physical registration to a shape.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {requireArray, requireRecord, requireString, requireFiniteNumber} from '@cssearth/core';
import {loadNativePhotograph} from '@cssearth/bake/objects/layers/terrestrial';
const [body, output] = process.argv.slice(2);
if (!body || !/^[a-z][a-z0-9-]*$/.test(body) || !output) throw new Error('Expected body id and report path.');
const root = resolve('src/objects', body, 'source');
const manifestText = await readFile(resolve(root,'manifest.json'),'utf8');
const recipeText = await readFile(resolve(root,'preparation/terrestrial.json'),'utf8');
const entries = requireArray(requireRecord(JSON.parse(manifestText)).inputs).map(value => requireRecord(value));
const recipes = requireArray(requireRecord(requireRecord(JSON.parse(recipeText)).raster).observations).map(value => requireRecord(value))
  .filter(recipe => requireRecord(recipe.validity).kind === 'geotiff-float-monochrome');
const results = [];
for (const recipe of recipes) {
  const id = requireString(recipe.id), policy = requireRecord(recipe.validity);
  const entry = entries.find(entry => entry.lensId === id);
  if (!entry) throw new Error(`Missing source for ${id}.`);
  const path = requireString(entry.path), labelPath = `reference/${basename(path,'.tif')}.lbl`;
  const bytes = await readFile(resolve(root,path)), label = await readFile(resolve(root,labelPath),'utf8');
  const number = (key: string) => {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*([-+.0-9eE]+)`, 'm').exec(label);
    if (!match || !Number.isFinite(Number(match[1]))) throw new Error(`Missing ISIS ${key}.`);
    return Number(match[1]);
  };
  for (const pattern of [/Type\s*=\s*Real/, /ByteOrder\s*=\s*Lsb/, /Format\s*=\s*BandSequential/,
    /ProjectionName\s*=\s*Equirectangular/, /LatitudeType\s*=\s*Planetocentric/, /LongitudeDirection\s*=\s*PositiveEast/]) {
    if (!pattern.test(label)) throw new Error(`Unsupported native encoding/frame: ${labelPath}.`);
  }
  const width = number('Samples'), height = number('Lines'), offset = number('StartByte') - 1;
  const radius = number('EquatorialRadius'), left = number('UpperLeftCornerX'), top = number('UpperLeftCornerY');
  const resolution = number('PixelResolution'), center = number('CenterLongitude');
  if (number('Bands') !== 1 || radius !== number('PolarRadius') || number('Base') !== 0 || number('Multiplier') !== 1 ||
      ![width,height,offset].every(Number.isSafeInteger) || width*height*4+offset !== bytes.length) throw new Error(`Native byte layout changed: ${path}.`);
  const noData = requireFiniteNumber(policy.noData), special = requireFiniteNumber(policy.specialValueMagnitude);
  const range = requireArray(policy.displayRange).map(value => requireFiniteNumber(value));
  const low = range[0], high = range[1];
  if (range.length !== 2 || low === undefined || high === undefined || !(high > low)) throw new Error('Invalid display range.');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const valueAt = (x: number,y: number) => {
    if(x < 0 || x >= width || y < 0 || y >= height) return null;
    const value = view.getFloat32(offset+4*(y*width+x),true);
    return Number.isFinite(value) && value !== noData && Math.abs(value) <= special ? value : null;
  };
  let valid = 0, negative = 0, clippedLow = 0, clippedHigh = 0, min = Infinity, max = -Infinity;
  let firstMissing = -1, firstNegative = -1, minimumIndex = -1, maximumIndex = -1;
  let northernmostRow = height, southernmostRow = -1;
  for(let i=0;i<width*height;i++) {
    const y=Math.floor(i/width), value=valueAt(i%width,y);
    if(value===null){if(firstMissing<0)firstMissing=i;continue;}
    valid++; northernmostRow=Math.min(northernmostRow,y);southernmostRow=Math.max(southernmostRow,y);
    if(value<0){negative++;if(firstNegative<0)firstNegative=i;}
    if(value<low)clippedLow++;if(value>high)clippedHigh++;
    if(value<min){min=value;minimumIndex=i;}if(value>max){max=value;maximumIndex=i;}
  }
  const targets: [number,number][] = [];
  for(let y=0;y<9;y++)for(let x=0;x<17;x++)targets.push([Math.round(x*(width-1)/16),Math.round(y*(height-1)/8)]);
  for(const i of [firstMissing,firstNegative,minimumIndex,maximumIndex])if(i>=0)targets.push([i%width,Math.floor(i/width)]);
  // Interior subpixel positions check interpolation of native floats before clipping.
  for(const [x,y] of targets.slice(0,153).filter(([x,y])=>x>0&&x<width-2&&y>0&&y<height-2))targets.push([x+.25,y+.75]);
  const sampler = await loadNativePhotograph(root,entry,policy), color:number[] = [], checks=[];
  const tolerance=1e-6; // display levels out of 255; only coordinate roundoff is tolerated
  for(const [x,y] of targets){
    const longitude=center+(left+(x+.5)*resolution)/radius*180/Math.PI;
    const latitude=(top-(y+.5)*resolution)/radius*180/Math.PI;
    if(Math.abs(latitude)>90)continue; // native pixel edges can extend just beyond a pole
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    let expected:number|null=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const weight=(dx?fx:1-fx)*(dy?fy:1-fy);if(!weight)continue;
      const v=valueAt(ix+dx,iy+dy);if(v===null){expected=null;break;}if(expected!==null)expected+=v*weight;
    }
    const expectedDisplay=expected===null?null:255*Math.max(0,Math.min(1,(expected-low)/(high-low)));
    const present=sampler.sample(longitude,latitude,color);
    const actual=present?color[0]:null;
    const passed=expectedDisplay===null?actual===null:actual!==null&&Math.abs(actual-expectedDisplay)<=tolerance&&color.every(c=>c===actual);
    checks.push({x,y,longitude,latitude,nativeValue:expected,expectedDisplay,actual,passed});
  }
  const result={id,path,labelPath,sourceBytes:bytes.length,wavelengthNm:number('Center'),width,height,
    byteOffset:offset,referenceRadiusMeters:radius,displayRange:range,valid,total:width*height,negative,clippedLow,clippedHigh,
    minimum:min,maximum:max,validLatitudeCenters:[(top-(southernmostRow+.5)*resolution)/radius*180/Math.PI,(top-(northernmostRow+.5)*resolution)/radius*180/Math.PI],
    toleranceDisplayLevels:tolerance,checks,passed:checks.length>0&&checks.every(check=>check.passed)};
  results.push(result);console.log(`${body}/${id}: ${checks.filter(c=>c.passed).length}/${checks.length} native probes; ${valid}/${width*height} valid source cells`);
}
const report={schema:'cssearth-reflectance-mosaic-check@1',body,method:'Independent ISIS-label coordinates and float32 byte reads compared with the production native sampler. Native centers, fractional footprints, extrema, negative values and missing cells; not instrument calibration or physical map-to-shape registration.',
  results,passed:results.length>0&&results.every(result=>result.passed)};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
