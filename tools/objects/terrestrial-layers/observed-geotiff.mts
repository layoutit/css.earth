import { isArray, number } from '@cssearth/core';
import type {PixelValidityPolicy,RasterResult} from './contracts.mts';
import {parseGeoImageEntry,parseDimensions,parseRgbBandPolicy,parseFloatObservationPolicy,parseMaskedObservationPolicy,parseIsisObservationPolicy,numericRasterBands,requireWrappedLongitudeSpan} from './source-records.mts';
import sharp from 'sharp';
import {fromFile} from 'geotiff';
import {sampleColorBand, loadScienceSurface} from './scientific-raster.mts';
import { prepareProjectedByteObservation } from './observed-image.mts';

/** Some published color products retain scientific band tags instead of RGB tags.
 * The authored band order and alpha bind the decoder to the original composite.
 */
export async function prepareRgbBandObservation(path: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parseRgbBandPolicy(value);
  const file = await fromFile(path);
  try {
    const image = await file.getImage(), keys = image.getGeoKeys();
    if (!keys) throw new Error("Missing observed GeoTIFF source keys");
    const origin = image.getOrigin(), resolution = image.getResolution();
    const { samples, alphaBand, sampleBytes, grid } = policy;
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
        image.getSamplesPerPixel() !== 4 || image.getGDALNoData() !== policy.noData ||
        [0, 1, 2, 3].some(b => image.getSampleFormat(b) !== 1 || image.getSampleByteSize(b) !== sampleBytes) ||
        keys.GTRasterTypeGeoKey !== 1 || keys.ProjCoordTransGeoKey !== 17 ||
        keys.ProjCenterLongGeoKey !== policy.centerLongitude || keys.ProjCenterLatGeoKey !== 0 || keys.ProjStdParallel1GeoKey !== 0 ||
        keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
        keys.GeogSemiMinorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
        resolution[0] !== policy.resolutionMeters || resolution[1] !== -policy.resolutionMeters ||
        origin[0] !== policy.origin[0] || origin[1] !== policy.origin[1] ||
        Math.abs(grid.pixelsPerDegree - entry.projection.referenceRadiusMeters * Math.PI / 180 / resolution[0]) > 1e-10 ||
        grid.sampleOffset !== -origin[0] / resolution[0] - .5 || grid.lineOffset !== origin[1] / resolution[0] - .5) {
      throw new Error(`RGB band observation grid changed: ${path}`);
    }
    const bands = numericRasterBands(await image.readRasters({ samples: [...samples, alphaBand] }));
    const count = entry.width * entry.height, maximum = 2 ** (8 * sampleBytes) - 1;
    const rgb = Buffer.alloc(count * 3), alpha = Buffer.alloc(count);
    for (let i = 0; i < count; i++) {
      // Source validity is evaluated before reducing 16-bit display codes to bytes.
      alpha[i] = bands[3][i] === maximum && samples.some((_, c) => bands[c][i] !== policy.noData) ? 255 : 0;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(bands[c][i] * 255 / maximum);
    }
    return await prepareProjectedByteObservation(rgb, entry, policy, width, height,
      { raw: { width: entry.width, height: entry.height, channels: 3 } }, alpha);
  } finally { await file.close(); }
}

/** Scalar observations keep native georeferencing, validity and display range. */
export async function prepareFloatObservation(path: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parseFloatObservationPolicy(value);
  const file = await fromFile(path);
  try {
    const image = await file.getImage(), keys = image.getGeoKeys();
    if (!keys) throw new Error("Missing observed GeoTIFF source keys");
    const origin = image.getOrigin(), resolution = image.getResolution();
    const geographic = policy.coordinates === 'degrees';
    const projectionMatches = geographic ? keys.GTModelTypeGeoKey === 2 && keys.GeogAngularUnitsGeoKey === 9102
      : keys.ProjCenterLongGeoKey === policy.centerLongitude && keys.ProjStdParallel1GeoKey === 0 && keys.ProjCenterLatGeoKey === 0;
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
        image.getSamplesPerPixel() !== 1 || image.getSampleFormat(0) !== (policy.kind === 'geotiff-byte-monochrome' ? 1 : 3) ||
        image.getSampleByteSize(0) !== (policy.kind === 'geotiff-byte-monochrome' ? 1 : policy.sampleBytes ?? 4) ||
        image.getGDALNoData() !== policy.noData || !projectionMatches ||
        keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
        resolution[0] !== (geographic ? policy.resolutionDegrees : policy.resolutionMeters) || resolution[1] !== -resolution[0] ||
        origin[0] !== policy.origin[0] || origin[1] !== policy.origin[1]) {
      throw new Error(`Float observation grid changed: ${path}`);
    }
    const [data] = numericRasterBands(await image.readRasters());
    const band = {data, width: entry.width, height: entry.height, origin, resolution,
      noData: policy.noData, specialValueMagnitude: policy.specialValueMagnitude};
    const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
    const radius = entry.projection.referenceRadiusMeters, [low, high] = policy.displayRange;
    for (let y = 0; y < height; y++) {
      const latitude = 90 - (y + 0.5) / height * 180;
      const northing = geographic ? latitude : latitude * Math.PI / 180 * radius;
      for (let x = 0; x < width; x++) {
        let deltaLongitude = (x + 0.5) / width * 360 - policy.centerLongitude;
        if (policy.wrapLongitude) deltaLongitude = ((deltaLongitude + 180) % 360 + 360) % 360 - 180;
        const easting = geographic ? deltaLongitude : deltaLongitude * Math.PI / 180 * radius;
        const value = sampleColorBand(band, easting, northing), i = y * width + x;
        if (value === null) { missing[i] = 1; continue; }
        const gray = Math.round(255 * Math.max(0, Math.min(1, (value - low) / (high - low))));
        rgb.fill(gray, i * 3, i * 3 + 3);
      }
    }
    return {rgb, missing, sourceGeoreference: {origin, resolution}};
  } finally { await file.close(); }
}

/** Explicit no-data and source-documented synthetic sectors, never darkness. */
export function observationPixelMissing(rgb: readonly number[],longitude: number,latitude: number,policy: PixelValidityPolicy) {
  const noData=policy.zeroValidity==='any-channel'?rgb.some(value=>value===policy.noData):rgb.every(value=>value===policy.noData);
  return noData || (policy.withholdLatitudeDegrees!==undefined&&Math.abs(latitude)>=policy.withholdLatitudeDegrees) ||
    (policy.withholdLongitudeDegrees!==undefined&&longitude>=policy.withholdLongitudeDegrees[0]&&longitude<=policy.withholdLongitudeDegrees[1]);
}

/** Map canonical output centres through the actual projected source grid.
 * Bilinear interpolation requires every nonzero-weight native contributor;
 * nearest sampling retains the containing source pixel-area value and mask.
 * Neither policy stretches the source extent or fills missing observations. A source declared
 * to wrap longitude interpolates across its edge meridian instead of leaving that column missing. */
export function resampleGeoreferencedObservation(source: RasterResult, sourceEntry: unknown, value: unknown, {origin, resolution}: {origin:number[];resolution:number[]}, width: number, height: number) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parseMaskedObservationPolicy(value);
  const {data, info} = source, channels = info.channels;
  const nearest = policy.resampling === 'source-georeferenced-nearest';
  const radius = entry.projection.referenceRadiusMeters;
  if (![width,height,info.width,info.height].every(n => Number.isSafeInteger(n) && n > 0) ||
      info.width !== entry.width || info.height !== entry.height || ![1,3].includes(channels) ||
      data.length !== info.width * info.height * channels || !(radius > 0) || !Number.isFinite(radius) ||
      !Number.isFinite(policy.centerLongitude) || !isArray(origin) || origin.length < 2 || !origin.slice(0,2).every(Number.isFinite) ||
      !isArray(resolution) || resolution.length < 2 || !resolution.slice(0,2).every(Number.isFinite) || !(resolution[0] > 0) || !(resolution[1] < 0)) {
    throw new TypeError('Georeferenced observation requires finite source pixel-area geometry.');
  }
  const radiansToMeters = radius * Math.PI / 180;
  const wrap = policy.wrapLongitude === true;
  if (wrap) requireWrappedLongitudeSpan(info.width, resolution[0], radiansToMeters);
  const column = (x: number) => wrap ? (x % info.width + info.width) % info.width : x;
  const valid = new Uint8Array(info.width * info.height), pixel = [0,0,0];
  let withheldSyntheticPixels = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = y * info.width + x, offset = i * channels;
    const longitude = policy.centerLongitude + (origin[0] + (x + .5) * resolution[0]) / radiansToMeters;
    const latitude = (origin[1] + (y + .5) * resolution[1]) / radiansToMeters;
    pixel[0] = data[offset]; pixel[1] = data[offset + (channels === 1 ? 0 : 1)]; pixel[2] = data[offset + (channels === 1 ? 0 : 2)];
    valid[i] = observationPixelMissing(pixel, longitude, latitude, policy) ? 0 : 1;
    if (policy.withholdLongitudeDegrees && longitude >= policy.withholdLongitudeDegrees[0] && longitude <= policy.withholdLongitudeDegrees[1]) withheldSyntheticPixels++;
  }
  // The tolerance only removes arithmetic roundoff at a source centre/boundary;
  // it scales with IEEE-754 precision, not any fraction of an output pixel.
  const tolerance = 32 * Number.EPSILON * Math.max(info.width, info.height);
  const stable = (n: number) => Math.abs(n - Math.round(n)) <= tolerance ? Math.round(n) : n;
  const sourceMiddleLongitude = policy.centerLongitude + (origin[0] + info.width * resolution[0] / 2) / radiansToMeters;
  const sourceX = Float64Array.from({length: width}, (_, x) => {
    const longitude = (x + .5) / width * 360;
    const equivalent = longitude + 360 * Math.round((sourceMiddleLongitude - longitude) / 360);
    return stable(((equivalent - policy.centerLongitude) * radiansToMeters - origin[0]) / resolution[0] - .5);
  });
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  for (let y = 0; y < height; y++) {
    const latitude = 90 - (y + .5) / height * 180;
    const sy = stable((latitude * radiansToMeters - origin[1]) / resolution[1] - .5);
    const areaY = stable(sy + .5);
    if (nearest ? areaY < 0 || areaY >= info.height : sy < 0 || sy > info.height - 1) continue;
    const y0 = Math.floor(sy), fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = sourceX[x];
      if (nearest) {
        const areaX = stable(sx + .5);
        if (!wrap && (areaX < 0 || areaX >= info.width)) continue;
        const cell = Math.floor(areaY) * info.width + column(Math.floor(areaX));
        if (!valid[cell]) continue;
        const index = y * width + x, offset = cell * channels;
        rgb[index * 3] = data[offset];
        rgb[index * 3 + 1] = data[offset + (channels === 1 ? 0 : 1)];
        rgb[index * 3 + 2] = data[offset + (channels === 1 ? 0 : 2)];
        missing[index] = 0;
        continue;
      }
      if (!wrap && (sx < 0 || sx > info.width - 1)) continue;
      const x0 = Math.floor(sx), fx = sx - x0, index = y * width + x;
      let red = 0, green = 0, blue = 0, supported = true;
      for (let dy = 0; dy < 2 && supported; dy++) for (let dx = 0; dx < 2; dx++) {
        const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
        if (weight === 0) continue;
        const cell = (y0 + dy) * info.width + column(x0 + dx);
        if (!valid[cell]) { supported = false; break; }
        const offset = cell * channels;
        red += data[offset] * weight;
        green += data[offset + (channels === 1 ? 0 : 1)] * weight;
        blue += data[offset + (channels === 1 ? 0 : 2)] * weight;
      }
      if (supported) {
        rgb[index * 3] = Math.round(red); rgb[index * 3 + 1] = Math.round(green); rgb[index * 3 + 2] = Math.round(blue);
        missing[index] = 0;
      }
    }
  }
  return {rgb, missing, sourceGeoreference: {origin,resolution}, withheldSyntheticPixels};
}

export async function prepareMaskedObservation(path: string,sourceEntry: unknown,value: unknown,width: number,height: number) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parseMaskedObservationPolicy(value);
  const tiff=await fromFile(path);let origin,resolution;
  try {
    const image=await tiff.getImage(),keys=image.getGeoKeys();if(!keys)throw new Error("Missing observed GeoTIFF keys");origin=image.getOrigin();resolution=image.getResolution();
    if (['source-georeferenced-bilinear','source-georeferenced-nearest'].includes(policy.resampling ?? "") && keys.GTRasterTypeGeoKey !== 1) throw new Error('Georeferenced observations require PixelIsArea coordinates.');
    if(image.getWidth()!==entry.width||image.getHeight()!==entry.height||image.getGDALNoData()!==policy.noData||
       resolution[0]<=0||resolution[1]>=0||keys.ProjCenterLongGeoKey!==policy.centerLongitude||
       Math.abs(number(keys.GeogSemiMajorAxisGeoKey)-entry.projection.referenceRadiusMeters)>0.01||
       (policy.resolutionMeters!==undefined&&(resolution[0]!==policy.resolutionMeters||resolution[1]!==-policy.resolutionMeters)))throw new Error(`Observed grid mapping drifted: ${path}`);
  }finally{await tiff.close()}
  const pipeline=sharp(path).removeAlpha();
  if(policy.channels==='monochrome')pipeline.greyscale();
  if(policy.colorSpace)pipeline.toColourspace(policy.colorSpace);
  const source=await pipeline.raw().toBuffer({resolveWithObject:true}),channels=source.info.channels;
  if(channels!==(policy.channels==='monochrome'?1:3))throw new Error(`Observed band count drifted: ${path}`);
  if (['source-georeferenced-bilinear','source-georeferenced-nearest'].includes(policy.resampling ?? "")) return resampleGeoreferencedObservation(source,entry,policy,{origin,resolution},width,height);
  const rgba=Buffer.alloc(entry.width*entry.height*4),radius=entry.projection.referenceRadiusMeters;
  let withheldSyntheticPixels=0;
  for(let y=0;y<entry.height;y++)for(let x=0;x<entry.width;x++){
    const i=y*entry.width+x,red=source.data[i*channels],green=source.data[i*channels+(channels===1?0:1)],blue=source.data[i*channels+(channels===1?0:2)];
    const longitude=policy.centerLongitude+(origin[0]+(x+.5)*resolution[0])/radius*180/Math.PI;
    const latitude=(origin[1]+(y+.5)*resolution[1])/radius*180/Math.PI;
    if(policy.withholdLongitudeDegrees&&longitude>=policy.withholdLongitudeDegrees[0]&&longitude<=policy.withholdLongitudeDegrees[1])withheldSyntheticPixels++;
    rgba.set([red,green,blue,observationPixelMissing([red,green,blue],longitude,latitude,policy)?0:255],i*4);
  }
  const data=await sharp(rgba,{raw:{width:entry.width,height:entry.height,channels:4}}).resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();
  // A global map can begin at a different meridian from projection center minus 180.
  // Use the GeoTIFF origin, including floating-point noise in its projected coordinates.
  const firstLongitude=policy.centerLongitude+origin[0]/radius*180/Math.PI;
  const exactRoll=-firstLongitude/360*width,roll=Math.round(exactRoll);
  if(Math.abs(exactRoll-roll)>1e-6)throw new Error('Observed longitude roll must align with prepared texels.');
  const rgb=Buffer.alloc(width*height*3),missing=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,j=y*width+(x+roll+width)%width;rgb.set(data.subarray(j*4,j*4+3),i*3);missing[i]=data[j*4+3]<255?1:0}
  return {rgb,missing,sourceGeoreference:{origin,resolution},withheldSyntheticPixels};
}

/** Mapped numeric observations use the same geographic sampling as elevation. */
export async function prepareIsisObservation(path: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseDimensions(sourceEntry),policy=parseIsisObservationPolicy(value);
  if (entry.width !== policy.grid.width || entry.height !== policy.grid.height) {
    throw new Error(`Observed ISIS3 dimensions changed: ${path}`);
  }
  const source = await loadScienceSurface('.', {path, format:'isis3', grid:policy.grid, sampling:'bilinear'});
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const [low, high] = policy.displayRange;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = source.sample((x + .5) / width * 360, 90 - (y + .5) / height * 180);
    const i = y * width + x;
    if (value === null) { missing[i] = 1; continue; }
    const gray = Math.round(255 * Math.max(0, Math.min(1, (value - low) / (high - low))));
    rgb.fill(gray, i * 3, i * 3 + 3);
  }
  return {rgb, missing, sourceGeoreference:{origin:policy.grid.origin,
    resolution:[policy.grid.resolutionMeters, -policy.grid.resolutionMeters]}};
}
