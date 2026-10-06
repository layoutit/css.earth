import { createPreparedImageStore, type PreparedImage } from '../rendering/loading/prepared-image-store.js';

/** A view owns only its demanded images. Decodes finish before CSS can take over from its billboard. */
export function createVolumeTextureReadiness(publish: () => void, createImage?: () => PreparedImage) {
  const store = createPreparedImageStore({ createImage,
    pools: [{ id: 'volume', capacity: Infinity, concurrency: 1, reuse: false, decoding: 'async' }] });
  const lease = store.createLease('volume-view');
  const pending = new Map<string, object>(), decoded = new Map<string, PreparedImage>();
  // Images decoded while nothing drew them (`undrawn`), and those being decoded again.
  const stale = new Set<string>(), again = new Map<string, object>();
  let disposed = false;
  const forget = (url: string) => { stale.delete(url); again.delete(url); return decoded.delete(url); };
  return {
    /** `shows`: the bank is asked on screen. One only kept resident behind its billboard is ready on what it has
     * decoded; its pixels are checked when it is about to show (`undrawn`). */
    ready(urls: readonly string[], shows = true): boolean {
      if (disposed) return false;
      const wanted = new Set(urls);
      store.batch(() => {
        for (const url of lease.keys()) if (!wanted.has(url)) {
          pending.delete(url);
          // Releasing our handle must not invalidate pixels that retained CSS just used.
          if (forget(url)) lease.handoff(url); else lease.release(url);
        }
        for (const url of wanted) if (!pending.has(url)) {
          const token = {};
          pending.set(url, token);
          void lease.load(url, { pool: 'volume' }).then(image => {
            if (disposed || pending.get(url) !== token || !image) return;
            decoded.set(url, image); publish();
          }, error => {
            if (disposed || pending.get(url) !== token) return;
            console.error('Prepared volume texture decode failed.', error);
          });
        }
      });
      if (![...wanted].every(url => decoded.has(url))) return false;
      if (!shows) return true;
      // Last, once every image is in: one decoded again now is the newest of them when the bank paints.
      let fresh = true;
      for (const url of wanted) if (stale.has(url)) {
        fresh = false;
        if (again.has(url)) continue;
        const token = {};
        again.set(url, token);
        // A failed decode still shows the bank: it then decodes as it paints, as before.
        void decoded.get(url)!.decode().catch(() => {}).then(() => {
          if (disposed || again.get(url) !== token) return;
          again.delete(url); stale.delete(url); publish();
        });
      }
      return fresh;
    },
    /** Whether one of the wanted images has finished its transport and decode. */
    decoded(url: string): boolean { return !disposed && decoded.has(url); },
    /** The bank left layout: nothing draws its images now. Keeping an image's handle does not pin its decoded pixels:
     * WebKit drops those of an image nothing draws, and the paint that shows it again decodes it on the main thread.
     * The Crab's slices, back in layout after 2.7 s out, spent 55 to 57 ms decoding their 2913 x 2749 atlas inside that
     * paint, in a frame of 110 to 115 ms on an iPad (2026-10-06). Each image decoded so far is decoded again, off that
     * thread, when the bank is next asked on screen and before it is ready; one still decoded resolves at once. Decoded
     * again as the bank left, its pixels were gone again 2.5 s later, when it came back. */
    undrawn() { if (disposed) return; for (const url of decoded.keys()) { stale.add(url); again.delete(url); } },
    destroy() {
      if (disposed) return;
      disposed = true; pending.clear(); decoded.clear(); stale.clear(); again.clear(); store.destroy();
    },
  };
}
