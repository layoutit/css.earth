/** Independent check of a compact global grid against an uncompressed native
 * GeoTIFF's detached ISIS label. Coordinates and byte offsets come from the
 * label; native samples are read with DataView, without the production reader.
 *
 * node packages/bake/src/objects/raster/fixtures/isis-geotiff-grid.mts <recipe.json> <native.lbl> <grid.tif> <report.json>
 *   [raster-recipe.json] [display-unit-scale, default 1] [calibration-override.json]
 */
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fromFile} from 'geotiff';
import {loadScienceSurface} from '@cssearth/bake/objects/raster';

function labelNumber(label: string, key: string) {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*([-+.0-9eE]+)`, 'm').exec(label);
  if (!match || !Number.isFinite(Number(match[1]))) throw new Error(`Label lacks ${key}.`);
  return Number(match[1]);
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected recipe record.');
  return v as Record<string, unknown>;
}
export async function checkIsisGeoTiffGrid(recipePath: string, labelPath: string, gridPath: string,
  options: {scientific?: unknown; unitScale?: number; calibration?: {scale:number;offset:number;source:string;reason:string}} = {}) {
  const recipe = record(JSON.parse(await readFile(recipePath, 'utf8')));
  const source = record(recipe.source), output = record(recipe.output), label = await readFile(labelPath, 'utf8');
  if (typeof source.url !== 'string' || !source.url.startsWith('https://') || typeof source.noData !== 'number' && source.noData !== null)
    throw new TypeError('Missing native URL or missing-value definition.');
  if (!/Format\s*=\s*BandSequential/.test(label) || !/ByteOrder\s*=\s*Lsb/.test(label) ||
      !/ProjectionName\s*=\s*(SimpleCylindrical|Equirectangular)/.test(label) ||
      !/LatitudeType\s*=\s*Planetocentric/.test(label) || !/LongitudeDirection\s*=\s*PositiveEast/.test(label))
    throw new Error('Oracle supports only the declared uncompressed little-endian cylindrical maps.');
  const type = /\bType\s*=\s*(\w+)/.exec(label)?.[1];
  const bytesPerSample = type === 'Real' ? 4 : type === 'SignedWord' ? 2 : type === 'UnsignedByte' ? 1 : 0;
  if (!bytesPerSample) throw new Error('Oracle does not support this native sample encoding.');
  const nativeScale = labelNumber(label,'Multiplier'), nativeOffset = labelNumber(label,'Base'), unitScale = options.unitScale ?? 1;
  if (!Number.isFinite(unitScale) || unitScale <= 0) throw new Error('Invalid display unit conversion.');
  const calibration = options.calibration;
  if (calibration && (!Number.isFinite(calibration.scale) || !Number.isFinite(calibration.offset) ||
      !calibration.source.startsWith('https://') || !calibration.reason)) throw new Error('Calibration override needs a cited rationale.');
  // Check physical decoding separately from the fitting-quality mask. The label
  // owns DN calibration; unitScale converts the label unit (e.g. fraction to %).
  const science = options.scientific ? await loadScienceSurface(dirname(gridPath), {...record(options.scientific),qualityMasks:undefined}) : null;
  const nativeWidth = labelNumber(label, 'Samples'), nativeHeight = labelNumber(label, 'Lines');
  const firstByte = labelNumber(label, 'StartByte') - 1, radius = labelNumber(label, 'EquatorialRadius');
  const center = labelNumber(label, 'CenterLongitude'), left = labelNumber(label, 'UpperLeftCornerX');
  const top = labelNumber(label, 'UpperLeftCornerY'), resolution = labelNumber(label, 'PixelResolution');
  if (radius !== labelNumber(label, 'PolarRadius')) throw new Error('Oracle requires a spherical projection datum.');
  const tiff = await fromFile(gridPath);
  try {
    const image = await tiff.getImage(), width = image.getWidth(), height = image.getHeight();
    if (width !== output.width || height !== output.height || width !== height * 2 || width * height > 16_777_216)
      throw new Error('Compact grid dimensions differ.');
    const data = await image.readRasters({interleave:true}), missing = image.getGDALNoData();
    const targets = [[0,0],[0.5,0],[1,0],[0,0.25],[0.25,0.25],[0.75,0.25],[1,0.25],
      [0,0.5],[0.25,0.5],[0.5,0.5],[0.75,0.5],[1,0.5],[0,0.75],[0.5,0.75],[1,0.75],[0,1],[0.5,1],[1,1]];
    let minimum = Infinity, maximum = -Infinity, low = -1, high = -1, zero = -1, gap = -1;
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (value === missing) {if (gap < 0 && i > width*height/3 && i < width*height*2/3) gap = i; continue;}
      if (value < minimum) {minimum = value; low = i;}
      if (value > maximum) {maximum = value; high = i;}
      if (value === 0 && zero < 0) zero = i;
    }
    for (const i of [low,high,zero,gap]) if (i >= 0) targets.push([(i%width+0.5)/width,(Math.floor(i/width)+0.5)/height]);
    let entity: string | null = null, changed = false;
    const checks = [];
    for (const [fx,fy] of targets) {
      const x = Math.min(width-1, Math.floor(fx*width)), y = Math.min(height-1, Math.floor(fy*height));
      const longitude = 360*(x+0.5)/width-180, latitude = 90-180*(y+0.5)/height;
      let relativeLongitude = longitude-center;
      while (relativeLongitude < -180) relativeLongitude += 360;
      while (relativeLongitude >= 180) relativeLongitude -= 360;
      // Geographic GeoTIFFs use the label's exact angular resolution. Projected
      // maps use its independent meter coordinates (sometimes rounded by ISIS).
      const col = source.coordinates === 'degrees'
        ? Math.floor((longitude-labelNumber(label,'MinimumLongitude'))*labelNumber(label,'Scale'))
        : Math.floor((relativeLongitude*Math.PI*radius/180-left)/resolution);
      const row = source.coordinates === 'degrees'
        ? Math.floor((labelNumber(label,'MaximumLatitude')-latitude)*labelNumber(label,'Scale'))
        : Math.floor((top-latitude*Math.PI*radius/180)/resolution);
      let expected: number | null = null, raw: number | null = null, range: string | null = null;
      if (row >= 0 && row < nativeHeight && col >= 0 && col < nativeWidth) {
        const offset: number = firstByte+(row*nativeWidth+col)*bytesPerSample;
        range = `bytes=${offset}-${offset+bytesPerSample-1}`;
        const response: Response = await fetch(source.url, {headers:{Range:range,...(entity?{'If-Match':entity}:{})},signal:AbortSignal.timeout(45000)});
        if (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${offset}-${offset+bytesPerSample-1}/`))
          throw new Error(`Invalid independent byte range: ${response.status}.`);
        const etag: string | null = response.headers.get('etag');
        if (!etag) throw new Error('Native byte check requires an entity tag.');
        if (entity !== null && entity !== etag) changed = true;
        entity = etag;
        const bytes: ArrayBuffer = await response.arrayBuffer();
        if (bytes.byteLength !== bytesPerSample) throw new Error('Independent native range has wrong length.');
        const view = new DataView(bytes);
        raw = type === 'Real' ? view.getFloat32(0,true) : type === 'SignedWord' ? view.getInt16(0,true) : view.getUint8(0);
        expected = Number.isFinite(raw) && raw !== source.noData ? raw : null;
      }
      const value = data[y*width+x], actual = value === missing ? null : value;
      const expectedDisplay = expected === null ? null : (expected*(calibration?.scale??nativeScale)+(calibration?.offset??nativeOffset))*unitScale;
      const actualDisplay = science?.sample(longitude,latitude) ?? null;
      const displayPass = science === null || (expectedDisplay === null ? actualDisplay === null
        : actualDisplay !== null && Math.abs(actualDisplay-expectedDisplay) < 1e-9);
      checks.push({x,y,longitude,latitude,sourceColumn:col,sourceRow:row,raw,expected,actual,range,
        ...(science?{expectedDisplay,actualDisplay,displayPass}:{}),pass:actual===expected && displayPass});
    }
    const bytes = await readFile(gridPath), passed = !changed && checks.every(c=>c.pass);
    return {schema:'cssearth-native-grid-oracle@1',passed,method:'Independent ISIS-label coordinates and byte offsets; native samples decoded by DataView. Checks source-to-compact sampling, not instrument accuracy or all native pixels.',
      recipe:recipePath,label:labelPath,grid:gridPath,gridBytes:bytes.length,
      nativeUrl:source.url,etag:entity,entityChanged:changed,nativeScale,nativeOffset,unitScale,...(calibration?{calibration}:{}),checks};
  } finally {await tiff.close();}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe,label,grid,report,rasterPath,scale,calibrationPath] = process.argv.slice(2);
  if (!recipe || !label || !grid || !report) throw new Error('Expected recipe, ISIS label, compact GeoTIFF and report paths.');
  let scientific: unknown, calibration: {scale:number;offset:number;source:string;reason:string} | undefined;
  if (rasterPath) {
    const raster = record(JSON.parse(await readFile(rasterPath,'utf8')));
    if (!Array.isArray(raster.surfaces)) throw new Error('Raster recipe has no surfaces.');
    const matches = raster.surfaces.map(record).filter(s=>typeof s.source==='string' && resolve(dirname(rasterPath),'..',s.source)===resolve(grid));
    if (matches.length !== 1) throw new Error('Expected one consuming scientific surface.');
    scientific = record(matches[0].science).scientific;
  }
  if (calibrationPath) {
    const value = record(JSON.parse(await readFile(calibrationPath,'utf8')));
    if (typeof value.scale!=='number' || typeof value.offset!=='number' || typeof value.source!=='string' || typeof value.reason!=='string')
      throw new Error('Invalid independent calibration reference.');
    calibration = {scale:value.scale,offset:value.offset,source:value.source,reason:value.reason};
  }
  const result = await checkIsisGeoTiffGrid(recipe,label,grid,{scientific,unitScale:scale===undefined?1:Number(scale),calibration});
  await writeFile(report,JSON.stringify(result,null,2)+'\n');
  console.log(`${grid}: ${result.checks.filter(c=>c.pass).length}/${result.checks.length} native samples agree.`);
  if (!result.passed) process.exitCode = 1;
}
