import { opacityClockFor } from '@cssearth/renderer';
/** Resume in a task after a rendering opportunity, not in the RAF microtask checkpoint.
 * Cancellation releases both scheduled callbacks without publishing scene work. */
export function afterSceneFrame(windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'setTimeout' | 'clearTimeout'>,
  signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  // The document's one frame clock.
  const clock = opacityClockFor(windowTarget);
  return new Promise(resolve => {
    let frame: number | null = null, task: number | null = null;
    const finish = () => {
      if (frame !== null) clock.cancel(frame);
      if (task !== null) windowTarget.clearTimeout(task);
      frame = task = null;
      signal.removeEventListener('abort', finish);
      resolve();
    };
    signal.addEventListener('abort', finish, { once: true });
    frame = clock.request(() => {
      frame = null;
      task = windowTarget.setTimeout(() => { task = null; finish(); }, 0);
    });
  });
}
