import { parseSharedView } from '@cssearth/renderer/navigation/view-url.ts';
import { parseObjectDiscovery } from '@cssearth/objects';
import type { SceneFactory } from './browser/browser-types.mts';
import type { CameraViewport } from '@cssearth/renderer/navigation/camera-viewport.ts';
import { prepareArrivalBillboard } from './arrival-billboard.mts';
import { createPreparedArrival } from './prepared-arrival.mts';
import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
import { preparedFocusFromUrl } from './navigation/navigation-scope.mts';

/** A custom view never borrows the default arrival photograph. */
export function usesDefaultStartupView(url: string, sceneId: string): boolean {
  const query = new URL(url).searchParams;
  return preparedFocusFromUrl(url, sceneId) === null && !['v', 'view', 'overview', 'feature', 'dataset', 'settings'].some(key => query.has(key));
}

/** Static previews restore from the URL; server-rendered focus responses carry a resolved camera. Only the `v` parameter is
 * a saved camera: a page URL also carries `overview`, `focus`, `dataset` and the rest, which the shared-view parser refuses. */
export function readStartupSavedView(url: string, preparedView?: string) {
  const saved = preparedView ?? new URL(url).searchParams.get('v');
  return saved === null ? null : parseSharedView(new URLSearchParams({ v: saved }).toString());
}

/** The same prepared cover and resource lease as fly-to, owned by the initial session. */
export async function prepareStartupBillboard(stage: HTMLElement, factory: SceneFactory, viewport: CameraViewport,
  url: string, sceneId: string, signal: AbortSignal) {
  const document = stage.ownerDocument, window = document.defaultView;
  const metadata = document.querySelector<HTMLScriptElement>('script[data-startup-discovery]');
  const image = document.querySelector<HTMLImageElement>('img[data-startup-billboard]');
  if (!window) return null;
  const saved = readStartupSavedView(url, stage.dataset.preparedView);
  const defaultView = usesDefaultStartupView(url, sceneId);
  if ((!defaultView && !saved) || !factory.navigation) { image?.remove(); return null; }
  const arrival = metadata ? parseObjectDiscovery(JSON.parse(metadata.textContent ?? '')).arrival : undefined;
  if (!saved && (!arrival?.billboard || !image)) { image?.remove(); return null; }
  const navigation = factory.navigation, input = document.querySelector<HTMLElement>('.object-input-surface');
  let pending: ReturnType<typeof createPreparedArrival> | null = null;
  function removeLoader() {
    document.querySelector('.startup-loading')?.remove();
    signal.removeEventListener('abort', removeLoader);
  }
  signal.addEventListener('abort', removeLoader, { once: true });
  try {
    const view = await navigation.initialView(viewport, window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
      saved ? { saved } : { rotation: arrival!.rotation, distanceM: arrival!.billboard!.distanceM }, signal);
    const cover = defaultView && arrival?.billboard && image ? await prepareArrivalBillboard(stage, arrival, navigation.frame, signal, image) : null;
    if (!cover) image?.remove();
    cover?.publish(view.world, view.viewport);
    window.performance.mark('cssearth:startup-billboard');
    pending = createPreparedArrival(signal, cover, () => {
      window.performance.mark('cssearth:startup-detail-ready');
      removeLoader();
    }, input);
    await pending.prepare(factory, { getView: () => view, cameraViewport: viewport, selectionStage: stage, ownerDocument: document });
    return pending.handoff(() => view);
  } catch (error) { pending?.dispose(); removeLoader(); throw error; }
}
