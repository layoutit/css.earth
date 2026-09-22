/** Resolves at the document's next animation frame, after the input queued before it has been dispatched. A document
 * without animation frames (no window, or a test DOM) resolves on the next task. */
export function nextFrame(documentTarget: Document): Promise<void> {
  const view = documentTarget.defaultView;
  return new Promise(resolve => {
    if (view && typeof view.requestAnimationFrame === 'function') view.requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}
