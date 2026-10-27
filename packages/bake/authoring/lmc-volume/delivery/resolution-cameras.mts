/** Physical pixel pitch is fixed by the registered observation; crops never resize a finished image. */
import {outsideCamera,type Camera} from '../render.mts';
import {loadObservation} from '../observation.mts';
import {need} from '../inputs.mts';
import type {V3} from '../geometry.mts';
import {versionDir} from '../sequence-state.mts';
export const RESOLUTION_DIR=versionDir(36)+'delivery/resolution/';

export async function equalScale(){const o=await loadObservation(16),b=o.metadata.registration.tangentBoundsKpc;return{observation:o,widthKpc:b.max[0]-b.min[0],heightKpc:b.max[1]-b.min[1],pcPerPixel:(b.max[0]-b.min[0])*1000/o.width};}
export function cropCamera(camera:Camera,left:number,top:number,width:number,height:number):Camera {
 need([left,top,width,height].every(Number.isSafeInteger)&&left>=0&&top>=0&&width>0&&height>0&&left+width<=camera.width&&top+height<=camera.height,'Invalid physical camera crop');
 return{...camera,name:camera.name+`-crop-${left}-${top}-${width}-${height}`,width,height,ray:(x,y)=>camera.ray(x+left,y+top),pixelOf:camera.pixelOf?(p:V3)=>{const q=camera.pixelOf!(p);return q?[q[0]-left,q[1]-top]:null;}:undefined};
}
export function equalOutside(tilt:number,size:number,widthKpc:number){return outsideCamera(tilt,size,widthKpc/2);}
