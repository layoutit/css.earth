/** Fixed-camera tiles preserve camera rays. Only finite emission is culled; the full dust field stays intact. */
import { projectCatalogue, catalogueBasis } from '../catalogue-render.mts';import { gradedPrediction } from '../grade.mts';
import { intersectsSlab } from '../delivery/slab-source.mts';import type { approvedScene } from '../delivery/reference.mts';
import type { Camera } from '../render.mts';import type { GalaxySlabDomain } from '../../milky-way-dust/galaxy-slab-domain.mts';
import type { SpatialSelection } from './regions.mts';
export function projectPiece(source:Pick<Awaited<ReturnType<typeof approvedScene>>,'scene'|'grade'|'amplitudes'>,camera:Camera,domain?:GalaxySlabDomain,spatial?:SpatialSelection){
 const scene=domain?{...source.scene,objects:source.scene.objects.filter(o=>o.kind==='dust-tent'||intersectsSlab(o,domain))}:source.scene,rgb=new Float64Array(camera.width*camera.height*3),tau=new Float64Array(camera.width*camera.height);
 for(let top=0;top<camera.height;top+=64)for(let left=0;left<camera.width;left+=64){const width=Math.min(64,camera.width-left),height=Math.min(64,camera.height-top),p=projectCatalogue(scene,camera,.015,undefined,domain,{objectSubpixels:4,cacheFinishedDust:true,gaussianTailSigma:10,skipEmptyGaussianRuns:true,spatial,window:{left,top,width,height}}),part=gradedPrediction(catalogueBasis(p,scene,source.amplitudes),source.grade);
  for(let y=0;y<height;y++){rgb.set(part.subarray(y*width*3,(y+1)*width*3),((top+y)*camera.width+left)*3);if(p.transmittance)for(let x=0;x<width;x++)tau[(top+y)*camera.width+left+x]=-Math.log(Math.max(1e-30,Math.max(...p.transmittance.map(v=>v[y*width+x]!))));}
 }return{rgb,tau};
}
