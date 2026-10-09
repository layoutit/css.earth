/**
 * The difference-map plane for the displayed image dataset: the server's prepared PNG, mounted on the saved
 * result's own registered original-image quad so it lands pixel for pixel on the Earth view.
 *
 * The map compares the analytic front projection with the image as seen from Earth, so it is shown only while
 * the camera holds the Earth-facing pose; any orbit hides it and returning shows it again.
 */
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../../adapters/viewer/prepared-loaders';
import { loadPlateOverlay, loadRegisteredOverlay, loadVolumeOverlay, mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay';
import type { DensityOverlay } from './overlay-catalogue';

export interface DifferenceOverlayState {
  /** A baked image dataset is displayed, so a map exists for it. */
  available: boolean; enabled: boolean;
  /** The camera holds the Earth-facing pose, the only pose the map describes. */
  earthFacing: boolean; opacity: number; loading: boolean;
}
export const differenceMapUrl = (resultId: string) =>
  `/__nebula/reconstruction-difference?resultId=${encodeURIComponent(resultId)}&format=png`;
/** Where a map comes from: its PNG, and the registered original-image quad it is laid on. */
export interface DifferenceSource { id: string; mapUrl: string; overlay(): Promise<DensityOverlay> }
/** A saved lab dataset's map, on its saved original; or a site entry's (plate or volume dataset bank) photograph against
 * the bank's own far picture (`/__nebula/site-difference`), on the photograph the Original control lays. */
export function differenceSourceOf(subject: { id: string; reconstructionOverlay?: string; plates?: { object: string }; siteVolume?: { object: string } },
  context: { dataset: string; picture: string; frame: DensityVolumeFrame; distanceUnits: number | undefined; url(path: string): string }): DifferenceSource | undefined {
  const resultId = datasetResultOf(subject.id), manifestPath = subject.reconstructionOverlay;
  if (resultId && manifestPath) return { id: resultId, mapUrl: differenceMapUrl(resultId),
    overlay: async () => (await loadRegisteredOverlay(manifestPath, context.url, { frame: context.frame, distanceUnits: context.distanceUnits })).overlay };
  const picture = context.picture === 'starless' ? 'starless' : 'original', object = subject.plates?.object ?? subject.siteVolume?.object;
  if (!object) return undefined;
  const query = new URLSearchParams({ kind: subject.plates ? 'plates' : 'volume', object, dataset: subject.plates ? '' : context.dataset, picture, format: 'png' });
  return { id: `${object}:${context.dataset}:${picture}`, mapUrl: `/__nebula/site-difference?${query}`,
    overlay: async () => (subject.plates ? await loadPlateOverlay(object, picture, context.url, context.frame) : await loadVolumeOverlay(object, context.dataset, context.url, context.frame)).overlay };
}
/** The dataset result id a registered reconstruction subject carries, when it is one. */
export const datasetResultOf = (subjectId: string) => /^reconstruction-([a-z0-9][a-z0-9-]*)$/.exec(subjectId)?.[1];

export function createDifferencePlane() {
  let plane: ReturnType<typeof mountReconstructionOverlay> | null = null, pending: Promise<void> | null = null;
  let enabled = false, opacity = .85, shown = false, objectUrl = '';
  return {
    get enabled() { return enabled; }, get opacity() { return opacity; }, get loading() { return Boolean(pending); },
    /** Turn the map on or off; mounts it once per displayed dataset. `current` guards against a dataset switching mid-load. */
    async set(next: boolean, nextOpacity: number, context?: { host: HTMLElement; before: Node; source: DifferenceSource | undefined; frame: DensityVolumeFrame; current(): boolean }) {
      if (!(Number.isFinite(nextOpacity) && nextOpacity >= 0 && nextOpacity <= 1)) throw new TypeError('Difference map opacity must be between zero and one.');
      enabled = next; opacity = nextOpacity;
      if (!enabled) { plane?.setVisible(false, opacity); return; }
      if (!context?.source) {
        enabled = false; throw new Error('The difference map needs a baked image dataset with its registered original image.');
      }
      if (!plane && !pending) {
        const { id: resultId, mapUrl } = context.source;
        const load = (async () => {
          const overlay = await context.source!.overlay();
          // The route prepares the map per request, so hold the exact decoded bytes as a local object URL.
          const response = await fetch(mapUrl);
          if (!response.ok) throw new Error(`The difference map could not be prepared for this dataset (HTTP ${response.status}).`);
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
    /** The displayed dataset changed: drop its plane; an enabled map remounts for the next dataset. */
    clear() { plane?.destroy(); plane = null; pending = null; shown = false; if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = ''; },
  };
}
