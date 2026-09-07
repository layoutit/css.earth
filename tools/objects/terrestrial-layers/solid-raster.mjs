import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fromFile } from 'geotiff';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mjs';
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';
import { reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from '../../../src/platform/prepare-solid-body-surface.mjs';
import { colorForValue, loadScienceSurface, paintScienceSurface, prepareObservedColor } from './scientific-raster.mjs';
import {prepareMaskedObservation, prepareFloatObservation} from './observed-geotiff.mjs';
import { prepareByteObservation } from './observed-image.mjs';
import { prepareControlledOrthographicMosaic } from './controlled-orthographic-mosaic.mjs';
import { preparePdsByteMosaic } from './pds-byte-mosaic.mjs';
import {loadControlledObservationGeometry,matchObservedColorLevels} from './photometric-observations.mjs';

export function createRasterEmitter(publicDirectory, publicBase) {
  return async (filename, pipeline, encoding = { lossless: true, effort: 4 }) => {
    const bytes = await pipeline.webp(encoding).toBuffer();
    await writeFile(resolve(publicDirectory, filename), bytes);
    const { width, height } = await sharp(bytes).metadata();
    return { url: `${publicBase}${filename}`, width, height, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') };
  };
}

// Terminal display encoding only. Source maps stay lossless for pole sampling.
function surfaceEncoding(config) {
  return config.raster.surfaceQuality === undefined ? { lossless: true, effort: 4 }
    : { quality: config.raster.surfaceQuality, alphaQuality: 100, effort: 4, smartSubsample: true };
}

export async function readObservation(sourceDirectory, entry, validity, width, height) {
  const path = resolve(sourceDirectory, entry.path);
  if (['geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(validity.kind)) return prepareFloatObservation(path, entry, validity, width, height);
  const metadata = await sharp(path).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height) throw new Error(`Observation source dimensions changed: ${entry.path}`);
  if (['image-monochrome-no-data', 'image-rgb-no-data'].includes(validity.kind)) return prepareByteObservation(path, entry, validity, width, height);
  if(validity.kind==='geotiff-rgb-alpha')return prepareMaskedObservation(path,entry,validity,width,height);
  if (validity.kind === 'south-connected-black') {
    const source = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sourceMissing = blackFillCoverage(source.data, source.info, { southConnected: true });
    const rgb = await sharp(path).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    return { rgb, missing: sampleCoverage(sourceMissing, source.info, width, height) };
  }
  if (validity.kind !== 'geotiff-monochrome-alpha') throw new Error(`Unsupported observation validity: ${validity.kind}`);
  const tiff = await fromFile(path);
  let origin, resolution;
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys();
    origin = image.getOrigin(); resolution = image.getResolution();
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== validity.noData ||
        resolution[0] <= 0 || resolution[1] >= 0 || keys.ProjCenterLongGeoKey !== validity.centerLongitude ||
        Math.abs(keys.GeogSemiMajorAxisGeoKey - entry.projection.referenceRadiusMeters) > 0.01) {
      throw new Error(`Observation GeoTIFF coordinate mapping changed: ${entry.path}`);
    }
  } finally { await tiff.close(); }
  const source = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (source.info.channels !== 1) throw new Error('Monochrome source must have one channel.');
  const grayAlpha = Buffer.alloc(source.data.length * 2);
  for (let i = 0; i < source.data.length; i++) {
    grayAlpha[i * 2] = source.data[i];
    grayAlpha[i * 2 + 1] = source.data[i] === validity.noData ? 0 : 255;
  }
  const { data, info } = await sharp(grayAlpha, { raw: { width: entry.width, height: entry.height, channels: 2 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error('Monochrome resampling must retain its validity channel.');
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let i = 0; i < missing.length; i++) {
    rgb.set(data.subarray(i * 4, i * 4 + 3), i * 3);
    missing[i] = data[i * 4 + 3] < 255 ? 1 : 0;
  }
  return { rgb, missing, sourceGeoreference: { origin, resolution } };
}

/** Surface composition is source-dependent; the projection/packing is shared. */
export async function prepareSolidRasters({ sourceDirectory, publicDirectory, outputDirectory, config, source }) {
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const { width, height, bandCount, gutter } = config.raster;
  const emit = createRasterEmitter(publicDirectory, config.publicBase), surfaces = [], observations = new Map();
  const entries = await source.validateGroup('surfaces');
  if (entries.length !== config.raster.observations.length ||
      new Set(entries.map(entry => entry.lensId)).size !== entries.length ||
      entries.some(entry => !config.raster.observations.some(recipe => recipe.id === entry.lensId))) {
    throw new Error('Observation recipe does not consume its complete pinned surface group.');
  }
  for (const recipe of config.raster.observations) {
    const entry=entries.find(item=>item.lensId===recipe.id);
    if (!entry) throw new Error(`Observation ${recipe.id} has no pinned source.`);
    const observation = await readObservation(sourceDirectory, entry, recipe.validity, width, height);
    let monochromePixels=0;
    if(recipe.monochromeBase){const base=observations.get(recipe.monochromeBase);if(!base)throw new Error('Observed fallback ordering is invalid.');
      for(let i=0;i<observation.missing.length;i++)if(observation.missing[i]&&!base.missing[i]){observation.rgb.set(base.rgb.subarray(i*3,i*3+3),i*3);observation.missing[i]=0;monochromePixels++}}
    observations.set(entry.lensId, observation);
    surfaces.push(await packSurface(entry.lensId, observation.rgb, observation.missing, {
      label: entry.label, falseColor: entry.falseColor,
      source: { id: entry.id, sha256: entry.expectedSha256, width: entry.width, height: entry.height },
      projection: {...entry.projection,...recipe.projection}, coverage: entry.coverage,
      ...recipe.metadata,
      ...(recipe.reportComposition?{monochromePixels,withheldSyntheticPixels:observation.withheldSyntheticPixels??0}:{}),
      ...(recipe.monochromeBase&&!recipe.reportComposition?{monochromePixels}:{}),
      ...(observation.sourceGeoreference ? { sourceGeoreference: observation.sourceGeoreference } : {}),
    }));
  }
  for (const recipe of config.raster.mosaics ?? []) {
    const tiles = await source.validateGroup(recipe.consumer);
    if (recipe.photometry) await source.validateGroup(recipe.photometry.consumer);
    const { rgb, missing, grid } = recipe.format === 'controlled-orthographic'
      ? await prepareControlledOrthographicMosaic(sourceDirectory, tiles, recipe, width, height)
      : await preparePdsByteMosaic(sourceDirectory, tiles, width, height);
    surfaces.push(await packSurface(recipe.id, rgb, missing, { ...recipe.metadata,
      sourceIds: tiles.map(tile => tile.id), sourceGrid: grid }));
  }
  for (const lens of config.raster.scientific ?? []) {
    await source.validateGroup(lens.consumer);
    const entry = source.manifest.inputs.find(input => input.lensId === lens.id);
    if (!entry || entry.path !== lens.path) throw new Error(`Scientific source ${lens.id} differs from its manifest.`);
    const additionalSources = (lens.additionalGrids ?? []).map(grid => {
      const input = source.manifest.inputs.find(input => input.path === grid.path && input.consumers.includes(lens.consumer));
      if (!input) throw new Error(`Scientific grid ${grid.path} has no pinned source.`);
      return {id: input.id, sha256: input.expectedSha256, width: input.width, height: input.height};
    });
    const raster = await loadScienceSurface(sourceDirectory, lens);
    const { rgb, missing } = paintScienceSurface(raster, lens, width, height);
    const scale = Buffer.alloc(256 * 3);
    for (let x = 0; x < 256; x++) scale.set(colorForValue(lens.minimum + x / 255 * (lens.maximum - lens.minimum), lens), x * 3);
    const legend = await emit(`${config.namespace}-${lens.id}-legend.webp`, sharp(scale, { raw: { width: 256, height: 1, channels: 3 } }).resize(256, 16, { fit: 'fill' }));
    surfaces.push(await packSurface(lens.id, rgb, null, { label: lens.label, falseColor: true,
      source: { id: entry.id, sha256: entry.expectedSha256, width: entry.width, height: entry.height },
      ...(additionalSources.length ? {additionalSources} : {}),
      projection: entry.projection, coverage: entry.coverage, scientific: true, legend,
      missingPixels: missing.reduce((sum, value) => sum + value, 0) }));
  }
  for (const recipe of config.raster.observedColors ?? []) {
    const photometry=recipe.photometry?{profile:recipe.photometry.profile,geometry:await loadControlledObservationGeometry({sourceDirectory,entries:await source.validateGroup(recipe.photometry.consumer),vectors:recipe.photometry.vectors})}:null;
    const color = await prepareObservedColor({ sourceDirectory, entries: await source.validateGroup(recipe.consumer), profile: recipe.profile, width, height,photometry });
    const base = observations.get(recipe.monochromeBase);
    if (!base) throw new Error(`Color observation base does not exist: ${recipe.monochromeBase}`);
    const levels=photometry?matchObservedColorLevels(color,base,{width,height,...recipe.photometry.levels}):null;
    if(photometry){if(!color.rgb.every(value=>Number.isFinite(value)&&value>=0&&value<=255))throw new Error('Corrected observation exceeds the display range.');color.rgb=Buffer.from(color.rgb)}
    let monochromePixels = 0;
    for (let i = 0; i < color.missing.length; i++) if (color.missing[i] && !base.missing[i]) {
      color.rgb.set(base.rgb.subarray(i * 3, i * 3 + 3), i * 3); color.missing[i] = 0; monochromePixels++;
    }
    surfaces.push(await packSurface(recipe.id, color.rgb, color.missing, {
      ...recipe.metadata, sourceIds: color.sourceIds, monochromePixels, observationCoverage: color.coverage,
      ...(photometry?{photometry:color.photometry,levels}:{}),
    }));
  }
  async function packSurface(id, rgb, missing, metadata) {
    const display = missing ? paintMissingCoverage(rgb, { width, height, channels: 3 }, missing) : rgb;
    const rgba = await sharp(display, { raw: { width, height, channels: 3 } }).ensureAlpha().raw().toBuffer();
    const projected = reprojectSolidBodySurfaceRaster(rgba, { width, height, latitudeSegments: bandCount });
    const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount, gutter });
    const { data, ...layout } = packed, stem = `${config.namespace}-${id}`;
    const normalized = sharp(rgba, { raw: { width, height, channels: 4 } });
    const map = await emit(`${stem}-map.webp`, normalized.clone());
    const surface = await emit(`${stem}-surface@2x.webp`, sharp(data, { raw: { width: packed.packedWidth, height: packed.packedHeight, channels: 4 } }), surfaceEncoding(config));
    const thumbnail = await emit(`${stem}-thumbnail.webp`, normalized.clone().resize(96, 48));
    return { id, ...metadata, map, surface, thumbnail, layout,
      ...(missing && config.raster.reportMissingPixels ? { missingPixels: missing.reduce((sum, value) => sum + value, 0) } : {}) };
  }
  await writeFile(resolve(outputDirectory, 'surfaces.json'), `${JSON.stringify({ objectId: config.namespace, surfaces })}\n`);
  return surfaces;
}

export function lambertAttenuationAtlas({ frameSize, columns, frameCount, terminatorWidth, directionalAmbient, fullPhaseAmbient, fullPhaseDiffuse, maximumOpacity }) {
  const rows = frameCount / columns, width = frameSize * columns, height = frameSize * rows;
  const pixels = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < frameCount; frame++) {
    const lz = -1 + 2 * frame / (frameCount - 1), lx = Math.sqrt(1 - lz * lz);
    for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
      const nx = (x - (frameSize - 1) / 2) / (frameSize / 2), ny = (y - (frameSize - 1) / 2) / (frameSize / 2), r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const direct = Math.max(0, nx * lx + Math.sqrt(1 - r2) * lz);
      const t = Math.min(1, direct / terminatorWidth), lit = t * t * (3 - 2 * t) * direct;
      const illumination = frame === frameCount - 1 ? fullPhaseAmbient + lit * fullPhaseDiffuse : directionalAmbient + lit;
      const offset = ((Math.floor(frame / columns) * frameSize + y) * width + frame % columns * frameSize + x) * 4;
      pixels[offset + 3] = Math.round(Math.min(maximumOpacity, Math.max(0, 1 - illumination)) * 255);
    }
  }
  return { pixels, width, height, rows };
}

export async function prepareSolidMaterial({ surfaces, publicDirectory, outputDirectory, config }) {
  const { poleSize } = config.raster;
  for (const surface of surfaces) {
    const { data, info } = await sharp(resolve(publicDirectory, surface.map.url.split('/').at(-1))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const atlas = prepareSolidBodyPoleRaster(data, { width: info.width, height: info.height, tileSize: poleSize });
    const filename = `${config.namespace}-${surface.id}-poles@2x.webp`;
    surface.polesUrl = `${config.publicBase}${filename}`;
    await sharp(atlas, { raw: { width: poleSize * 2, height: poleSize, channels: 4 } }).webp(surfaceEncoding(config)).toFile(resolve(publicDirectory, filename));
    const mean = await sharp(data, { raw: info }).resize(1, 1).removeAlpha().raw().toBuffer();
    surface.billboardColor = `#${mean.subarray(0, 3).toString('hex')}`;
  }
  const { pixels, width, height, rows } = lambertAttenuationAtlas(config.lighting);
  const filename = `${config.namespace}-lighting.webp`, url = `${config.publicBase}${filename}`;
  await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, quality: 100, effort: 6 }).toFile(resolve(publicDirectory, filename));
  const { columns, frameCount, logicalSize } = config.lighting;
  const frames = Array.from({ length: frameCount }, (_, frame) => ({ resource: 'lighting', frame, row: 0,
    backgroundPosition: `${-(frame % columns) * logicalSize}px ${-Math.floor(frame / columns) * logicalSize}px`,
    backgroundSize: `${columns * logicalSize}px ${rows * logicalSize}px` }));
  const material = { surfaces, lighting: { url, columns, rowCount: rows, frameCount, frames } };
  await writeFile(resolve(outputDirectory, 'material.json'), `${JSON.stringify(material)}\n`);
  return material;
}
