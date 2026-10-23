/** Export-time adapter of a verified point field to the site's SVG point layer. */
import { parseHTML } from 'linkedom';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import type { PreparedCssPointField } from '@cssearth/objects';
import { mountBatchedSpatialPoints, pointPaint } from '@cssearth/renderer/universe/points/batched-spatial-points.ts';
import { pointPhotometry, pointLuminanceVisible } from '@cssearth/renderer/stars/point-field-projection.ts';

export function pointsMarkup(payload: PreparedCssPointField): string {
  const {document}=parseHTML('<!doctype html><html><body><div class="scene-board"></div></body></html>');
  const host=document.querySelector<HTMLElement>('.scene-board')!;
  // A photometric point field is a sky seen from its frame origin. Its bounds
  // enclose catalogue positions, not a surface to frame from outside: that
  // distant view dims the stars to the coverage-anchor floor.
  const eye=[0,0,0] as const;
  // Prepared atlas colors and exposure samples become a fixed paint palette for this fixed view.
  const styles=new Map(payload.stars.map(star=>{
    const distance=Math.hypot(...star.positionUnits.map((value,index)=>value-eye[index]));
    const light=pointPhotometry(payload,star.absoluteMagnitude,distance,star.coverageAnchor);
    const rgb=payload.atlas.colors[star.colorIndex];
    if(!rgb)throw new TypeError('Point color is absent from its prepared palette.');
    return [star,{colorCss:'#'+rgb.map(channel=>channel.toString(16).padStart(2,'0')).join(''),
      radiusPx:light.radiusPx,opacity:pointLuminanceVisible(light.luminance,star.coverageAnchor)?Math.min(1,light.luminance):0}] as const;
  }));
  const renderer=mountBatchedSpatialPoints({host,frame:payload.frame,points:payload.stars,className:'standalone-points',
    stylePoint:star=>styles.get(star)!,paintPalette:[...new Set([...styles.values()].map(pointPaint))]});
  const pose=cameraPoseToReferenceFrame({positionM:[eye[0]*payload.frame.metersPerUnit,eye[1]*payload.frame.metersPerUnit,eye[2]*payload.frame.metersPerUnit],orientationXyzw:[0,0,0,1]},payload.frame);
  renderer.publish({world:{referenceFrame:payload.frame.referenceFrame,epochJdTt:payload.frame.epochJdTt,pose},
    viewport:{focalPixels:866.0254,widthPixels:1000,heightPixels:700,principalOffsetPixels:[0,0]}});
  if(!renderer.stats().visiblePoints)throw new TypeError('The prepared point field has no visible points from its origin view.');
  const svg=host.querySelector('svg')!;
  svg.setAttribute('viewBox','0 0 1000 700');
  // Empty palette paths draw nothing and have no place in a static export.
  for(const path of [...svg.querySelectorAll('path')])if(!path.getAttribute('d'))path.remove();
  const markup=`<div class="viewer">${host.outerHTML}</div>`;
  renderer.destroy();
  return markup;
}
