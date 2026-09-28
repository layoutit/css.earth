import { opacityClockFor } from '../stars/opacity-clock.js';

/** The complete mesh connects once. Only leaf-local image writes are paced;
 * selection remains the owner of each pending image, including replacements. */
export function prepareTextureActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown) {
  const batches = groups.filter(group => group.length);
  const pending = new Map(batches.flat().map(node => [node, node.style.backgroundImage || 'none']));
  for (const node of pending.keys()) if (node.style.backgroundImage !== 'none') node.style.backgroundImage = 'none';
  const window = batches[0]?.[0].ownerDocument.defaultView;
  const clock = window ? opacityClockFor(window) : null;
  let disposed = false, frame: number | null = null, promise: Promise<void> | null = null;
  let finish: (() => void) | null = null;
  own(() => {
    disposed = true;
    if (frame !== null) clock?.cancel(frame);
    frame = null; pending.clear(); finish?.();
  });
  return {
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
