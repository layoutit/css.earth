/** Prepared groups are already constructed and retain their DOM identity.
 * Spread their first connected layout across paints while the application
 * camera presents the coarse universe. No geometry or assets are derived. */
export function prepareConnectedActivation(groups: readonly (readonly HTMLElement[])[], own: (cleanup: () => void) => unknown) {
  if (!groups.length) return () => Promise.resolve();
  const window = groups[0][0].ownerDocument.defaultView;
  if (!window) throw new Error('Prepared activation requires a window.');
  const entries = groups.map(group => group.map(node => ({ node, display: node.style.display })));
  for (const group of entries) for (const { node } of group) node.style.display = 'none';
  let frame: number | null = null, disposed = false, promise: Promise<void> | null = null;
  let resolve: (() => void) | null = null;
  own(() => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null; resolve?.();
  });
  return () => promise ??= new Promise<void>(done => {
    resolve = done;
    let index = 0;
    function next() {
      frame = null;
      if (disposed) { done(); return; }
      for (const entry of entries[index++]) entry.node.style.display = entry.display;
      if (index === entries.length) done();
      else frame = window!.requestAnimationFrame(next);
    }
    if (disposed) done();
    else frame = window.requestAnimationFrame(next);
  });
}
