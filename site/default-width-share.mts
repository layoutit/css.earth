/** The body's diameter on a landscape screen, as a share of the viewport width and of the focal length, when the camera
 * plan declares a responsive fit and a focal length in container widths. A page without script sizes its arrival
 * photograph by the same share (ObjectLayout.astro). */
export function defaultWidthShare(camera: { responsiveFit?: { portraitBaseWidthShare?: number; landscapeWidthShareGain?: number } | null;
  projection?: { cssPerspective: string } | null }): { diameterOverWidth: number; diameterOverFocal: number } | null {
  const focalOverWidth = Number(/^([0-9.]+)cqw$/u.exec(camera.projection?.cssPerspective ?? '')?.[1]) / 100;
  const diameterOverWidth = (camera.responsiveFit?.portraitBaseWidthShare ?? NaN) + (camera.responsiveFit?.landscapeWidthShareGain ?? NaN);
  return focalOverWidth > 0 && diameterOverWidth > 0 ? { diameterOverWidth, diameterOverFocal: diameterOverWidth / focalOverWidth } : null;
}
