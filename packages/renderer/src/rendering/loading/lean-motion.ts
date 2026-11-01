/**
 * Opt-in, per document: a scene whose prepared bank asks for it (`warpInMotion`) holds the paints and surfaces a phone
 * cannot afford while the camera moves. While such a bank is attached, the document's star fields keep a paint through
 * the camera's travel and repaint at a measured pace, and a dataset bank fully shown stays at opacity 1, with no surface
 * of its own round the stacks. Every other scene is untouched.
 *
 * On a Galaxy S23 Ultra through a flick at the LMC (2026-11-01): the bank's 0.999 nested the two stacks' surfaces in a third,
 * which stalled the GPU thread for frames of 30 to 120 ms; without it no render pass was over 15 ms. The star field's 5,052
 * dots repainted every frame of an orbit, 9 tiles a frame, half of the GPU process's work.
 */
const holders = new WeakMap<Document, number>();

export function enterLeanMotion(document: Document): () => void {
  holders.set(document, (holders.get(document) ?? 0) + 1);
  let left = false;
  return () => { if (left) return; left = true; holders.set(document, (holders.get(document) ?? 1) - 1); };
}
export const leanMotion = (document: Document) => (holders.get(document) ?? 0) > 0;
