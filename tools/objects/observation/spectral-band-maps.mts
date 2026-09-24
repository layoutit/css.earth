import { sha256 } from '../../../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeArrayBuffer } from 'geotiff';
import { readFitsHdu, fitsImageAccessor } from '../../fits/fits.mts';
import { shape, text, number, array } from '@cssearth/core';

const windowSchema = shape({ minimum: number, maximum: number, minimumChannels: number });
const mapSchema = shape({ id: text, method: text, windows: array(windowSchema), block: number });
const scanSchema = shape({ id: text, cube: text, wavelengths: text, geometry: text, label: text,
  width: number, height: number, nativeResolutionKm: number, mapBlocks: array(mapSchema) });
const schema = shape({ schema: text, radiusKm: number, width: number, height: number,
  maximumEmission: number, maximumIncidence: number, firstBand: number, lastBand: number, scans: array(scanSchema) });
type Recipe = ReturnType<typeof schema>;
type MapRecipe = ReturnType<typeof mapSchema>;
type Triple = [number, number, number];
type Cell = { corners: Triple[]; latitude: number; longitude: number; value: number; score: number; x: number; y: number; samples: number };

function pathWithin(root: string, path: string) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('Spectral input must stay inside its source directory.');
  return resolve(root, path);
}
export function parseSpectralBandRecipe(value: unknown): Recipe {
  const recipe = schema(value);
  if (recipe.schema !== 'cssearth-spectral-band-maps@1' || recipe.radiusKm <= 0 ||
      ![recipe.width, recipe.height].every(n => Number.isSafeInteger(n) && n > 1 && n <= 4096) || recipe.width !== 2 * recipe.height ||
      ![recipe.maximumEmission, recipe.maximumIncidence].every(n => n > 0 && n < 90) ||
      ![recipe.firstBand, recipe.lastBand].every(n => Number.isInteger(n) && n >= 0 && n < 256) || recipe.firstBand >= recipe.lastBand ||
      !recipe.scans.length || recipe.scans.length > 16) throw new TypeError('Invalid spectral map domain or quality limits.');
  const ids = new Set<string>();
  for (const scan of recipe.scans) {
    if (ids.has(scan.id) || !/^[0-9]{10}_charon_cube$/.test(scan.id) || scan.nativeResolutionKm <= 0 ||
        ![scan.width, scan.height].every(n => Number.isSafeInteger(n) && n > 1 && n <= 2048) || !scan.mapBlocks.length) throw new TypeError('Invalid LEISA scan.');
    ids.add(scan.id);
    for (const path of [scan.cube, scan.wavelengths, scan.geometry, scan.label]) pathWithin('.', path);
    const maps = new Set<string>();
    for (const map of scan.mapBlocks) {
      if (maps.has(map.id) || !/^[a-z][a-z0-9-]*$/.test(map.id) || !['linear-band-depth', 'continuum-ratio'].includes(map.method) ||
          !Number.isSafeInteger(map.block) || map.block < 1 || map.block > 32 || map.windows.length !== 3 ||
          map.windows.some(w => !(w.minimum > 0 && w.maximum > w.minimum && w.maximum < 10 && Number.isSafeInteger(w.minimumChannels) && w.minimumChannels >= 2)) ||
          map.windows[0].maximum >= map.windows[1].minimum || map.windows[1].maximum >= map.windows[2].minimum) throw new TypeError('Invalid spectral band estimator.');
      maps.add(map.id);
    }
  }
  return recipe;
}

/** FITS defines big-endian samples. The migrated LEISA label incorrectly says
 * little-endian for the spectra/wavelengths; the native FITS and physical
 * wavelength/geometry anchors determine decoding. No new binary format. */
export function fitsCube(bytes: Buffer, width: number, height: number, planes: number) {
  const hdu = readFitsHdu(bytes), { header, dataOffset } = hdu, sample = fitsImageAccessor(bytes, hdu);
  if (header.SIMPLE !== true || header.BITPIX !== -32 || header.NAXIS !== 3 || header.NAXIS1 !== width || header.NAXIS2 !== height ||
      header.NAXIS3 !== planes || (header.BSCALE ?? 1) !== 1 || (header.BZERO ?? 0) !== 0 ||
      bytes.length !== Math.ceil((dataOffset + width * height * planes * 4) / 2880) * 2880) throw new Error('Spectral FITS layout changed.');
  return { at(plane: number, index: number) {
    if (!Number.isInteger(plane) || plane < 0 || plane >= planes || !Number.isInteger(index) || index < 0 || index >= width * height) throw new RangeError('Spectral FITS sample outside the cube.');
    const value = sample(plane * width * height + index);
    return Number.isFinite(value) && Math.abs(value) < 1e30 ? value : null;
  } };
}

/** Windows contain sums of I/F, wavelength, and the number of measured channels.
 * A ratio is computed after averaging spectra, without counting resampled
 * spatial pixels as independent measurements or claiming abundance. */
export function estimateBand(windows: readonly Triple[], method: string) {
  if (windows.length !== 3 || windows.some(w => w[2] <= 0 || !w.every(Number.isFinite))) return null;
  const [left, band, right] = windows, bandMean = band[0] / band[2];
  if (method === 'continuum-ratio') {
    const continuum = (left[0] + right[0]) / (left[2] + right[2]);
    return bandMean > 0 && continuum > 0 ? continuum / bandMean : null;
  }
  if (method !== 'linear-band-depth') throw new TypeError('Unknown spectral estimator.');
  const a = left[0] / left[2], b = right[0] / right[2];
  const la = left[1] / left[2], lb = right[1] / right[2], lm = band[1] / band[2];
  const continuum = a + (b - a) * (lm - la) / (lb - la);
  return continuum > 0 && lm > la && lm < lb ? 1 - bandMean / continuum : null;
}
const rad = Math.PI / 180;
const vector = (longitude: number, latitude: number): Triple => [Math.cos(latitude * rad) * Math.cos(longitude * rad), Math.cos(latitude * rad) * Math.sin(longitude * rad), Math.sin(latitude * rad)];
const geographic = (v: Triple): [number, number] => [Math.atan2(v[1], v[0]) / rad, Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad];
const wrap = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;

async function scanCells(root: string, recipe: Recipe, scan: Recipe['scans'][number]) {
  const [cubeBytes, waveBytes, geometryBytes, label] = await Promise.all([
    readFile(pathWithin(root, scan.cube)), readFile(pathWithin(root, scan.wavelengths)), readFile(pathWithin(root, scan.geometry)), readFile(pathWithin(root, scan.label), 'utf8')]);
  if (!label.includes(`<logical_identifier>urn:nasa:pds:nh_derived:plutosystem_composition:${scan.id}</logical_identifier>`) ||
      !label.includes('<version_id>1.0</version_id>') || !label.includes('instrument:nh.leisa') || !label.includes('satellite.134340_pluto.charon') ||
      [scan.cube, scan.wavelengths, scan.geometry].some(p => !label.includes(`<file_name>${p.split('/').at(-1)}</file_name>`))) throw new Error('LEISA product identity or companions changed.');
  const cube = fitsCube(cubeBytes, scan.width, scan.height, 256), wavelengths = fitsCube(waveBytes, scan.width, scan.height, 256), geometry = fitsCube(geometryBytes, scan.width, scan.height, 5);
  const validGeometry = (i: number) => {
    const e = geometry.at(1, i), incidence = geometry.at(2, i), lat = geometry.at(3, i), lon = geometry.at(4, i);
    return e !== null && incidence !== null && lat !== null && lon !== null && e >= 0 && e <= recipe.maximumEmission && incidence >= 0 && incidence <= recipe.maximumIncidence && Math.abs(lat) <= 90 && lon >= 0 && lon <= 360;
  };
  const point = (x: number, y: number): Triple | null => {
    const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= scan.width || y0 + 1 >= scan.height) return null;
    const sum: Triple = [0, 0, 0];
    for (const [cx, cy, weight] of [[0, 0, (1-dx)*(1-dy)], [1, 0, dx*(1-dy)], [0, 1, (1-dx)*dy], [1, 1, dx*dy]]) {
      const i = (y0 + cy) * scan.width + x0 + cx;
      if (!validGeometry(i)) return null;
      const lat = geometry.at(3, i), lon = geometry.at(4, i);
      if (lat === null || lon === null) return null;
      const v = vector(lon, lat); for (let c = 0; c < 3; c++) sum[c] += weight * v[c];
    }
    const length = Math.hypot(...sum); return sum.map(v => v / length) as Triple;
  };
  const maps = new Map<string, Cell[]>();
  for (const map of scan.mapBlocks) {
    const n = scan.width * scan.height;
    const sums = map.windows.map(() => [new Float64Array(n), new Float64Array(n), new Uint16Array(n)] as const);
    for (let i = 0; i < n; i++) {
      if (!validGeometry(i)) continue;
      for (let p = recipe.firstBand; p <= recipe.lastBand; p++) {
        const wavelength = wavelengths.at(p, i), reflectance = cube.at(p, i);
        if (wavelength === null || reflectance === null) continue;
        if (!(wavelength >= 1.2 && wavelength <= 2.6)) throw new Error('LEISA wavelength decoding or selected segment changed.');
        for (let k = 0; k < 3; k++) if (wavelength >= map.windows[k].minimum && wavelength <= map.windows[k].maximum) {
          sums[k][0][i] += reflectance; sums[k][1][i] += wavelength; sums[k][2][i]++;
        }
      }
    }
    const cells: Cell[] = [], block = map.block;
    for (let y = 0; y + block < scan.height; y += block) for (let x = 0; x + block < scan.width; x += block) {
      const corners = [[x-.5,y-.5],[x+block-.5,y-.5],[x+block-.5,y+block-.5],[x-.5,y+block-.5]].map(([x,y]) => point(x,y));
      if (corners.some(p => p === null)) continue;
      const windows: Triple[] = map.windows.map(() => [0,0,0]); let valid = true;
      for (let yy = y; yy < y + block && valid; yy++) for (let xx = x; xx < x + block; xx++) {
        const i = yy * scan.width + xx;
        if (!validGeometry(i) || sums.some((sum,k) => sum[2][i] < map.windows[k].minimumChannels)) { valid = false; break; }
        for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) windows[k][c] += sums[k][c][i];
      }
      if (!valid) continue;
      const value = estimateBand(windows, map.method), center = point(x+(block-1)/2,y+(block-1)/2);
      if (value === null || !Number.isFinite(value) || !center) continue;
      const [longitude, latitude] = geographic(center), shape = corners.filter((p): p is Triple => p !== null);
      const diagonal = Math.hypot(...shape[0].map((n,i) => n-shape[2][i])) * recipe.radiusKm;
      const score = Math.max(scan.nativeResolutionKm ** 2, diagonal ** 2 / 2);
      cells.push({ corners: shape, longitude, latitude, value, score, x, y, samples: block * block });
    }
    maps.set(map.id, cells);
  }
  return { maps, inputs: [scan.cube, scan.wavelengths, scan.geometry, scan.label].map((path,i) => {
    const bytes = [cubeBytes, waveBytes, geometryBytes, Buffer.from(label)][i];
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }) };
}

/** Inverse rasterization of the archived surface-coordinate cell. Only covered
 * destination centres are painted; no nearest-point extrapolation at gaps. */
export function paintCell(cell: Cell, width: number, height: number, paint: (index: number) => void) {
  const points = cell.corners.map(v => {
    const [lon, lat] = geographic(v); return [(cell.longitude + wrap(lon-cell.longitude) + 180) / 360 * width, (90-lat)/180*height];
  });
  if (Math.max(...points.map(p=>p[0])) - Math.min(...points.map(p=>p[0])) > width/2) return;
  for (const indexes of [[0,1,2],[0,2,3]]) {
    const [a,b,c] = indexes.map(i=>points[i]);
    const cross = (p: number[],q: number[],x: number,y: number) => (q[0]-p[0])*(y-p[1])-(q[1]-p[1])*(x-p[0]);
    const determinant = cross(a,b,c[0],c[1]); if (Math.abs(determinant) < 1e-12) continue;
    for (let y=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])-.5));y<=Math.min(height-1,Math.floor(Math.max(a[1],b[1],c[1])-.5));y++)
      for (let x=Math.ceil(Math.min(a[0],b[0],c[0])-.5);x<=Math.floor(Math.max(a[0],b[0],c[0])-.5);x++) {
        const u=cross(a,b,x+.5,y+.5)/determinant,v=cross(b,c,x+.5,y+.5)/determinant,w=cross(c,a,x+.5,y+.5)/determinant;
        if (Math.min(u,v,w)>=-1e-9) paint(y*width+((x%width)+width)%width);
      }
  }
}

export async function prepareSpectralBandMaps(root: string, recipePath: string) {
  const recipe = parseSpectralBandRecipe(JSON.parse(await readFile(pathWithin(root, recipePath), 'utf8')));
  const maps = new Map<string, { data: Float32Array; score: Float64Array; owners: Uint16Array }>();
  const reports = [];
  for (let s=0;s<recipe.scans.length;s++) {
    const scan=recipe.scans[s], prepared=await scanCells(root,recipe,scan);
    const quantities=[];
    for (const [id,cells] of prepared.maps) {
      let map=maps.get(id); if (!map) { map={data:new Float32Array(recipe.width*recipe.height).fill(-9999),score:new Float64Array(recipe.width*recipe.height).fill(Infinity),owners:new Uint16Array(recipe.width*recipe.height)};maps.set(id,map); }
      const target=map;
      for (const cell of cells) paintCell(cell,recipe.width,recipe.height,index=>{if(cell.score<target.score[index]){target.data[index]=cell.value;target.score[index]=cell.score;target.owners[index]=s+1;}});
      quantities.push({id,cells:cells.length,anchors:cells.filter(c=>Math.abs(wrap(c.longitude-310.9))*Math.cos(c.latitude*rad)<2&&Math.abs(c.latitude-54.3)<2).map(({corners,...c})=>c)});
    }
    reports.push({id:scan.id,inputs:prepared.inputs,quantities});
  }
  const products: Record<string, Uint8Array> = {}, coverage=[];
  const radius=recipe.radiusKm*1000, resolution=Math.PI*2*radius/recipe.width;
  for (const [id,map] of maps) {
    products[id]=new Uint8Array(writeArrayBuffer(map.data,{width:recipe.width,height:recipe.height,BitsPerSample:[32],SampleFormat:[3],
      SamplesPerPixel:1,PhotometricInterpretation:1,GDAL_NODATA:'-9999',ProjectedCSTypeGeoKey:32767,ModelPixelScale:[resolution,resolution,0],
      GeoKeyDirectory:[1,1,0,10,1024,0,1,1,1025,0,1,1,2048,0,1,32767,2054,0,1,9102,
        2057,34736,1,0,2058,34736,1,0,3075,0,1,17,3076,0,1,9001,3088,34736,1,1,3089,34736,1,1],
      GeoDoubleParams:[radius,0],
      ModelTiepoint:[0,0,0,-Math.PI*radius,Math.PI*radius/2,0]}));
    const byScan=recipe.scans.map(scan=>({id:scan.id,cells:0,areaFraction:0})); let total=0,valid=0,area=0;
    for (let y=0;y<recipe.height;y++) {
      const weight=Math.sin((90-y/recipe.height*180)*rad)-Math.sin((90-(y+1)/recipe.height*180)*rad);
      total+=weight*recipe.width;
      for (let x=0;x<recipe.width;x++) {const owner=map.owners[y*recipe.width+x];if(owner){valid++;area+=weight;byScan[owner-1].cells++;byScan[owner-1].areaFraction+=weight;}}
    }
    for(const scan of byScan)scan.areaFraction/=total;
    coverage.push({id,validCells:valid,areaFraction:area/total,byScan});
  }
  return {products,report:{schema:'cssearth-spectral-band-evidence@1',recipe,scans:reports,coverage}};
}
