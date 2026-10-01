import { writeLossyWebp } from '../../../raster/index.ts';
import {parse} from '@cssearth/core/schema';
import {spectralRecipe, type SpectralRecipe} from './spectral-recipe.ts';
import type {Channels, OutputInfo} from 'sharp';
type SpectralDataset = SpectralRecipe['datasets'][number];
type ColorPalette = readonly (readonly number[])[];
interface RawImage {data: Buffer; info: {width: number; height: number; channels: Channels}}
interface ScalarMap {width: number; height: number; values: Float32Array; coverage: Uint8Array}
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {packProjectiveSurfaceRaster} from '../../../scene/index.ts';
import { readFitsPrimary } from '@cssearth/fits';
import {planetographicRowsToMeshLatitude} from '../../geometry/index.ts';
import {verifyObservationSources} from '../observed-surfaces/index.ts';
import {validateMaterialRecipe} from './recipe.ts';
import {validateRelativePath} from '../giant/index.ts';
/** Compose source-selected single-band surfaces and the corresponding material variants. */
export async function prepareSpectralMaterialVariants({sourceDirectory,publicDirectory,stagingDirectory,config: input}: {sourceDirectory:string;publicDirectory:string;stagingDirectory:string;config:unknown}) {
const config = parse(input, spectralRecipe, 'spectral material recipe');
validateMaterialRecipe(config, 'cssearth-spectral-material-variants@2');
if(!Array.isArray(config.datasets)||config.datasets.some(plan=>plan.operation!=='scalar-map'))throw new TypeError('Unsupported spectral material operation.');
validateRelativePath(config.sourceSubdirectory);
for(const plan of config.datasets)for(const filename of plan.sourceFiles)validateRelativePath(filename);
// Every dataset names its files; they are the inputs, read from the source subdirectory.
await verifyObservationSources(sourceDirectory,config.datasets.flatMap(plan=>plan.sourceFiles.map(filename=>({path:`${config.sourceSubdirectory}/${filename}`}))));













const sourceRoot = sourceDirectory;
const publicRoot = publicDirectory;
const stagingRoot = stagingDirectory;

const bodyWidth = config.parameters.bodyWidth;
const bodyHeight = config.parameters.bodyHeight;
const body2xWidth = config.parameters.body2xWidth;
const body2xHeight = config.parameters.body2xHeight;
const latitudeBandCount = config.parameters.latitudeBandCount;
const ringOuterKm = config.parameters.ringOuterKm;
const poleTileSize = config.parameters.poleTileSize;
const poleAtlasWidth = config.parameters.poleAtlasWidth;
const poleAtlasHeight = config.parameters.poleAtlasHeight;
const polarBoundaryLatitude = config.parameters.polarBoundaryLatitude;
const materialModes = config.parameters.materialModes;
const surfaceAxisRatio = config.parameters.objectEquatorialRadiusKm / config.parameters.objectPolarRadiusKm;
const materialVariantId = (datasetId: string, mode: string) =>
  mode === "full" ? datasetId : `${datasetId}-${mode}`;

const datasetPlans = config.datasets;

const normalAssets = Object.freeze({
  surface: resolve(stagingRoot, config.files.surface),
  poles: resolve(publicRoot, config.files.poles),
  rings: resolve(publicRoot, config.files.rings),
  rings2x: resolve(publicRoot, config.files.rings2x),
  materials: Object.freeze(Object.fromEntries(materialModes.map((mode) => {
    const variantId = materialVariantId("normal", mode);
    return [mode, resolve(
      stagingRoot,
      variantId === "normal"
        ? config.files.orbitMaterial
        : `${config.namespace}-orbit-material-${variantId}.webp`,
    )];
  }))),
  interiorMaterials: Object.freeze(Object.fromEntries(materialModes.map(
    (mode) => {
      const variantId = materialVariantId("normal", mode);
      return [mode, resolve(
        stagingRoot,
        variantId === "normal"
          ? config.files.interiorAtmosphere
          : `${config.namespace}-interior-atmosphere-${variantId}.webp`,
      )];
    },
  ))),
});

const prepared: Awaited<ReturnType<typeof prepareDataset>>[] = [];
await prepareThumbnail(normalAssets.surface, resolve(publicRoot, config.files.normalThumbnail));
for (const plan of datasetPlans) prepared.push(await prepareDataset(plan));

const descriptor = {...config.descriptor,controls:config.controlOrder.map(id=>{const control=prepared.find(plan=>plan.id===id)??config.descriptor.controls.find(control=>control.id===id);if(!control)throw new TypeError(`Missing spectral control ${id}`);return control;})};



async function prepareDataset(plan: SpectralDataset) {
  const surfacePath = resolve(publicRoot, `${config.namespace}-surface-${plan.id}.webp`);
  const surface2xPath = resolve(publicRoot, `${config.namespace}-surface-${plan.id}@2x.webp`);
  const preparedSurface = await prepareScalarSurface(plan);
  const bodyData = preparedSurface.data;
  await Promise.all([
    writeProjectiveSurface(
      preparedSurface,
      body2xWidth / 2,
      body2xHeight / 2,
      surfacePath,
    ),
    writeProjectiveSurface(
      preparedSurface,
      body2xWidth,
      body2xHeight,
      surface2xPath,
    ),
  ]);

  const body = { data: bodyData, info: preparedSurface.info };
  const polesPath = resolve(publicRoot, `${config.namespace}-poles-${plan.id}.webp`);
  await preparePolarAtlas(body, plan, polesPath);



  const materialPaths = Object.freeze(Object.fromEntries(materialModes.map(
    (mode) => {
      const variantId = materialVariantId(plan.id, mode);
      return [mode, Object.freeze({
        exterior: resolve(
          stagingRoot,
          `${config.namespace}-orbit-material-${variantId}.webp`,
        ),
        interior: resolve(
          stagingRoot,
          `${config.namespace}-interior-atmosphere-${variantId}.webp`,
        ),
      })];
    },
  )));
  await Promise.all(materialModes.flatMap((mode) => [
    prepareMaterial(
      normalAssets.materials[mode],
      materialPaths[mode].exterior,
      plan,
    ),
    prepareMaterial(
      normalAssets.interiorMaterials[mode],
      materialPaths[mode].interior,
      plan,
    ),
  ]));
  const thumbnailPath = resolve(publicRoot, `${config.namespace}-dataset-${plan.id}.webp`);
  await prepareThumbnail(surfacePath, thumbnailPath);
  return Object.freeze({
    id: plan.id,
    materialDataset: plan.id,
    label: plan.label,
    shortLabel: plan.shortLabel,
    filter: plan.filter,
    wavelength: plan.wavelength,
    thumbnailUrl: `${config.publicPrefix}${config.namespace}-dataset-${plan.id}.webp`,
    surfaceUrl: `${config.publicPrefix}${config.namespace}-surface-${plan.id}.webp`,
    surface2xUrl: `${config.publicPrefix}${config.namespace}-surface-${plan.id}@2x.webp`,
    polesUrl: `${config.publicPrefix}${config.namespace}-poles-${plan.id}.webp`,
    // No ring response is measured in these bands: every dataset shows the one measured ring profile.
    ringUrl: `${config.publicPrefix}${config.files.rings}`,
    ring2xUrl: `${config.publicPrefix}${config.files.rings2x}`,
    materialVariant: plan.id,
    materialPreparationFile: `${config.namespace}-orbit-material-${plan.id}.webp`,
    interiorMaterialPreparationFile:
      `${config.namespace}-interior-atmosphere-${plan.id}.webp`,
    materialModes,
    falseColorPalette: plan.palette,
    materialGain: plan.materialGain,
    sourceModel: plan.sourceKind,
    falseColor: true,
    qualification: `${plan.filter} single-band Hubble data shown with a declared false-color palette`,
    detailPreparation: config.qualifications.scalarDetail,
    sourceFiles: Object.freeze([plan.sourceFiles[plan.sourceIndex]]),
  });
}

async function writeProjectiveSurface(source: RawImage, width: number, height: number, outputPath: string) {
  const resized = await sharp(source.data, { raw: source.info })
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const packed = packProjectiveSurfaceRaster(resized.data, {
    width,
    height,
    channels: resized.info.channels,
    bandCount: latitudeBandCount,
    gutter: height / latitudeBandCount / 4,
  });
  await sharp(packed.data, { raw: {
    width: packed.packedWidth,
    height: packed.packedHeight,
    channels: resized.info.channels,
  } })
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

async function prepareScalarSurface(plan: SpectralDataset): Promise<RawImage> {
  const maps = await Promise.all(plan.sourceFiles.map(async (filename) =>
    readFitsPrimary(await readFile(resolve(sourceRoot, config.sourceSubdirectory, filename)))));
  if (maps.some(({ width, height }) => width !== config.scalar.width || height !== config.scalar.height)) {
    throw new Error(`${plan.id} Hubble map dimensions changed.`);
  }
  const detailMap = selectHighResolutionMap(maps, plan.sourceIndex);
  maskPreparedRingOcclusion(detailMap);
  fillMissingColumns(detailMap.values, detailMap.coverage, detailMap.width, detailMap.height);
  const [low, high] = finitePercentiles(detailMap.values, ...config.scalar.percentiles);
  const sourceRgba = falseColorMap(detailMap, plan.palette, low, high);
  const spectralSurface = await sharp(sourceRgba, {
    raw: { width: detailMap.width, height: detailMap.height, channels: 4 },
  }).resize(bodyWidth, bodyHeight, { kernel: sharp.kernel.lanczos3 })
    .raw().toBuffer({ resolveWithObject: true });
  // OPAL maps index rows by planetographic latitude; the mesh texture rows follow parametric latitude.
  const meshSurface = planetographicRowsToMeshLatitude(spectralSurface.data, spectralSurface.info.width,
    spectralSurface.info.height, spectralSurface.info.channels, surfaceAxisRatio);
  return Object.freeze({ data: meshSurface, info: spectralSurface.info });
}

function selectHighResolutionMap(maps: ReturnType<typeof readFitsPrimary>[], sourceIndex: number) {
  const source = maps[sourceIndex];
  if (!source) throw new RangeError(`Missing Hubble detail source ${sourceIndex}.`);
  const values = new Float32Array(source.values);
  const coverage = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value > config.scalar.minimumValue) coverage[index] = 1;
  }
  return { width: source.width, height: source.height, values, coverage };
}

function maskPreparedRingOcclusion(map: ScalarMap) {
  const [firstRow,lastRow] = config.scalar.maskedRows;
  for (let y = firstRow; y <= lastRow; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      map.coverage[y * map.width + x] = 0;
    }
  }
}

function fillMissingColumns(values: Float32Array, coverage: Uint8Array, width: number, height: number) {
  for (let x = 0; x < width; x += 1) {
    const validRows = [];
    for (let y = 0; y < height; y += 1) {
      if (coverage[y * width + x]) validRows.push(y);
    }
    if (validRows.length === 0) continue;
    let cursor = 0;
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      if (coverage[index]) continue;
      while (cursor < validRows.length && validRows[cursor] < y) cursor += 1;
      const upper = validRows[Math.min(cursor, validRows.length - 1)];
      const lower = validRows[Math.max(0, cursor - 1)];
      const lowerValue = values[lower * width + x];
      const upperValue = values[upper * width + x];
      const span = upper - lower;
      const mix = span > 0 ? (y - lower) / span : 0;
      values[index] = lowerValue + (upperValue - lowerValue) * mix;
      coverage[index] = 2;
    }
  }
}

function finitePercentiles(values: Float32Array, lowQuantile: number, highQuantile: number) {
  const sample = [];
  const step = Math.max(1, Math.floor(values.length / config.scalar.maximumPercentileSamples));
  for (let index = 0; index < values.length; index += step) {
    if (Number.isFinite(values[index]) && values[index] > 0) sample.push(values[index]);
  }
  sample.sort((left, right) => left - right);
  if (sample.length === 0) throw new Error("Hubble OPAL map has no finite samples.");
  return [sample[Math.floor((sample.length - 1) * lowQuantile)],
    sample[Math.floor((sample.length - 1) * highQuantile)]];
}

function falseColorMap(map: ScalarMap, palette: ColorPalette, low: number, high: number) {
  const output = Buffer.alloc(map.values.length * 4);
  for (let index = 0; index < map.values.length; index += 1) {
    const normalized = Math.pow(clamp01((map.values[index] - low) / (high - low)), config.colorExponent);
    const color = samplePalette(palette, normalized);
    const offset = index * 4;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = 255;
  }
  return output;
}

async function preparePolarAtlas(body: RawImage, plan: SpectralDataset, outputPath: string) {
  const existing = await sharp(normalAssets.poles).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const output = colorizeRgba(existing.data, plan.palette, config.colorExponent);
  for (const pole of ["north", "south"]) {
    for (const inner of [false, true]) {
      const tile = pole === "north" ? (inner ? 4 : 0) : (inner ? 5 : 1);
      const radialScale = inner ? 1.05 / 1.035 : 1;
      for (let y = 0; y < poleTileSize; y += 1) {
        for (let x = 0; x < poleTileSize; x += 1) {
          const unitX = (x + 0.5) / poleTileSize * 2 - 1;
          const unitY = (y + 0.5) / poleTileSize * 2 - 1;
          const radius = Math.hypot(unitX, unitY);
          const offset = (y * poleAtlasWidth + tile * poleTileSize + x) * 4;
          if (radius > 1) {
            output[offset + 3] = 0;
            continue;
          }
          const projectedRadius = Math.min(1, radius * radialScale);
          const latitudeMagnitude = Math.acos(Math.min(
            1,
            projectedRadius * Math.cos(polarBoundaryLatitude),
          ));
          const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
          let longitude = Math.atan2(unitY, unitX);
          if (longitude < 0) longitude += Math.PI * 2;
          const sampleX = longitude / (Math.PI * 2) * body.info.width;
          const sampleY = (Math.PI / 2 - latitude) / Math.PI * body.info.height;
          const color = bilinearSample(body.data, body.info.width, body.info.height, sampleX, sampleY);
          output[offset] = color[0];
          output[offset + 1] = color[1];
          output[offset + 2] = color[2];
          output[offset + 3] = 255;
        }
      }
    }
  }
  await sharp(output, {
    raw: { width: poleAtlasWidth, height: poleAtlasHeight, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}



async function prepareMaterial(inputPath: string, outputPath: string, plan: SpectralDataset) {
  const source = await sharp(inputPath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const output = colorizeRgba(source.data, plan.palette, plan.materialGain);
  await sharp(output, { raw: source.info })
    .webp({ quality: 96, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(outputPath);
}

async function prepareThumbnail(inputPath: string, outputPath: string) {
  const metadata = await sharp(inputPath).metadata();
  if (metadata.width === undefined || metadata.height === undefined) throw new Error('Spectral thumbnail dimensions are missing.');
  const width = Math.min(metadata.width, Math.round(metadata.width * 0.34));
  const height = Math.min(metadata.height, Math.round(metadata.height * 0.28));
  const left = Math.round((metadata.width - width) * 0.5);
  const top = Math.round((metadata.height - height) * 0.46);
  await writeLossyWebp(sharp(inputPath).extract({ left, top, width, height })
    .resize(112, 64, { fit: "cover", kernel: sharp.kernel.lanczos3 }), outputPath, { effort: 6 });
}

function colorizeRgba(source: Buffer, palette: ColorPalette, gain: number) {
  const output = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 4) {
    const luminance = (source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
      source[offset + 2] * 0.0722) / 255;
    const color = samplePalette(palette, clamp01(Math.pow(luminance, config.colorExponent) * gain));
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = source[offset + 3];
  }
  return output;
}

function samplePalette(palette: ColorPalette, value: number) {
  const segment = value < 0.5 ? 0 : 1;
  const mix = value < 0.5 ? value * 2 : (value - 0.5) * 2;
  return [0, 1, 2].map((channel) => Math.round(
    palette[segment][channel] +
      (palette[segment + 1][channel] - palette[segment][channel]) * mix,
  ));
}

function bilinearSample(data: Uint8Array, width: number, height: number, x: number, y: number) {
  const x0 = ((Math.floor(x) % width) + width) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  return [0, 1, 2].map((channel) => {
    const top = data[(y0 * width + x0) * 4 + channel] * (1 - fx) +
      data[(y0 * width + x1) * 4 + channel] * fx;
    const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - fx) +
      data[(y1 * width + x1) * 4 + channel] * fx;
    return Math.round(top * (1 - fy) + bottom * fy);
  });
}



function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}



return descriptor;
}
