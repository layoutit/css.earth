/** The body's diameter on a landscape screen, as a share of the viewport width and of the focal length, when the camera
 * plan declares a responsive fit and a focal length in container widths; and the share of the viewport height the live
 * camera never lets it pass (camera-layout.ts). A page without script sizes its arrival photograph and its drawn body by
 * the same shares (ObjectLayout.astro). */
export function defaultWidthShare(camera: { responsiveFit?: { portraitBaseWidthShare?: number; landscapeWidthShareGain?: number; maximumHeightShare?: number } | null;
  projection?: { cssPerspective: string } | null }): { diameterOverWidth: number; diameterOverFocal: number; maximumDiameterOverHeight: number | null } | null {
  const focalOverWidth = Number(/^([0-9.]+)cqw$/u.exec(camera.projection?.cssPerspective ?? '')?.[1]) / 100;
  const diameterOverWidth = (camera.responsiveFit?.portraitBaseWidthShare ?? NaN) + (camera.responsiveFit?.landscapeWidthShareGain ?? NaN);
  const maximumHeightShare = camera.responsiveFit?.maximumHeightShare;
  return focalOverWidth > 0 && diameterOverWidth > 0 ? { diameterOverWidth, diameterOverFocal: diameterOverWidth / focalOverWidth,
    maximumDiameterOverHeight: maximumHeightShare !== undefined && maximumHeightShare > 0 ? maximumHeightShare : null } : null;
}
