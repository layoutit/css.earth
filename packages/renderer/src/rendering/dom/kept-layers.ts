import { releaseAnimation } from '../loading/prepared-playback.js';

/** How long the keeping animation would run: it is paused two frames in and never plays. */
const KEPT_MILLISECONDS = 100_000_000;

/**
 * Keeps the surface of every composited layer under `element` while it is off screen; returns the release. `view` gives
 * the animation frames; without it, or without animations (a test document, a server), nothing is kept.
 *
 * Safari gives up the surface of a layer that leaves the screen and makes it again when the layer comes back. After a
 * zoom in, a zoom out on Earth brought its off-screen faces back together: frames of 124 to 253 ms on the iPad with no
 * write from the page, the longest a composite alone (2026-10-05). While an ancestor carries a transform animation
 * Safari keeps the layers under it, and a paused animation counts: this one moves nothing and, paused, animates
 * nothing. With it the same zoom out had no frame over 47 ms. The faces off screen keep their surfaces, 58 MB more in
 * the page's process zoomed in on Earth and none at the default view, and are painted when a zoom in sharpens them:
 * about ten frames of 33 to 49 ms at rest where there were two.
 */
export function keepLayers(element: HTMLElement, view: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> | null): () => void {
  if (typeof element.animate !== 'function' || !view || typeof view.requestAnimationFrame !== 'function') return () => {};
  // An animation's value replaces the element's own for that property, so it animates the one transform property the
  // camera root does not write. The root's `translate` lifts the body over the shell's sheet and its `scale` fits it
  // (perspective-dolly.ts): animating `translate` here drew every body the sheet's lift too low, 28 px under its limb
  // layer on an iPad held upright, from 2026-10-05 to 2026-10-06.
  const animation = element.animate([{ rotate: '0deg' }, { rotate: '0.01deg' }], { duration: KEPT_MILLISECONDS, iterations: Infinity });
  animation.id = 'kept-layers';
  // Paused once the browser has taken the animation to its compositor: one paused from the start never gets there.
  let frames = 2, request = view.requestAnimationFrame(function wait() {
    request = --frames > 0 ? view.requestAnimationFrame(wait) : 0;
    if (!request) animation.pause();
  });
  return () => { if (request) view.cancelAnimationFrame(request); request = 0; releaseAnimation(animation); };
}
