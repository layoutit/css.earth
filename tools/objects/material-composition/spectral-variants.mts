import { sha256 } from '../../../src/platform/sha256.mts';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';
import {parse} from './data-schema.mts';
import {spectralRecipe, type SpectralRecipe} from './spectral-recipe.mts';
import type {Channels, OutputInfo} from 'sharp';
type SpectralLens = SpectralRecipe['lenses'][number];
type ColorPalette = readonly (readonly number[])[];
interface RawImage {data: Buffer; info: {width: number; height: number; channels: Channels}}
interface ScalarMap {width: number; height: number; values: Float32Array; coverage: Uint8Array}
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {packProjectiveSurfaceRaster} from '../../../src/platform/projective-surface-raster.mts';
import {readFitsPrimary} from '../observation/fits.mts';
import {planetographicRowsToMeshLatitude} from './ellipsoid.mts';
import {verifyObservationSources} from '../observed-surfaces/index.mts';
import {validateMaterialRecipe,validateRelativePath} from './recipe.mts';
/** Compose source-selected scalar/thermal surfaces and the corresponding material variants. */
export async function prepareSpectralMaterialVariants({sourceDirectory,publicDirectory,stagingDirectory,config: input}: {sourceDirectory:string;publicDirectory:string;stagingDirectory:string;config:unknown}) {
const config = parse(input, spectralRecipe, 'spectral material recipe');
validateMaterialRecipe(config, 'cssearth-spectral-material-variants@1');
if(!Array.isArray(config.lenses)||config.lenses.some(plan=>!['scalar-map','morphology-response'].includes(plan.operation)))throw new TypeError('Unsupported spectral material operation.');
validateRelativePath(config.sourceSubdirectory);
for(const plan of config.lenses)for(const filename of plan.sourceFiles)validateRelativePath(filename);
// Every lens names its files; they are the inputs, read from the source subdirectory.
await verifyObservationSources(sourceDirectory,config.lenses.flatMap(plan=>plan.sourceFiles.map(filename=>({path:`${config.sourceSubdirectory}/${filename}`}))));













const sourceRoot = sourceDirectory;
const publicRoot = publicDirectory;
const stagingRoot = stagingDirectory;

const bodyWidth = config.parameters.bodyWidth;
const bodyHeight = config.parameters.bodyHeight;
const body2xWidth = config.parameters.body2xWidth;
const body2xHeight = config.parameters.body2xHeight;
const latitudeBandCount = config.parameters.latitudeBandCount;
const detailBlurSigma = config.parameters.detailBlurSigma;
const detailGain = config.parameters.detailGain;
const minimumDetailScale = config.parameters.minimumDetailScale;
const maximumDetailScale = config.parameters.maximumDetailScale;
const ringOuterKm = config.parameters.ringOuterKm;
const poleTileSize = config.parameters.poleTileSize;
const poleAtlasWidth = config.parameters.poleAtlasWidth;
const poleAtlasHeight = config.parameters.poleAtlasHeight;
const polarBoundaryLatitude = config.parameters.polarBoundaryLatitude;
const materialModes = config.parameters.materialModes;
const surfaceAxisRatio = config.parameters.objectEquatorialRadiusKm / config.parameters.objectPolarRadiusKm;
const materialVariantId = (lensId: string, mode: string) =>
  mode === "full" ? lensId : `${lensId}-${mode}`;

const lensPlans = config.lenses;

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
const highResolutionDetailPromise = prepareHighResolutionDetailCarrier();

const prepared: Awaited<ReturnType<typeof prepareLens>>[] = [];
await prepareThumbnail(normalAssets.surface, resolve(publicRoot, config.files.normalThumbnail));
for (const plan of lensPlans) prepared.push(await prepareLens(plan));

const descriptor = {...config.descriptor,controls:config.controlOrder.map(id=>{const control=prepared.find(plan=>plan.id===id)??config.descriptor.controls.find(control=>control.id===id);if(!control)throw new TypeError(`Missing spectral control ${id}`);return control;})};



async function prepareLens(plan: SpectralLens) {
  const surfacePath = resolve(publicRoot, `${config.namespace}-surface-${plan.id}.webp`);
  const surface2xPath = resolve(publicRoot, `${config.namespace}-surface-${plan.id}@2x.webp`);
  const preparedSurface = plan.operation === "morphology-response"
    ? await prepareThermalSurface(plan)
    : await prepareScalarSurface(plan);
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

  const ringPath = resolve(publicRoot, `${config.namespace}-rings-${plan.id}.webp`);
  const ring2xPath = resolve(publicRoot, `${config.namespace}-rings-${plan.id}@2x.webp`);


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
  const thumbnailPath = resolve(publicRoot, `${config.namespace}-lens-${plan.id}.webp`);
  await prepareThumbnail(surfacePath, thumbnailPath);
  const assets = await Promise.all([
    surfacePath,
    surface2xPath,
    polesPath,
    ringPath,
    ring2xPath,
    ...materialModes.flatMap((mode) => [
      materialPaths[mode].exterior,
      materialPaths[mode].interior,
    ]),
    thumbnailPath,
  ].map((assetPath) => readFile(assetPath)));
  return Object.freeze({
    id: plan.id,
    materialLens: plan.id,
    label: plan.label,
    shortLabel: plan.shortLabel,
    filter: plan.filter,
    wavelength: plan.wavelength,
    thumbnailUrl: `${config.publicPrefix}${config.namespace}-lens-${plan.id}.webp`,
    surfaceUrl: `${config.publicPrefix}${config.namespace}-surface-${plan.id}.webp`,
    surface2xUrl: `${config.publicPrefix}${config.namespace}-surface-${plan.id}@2x.webp`,
    polesUrl: `${config.publicPrefix}${config.namespace}-poles-${plan.id}.webp`,
    ringUrl: `${config.publicPrefix}${config.namespace}-rings-${plan.id}.webp`,
    ring2xUrl: `${config.publicPrefix}${config.namespace}-rings-${plan.id}@2x.webp`,
    materialVariant: plan.id,
    materialPreparationFile: `${config.namespace}-orbit-material-${plan.id}.webp`,
    interiorMaterialPreparationFile:
      `${config.namespace}-interior-atmosphere-${plan.id}.webp`,
    materialModes,
    falseColorPalette: plan.palette,
    materialGain: plan.materialGain,
    sourceModel: plan.sourceKind,
    falseColor: true,
    qualification: plan.operation === "scalar-map"
      ? `${plan.filter} single-band Hubble data shown with a declared false-color palette`
      : config.qualifications.morphology,
    detailPreparation: plan.operation === "scalar-map"
      ? config.qualifications.scalarDetail
      : config.qualifications.morphologyDetail,
    detailCarrierUrl: config.detailCarrierUrl,
    maximumDetailScale: plan.operation === "scalar-map"
      ? maximumDetailScale
      : 1,
    sourceFiles: Object.freeze(plan.operation === "scalar-map"
      ? [plan.sourceFiles[plan.detailSourceIndex]]
      : []),
    sourceUrls: Object.freeze('sourceUrls' in plan ? plan.sourceUrls : []),
    assetSha256: Object.freeze({
      surface: sha256(assets[0]),
      surface2x: sha256(assets[1]),
      poles: sha256(assets[2]),
      rings: sha256(assets[3]),
      rings2x: sha256(assets[4]),
      material: sha256(assets[5]),
      interiorMaterial: sha256(assets[6]),
      materialNoShadows: sha256(assets[7]),
      interiorMaterialNoShadows: sha256(assets[8]),
      materialRingless: sha256(assets[9]),
      interiorMaterialRingless: sha256(assets[10]),
      materialRinglessNoShadows: sha256(assets[11]),
      interiorMaterialRinglessNoShadows: sha256(assets[12]),
      thumbnail: sha256(assets[13]),
    }),
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

async function prepareScalarSurface(plan: Extract<SpectralLens,{operation:'scalar-map'}>) {
  const maps = await Promise.all(plan.sourceFiles.map(async (filename) =>
    readFitsPrimary(await readFile(resolve(sourceRoot, config.sourceSubdirectory, filename)))));
  if (maps.some(({ width, height }) => width !== config.scalar.width || height !== config.scalar.height)) {
    throw new Error(`${plan.id} Hubble map dimensions changed.`);
  }
  const detailMap = selectHighResolutionMap(maps, plan.detailSourceIndex);
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
  const highResolutionDetail = await highResolutionDetailPromise;
  return Object.freeze({
    data: applyHighResolutionDetail(meshSurface, highResolutionDetail),
    info: spectralSurface.info,
  });
}

async function prepareThermalSurface(plan: SpectralLens): Promise<RawImage> {
  const detail = await highResolutionDetailPromise;
  const { width, height } = detail.source.info;
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const latitude = (0.5 - (row + 0.5) / height) * Math.PI;
    const polarEmission = Math.pow(Math.abs(Math.sin(latitude)), config.thermal.polarExponent);
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      const sourceLuminance = luminance(detail.source.data, offset);
      const localLuminance = luminance(detail.blurred, offset);
      const broadCloudWindow = 1 - localLuminance / 255;
      const fineCloudWindow = clamp01(
        config.thermal.fineCenter + (localLuminance - sourceLuminance) / config.thermal.fineDenominator,
      );
      const longitude = (column + 0.5) / width * Math.PI * 2;
      const bandStructure = Math.sin(
        latitude * config.thermal.latitudeFrequency + Math.sin(longitude * config.thermal.longitudeFrequency) * config.thermal.longitudeAmplitude,
      ) * config.thermal.bandAmplitude;
      const intensity = clamp01(
        config.thermal.baseline + broadCloudWindow * config.thermal.broadGain + fineCloudWindow * config.thermal.fineGain +
        polarEmission * config.thermal.polarGain + bandStructure,
      );
      const color = samplePalette(plan.palette, Math.pow(intensity, config.thermal.exponent));
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = detail.source.data[offset + 3];
    }
  }
  return Object.freeze({
    data: output,
    info: Object.freeze({ width, height, channels: 4 }),
  });
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

async function prepareHighResolutionDetailCarrier() {
  const source = await sharp(normalAssets.surface).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  if (source.info.width !== bodyWidth || source.info.height !== bodyHeight) {
    throw new Error("Observed detail-carrier dimensions changed.");
  }
  const blurred = await sharp(normalAssets.surface).blur(detailBlurSigma)
    .ensureAlpha().raw().toBuffer();
  return Object.freeze({ source, blurred });
}

function applyHighResolutionDetail(spectral: Buffer, detail: Awaited<ReturnType<typeof prepareHighResolutionDetailCarrier>>) {
  const output = Buffer.from(spectral);
  for (let offset = 0; offset < output.length; offset += 4) {
    const detailLuminance = luminance(detail.source.data, offset);
    const localLuminance = luminance(detail.blurred, offset);
    const scale = Math.max(minimumDetailScale, Math.min(
      maximumDetailScale,
      1 + (detailLuminance - localLuminance) /
        Math.max(config.detailMinimumLuminance, localLuminance) * detailGain,
    ));
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = Math.round(Math.max(
        0,
        Math.min(255, output[offset + channel] * scale),
      ));
    }
  }
  return output;
}

function luminance(data: Uint8Array, offset: number) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 +
    data[offset + 2] * 0.0722;
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

async function preparePolarAtlas(body: RawImage, plan: SpectralLens, outputPath: string) {
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



async function prepareMaterial(inputPath: string, outputPath: string, plan: SpectralLens) {
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
