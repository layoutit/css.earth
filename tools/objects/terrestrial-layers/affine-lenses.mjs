import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { packProjectiveSurfaceRaster } from
  "../../../src/platform/projective-surface-raster.mjs";

import {createEllipsoidGeometry} from './ellipsoid-geometry.mjs';
import {preparePolarAtlas} from './polar-stabilization.mjs';
import {polarZeroCoverage,resizeObservedRgb,prepareMeasuredPolarAtlas} from '../observed-coverage.mjs';



/** Source-authored observation processing over shared affine texture bands. */
export async function prepareAffineLenses({config,shape,sourceDirectory,publicDirectory,outputDirectory,sourceManifest}) {
const geometry=createEllipsoidGeometry(shape);
await sourceManifest.validateGroup("lenses");


const BODY_WIDTH = config.width;
const BODY_HEIGHT = config.height;
const BODY_2X_WIDTH = config.width * 2;
const BODY_2X_HEIGHT = config.height * 2;
const POLAR_TILE_SIZE = config.polarTileSize;
const POLAR_OVERLAP = shape.polar.overlap;
const BODY_LATITUDE_BOUNDS_DEGREES = shape.latitudeBoundsDegrees;
const plans = config.lenses.plans;

const controls = [config.lenses.normal];
await prepareThumbnail(
  resolve(publicDirectory, `${config.namespace}-surface.webp`),
  resolve(publicDirectory, `${config.namespace}-lens-normal.webp`),
);
for (const plan of plans) controls.push(await prepareLens(plan));

const descriptor = Object.freeze({
  schema: `css${config.namespace}-prepared-lenses@1`,
  defaultLens: "normal",
  runtimeFilters: false,
  runtimeRasterization: false,
  controls: Object.freeze(controls),
  provenance: config.lenses.provenance,
});
await writeFile(resolve(outputDirectory,'lenses.json'),JSON.stringify(descriptor)+'\n');
return descriptor;

async function prepareLens(plan) {
  const sourcePath = resolve(sourceDirectory, plan.source);
  const source = await sharp(sourcePath)
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (source.info.width !== BODY_2X_WIDTH ||
      source.info.height !== BODY_2X_HEIGHT ||
      source.info.channels !== 3) {
    throw new Error(`${plan.label} Ellipsoid lens dimensions changed.`);
  }
  const measuredOnly = plan.coverage?.kind === 'polar-connected-zero';
  if (plan.coverage && !measuredOnly) throw new TypeError('Unsupported observed lens coverage.');
  const observed = measuredOnly ? {...source, missing:polarZeroCoverage(source.data, source.info)} : null;
  const complete = measuredOnly ? resizeObservedRgb(observed, BODY_2X_WIDTH, BODY_2X_HEIGHT) : source;
  const source1x = measuredOnly ? resizeObservedRgb(observed, BODY_WIDTH, BODY_HEIGHT) : await sharp(complete.data, { raw: complete.info })
    .resize(BODY_WIDTH, BODY_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const surfacePath = resolve(publicDirectory, `${config.namespace}-lens-${plan.id}.webp`);
  const surface2xPath = resolve(
    publicDirectory,
    `${config.namespace}-lens-${plan.id}@2x.webp`,
  );
  await Promise.all([
    writeProjectiveSurface(source1x, surfacePath),
    writeProjectiveSurface(complete, surface2xPath),
  ]);
  const polar = measuredOnly ? prepareMeasuredPolarAtlas(observed, POLAR_TILE_SIZE * 2, {projection:'orthographic', ...shape.polar}) : preparePolarAtlas(complete, POLAR_TILE_SIZE * 2, {
    ...shape.polar,
    boundaryLatitudeDegrees: shape.polar.boundaryLatitudeDegrees,
    overlap: POLAR_OVERLAP,
    inpaintRadius: config.lenses.polarInpaintRadius,
  });
  const polesPath = resolve(publicDirectory, `${config.namespace}-lens-${plan.id}-poles.webp`);
  const poles2xPath = resolve(
    publicDirectory,
    `${config.namespace}-lens-${plan.id}-poles@2x.webp`,
  );
  await Promise.all([
    sharp(polar.data, {
      raw: { width: polar.width, height: polar.height, channels: 4 },
    }).resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE)
      .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(polesPath),
    sharp(polar.data, {
      raw: { width: polar.width, height: polar.height, channels: 4 },
    }).webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(poles2xPath),
  ]);
  const thumbnailPath = resolve(
    publicDirectory,
    `${config.namespace}-lens-${plan.id}-thumbnail.webp`,
  );
  await prepareThumbnail(surfacePath, thumbnailPath);
  const assets = await Promise.all([
    surfacePath,
    surface2xPath,
    polesPath,
    poles2xPath,
    thumbnailPath,
  ].map((path) => readFile(path)));
  return Object.freeze({
    id: plan.id,
    label: plan.label,
    shortLabel: plan.shortLabel,
    measurement: plan.measurement,
    thumbnailUrl: `${config.publicBase}${config.namespace}-lens-${plan.id}-thumbnail.webp`,
    surfaceUrl: `${config.publicBase}${config.namespace}-lens-${plan.id}.webp`,
    surface2xUrl: `${config.publicBase}${config.namespace}-lens-${plan.id}@2x.webp`,
    polesUrl: `${config.publicBase}${config.namespace}-lens-${plan.id}-poles.webp`,
    poles2xUrl: `${config.publicBase}${config.namespace}-lens-${plan.id}-poles@2x.webp`,
    falseColor: plan.falseColor,
    qualification: plan.qualification,
    coveragePreparation: plan.coveragePreparation,
    sourceMissingPixels: observed ? observed.missing.reduce((sum,value)=>sum+value,0) : undefined,
    polarPreparation: Object.freeze({
      boundaryLatitudeDegrees: shape.polar.boundaryLatitudeDegrees,
      singularityStabilization: polar.stabilization,
      runtimeProjection: false,
    }),
    sourceFile: plan.source,
    assetSha256: Object.freeze({
      surface: digest(assets[0]),
      surface2x: digest(assets[1]),
      poles: digest(assets[2]),
      poles2x: digest(assets[3]),
      thumbnail: digest(assets[4]),
    }),
  });
}

async function writeProjectiveSurface(source, outputPath) {
  const { width, height, channels } = source.info;
  const packed = packProjectiveSurfaceRaster(source.data, {
    width,
    height,
    channels,
    bands: geometry.rasterBands(height),
    gutter: height / 16 / 4,
  });
  await sharp(packed.data, { raw: {
    width: packed.packedWidth,
    height: packed.packedHeight,
    channels,
  } })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(outputPath);
}

async function prepareThumbnail(inputPath, outputPath) {
  const metadata = await sharp(inputPath).metadata();
  const width = Math.round(metadata.width * 0.34);
  const height = Math.round(metadata.height * 0.28);
  const left = Math.round((metadata.width - width) * 0.5);
  const top = Math.round((metadata.height - height) * 0.46);
  await sharp(inputPath)
    .extract({ left, top, width, height })
    .resize(112, 64, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 90, effort: 6 })
    .toFile(outputPath);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

}
