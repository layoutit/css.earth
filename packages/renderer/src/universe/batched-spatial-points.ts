import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';

export interface BatchedSpatialPoint { readonly positionUnits: VolumeVector }
export interface BatchedSpatialPointStyle { readonly colorCss: string; readonly opacity: number; readonly radiusPx: number }

/** Project a bounded 3D field through eight retained CSS nodes. Each node carries a
 * batch of circular box shadows, so camera motion changes paint but never DOM shape. */
export function mountBatchedSpatialPoints<T extends BatchedSpatialPoint>({ host, before, frame, points, className, stylePoint }: {
  host: HTMLElement; before?: Element; frame: DensityVolumeFrame; points: readonly T[]; className: string;
  stylePoint(point: T, distanceUnits: number): BatchedSpatialPointStyle | null;
}) {
  const root = host.ownerDocument.createElement('div'); root.className = className; root.ariaHidden = 'true';
  Object.assign(root.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none'});
  const nodes = Array.from({length:8},()=>{const node=host.ownerDocument.createElement('i');
    Object.assign(node.style,{position:'absolute',left:'50%',top:'50%',width:'1px',height:'1px',borderRadius:'50%',background:'transparent',pointerEvents:'none'});
    root.append(node);return node;});
  if (before) host.insertBefore(root, before); else host.append(root);
  let previousCamera: number[] = [], destroyed = false;
  let last={visiblePoints:0,residentElements:nodes.length+1,publishMs:0};
  const publish = ({world,viewport}: VolumeCameraPublication) => {
    if (destroyed) return;
    const started=performance.now();
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const camera=[...local.positionUnits,...local.orientationXyzw,viewport.focalPixels,...viewport.principalOffsetPixels,viewport.widthPixels??0,viewport.heightPixels??0];
    if(camera.length===previousCamera.length && camera.every((value,i)=>value===previousCamera[i]))return;
    previousCamera=camera;
    let visible = 0;
    const shadows: string[][]=nodes.map(()=>[]);
    points.forEach((point,index)=>{
      const x=point.positionUnits[0]-local.positionUnits[0], y=point.positionUnits[1]-local.positionUnits[1], z=point.positionUnits[2]-local.positionUnits[2];
      const depth=-(r[2]!*x+r[5]!*y+r[8]!*z);
      if(depth<=0)return;
      const sx=viewport.focalPixels*(r[0]!*x+r[3]!*y+r[6]!*z)/depth+viewport.principalOffsetPixels[0];
      const sy=viewport.focalPixels*(r[1]!*x+r[4]!*y+r[7]!*z)/depth+viewport.principalOffsetPixels[1];
      const style=stylePoint(point,Math.hypot(x,y,z));
      if(!style || !(style.opacity>0) || !(style.radiusPx>0))return;
      const margin=Math.max(2,style.radiusPx);
      if(Math.abs(sx)>(viewport.widthPixels??Infinity)/2+margin || Math.abs(sy)>(viewport.heightPixels??Infinity)/2+margin)return;
      const opacity=Math.max(0,Math.min(255,Math.round(style.opacity*255))).toString(16).padStart(2,'0');
      const spread=Math.max(0,style.radiusPx-.5);
      shadows[index%nodes.length]!.push(`${(sx-.5).toFixed(3)}px ${(sy-.5).toFixed(3)}px 0 ${spread.toFixed(3)}px ${style.colorCss}${opacity}`);visible++;
    });
    nodes.forEach((node,index)=>{const shadow=shadows[index]!.join(',')||'none';if(node.style.boxShadow!==shadow)node.style.boxShadow=shadow;});
    // Counts for probes and tests, kept here: a per-frame dataset write is a DOM write (motion-freezes-membership.md).
    last={visiblePoints:visible,residentElements:nodes.length+1,publishMs:performance.now()-started};
  };
  return Object.freeze({root,nodes:Object.freeze(nodes),publish,stats:()=>Object.freeze({...last}),destroy(){if(destroyed)return;destroyed=true;root.remove();}});
}
