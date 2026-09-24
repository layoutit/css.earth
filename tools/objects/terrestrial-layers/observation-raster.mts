/** Decode an observation and its validity mask independently of material and scene preparation. */
import type { RgbObservation } from './contracts.mts';
import { requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
import { parseDimensions } from './source-records.mts';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fromFile } from 'geotiff';
import { blackFillCoverage, sampleCoverage } from '../../../src/platform/prepare-missing-coverage.mts';
import { prepareMaskedObservation, prepareFloatObservation, prepareIsisObservation, prepareRgbBandObservation } from './observed-geotiff.mts';
import { preparePdsRgbObservation } from './observed-pds-rgb.mts';
import { prepareByteObservation } from './observed-image.mts';
import { preparePds4Observation } from './observed-pds4.mts';
import { prepareFitsObservation } from './observed-fits.mts';
import { preparePdsByteMosaic } from './pds-byte-mosaic.mts';
export interface ObservationRaster extends RgbObservation {withheldSyntheticPixels?:number;sourceGeoreference?:unknown;}

export async function readObservation(sourceDirectory:string, entryInput:unknown, validityInput:unknown, width:number, height:number): Promise<ObservationRaster> {
  const entry=Object.assign({},requireRecord(entryInput),parseDimensions(entryInput));
  const validity=requireRecord(validityInput),kind=requireString(validity.kind);
  const sourcePath=requireString(entry.path);

  const path = resolve(sourceDirectory, sourcePath);
  if (kind === 'pds4-float-rgb') return preparePds4Observation(sourceDirectory, entry, validity, width, height);
  if (kind === 'pds3-rgb-zip') return preparePdsRgbObservation(path, entry, validity, width, height);
  if (kind === 'geotiff-rgb-bands') return prepareRgbBandObservation(path, entry, validity, width, height);
  if (kind === 'fits-byte-monochrome') return prepareFitsObservation(path, entry, validity, width, height);
  if (kind === 'pds3-byte-monochrome') return preparePdsByteMosaic(sourceDirectory, [entry], width, height, validity);
  if (kind === 'isis3-float-monochrome') return prepareIsisObservation(path, entry, validity, width, height);
  if (['geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(kind)) return prepareFloatObservation(path, entry, validity, width, height);
  const metadata = await sharp(path, { limitInputPixels: false }).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height) throw new Error(`Observation source dimensions changed: ${entry.path}`);
  if (['image-monochrome-no-data', 'image-rgb-no-data'].includes(kind)) return prepareByteObservation(path, entry, validity, width, height);
  if(kind==='geotiff-rgb-alpha')return prepareMaskedObservation(path,entry,validity,width,height);
  if (kind === 'geotiff-monochrome-alpha' && typeof validity.resampling === 'string' && ['source-georeferenced-bilinear','source-georeferenced-nearest'].includes(validity.resampling)) {
    return prepareMaskedObservation(path, entry, {...validity, channels:'monochrome', zeroValidity:validity.zeroValidity ?? 'all-channels'}, width, height);
  }
  if (kind === 'south-connected-black') {
    const source = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sourceMissing = blackFillCoverage(source.data, source.info, { southConnected: true });
    const rgb = await sharp(path).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    return { rgb, missing: sampleCoverage(sourceMissing, source.info, width, height) };
  }
  if (kind !== 'geotiff-monochrome-alpha') throw new Error(`Unsupported observation validity: ${validity.kind}`);
  const tiff = await fromFile(path);
  let origin, resolution;
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys();
    if (!keys) throw new Error('Observation GeoTIFF has no source keys.');
    const referenceRadius=requireFiniteNumber(requireRecord(entry.projection).referenceRadiusMeters);
    origin = image.getOrigin(); resolution = image.getResolution();
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== validity.noData ||
        resolution[0] <= 0 || resolution[1] >= 0 || keys.ProjCenterLongGeoKey !== validity.centerLongitude ||
        Math.abs(requireFiniteNumber(keys.GeogSemiMajorAxisGeoKey) - referenceRadius) > 0.01) {
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
