import { pointLuminanceVisible, pointPhotometry } from '../stars/point-field-projection.js';
import type { PreparedPointAppearance, PointFieldRgb } from '../stars/types.js';
import type { VolumeCameraPublication } from '../volume/types.js';
import { mountBatchedSpatialPoints } from './batched-spatial-points.js';

const colorCss = (rgb: PointFieldRgb) => `#${rgb.map(value=>value.toString(16).padStart(2,'0')).join('')}`;

export function stellarPointsOpacity(starsHandoff: number, completedVolumeContribution: number): number {
  return Math.max(0,Math.min(1,starsHandoff))*(1-Math.max(0,Math.min(1,completedVolumeContribution)));
}

export function mountStellarPoints({host,before,field}:{host:HTMLElement;before:Element;field:PreparedPointAppearance}) {
  if (!field.directPoints) return null;
  const runtime=mountBatchedSpatialPoints({host,before,frame:field.frame,points:field.directPoints.points,className:'stellar-direct-points',
    stylePoint(point,distanceUnits){
      const presentation=pointPhotometry(field,point.absoluteMagnitude,distanceUnits,point.coverageAnchor);
      if(!pointLuminanceVisible(presentation.luminance,point.coverageAnchor))return null;
      return {colorCss:colorCss(field.atlas.colors[point.colorIndex]!),opacity:presentation.luminance,radiusPx:presentation.radiusPx};
    }});
  runtime.root.dataset.catalogueCount=String(field.directPoints.catalogueCount);
  runtime.root.dataset.pointCount=String(field.directPoints.points.length);
  runtime.root.dataset.selection=field.directPoints.selection;
  runtime.root.style.display='none';
  return Object.freeze({root:runtime.root,publish(publication:VolumeCameraPublication,opacity:number){
    const alpha=Math.max(0,Math.min(1,opacity));
    runtime.root.style.opacity=String(alpha);runtime.root.style.display=alpha>0?'block':'none';
    if(alpha>0)runtime.publish(publication);
  },destroy:runtime.destroy});
}
