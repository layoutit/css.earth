import sharp from 'sharp';
import {fromFile} from 'geotiff';
import {sampleColorBand, loadScienceSurface} from './scientific-raster.mjs';

/** Scalar observations keep native georeferencing, validity and display range. */
export async function prepareFloatObservation(path, entry, policy, width, height) {
  const file = await fromFile(path);
  try {
    const image = await file.getImage(), keys = image.getGeoKeys();
    const origin = image.getOrigin(), resolution = image.getResolution();
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
        image.getSamplesPerPixel() !== 1 || image.getSampleFormat(0) !== (policy.kind === 'geotiff-byte-monochrome' ? 1 : 3) ||
        image.getSampleByteSize(0) !== (policy.kind === 'geotiff-byte-monochrome' ? 1 : 4) ||
        image.getGDALNoData() !== policy.noData || keys.ProjCenterLongGeoKey !== policy.centerLongitude ||
        keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters || keys.ProjStdParallel1GeoKey !== 0 ||
        keys.ProjCenterLatGeoKey !== 0 || resolution[0] !== policy.resolutionMeters || resolution[1] !== -policy.resolutionMeters ||
        origin[0] !== policy.origin[0] || origin[1] !== policy.origin[1]) {
      throw new Error(`Float observation grid changed: ${entry.id}`);
    }
    const [data] = await image.readRasters();
    const band = {data, width: entry.width, height: entry.height, origin, resolution,
      noData: policy.noData, specialValueMagnitude: policy.specialValueMagnitude};
    const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
    const radius = entry.projection.referenceRadiusMeters, [low, high] = policy.displayRange;
    for (let y = 0; y < height; y++) {
      const northing = (90 - (y + 0.5) / height * 180) * Math.PI / 180 * radius;
      for (let x = 0; x < width; x++) {
        let deltaLongitude = (x + 0.5) / width * 360 - policy.centerLongitude;
        if (policy.wrapLongitude) deltaLongitude = ((deltaLongitude + 180) % 360 + 360) % 360 - 180;
        const easting = deltaLongitude * Math.PI / 180 * radius;
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
export function observationPixelMissing(rgb,longitude,latitude,policy) {
  const noData=policy.zeroValidity==='any-channel'?rgb.some(value=>value===policy.noData):rgb.every(value=>value===policy.noData);
  return noData || (policy.withholdLatitudeDegrees!==undefined&&Math.abs(latitude)>=policy.withholdLatitudeDegrees) ||
    (policy.withholdLongitudeDegrees!==undefined&&longitude>=policy.withholdLongitudeDegrees[0]&&longitude<=policy.withholdLongitudeDegrees[1]);
}

export async function prepareMaskedObservation(path,entry,policy,width,height) {
  const tiff=await fromFile(path);let origin,resolution;
  try {
    const image=await tiff.getImage(),keys=image.getGeoKeys();origin=image.getOrigin();resolution=image.getResolution();
    if(image.getWidth()!==entry.width||image.getHeight()!==entry.height||image.getGDALNoData()!==policy.noData||
       resolution[0]<=0||resolution[1]>=0||keys.ProjCenterLongGeoKey!==policy.centerLongitude||
       Math.abs(keys.GeogSemiMajorAxisGeoKey-entry.projection.referenceRadiusMeters)>0.01||
       (policy.resolutionMeters!==undefined&&(resolution[0]!==policy.resolutionMeters||resolution[1]!==-policy.resolutionMeters)))throw new Error(`Observed grid mapping drifted: ${entry.id}`);
  }finally{await tiff.close()}
  const pipeline=sharp(path).removeAlpha();
  if(policy.channels==='monochrome')pipeline.greyscale();
  if(policy.colorSpace)pipeline.toColourspace(policy.colorSpace);
  const source=await pipeline.raw().toBuffer({resolveWithObject:true}),channels=source.info.channels;
  if(channels!==(policy.channels==='monochrome'?1:3))throw new Error(`Observed band count drifted: ${entry.id}`);
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
export async function prepareIsisObservation(path, entry, policy, width, height) {
  if (entry.width !== policy.grid.width || entry.height !== policy.grid.height) {
    throw new Error(`Observed ISIS3 dimensions changed: ${entry.id}`);
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
