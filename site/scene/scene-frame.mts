/** Resume in a task after a rendering opportunity, not in the RAF microtask checkpoint.
 * Cancellation releases both scheduled callbacks without publishing scene work. */
export function afterSceneFrame(windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'setTimeout' | 'clearTimeout'>,
  signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let frame: number | null = null, task: number | null = null;
    const finish = () => {
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      if (task !== null) windowTarget.clearTimeout(task);
      frame = task = null;
      signal.removeEventListener('abort', finish);
      resolve();
    };
    signal.addEventListener('abort', finish, { once: true });
    frame = windowTarget.requestAnimationFrame(() => {
      frame = null;
      task = windowTarget.setTimeout(() => { task = null; finish(); }, 0);
    });
  });
}
