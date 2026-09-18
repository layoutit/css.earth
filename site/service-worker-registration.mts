import {
  CACHE_PREFIX, PUT_MESSAGE, responseValidator, shouldRegisterServiceWorker, STORE_CONCURRENCY, STORE_MESSAGE, TOUCH_MESSAGE,
} from './service-worker/policy.mts';

const FLUSH_INTERVAL_MS = 5000;

// Registers the offline worker after the first scene has loaded, so it never
// competes with the page for bandwidth. Online requests never pass through the
// worker. Instead the page reads the files it used back from its own HTTP cache
// and hands the changed ones to the worker: the page's cache holds exactly the
// bytes it showed, while Safari gives the worker a separate cache that kept an
// earlier deploy's bytes. A page that should not be controlled
// (development servers, Firefox tabs, or a build that turns offline support
// off) removes any worker and copies an earlier visit left behind.
export function registerServiceWorker(windowTarget: Window, enabled: boolean) {
  const container = windowTarget.navigator.serviceWorker;
  if (!container) return;
  const standalone = windowTarget.matchMedia('(display-mode: standalone)').matches;
  const whenLoaded = (task: () => void) => {
    if (windowTarget.document.readyState === 'complete') task();
    else windowTarget.addEventListener('load', task, { once: true });
  };
  if (!enabled || !shouldRegisterServiceWorker(windowTarget.navigator.userAgent, standalone)) {
    whenLoaded(() => { void removeServiceWorker(windowTarget, container); });
    return;
  }
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
  let copying = Promise.resolve();
  const flush = (worker: ServiceWorker | null) => {
    add(`${origin}${windowTarget.location.pathname}`);
    if (!worker || !pending.size) return;
    const urls = [...pending];
    pending.clear();
    for (const url of urls) sent.add(url);
    copying = copying.then(() => copyToWorker(worker, urls)).catch(() => undefined);
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
  whenLoaded(register);
}

async function removeServiceWorker(windowTarget: Window, container: ServiceWorkerContainer) {
  try {
    const registrations = await container.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const names = await windowTarget.caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX)).map(name => windowTarget.caches.delete(name)));
  } catch {
    // Storage may be unavailable, as in some private windows; nothing is left to remove.
  }
}

function askWorker(worker: ServiceWorker, urls: readonly string[]): Promise<Record<string, string | null>> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = event => {
      const answer: Record<string, string | null> = {};
      if (typeof event.data === 'object' && event.data !== null) {
        for (const [url, validator] of Object.entries(event.data)) {
          if (typeof validator === 'string' || validator === null) answer[url] = validator;
        }
      }
      resolve(answer);
    };
    worker.postMessage({ type: STORE_MESSAGE, urls }, [channel.port2]);
  });
}

async function copyToWorker(worker: ServiceWorker, urls: readonly string[]) {
  const known = await askWorker(worker, urls);
  const queue = Object.keys(known);
  const unchanged: string[] = [];
  await Promise.all(Array.from({ length: STORE_CONCURRENCY }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      try {
        const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
        if (response.status !== 200 || response.type !== 'basic' || response.redirected) { await response.body?.cancel(); continue; }
        const validator = responseValidator(response.headers);
        if (validator && validator === known[url]) { await response.body?.cancel(); unchanged.push(url); continue; }
        const body = await response.arrayBuffer();
        worker.postMessage({ type: PUT_MESSAGE, url, body, headers: [...response.headers] }, [body]);
      } catch {
        // The copy is best effort; the next visit tries again.
      }
    }
  }));
  if (unchanged.length) worker.postMessage({ type: TOUCH_MESSAGE, urls: unchanged });
}
