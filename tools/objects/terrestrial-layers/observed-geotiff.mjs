import sharp from 'sharp';
import {fromFile} from 'geotiff';

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
  const rgb=Buffer.alloc(width*height*3),missing=new Uint8Array(width*height),roll=(180-policy.centerLongitude)/360*width;
  if(!Number.isInteger(roll))throw new Error('Observed longitude roll must align with prepared texels.');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,j=y*width+(x+roll+width)%width;rgb.set(data.subarray(j*4,j*4+3),i*3);missing[i]=data[j*4+3]<255?1:0}
  return {rgb,missing,sourceGeoreference:{origin,resolution},withheldSyntheticPixels};
}
