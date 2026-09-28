import { parseObjectDiscovery } from '@cssearth/objects';
import type { SceneFactory } from './browser/browser-types.mts';
import type { CameraViewport } from '@cssearth/renderer/navigation/camera-viewport.ts';
import { prepareArrivalBillboard } from './arrival-billboard.mts';
import { createPreparedArrival } from './prepared-arrival.mts';
import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';

/** A custom view never borrows the default arrival photograph. */
export function usesDefaultStartupView(url: string): boolean {
  const query = new URL(url).searchParams;
  return !['v', 'view', 'overview', 'focus', 'focusLens', 'feature', 'dataset', 'settings'].some(key => query.has(key));
}

/** The same prepared cover and resource lease as fly-to, owned by the initial session. */
export async function prepareStartupBillboard(stage: HTMLElement, factory: SceneFactory, viewport: CameraViewport,
  url: string, signal: AbortSignal) {
  const document = stage.ownerDocument, window = document.defaultView;
  const metadata = document.querySelector<HTMLScriptElement>('script[data-startup-discovery]');
  const image = document.querySelector<HTMLImageElement>('img[data-startup-billboard]');
  if (!metadata || !image || !window) return null;
  if (!usesDefaultStartupView(url) || !factory.navigation) { image.remove(); return null; }
  const arrival = parseObjectDiscovery(JSON.parse(metadata.textContent ?? '')).arrival;
  if (!arrival?.billboard) { image.remove(); return null; }
  const navigation = factory.navigation, input = document.querySelector<HTMLElement>('.object-input-surface');
  let pending: ReturnType<typeof createPreparedArrival> | null = null;
  function removeLoader() {
    document.querySelector('.startup-loading')?.remove();
    signal.removeEventListener('abort', removeLoader);
  }
  signal.addEventListener('abort', removeLoader, { once: true });
  try {
    const view = await navigation.initialView(viewport, window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
      { rotation: arrival.rotation, distanceM: arrival.billboard.distanceM }, signal);
    const cover = await prepareArrivalBillboard(stage, arrival, navigation.frame, signal, image);
    cover.publish(view.world, view.viewport);
    window.performance.mark('cssearth:startup-billboard');
    pending = createPreparedArrival(signal, cover, () => {
      window.performance.mark('cssearth:startup-detail-ready');
      removeLoader();
    }, input);
    await pending.prepare(factory, { getView: () => view, cameraViewport: viewport, ownerDocument: document });
    return pending.handoff(() => view);
  } catch (error) { pending?.dispose(); removeLoader(); throw error; }
}
