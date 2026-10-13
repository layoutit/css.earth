/** Serialize the site's retained slab renderer at export time. */
import { parseHTML } from 'linkedom';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import type { PreparedCssVolume } from '@cssearth/objects';
import { mountPreparedCssVolume } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';

import { COMPOSITE_VOLUME_PLANNED } from './html-limits.mts';

export function volumeMarkup(payload: PreparedCssVolume, resolveResource: (path: string) => string): string {
  if(payload.sky||payload.impostors)throw new TypeError(COMPOSITE_VOLUME_PLANNED);
  const { document } = parseHTML('<!doctype html><html><body><div class="scene-board"><i></i></div></body></html>');
  const host = document.querySelector<HTMLElement>('.scene-board')!, before = host.querySelector('i')!;
  const { min,max }=payload.frame.boundsUnits;
  const radius=Math.hypot(max[0]-min[0],max[1]-min[1],max[2]-min[2])/2;
  const center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2] as const;
  const distance=radius*4;
  const pose=cameraPoseToReferenceFrame({positionM:[center[0]*payload.frame.metersPerUnit,center[1]*payload.frame.metersPerUnit,(center[2]+distance)*payload.frame.metersPerUnit],orientationXyzw:[0,0,0,1]},payload.frame);
  const renderer=mountPreparedCssVolume({host,before,payload,resolveResource});
  renderer.publish({world:{referenceFrame:payload.frame.referenceFrame,epochJdTt:payload.frame.epochJdTt,pose},viewport:{focalPixels:866.0254,widthPixels:1000,heightPixels:700,principalOffsetPixels:[0,0]}});
  // Serialize only resident, visible slices/copies. The browser mounts no inactive stacks.
  for (const node of [...host.querySelectorAll<HTMLElement>('[style]')]) {
    if (node.style.display==='none'||node.style.visibility==='hidden'||node.style.opacity==='0') node.remove();
  }
  before.remove();
  if (!host.querySelector('.css-volume-mesh s')) throw new TypeError('The prepared volume has no visible slices from its bounds view.');
  return `<div class="viewer">${host.outerHTML}</div>`;
}
