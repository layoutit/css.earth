import type {GeoTIFF, GeoTIFFImage} from 'geotiff';
import type {NightLightGrid, NightLightRecipe, NightLightDisplay, MapSource, Dimensions} from './contracts.mts';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fromFile, Pool } from 'geotiff';
import sharp from 'sharp';

function demand(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(`Night lights: ${why}`); };
const prepared = new Map<string, Promise<Float32Array>>();

export function validateNightLightGrid(image: Pick<GeoTIFFImage,'getWidth'|'getHeight'|'getBoundingBox'|'getSamplesPerPixel'|'getGDALNoData'|'getGeoKeys'>, recipe: Pick<NightLightRecipe, "grid">) {
  const grid = recipe.grid, bounds = image.getBoundingBox(), keys = image.getGeoKeys();
  demand(grid.width === 86400 && grid.height === 33600 && grid.cellDegrees === 1 / 240 &&
    JSON.stringify(grid.bounds) === JSON.stringify([-180, -65, 180, 75]), 'unsupported source grid');
  demand(image.getWidth() === grid.width && image.getHeight() === grid.height &&
    bounds.every((v, i) => Math.abs(v - grid.bounds[i]) < 1e-9) &&
    keys?.GeographicTypeGeoKey === 4326 && keys.GTRasterTypeGeoKey === 1 &&
    image.getSamplesPerPixel() === 1 && image.getGDALNoData() === Math.fround(-999.9),
  'GeoTIFF coordinates, band count or missing value differ');
}

// Integrate native pixels over each output cell before applying false color.
// Sparse city pixels contribute their radiance; nearest sampling can miss them.
// Pixel overlap is weighted by spherical area, with missing observations omitted.
export function accumulateRadianceRow(values: ArrayLike<number>, sourceRow: number, grid: NightLightGrid, target: Dimensions, sums: Float64Array, weights: Float64Array) {
  const [west, , east, north] = grid.bounds;
  const sourceStep = (east - west) / grid.width;
  const northEdge = north - sourceRow * grid.cellDegrees;
  const southEdge = northEdge - grid.cellDegrees;
  const top = (90 - northEdge) / 180 * target.height;
  const bottom = (90 - southEdge) / 180 * target.height;
  const rad = Math.PI / 180;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(target.height, Math.ceil(bottom)); y++) {
    const latitudeTop = Math.min(northEdge, 90 - y * 180 / target.height);
    const latitudeBottom = Math.max(southEdge, 90 - (y + 1) * 180 / target.height);
    const latitudeWeight = Math.sin(latitudeTop * rad) - Math.sin(latitudeBottom * rad);
    if (latitudeWeight <= 0) continue;
    for (let x = 0; x < target.width; x++) {
      const left = (x * 360 / target.width - 180 - west) / sourceStep;
      const right = ((x + 1) * 360 / target.width - 180 - west) / sourceStep;
      let sum = 0, weight = 0;
      for (let sx = Math.max(0, Math.floor(left)); sx < Math.min(grid.width, Math.ceil(right)); sx++) {
        const value = values[sx];
        if (value === Math.fround(-999.9)) continue;
        demand(Number.isFinite(value) && value >= 0, 'unexpected negative or non-finite radiance');
        const overlap = Math.min(right, sx + 1) - Math.max(left, sx);
        sum += value * overlap;
        weight += overlap;
      }
      const index = y * target.width + x;
      sums[index] += sum * latitudeWeight;
      weights[index] += weight * latitudeWeight;
    }
  }
}

export function finishRadianceGrid(sums: Float64Array, weights: Float64Array, grid: NightLightGrid, target: Dimensions) {
  const values = new Float32Array(sums.length);
  values.fill(Math.fround(-999.9));
  for (let y = 0; y < target.height; y++) {
    const rowArea = Math.sin((90 - y * 180 / target.height) * Math.PI / 180) -
      Math.sin((90 - (y + 1) * 180 / target.height) * Math.PI / 180);
    const expectedWeight = rowArea * grid.width / target.width;
    for (let x = 0; x < target.width; x++) {
      const i = y * target.width + x;
      // A source gap cannot be painted from a tiny valid sliver at its edge.
      if (weights[i] >= expectedWeight * .5 && weights[i] > 0) values[i] = sums[i] / weights[i];
    }
  }
  return values;
}

export function nightLightColor(value: number, display: NightLightDisplay) {
  if (value < 0 || !Number.isFinite(value)) return display.missing;
  const t = Math.min(1, Math.log1p(value / display.softening) / Math.log1p(display.maximum / display.softening));
  return [Math.round(4 + 251 * t), Math.round(7 + 244 * t ** 1.3), Math.round(13 + 198 * t ** 2)];
}

async function readNightLightGrid(archivePath: string, recipe: NightLightRecipe, width: number, height: number) {
  demand(recipe.kind === 'black-marble-radiance' && recipe.member === 'viirs_2025_raw.tif' &&
    recipe.year === 2025 && recipe.product === 'VJ146A4.002' && recipe.band === 'AllAngle_Composite_Snow_Free' &&
    recipe.units === 'nW/cm2/sr', 'source identity differs');
  let bytes = 0;
  for await (const chunk of createReadStream(archivePath)) bytes += chunk.length;
  demand(bytes === recipe.archiveBytes, 'archive size differs');
  const key = `${recipe.product}:${recipe.member}:${width}:${height}`;
  const cached = prepared.get(key);
  if (cached) return cached;
  const work = (async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-night-lights-'));
    let tiff: GeoTIFF | undefined, pool: Pool | undefined;
    try {
      const path = resolve(directory, recipe.member);
      const child = spawn('unzip', ['-p', archivePath, recipe.member], { stdio: ['ignore', 'pipe', 'pipe'] });
      let diagnostic = ''; child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-1000); });
      const exited = new Promise<void>((done, fail) => { child.once('error', fail); child.once('close', code =>
        code === 0 ? done() : fail(new Error(`Night-light archive extraction failed: ${diagnostic}`))); });
      await Promise.all([pipeline(child.stdout, createWriteStream(path)), exited]);
      tiff = await fromFile(path);
      demand(await tiff.getImageCount() === 1, 'unexpected GeoTIFF image count');
      const image = await tiff.getImage(); validateNightLightGrid(image, recipe);
      const target = { width, height }, sums = new Float64Array(width * height), weights = new Float64Array(width * height);
      pool = new Pool(4);
      for (let row = 0; row < recipe.grid.height; row += 128) {
        const end = Math.min(row + 128, recipe.grid.height);
        const block = await image.readRasters({ window: [0, row, recipe.grid.width, end], interleave: true, pool });
        demand(block instanceof Float32Array, 'expected unscaled float32 radiance');
        for (let y = row; y < end; y++) accumulateRadianceRow(
          block.subarray((y - row) * recipe.grid.width, (y - row + 1) * recipe.grid.width), y, recipe.grid, target, sums, weights);
      }
      return finishRadianceGrid(sums, weights, recipe.grid, target);
    } finally {
      pool?.destroy(); await tiff?.close(); await rm(directory, { recursive: true, force: true });
    }
  })();
  prepared.set(key, work);
  try { return await work; } catch (error) { prepared.delete(key); throw error; }
}

export async function prepareNightLightsMap({ sourceDirectory, map, width, height }: {sourceDirectory: string; map: MapSource<NightLightRecipe>; width: number; height: number}) {
  demand(Number.isInteger(width) && Number.isInteger(height) && width === height * 2 && width <= 8192,
    'invalid output grid');
  const recipe = map.scientific;
  demand(recipe.display.maximum > 0 && recipe.display.softening > 0 &&
    recipe.display.missing.length === 3 && recipe.display.missing.every(v => Number.isInteger(v) && v >= 0 && v <= 255), 'invalid display scale');
  const values = await readNightLightGrid(resolve(sourceDirectory, map.path), recipe, width, height);
  const data = Buffer.alloc(values.length * 3);
  for (let i = 0; i < values.length; i++) data.set(nightLightColor(values[i], recipe.display), i * 3);
  return { data, info: { width, height, channels: 3 as const } };
}

export async function writeNightLightsLegend(recipe: NightLightRecipe, path: string) {
  const width = 620, height = 16, data = Buffer.alloc(width * height * 3);
  for (let x = 0; x < width; x++) {
    const value = recipe.display.softening * Math.expm1(x / (width - 1) * Math.log1p(recipe.display.maximum / recipe.display.softening));
    const color = nightLightColor(value, recipe.display);
    for (let y = 0; y < height; y++) data.set(color, (y * width + x) * 3);
  }
  await mkdir(resolve(path, '..'), { recursive: true });
  await sharp(data, { raw: { width, height, channels: 3 as const } }).png().toFile(path);
}
