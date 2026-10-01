/**
 * Background requests wait for the first view (docs/performance/startup-gate.md). A page whose first view is a body holds
 * its document's gate from its first mount until that body's detail is interactive (`cssearth:startup-detail-ready`); the
 * world's background banks (the galaxy's dots, the sky's faces, the galaxies beyond) then start loading when the browser
 * is next idle. A document that never holds the gate, such as an overview whose first view is the world itself, finds it
 * open, and its loaders start at once.
 */
interface StartupGate { state: 'held' | 'releasing' | 'open'; readonly waiting: (() => void)[] }

/** The longest a released gate waits for an idle period before it runs its loaders anyway. */
const IDLE_TIMEOUT_MS = 1_000;
// Kept on the window itself: the site's own import and a built renderer bundle (the dev server's) are two copies of
// this module, and must share one gate.
const GATE = Symbol.for('cssearth.startupGate');
const gateOf = (target: Window): StartupGate | undefined => Reflect.get(target, GATE) as StartupGate | undefined;

/** Holds a document's background loads until `releaseStartup`. A document holds its gate once: a later hold, after the
 * first view was released, does nothing. */
export function holdStartup(target: Window): void {
  if (!gateOf(target)) Reflect.set(target, GATE, { state: 'held', waiting: [] } satisfies StartupGate);
}

/** Lets a held document's background loads start, once the browser is next idle. Releasing twice, or a gate never held,
 * does nothing. */
export function releaseStartup(target: Window): void {
  const gate = gateOf(target);
  if (gate?.state !== 'held') return;
  gate.state = 'releasing';
  const drain = () => {
    gate.state = 'open';
    for (const run of gate.waiting.splice(0)) run();
  };
  if (typeof target.requestIdleCallback === 'function') target.requestIdleCallback(drain, { timeout: IDLE_TIMEOUT_MS });
  else if (typeof target.setTimeout === 'function') target.setTimeout(drain, 0);
  else drain();
}

/** Whether a document's background loads may start now. */
export function startupOpen(target: Window | null | undefined): boolean {
  return !target || (gateOf(target)?.state ?? 'open') === 'open';
}

/** Runs `load` now when the gate is open, or once it opens. The caller checks its own disposal inside `load`. */
export function afterStartup(target: Window | null | undefined, load: () => void): void {
  if (startupOpen(target)) load();
  else gateOf(target!)!.waiting.push(load);
}
