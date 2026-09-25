export { registeredImageSampler, registeredScalarSampler } from '@cssearth/bake/volume';
/** Offline color sampling and original-image reference plane in the fixed cloud frame. */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { ObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import type { ObservationPhoto } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { prepareOverlayGeometry } from '../../../adapters/renderer/overlay-geometry.ts';
import { sha256 } from '@cssearth/core/node';

export async function writeOriginalOverlay(directory:string,photo:ObservationPhoto,mapping:ObservationMapping,
  frame:DensityVolumeFrame,source:{id:string;sourcePageUrl:string;credit:string}) {
  const rgba=Buffer.alloc(photo.width*photo.height*4),{min,max}=mapping.boundsUnits;
  for(let y=0;y<photo.height;y++)for(let x=0;x<photo.width;x++) {
    const at=y*photo.width+x;
    const covered=mapping.uvAtTangent(min[0]+(x+.5)/photo.width*(max[0]-min[0]),max[1]-(y+.5)/photo.height*(max[1]-min[1]));
    // Coverage is geometric and, for a source that declares one, its own mask: masked pixels stay unobserved.
    if(covered&&(photo.sourceCoverage===undefined||photo.sourceCoverage[at]===1)) {rgba.set(photo.rgb.subarray(at*3,at*3+3),at*4);rgba[at*4+3]=255;}
  }
  const bytes=await sharp(rgba,{raw:{width:photo.width,height:photo.height,channels:4}}).png().toBuffer();
  await writeFile(resolve(directory,'source/original-image.png'),bytes);
  const geometry=prepareOverlayGeometry([[min[0],max[1],0],[max[0],max[1],0],[max[0],min[1],0],[min[0],min[1],0]],photo.width,photo.height);
  const overlay={id:source.id,label:'Original image',texturePath:'original-image.png',widthPx:photo.width,heightPx:photo.height,
    sha256:sha256(bytes),bytes:bytes.length,pivotCssPx:[0,0,0],sourcePageUrl:source.sourcePageUrl,credit:source.credit,
    registrationNote:'Original source with stars, in the exact fixed-cloud registration used for material sampling.',
    style:{width:`${photo.width}px`,height:`${photo.height}px`,transform:`matrix3d(${geometry.matrix})`,
      backgroundSize:`${photo.width}px ${photo.height}px`,backgroundPosition:'0px 0px'}};
  await writeFile(resolve(directory,'source/original-overlay.json'),JSON.stringify({schema:'cssearth-nebula-overlays@1',frame,
    referenceDistanceUnits:mapping.distanceUnits,overlays:[overlay]},null,2)+'\n');
  return 'source/original-overlay.json';
}
