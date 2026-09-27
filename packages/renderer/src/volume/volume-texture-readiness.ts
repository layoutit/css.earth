import { createPreparedImageStore, type PreparedImage } from '../rendering/prepared-image-store.js';

/** A view owns only its demanded images. Decodes finish before CSS can take over from its billboard. */
export function createVolumeTextureReadiness(publish: () => void, createImage?: () => PreparedImage) {
  const store = createPreparedImageStore({ createImage,
    pools: [{ id: 'volume', capacity: Infinity, concurrency: 1, reuse: false, decoding: 'async' }] });
  const lease = store.createLease('volume-view');
  const pending = new Map<string, object>(), decoded = new Set<string>();
  let disposed = false;
  return {
    ready(urls: readonly string[]): boolean {
      if (disposed) return false;
      const wanted = new Set(urls);
      store.batch(() => {
        for (const url of lease.keys()) if (!wanted.has(url)) {
          pending.delete(url);
          // Releasing our handle must not invalidate pixels that retained CSS just used.
          if (decoded.delete(url)) lease.handoff(url); else lease.release(url);
        }
        for (const url of wanted) if (!pending.has(url)) {
          const token = {};
          pending.set(url, token);
          void lease.load(url, { pool: 'volume' }).then(image => {
            if (disposed || pending.get(url) !== token || !image) return;
            decoded.add(url); publish();
          }, error => {
            if (disposed || pending.get(url) !== token) return;
            console.error('Prepared volume texture decode failed.', error);
          });
        }
      });
      return [...wanted].every(url => decoded.has(url));
    },
    destroy() {
      if (disposed) return;
      disposed = true; pending.clear(); decoded.clear(); store.destroy();
    },
  };
}
