import { opacityClockFor } from '../stars/opacity-clock.js';
// The flight holds its approach until activation completes. One group per paint
// took 18+ frames for a planet, longer than the approach leaves; its per-group
// frames cost a few milliseconds, so a few groups share each paint instead.
const ACTIVATION_PAINTS = 6;

/** Prepared groups are already constructed and retain their DOM identity.
 * Spread their first connected layout across paints while the application
 * camera presents the coarse universe. No geometry or assets are derived. */
export function prepareConnectedActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown) {
  if (!groups.length) return () => Promise.resolve();
  const window = groups[0][0].ownerDocument.defaultView;
  if (!window) throw new Error('Prepared activation requires a window.');
  const clock = opacityClockFor(window);
  // Consecutive prepared groups share a paint, balanced by their leaf count.
  const leaves = groups.reduce((sum, group) => sum + group.length, 0);
  const budget = Math.ceil(leaves / ACTIVATION_PAINTS);
  const entries: { node: HTMLElement; display: string }[][] = [];
  for (const group of groups) {
    const batch = entries[entries.length - 1];
    const next = group.map(node => ({ node, display: node.style.display }));
    if (batch && batch.length + next.length <= budget) batch.push(...next); else entries.push(next);
  }
  for (const group of entries) for (const { node } of group) node.style.display = 'none';
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
      for (const entry of entries[index++]) entry.node.style.display = entry.display;
      // Give the final batch a rendering opportunity before readiness. Calling
      // the continuation here stacks handoff work onto that batch's first frame.
      if (index === entries.length) frame = clock.request(() => { frame = null; done(); });
      else frame = clock.request(next);
    }
    if (disposed) done();
    else frame = clock.request(next);
  });
}
