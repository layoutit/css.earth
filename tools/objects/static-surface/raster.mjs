import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import {loadScienceSurface, paintScienceSurface, colorForValue} from '../terrestrial-layers/scientific-raster.mjs';
import sharp from 'sharp';
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';
import { orientLatitudeBands, preparePolarAtlas } from './projection.mjs';
import { writeCurvatureMaterial } from './curvature.mjs';
import { decodeElevationGrid, elevationRaster, elevationColor } from './elevation.mjs';
import { bakeSurfaceRaster } from './inverse-homography.mjs';

/** Observation interpretation is selected by the source recipe, never body ID. */
export async function prepareObservationLenses({ sourceDirectory, publicDirectory, config, geometry, surfaceRasterCells }) {
  if (config.schema !== 'cssearth-static-surface-raster@1' || config.kind !== 'observation-lenses') throw new TypeError('Unsupported observation lens recipe.');
  if (!['oriented-bands', 'inverse-homography'].includes(config.surfaceProjection)) throw new TypeError('Unsupported prepared surface projection.');
  if (config.surfaceProjection === 'inverse-homography' && (!geometry.rasterAtlas || !surfaceRasterCells?.length)) throw new TypeError('Inverse-homography preparation requires compiled surface cells.');
  await mkdir(publicDirectory, { recursive: true });
  sharp.concurrency(2);
  for (const plan of config.lenses) {
    // More source detail can use denser material pixels on the same retained
    // bands. Their CSS dimensions and pole layout remain the geometry owner's.
    const rasterScale = plan.rasterScale ?? 1;
    if (!Number.isSafeInteger(rasterScale) || rasterScale < 1 ||
        rasterScale !== 1 && config.surfaceProjection !== 'oriented-bands') {
      throw new TypeError('Lens raster scale requires a positive integer and oriented bands.');
    }
    const nearest = plan.scientific?.displaySampling === 'nearest';
    if (plan.scientific?.displaySampling !== undefined && !nearest) throw new Error('Unsupported scientific display sampling.');
    // Numeric values and missing footprints may not enter an interpolating path.
    if (nearest && config.surfaceProjection !== 'oriented-bands') throw new Error('Nearest scientific display requires oriented bands.');
    const input = resolve(sourceDirectory, plan.input);
    const elevation = plan.elevation ? decodeElevationGrid(await readFile(input), plan.elevation) : null;
    const scientific = plan.scientific ? await loadScienceSurface(dirname(input), {...plan.scientific, path: basename(input)}) : null;
    if (plan.scientific && (plan.elevation || plan.coverage || plan.presentation)) throw new Error('Scientific rasters require a single numeric interpretation.');
    if (plan.elevation || plan.scientific) {
      const width = 256, height = 16, data = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const value = plan.scientific?.categories
          ? Math.min(plan.scientific.categories.length - 1, Math.floor(x * plan.scientific.categories.length / width))
          : plan.scientific && plan.scientific.minimum + x / (width - 1) * (plan.scientific.maximum - plan.scientific.minimum);
        data.set(plan.scientific ? colorForValue(value, plan.scientific) : elevationColor((2 * x / (width - 1) - 1) * plan.elevation.rangeMetres, plan.elevation), (y * width + x) * 3);
      }
      await sharp(data, { raw: { width, height, channels: 3 } }).webp({ lossless: true })
        .toFile(resolve(publicDirectory, `${plan.output}-legend.webp`));
    }
    const source = plan.coverage ? await sharp(input, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true }) : null;
    if (plan.coverage && plan.coverage.kind !== 'black-fill') throw new TypeError('Unsupported observed coverage source.');
    const sourceMissing = source && blackFillCoverage(source.data, source.info, { southConnected: plan.coverage.southConnected });
    let thumbnailRaster;
    for (const density of config.densities) {
      const width = config.width * density * rasterScale, height = config.height * density * rasterScale;
      const { data, info } = await observationRaster({ input, plan, elevation, scientific, source, sourceMissing, width, height });
      if (density === 2) thumbnailRaster = { data, info };
      const atlas = config.surfaceProjection === 'inverse-homography'
        ? bakeSurfaceRaster(data, { width, height, channels: info.channels }, surfaceRasterCells, density, geometry.rasterAtlas)
        : { data: orientLatitudeBands(data, { width, height, channels: info.channels, bandCount: config.latitudeSegments }), width, height, channels: info.channels };
      const poles = preparePolarAtlas(data, { width, height, channels: info.channels, tileSize: config.polarTile * density, boundaryLatitudeRadians: Math.PI / 2 - Math.PI / config.latitudeSegments, ...(nearest ? { sampling: 'nearest' } : {}) });
      const suffix = density === 2 ? '@2x' : '';
      await Promise.all([
        sharp(atlas.data, { raw: { width: atlas.width, height: atlas.height, channels: atlas.channels } })
          // Chroma subsampling across transparent, warped face boundaries
          // produces colored seams even when the geometry overlaps correctly.
          .webp(nearest || atlas.channels === 4 ? { lossless: true } : { quality: 88, smartSubsample: true })
          .toFile(resolve(publicDirectory, `${plan.output}${suffix}.webp`)),
        sharp(poles, { raw: { width: config.polarTile * 4 * density, height: config.polarTile * density, channels: 4 } })
          .webp(nearest ? { lossless: true } : { quality: 88, alphaQuality: 100, smartSubsample: true })
          .toFile(resolve(publicDirectory, `${plan.output}-poles${suffix}.webp`)),
      ]);
    }
    let thumbnail;
    if (config.thumbnail === 'prepared-centered' || plan.scientific) {
      thumbnail = sharp(thumbnailRaster.data, { raw: thumbnailRaster.info })
        .resize(96, 96, { fit: 'cover', position: 'centre', kernel: nearest ? sharp.kernel.nearest : sharp.kernel.lanczos3 }).removeAlpha().toColourspace('srgb');
    } else if (config.thumbnail === 'source-center-crop') {
      const metadata = await sharp(input).metadata(), cropSize = Math.round(metadata.height / 2);
      thumbnail = sharp(input).extract({ left: Math.round((metadata.width - cropSize) / 2), top: Math.round((metadata.height - cropSize) / 2), width: cropSize, height: cropSize })
        .resize(96, 96, { kernel: sharp.kernel.lanczos3 }).removeAlpha();
      if (plan.presentation) thumbnail = applyTonalPresentation(thumbnail, plan.presentation);
    } else throw new TypeError('Unsupported observation thumbnail recipe.');
    await thumbnail.webp(nearest ? { lossless: true, effort: 6 } : { quality: 88, effort: 6 }).toFile(resolve(publicDirectory, `${plan.output}-thumbnail.webp`));
  }
  await Promise.all(config.densities.map(density => writeCurvatureMaterial({ publicDirectory, material: config.material, density })));
}

/** The same source interpretation feeds globe atlases and small, unwarped maps. */
export async function observationRaster({ input, plan, width, height, elevation, scientific, source, sourceMissing }) {
  if (plan.scientific && (plan.elevation || plan.coverage || plan.presentation)) throw new Error('Scientific rasters require a single numeric interpretation.');
  scientific ??= plan.scientific ? await loadScienceSurface(dirname(input), {...plan.scientific, path: basename(input)}) : null;
  elevation ??= plan.elevation ? decodeElevationGrid(await readFile(input), plan.elevation) : null;
  source ??= plan.coverage ? await sharp(input, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true }) : null;
  if (plan.coverage && plan.coverage.kind !== 'black-fill') throw new TypeError('Unsupported observed coverage source.');
  sourceMissing ??= source && blackFillCoverage(source.data, source.info, { southConnected: plan.coverage.southConnected });
  let raster;
  if (scientific) {
    const {rgb, missing} = paintScienceSurface(scientific, plan.scientific, width, height);
    raster = {data: rgb, info: {width, height, channels: 3}, missing};
  } else if (elevation) raster = elevationRaster(elevation, width, height);
  else {
    let pipeline = sharp(input, { limitInputPixels: false }).resize(width, height, { fit: 'fill' }).removeAlpha();
    if (plan.presentation) pipeline = applyTonalPresentation(pipeline, plan.presentation);
    if (plan.coverage) pipeline = pipeline.toColourspace('srgb');
    raster = await pipeline.raw().toBuffer({ resolveWithObject: true });
  }
  const { info } = raster;
  const missing = raster.missing ?? (sourceMissing && sampleCoverage(sourceMissing, source.info, width, height));
  return { info, data: missing ? paintMissingCoverage(raster.data, info, missing) : raster.data };
}

function applyTonalPresentation(pipeline, presentation) {
  return pipeline.modulate({ saturation: presentation.saturation }).linear(presentation.linearGain, presentation.linearOffset).sharpen({ sigma: presentation.sharpenSigma });
}
