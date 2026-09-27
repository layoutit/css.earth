import { opacityClockFor } from '../stars/opacity-clock.js';

/** Connect one prepared leaf batch per rendering opportunity. The scene's
 * hierarchy, face order, styles and textures are unchanged; its caller keeps
 * the arrival billboard in place until activation and first paint complete. */
export function prepareConnectedActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown, resident: readonly HTMLElement[] = [], surfaceScenes?: readonly HTMLElement[]) {
  const retained = new Set<Node>(resident);
  // Flat material/proxy overlays establish compositing before surface leaves join.
  // Attaching those overlays last can repaint the entire already-connected mesh.
  groups = groups.map(group => group.filter(node => !retained.has(node) &&
    (!surfaceScenes || surfaceScenes.some(scene => scene.contains(node))))).filter(group => group.length);
  if (!groups.length) return () => Promise.resolve();
  const window = groups[0][0].ownerDocument.defaultView;
  if (!window) throw new Error('Prepared activation requires a window.');
  const clock = opacityClockFor(window);
  const pending = new Set<Node>(groups.flat());
  const parents = new Set<HTMLElement>();
  const entries = groups.map(group => group.map(node => {
    const parent = node.parentElement;
    if (!parent) throw new TypeError('Prepared activation leaf has no parent.');
    parents.add(parent);
    return { node, parent };
  }));
  // Every batch preserves sibling order. Retained siblings anchor each run of
  // deferred leaves, including selection-owned nodes that are not in a batch.
  const anchors = new Map<Node, ChildNode | null>();
  for (const parent of parents) {
    let anchor: ChildNode | null = null;
    for (const child of [...parent.childNodes].reverse()) {
      if (pending.has(child)) anchors.set(child, anchor);
      else anchor = child;
    }
  }
  // Keep an emptied mesh parent detached until its first batch is inside it.
  // Connecting an empty preserve-3d parent first can leave WebKit without its
  // structural compositor layer when the triangles subsequently arrive.
  for (const group of entries) for (const { node } of group) node.remove();
  const attachments = new Map<HTMLElement, { owner: ParentNode; following: readonly ChildNode[] }>();
  for (const parent of parents) {
    const owner = parent.parentNode;
    if (!owner || parent.childNodes.length || retained.has(parent)) continue;
    const siblings = [...owner.childNodes];
    attachments.set(parent, { owner, following: siblings.slice(siblings.findIndex(sibling => sibling === parent) + 1) });
  }
  for (const [parent, { owner }] of attachments) owner.removeChild(parent);
  let frame: number | null = null, disposed = false, promise: Promise<void> | null = null;
  let resolve: (() => void) | null = null;
  own(() => {
    disposed = true;
    if (frame !== null) clock.cancel(frame);
    frame = null; resolve?.();
  });
  return () => promise ??= new Promise<void>(done => {
    resolve = done;
    let index = 0;
    function next() {
      frame = null;
      if (disposed) { done(); return; }
      const batch = entries[index++];
      for (const { node, parent } of batch) parent.insertBefore(node, anchors.get(node) ?? null);
      for (const { parent } of batch) {
        const attachment = attachments.get(parent);
        if (!attachment) continue;
        const { owner, following } = attachment;
        // Batch order need not match sibling order. Find the next resident
        // sibling so reconnecting a populated parent preserves prepared depth.
        owner.insertBefore(parent, following.find(node => node.parentNode === owner) ?? null);
        attachments.delete(parent);
      }
      // Let the final connected batch render before readiness resumes the
      // router. The mounted scene also waits for its normal first-paint gate.
      if (index === entries.length) frame = clock.request(() => { frame = null; done(); });
      else frame = clock.request(next);
    }
    if (disposed) done();
    else frame = clock.request(next);
  });
}
