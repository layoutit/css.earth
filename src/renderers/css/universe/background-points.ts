import { mountGalaxyPoints } from './galaxy-points.js';
import type { PreparedVolumeRuntime, VolumeCameraPublication } from '../volume/types.js';
/** Distant field persists across focus scales; individual objects own proximity fading. */
export function mountBackgroundPoints(host: HTMLElement, before: Element, manifestUrl?: string, cloudUrl?: string, sha256?: string) {
  const root = host.ownerDocument.createElement('div');
  root.dataset.galaxyField='points';root.style.cssText='position:absolute;inset:0;pointer-events:none;display:none';
  if(manifestUrl)host.insertBefore(root,before);
  let runtime: PreparedVolumeRuntime | undefined, pending=false, disposed=false;
  let latest: VolumeCameraPublication | undefined;
  return {publish(publication: VolumeCameraPublication){
    if(!manifestUrl||disposed)return;
    latest=publication;
    root.style.opacity='1';root.style.display='block';
    if(runtime){runtime.publish(publication);return;}
    if(pending)return;pending=true;
    void mountGalaxyPoints({host:root,manifestUrl,cloudUrl,sha256}).then(result=>{
      if(disposed){result.destroy();return;}runtime=result;if(latest)runtime.publish(latest);root.dataset.ready='true';
    }).catch(error=>{root.dataset.error=String(error);console.error('Galaxy field failed',error);});
  },destroy(){disposed=true;runtime?.destroy();root.remove();}};
}
