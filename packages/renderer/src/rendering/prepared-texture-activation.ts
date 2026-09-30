import { opacityClockFor } from '../stars/opacity-clock.js';

/** A pending leaf draws no image until its batch activates, and a withheld one does not render either: attribute rules
 * (styles/prepared-scene.css) that outrank the leaf's own inline image and display. Selection writes those inline as
 * usual; activation removes the attribute. */
export const TEXTURE_PENDING_ATTRIBUTE = 'data-texture-pending';
const WITHHELD = 'withheld';

/** The complete mesh connects once. Leaf-local rendering and image writes are paced;
 * selection remains the owner of each pending image, including replacements. */
export function prepareTextureActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown) {
  const batches = groups.filter(group => group.length);
  const pending = new Set(batches.flat());
  const withheld = new Set<HTMLElement>();
  const parents = new Set<HTMLElement | null>();
  for (const node of pending) {
    // Keep a populated rendering anchor for each mesh parent. The remaining
    // retained leaves acquire render/compositor layers only with their batch.
    if (!parents.has(node.parentElement)) { parents.add(node.parentElement); node.setAttribute(TEXTURE_PENDING_ATTRIBUTE, ''); continue; }
    withheld.add(node);
    node.setAttribute(TEXTURE_PENDING_ATTRIBUTE, WITHHELD);
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
    /** A withheld leaf takes its selected display now; its attribute keeps it unrendered until its batch. */
    deferDisplay(node: HTMLElement, value: string) {
      if (!withheld.has(node) || disposed) return false;
      if (!value) node.style.removeProperty('display');
      else if (node.style.display !== value) node.style.display = value;
      return true;
    },
    write(node: HTMLElement, image: string) {
      if (disposed) return;
      if (node.style.backgroundImage !== image) node.style.backgroundImage = image;
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
          const node = batch[offset], image = pending.has(node) ? node.style.backgroundImage || 'none' : 'none';
          const firstUse = image !== 'none' && !introduced.has(image);
          // A new atlas pays graphics-process setup on its first actual paint.
          // Give that retained face its own rendering opportunity, without a
          // synthetic warm-up element or a timer-based readiness assumption.
          if (firstUse && wroteImage) break;
          // An activated leaf without an image draws none, never one a stylesheet would give it.
          if (node.style.backgroundImage !== image) node.style.backgroundImage = image;
          wroteImage ||= image !== 'none';
          node.removeAttribute(TEXTURE_PENDING_ATTRIBUTE);
          withheld.delete(node); pending.delete(node); offset++;
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
