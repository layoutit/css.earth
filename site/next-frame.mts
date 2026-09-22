/** Resolves at the document's next animation frame, after the input queued before it has been dispatched. A document
 * without a window resolves on the next task. */
export function nextFrame(documentTarget: Document): Promise<void> {
  const view = documentTarget.defaultView;
  return new Promise(resolve => { if (view) view.requestAnimationFrame(() => resolve()); else setTimeout(resolve, 0); });
}
