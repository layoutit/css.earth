/**
 * The difference-map plane for the displayed image lens: the server's prepared PNG, mounted on the saved
 * result's own registered original-image quad so it lands pixel for pixel on the Earth view.
 *
 * The map compares the analytic front projection with the image as seen from Earth, so it is shown only while
 * the camera holds the Earth-facing pose; any orbit hides it and returning shows it again.
 */
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../../adapters/viewer/prepared-loaders';
import { loadRegisteredOverlay, mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay';

export interface DifferenceOverlayState {
  /** A baked image lens is displayed, so a map exists for it. */
  available: boolean; enabled: boolean;
  /** The camera holds the Earth-facing pose, the only pose the map describes. */
  earthFacing: boolean; opacity: number; loading: boolean;
}
export const differenceMapUrl = (resultId: string) =>
  `/__nebula/reconstruction-difference?resultId=${encodeURIComponent(resultId)}&format=png`;
/** The lens result id a registered reconstruction subject carries, when it is one. */
export const lensResultOf = (subjectId: string) => /^reconstruction-([a-f0-9]{64})$/.exec(subjectId)?.[1];

export function createDifferencePlane() {
  let plane: ReturnType<typeof mountReconstructionOverlay> | null = null, pending: Promise<void> | null = null;
  let enabled = false, opacity = .85, shown = false, objectUrl = '';
  return {
    get enabled() { return enabled; }, get opacity() { return opacity; }, get loading() { return Boolean(pending); },
    /** Turn the map on or off; mounts it once per displayed lens. `current` guards against a lens switching mid-load. */
    async set(next: boolean, nextOpacity: number, context?: { host: HTMLElement; before: Node; resultId: string | undefined;
      manifestPath: string | undefined; frame: DensityVolumeFrame; distanceUnits: number | undefined; url(path: string): string; current(): boolean }) {
      if (!(Number.isFinite(nextOpacity) && nextOpacity >= 0 && nextOpacity <= 1)) throw new TypeError('Difference map opacity must be between zero and one.');
      enabled = next; opacity = nextOpacity;
      if (!enabled) { plane?.setVisible(false, opacity); return; }
      if (!context?.resultId || !context.manifestPath) {
        enabled = false; throw new Error('The difference map needs a baked image lens with its registered original image.');
      }
      if (!plane && !pending) {
        const { resultId, manifestPath } = context;
        const load = (async () => {
          const { overlay } = await loadRegisteredOverlay(manifestPath, context.url, { frame: context.frame, distanceUnits: context.distanceUnits });
          // The route prepares the map per request, so hold the exact decoded bytes as a local object URL.
          const response = await fetch(differenceMapUrl(resultId));
          if (!response.ok) throw new Error(`The difference map could not be prepared for this lens (HTTP ${response.status}).`);
          const url = URL.createObjectURL(await response.blob()), image = new Image(); image.src = url;
          try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new Error('The difference map is not a readable image.'); }
          if (!context.current()) { URL.revokeObjectURL(url); return; }
          plane = mountReconstructionOverlay({ host: context.host, before: context.before, frame: context.frame, overlay, url, kind: 'difference' });
          plane.root.dataset.differenceResult = resultId; objectUrl = url;
          plane.setVisible(false, opacity); shown = false;
        })();
        pending = load;
        try { await load; } catch (failure) { if (context.current()) enabled = false; throw failure; }
        finally { if (pending === load) pending = null; }
      } else if (pending) await pending;
    },
    /** Follow the shared camera; visible only while enabled and Earth-facing. */
    publish(publication: VolumeCameraPublication, earthFacing: boolean) {
      if (!plane) return;
      plane.publish(publication);
      const visible = enabled && earthFacing;
      if (visible !== shown || visible) { plane.setVisible(visible, opacity); shown = visible; }
      plane.root.dataset.earthFacing = String(earthFacing);
    },
    /** The displayed lens changed: drop its plane; an enabled map remounts for the next lens. */
    clear() { plane?.destroy(); plane = null; pending = null; shown = false; if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = ''; },
  };
}
