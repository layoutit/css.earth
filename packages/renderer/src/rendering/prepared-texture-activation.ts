import { opacityClockFor } from '../stars/opacity-clock.js';

/** The complete mesh connects once. Leaf-local rendering and image writes are paced;
 * selection remains the owner of each pending image, including replacements. */
export function prepareTextureActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown) {
  const batches = groups.filter(group => group.length);
  const pending = new Map(batches.flat().map(node => [node, node.style.backgroundImage || 'none']));
  const withheld = new Map<HTMLElement, string>();
  const parents = new Set<HTMLElement | null>();
  for (const node of pending.keys()) {
    if (node.style.backgroundImage !== 'none') node.style.backgroundImage = 'none';
    // Keep a populated rendering anchor for each mesh parent. The remaining
    // retained leaves acquire render/compositor layers only with their batch.
    if (!parents.has(node.parentElement)) { parents.add(node.parentElement); continue; }
    withheld.set(node, node.style.display || '');
    node.style.display = 'none';
  }
  const window = batches[0]?.[0].ownerDocument.defaultView;
  const clock = window ? opacityClockFor(window) : null;
  let disposed = false, frame: number | null = null, promise: Promise<void> | null = null;
  let finish: (() => void) | null = null;
  own(() => {
    disposed = true;
    if (frame !== null) clock?.cancel(frame);
    frame = null; pending.clear(); withheld.clear(); finish?.();
  });
  return {
    deferDisplay(node: HTMLElement, value: string) {
      if (!withheld.has(node) || disposed) return false;
      withheld.set(node, value);
      return true;
    },
    write(node: HTMLElement, image: string) {
      if (disposed) return;
      if (pending.has(node)) pending.set(node, image);
      else if (node.style.backgroundImage !== image) node.style.backgroundImage = image;
    },
    activate: () => promise ??= new Promise<void>(resolve => {
      finish = resolve;
      if (disposed || !batches.length) { resolve(); return; }
      if (!clock) throw new Error('Prepared texture activation requires a window.');
      let index = 0, offset = 0;
      const introduced = new Set<string>();
      const next = () => {
        frame = null;
        if (disposed) { resolve(); return; }
        const batch = batches[index];
        let wroteImage = false;
        while (offset < batch.length) {
          const node = batch[offset], image = pending.get(node) ?? 'none';
          const firstUse = image !== 'none' && !introduced.has(image);
          // A new atlas pays graphics-process setup on its first actual paint.
          // Give that retained face its own rendering opportunity, without a
          // synthetic warm-up element or a timer-based readiness assumption.
          if (firstUse && wroteImage) break;
          if (node.style.backgroundImage !== image) {
            node.style.backgroundImage = image;
            wroteImage ||= image !== 'none';
          }
          const display = withheld.get(node);
          if (display !== undefined) {
            if (display) node.style.display = display;
            else node.style.removeProperty('display');
            withheld.delete(node);
          }
          pending.delete(node); offset++;
          if (firstUse) { introduced.add(image); break; }
        }
        if (offset === batch.length) { index++; offset = 0; }
        // Give the final batch a rendering opportunity before the normal paint gate.
        frame = clock.request(index === batches.length ? () => { frame = null; resolve(); } : next);
      };
      frame = clock.request(next);
    }),
  };
}
