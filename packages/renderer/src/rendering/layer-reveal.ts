import { createSettlePacer, framePacerFor } from './settle-pacer.js';
import type { OpacityWindow } from '../stars/opacity-clock.js';

// A layer shown for the first time paints everything it holds. On a zoom out the galaxy's backing image and its two ring
// sections, all one plane's size, painted about 21 ms each in one frame, and its dot layers joined them: 45-62 ms paints
// on six bodies on the iPad (2026-09-30). A layer switching on waits hidden until its image is decoded off the main
// thread, then the document's pacer shows one a frame, each taking that frame's budget.
interface Waiting { readonly layer: HTMLElement | SVGElement; ready: boolean }
const reveals = new WeakMap<OpacityWindow, { readonly waiting: Waiting[]; readonly pacer: ReturnType<typeof createSettlePacer> }>();

/** Show `layer` on a later frame of its own, once `images` (urls it paints) are decoded. Without animation frames (a test
 * document) the layer shows at once. */
export function revealLayer(layer: HTMLElement | SVGElement, images: string | readonly string[] = [],
  /** Decodes one url; the window's Image by default. */ decode?: (url: string) => Promise<unknown>) {
  const urls = typeof images === 'string' ? [images] : images;
  const view = layer.ownerDocument.defaultView as (OpacityWindow & { Image?: typeof Image }) | null;
  if (!view || typeof view.requestAnimationFrame !== 'function') { if (layer.style.visibility !== '') layer.style.visibility = ''; return; }
  let reveal = reveals.get(view);
  if (!reveal) {
    const waiting: Waiting[] = [];
    const pacer = createSettlePacer(budget => {
      const next = waiting.findIndex(entry => entry.ready);
      if (next < 0) return 0;
      const [{ layer: shown }] = waiting.splice(next, 1) as [Waiting];
      if (shown.style.visibility !== '') shown.style.visibility = '';
      return Math.max(1, budget);
    }, { frame: framePacerFor(view), holdWhile: 'never' });
    reveals.set(view, reveal = { waiting, pacer });
  }
  if (reveal.waiting.some(entry => entry.layer === layer)) return;
  const entry: Waiting = { layer, ready: urls.length === 0 };
  layer.style.visibility = 'hidden';
  reveal.waiting.push(entry);
  const Decoder = view.Image;
  const decoding = decode ?? (Decoder && typeof Decoder.prototype.decode === 'function'
    ? (url: string) => { const decoder = new Decoder(); decoder.src = url; return decoder.decode(); } : null);
  if (urls.length && decoding) {
    // A failed decode still shows the layer: it then decodes as it paints, as before.
    void Promise.all(urls.map(url => decoding(url).catch(() => {}))).then(() => { entry.ready = true; reveal!.pacer.request(); });
  } else entry.ready = true;
  reveal.pacer.request();
}
