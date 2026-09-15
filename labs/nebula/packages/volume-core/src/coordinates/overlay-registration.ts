/** Offline mapping from matched source-image stars to a reference image's sky coordinates. */
import { rayToOverlayPlane, wcsPixelRay, type ImageWcs, type OverlayFrame } from './overlay-wcs.ts';

export interface ImageRegistration {
  referenceWcs: ImageWcs;
  referenceWidthPx: number; referenceHeightPx: number;
  /** Row-major homography: zero-based source pixel centres → zero-based reference pixel centres. */
  imageToReferenceMatrix: number[];
}
export function registeredOverlayCorners(registration: ImageRegistration, width: number, height: number, frame: OverlayFrame) {
  const { referenceWcs: wcs, referenceWidthPx: rw, referenceHeightPx: rh, imageToReferenceMatrix: h } = registration;
  if (h.length !== 9 || !h.every(Number.isFinite) || ![width, height, rw, rh].every(n => Number.isInteger(n) && n > 0)) {
    throw new TypeError('Invalid matched-star image registration.');
  }
  return [[-.5, -.5], [width - .5, -.5], [width - .5, height - .5], [-.5, height - .5]].map(([x, y]) => {
    const d = h[6]! * x! + h[7]! * y! + h[8]!;
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) throw new TypeError('Registration crosses a projective horizon.');
    const u = (h[0]! * x! + h[1]! * y! + h[2]!) / d, v = (h[3]! * x! + h[4]! * y! + h[5]!) / d;
    const fx = (u + .5) * wcs.referenceDimension[0] / rw + .5;
    const fy = wcs.referenceDimension[1] + .5 - (v + .5) * wcs.referenceDimension[1] / rh;
    return rayToOverlayPlane(wcsPixelRay(wcs, fx, fy), frame);
  });
}
