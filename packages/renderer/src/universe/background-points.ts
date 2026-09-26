import { mountGalaxyPoints } from './galaxy-points.js';
import type { PreparedVolumeRuntime, VolumeCameraPublication } from '../volume/types.js';
const PARSEC_M = 3.085677581491367e16;
/** Keep the distant population at Local Group scale; remove it around the Milky Way. */
export function backgroundPointsOpacity(distanceM: number): number {
  const near = 200_000 * PARSEC_M, far = 500_000 * PARSEC_M;
  if (!(distanceM > near)) return 0;
  if (distanceM >= far) return 1;
  const t = Math.log(distanceM / near) / Math.log(far / near);
  return t * t * (3 - 2 * t);
}
export function mountBackgroundPoints(host: HTMLElement, before: Element, manifestUrl?: string, cloudUrl?: string) {
  const root = host.ownerDocument.createElement('div');
  root.dataset.galaxyField='points';root.style.cssText='position:absolute;inset:0;pointer-events:none;display:none';
  if(manifestUrl)host.insertBefore(root,before);
  let runtime: PreparedVolumeRuntime | undefined, pending=false, disposed=false;
  let latest: VolumeCameraPublication | undefined;
  return {publish(publication: VolumeCameraPublication, distanceM: number){
    if(!manifestUrl||disposed)return;
    latest=publication;
    const opacity = backgroundPointsOpacity(distanceM);
    const display = opacity > 0 ? 'block' : 'none';
    if (root.style.opacity !== String(opacity)) root.style.opacity = String(opacity);
    if (root.style.display !== display) root.style.display = display;
    if (opacity === 0) return;
    if(runtime){runtime.publish(publication);return;}
    if(pending)return;pending=true;
    void mountGalaxyPoints({host:root,manifestUrl,cloudUrl}).then(result=>{
      if(disposed){result.destroy();return;}runtime=result;if(latest && root.style.display !== 'none')runtime.publish(latest);root.dataset.ready='true';
    }).catch(error=>{root.dataset.error=String(error);console.error('Galaxy field failed',error);});
  },destroy(){disposed=true;runtime?.destroy();root.remove();}};
}
