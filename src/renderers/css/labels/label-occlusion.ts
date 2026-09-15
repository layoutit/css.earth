import type { LabelScreenRect } from './screen-label-layout.js';

const owners = new WeakMap<Document, ReturnType<typeof createOcclusionState>>();
function createOcclusionState() {
  let rects: readonly LabelScreenRect[] = [];
  const listeners = new Set<() => void>();
  return {
    read: () => rects,
    publish(next: readonly LabelScreenRect[]) {
      if (next.length === rects.length && next.every((rect, index) => {
        const old = rects[index]!;
        return rect.left === old.left && rect.top === old.top && rect.right === old.right && rect.bottom === old.bottom;
      })) return;
      rects = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
/** The shell measures once; every annotation owner consumes the same snapshot. */
export function labelOcclusionFor(document: Document) {
  let owner = owners.get(document);
  if (!owner) { owner = createOcclusionState(); owners.set(document, owner); }
  return owner;
}
