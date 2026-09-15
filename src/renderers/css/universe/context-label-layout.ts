import type { LabelScreenRect } from '../labels/screen-label-layout.js';

/** A framed overview may reserve its orbit footprint; close/clipped orbits must not cover the sky. */
export function compactOrbitFootprint(bounds: LabelScreenRect, width: number, height: number): LabelScreenRect | null {
  const spanX = bounds.right - bounds.left, spanY = bounds.bottom - bounds.top;
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite) || spanX <= 0 || spanY < 0 ||
      bounds.left <= -width / 2 + 3 || bounds.right >= width / 2 - 3 || bounds.top <= -height / 2 + 3 || bounds.bottom >= height / 2 - 3 ||
      spanX > width * .8 || spanY > height * .8 || spanX * spanY > width * height / 2) return null;
  return bounds;
}
