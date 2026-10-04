import { parseSharedView } from '@cssearth/renderer/navigation/view-url.ts';
import { parseObjectDiscovery } from '@cssearth/objects';
import type { SceneFactory } from './browser/browser-types.mts';
import type { CameraViewport } from '@cssearth/renderer/navigation/camera-viewport.ts';
import { prepareArrivalBillboard } from './arrival-billboard.mts';
import { createPreparedArrival } from './prepared-arrival.mts';
import { namesSystem } from './navigation/navigation-scope.mts';
import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
import { releaseStartup } from '@cssearth/renderer/rendering/startup-gate.ts';

/** A custom view never borrows the default arrival photograph, and neither does a system's page: it shows its host out
 * to its members, not the host's own opening view. */
export function usesDefaultStartupView(url: string, sceneId: string): boolean {
  const query = new URL(url).searchParams;
  return !namesSystem(url) && !['v', 'feature', 'dataset', 'settings'].some(key => query.has(key));
}

/** Static previews restore from the URL; server-rendered focus responses carry a resolved camera. Only the `v` parameter is
 * a saved camera: a page URL also carries `overview`, `focus`, `dataset` and the rest, which the shared-view parser refuses. */
export function readStartupSavedView(url: string, preparedView?: string) {
  const saved = preparedView ?? new URL(url).searchParams.get('v');
  if (saved === null) return null;
  // An unreadable view (a damaged copy, an older format) opens the page's default view, as the server renders it
  // (search-response.mts). Thrown from here it failed the whole mount: `/earth/?v=garbage` never became ready (2026-10-01).
  try { return parseSharedView(new URLSearchParams({ v: saved }).toString()); }
  catch { return null; }
}

/** The same prepared cover and resource lease as fly-to, owned by the initial session. */
export async function prepareStartupBillboard(stage: HTMLElement, factory: SceneFactory, viewport: CameraViewport,
  url: string, sceneId: string, signal: AbortSignal,
  /** Called once the photograph is placed, before the scene's images are requested: what else the page builds for the
   * first view (the world, the shell) runs while they download instead of after. */
  onCover: () => void = () => {}) {
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
    // The page's cover may have shown the photograph already (startup-cover.mts); the mark is the first time it showed.
    if (!window.performance.getEntriesByName('cssearth:startup-billboard').length) window.performance.mark('cssearth:startup-billboard');
    // Once the billboard shows, the ring leaves and the header's line runs until the detail answers input, as on the
    // page's own cover (startup-cover.mts). Without a billboard, the ring waits for the detail.
    if (cover) { removeLoader(); document.querySelector('.explorer-navigation-progress')?.setAttribute('aria-hidden', 'false'); }
    onCover();
    pending = createPreparedArrival(signal, cover, () => {
      window.performance.mark('cssearth:startup-detail-ready');
      // The world's background banks held for this moment start once the browser is idle (startup-gate.ts).
      releaseStartup(window);
      removeLoader();
    }, input);
    await pending.prepare(factory, { getView: () => view, cameraViewport: viewport, selectionStage: stage, ownerDocument: document });
    // Paced an atlas a frame, Earth's 77 images took 148 frames before the reveal: 1.35 s in headless Chromium and 2.63 s
    // in headless WebKit, against 0.11 s and 0.26 s whole (2026-10-02).
    return pending.handoff(() => view, {}, {}, cover ? 'whole' : 'paced');
  } catch (error) { pending?.dispose(); removeLoader(); throw error; }
}
