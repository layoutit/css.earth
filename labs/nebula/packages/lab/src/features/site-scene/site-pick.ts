/**
 * Annotate's pick layer: the shown bank's leaves, mounted by the site's own renderer (inspection-renderer.ts binds
 * `mountPreparedCssVolume` and `mountPreparedCssImageLayers`) under a fully transparent root and published with the page's
 * camera, so each leaf's box lies exactly over the leaf the page draws. It draws nothing: its slices carry a one-pixel
 * transparent image whose link names the real texture, read only for Annotate's alpha test. It exists only while
 * Annotate is on, and the browser's own projection gives every hit and every corner.
 */
import type { PreparedCssImageLayers, PreparedCssVolume } from '@cssearth/objects';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import { mountInspectionScene } from '@cssearth/volume-viewer/scene/inspection-banks';
import { inspectionRenderer } from '../../adapters/viewer/inspection-renderer';
import { settleImageBank } from '../legacy-viewer/bank-selection';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
/** A pick slice's background: the transparent pixel, with the real texture's link after `#`. */
export const pickTextureUrl = (url: string) => `${TRANSPARENT_PIXEL}#${encodeURIComponent(url)}`;
/** The real texture a pick slice's background names, or the background itself for any other slice. */
export function pickedTexture(background: string): string {
  if (!background.startsWith(TRANSPARENT_PIXEL)) return background;
  const hash = background.indexOf('#');
  return hash < 0 ? '' : decodeURIComponent(background.slice(hash + 1));
}

export function mountSitePick({ host, payload, resolve }: { host: HTMLElement; payload: PreparedCssVolume | PreparedCssImageLayers; resolve(path: string): string }) {
  const root = host.ownerDocument.createElement('div');
  root.className = 'site-pick-layer'; root.dataset.sitePick = payload.id;
  root.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none';
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end); host.append(root);
  const isImage = 'bankViews' in payload;
  const scene = mountInspectionScene({ backend: inspectionRenderer(isImage), host: root, before: end, payload,
    resolveResource: path => pickTextureUrl(resolve(path)), composite: false, overlays: false });
  let last: VolumeCameraPublication | null = null, destroyed = false;
  const publish = (publication: VolumeCameraPublication | null = last) => { if (publication && !destroyed) { last = publication; scene.publish(publication); } };
  if (isImage) settleImageBank(root, () => publish(), () => !destroyed);
  return { root, banks: scene.banks, publish,
    destroy() { if (destroyed) return; destroyed = true; scene.destroy(); root.remove(); } };
}
export type SitePick = ReturnType<typeof mountSitePick>;
