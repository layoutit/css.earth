import { STORE_MESSAGE } from './service-worker/policy.mts';

const FLUSH_INTERVAL_MS = 5000;

// Registers the offline worker after the first scene has loaded, so it never
// competes with the page for bandwidth. Online requests never pass through the
// worker; instead the page tells it which same-origin files it used, and the
// worker copies them from the HTTP cache. Development servers skip it.
export function registerServiceWorker(windowTarget: Window, enabled: boolean) {
  const container = windowTarget.navigator.serviceWorker;
  if (!enabled || !container) return;
  const origin = windowTarget.location.origin;
  const pending = new Set<string>();
  const sent = new Set<string>();
  const add = (url: string) => {
    if (url.startsWith(`${origin}/`) && !sent.has(url)) pending.add(url);
  };
  // Buffered entries cover what loaded before this module ran.
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) add(entry.name);
    }).observe({ type: 'resource', buffered: true });
  } catch {
    return;
  }
  const flush = (worker: ServiceWorker | null) => {
    add(`${origin}${windowTarget.location.pathname}`);
    if (!worker || !pending.size) return;
    const urls = [...pending];
    pending.clear();
    for (const url of urls) sent.add(url);
    worker.postMessage({ type: STORE_MESSAGE, urls });
  };
  const register = () => {
    container.register('/sw.js', { scope: '/' }).then(async registration => {
      await container.ready;
      flush(registration.active);
      windowTarget.setInterval(() => flush(registration.active), FLUSH_INTERVAL_MS);
      // A visitor may leave before the next interval.
      windowTarget.addEventListener('pagehide', () => flush(registration.active));
    }).catch(error => {
      console.warn('Offline support is unavailable.', error);
    });
  };
  if (windowTarget.document.readyState === 'complete') register();
  else windowTarget.addEventListener('load', register, { once: true });
}
