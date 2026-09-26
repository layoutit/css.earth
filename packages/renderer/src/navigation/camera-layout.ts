import type { CameraPlan } from './types.js';
export interface ResponsiveZoomOptions { plan: CameraPlan; mobile: boolean; framingReferenceZoom?: number; viewport: import('./camera-viewport.js').CameraViewport; }
import { smoothstep } from "@cssearth/engine";

/** Share of a phone's open scene area (width, and height between header and drawer) the focus body spans on arrival. */
export const MOBILE_OPEN_AREA_SHARE = .75;

export function selectPreparedResponsiveZoom({
  plan,
  mobile,
  framingReferenceZoom = plan.defaultZoom,
  viewport,
}: ResponsiveZoomOptions) {
  const fit = plan.responsiveFit;
  const numericFields = [
    fit?.portraitBaseWidthShare,
    fit?.narrowPortraitWidthShareGain,
    fit?.landscapeWidthShareGain,
    fit?.narrowPortraitAspectRatio,
    fit?.portraitAspectRatio,
    fit?.squareAspectRatio,
    fit?.maximumHeightShare,
    fit?.maximumMobilePreviewShare,
    fit?.minimumZoom,
    fit?.maximumZoom,
    plan.logicalBodyDiameter,
    framingReferenceZoom,
  ];
  if (fit?.model !== "continuous-aspect-smoothstep" ||
      numericFields.some((value) => !Number.isFinite(value)) ||
      fit.narrowPortraitAspectRatio >= fit.portraitAspectRatio ||
      fit.portraitAspectRatio >= fit.squareAspectRatio ||
      fit.maximumMobilePreviewShare <= 0 ||
      fit.maximumMobilePreviewShare > 1) {
    throw new TypeError("Continuous responsive planet fit is invalid.");
  }
  if (!plan.projection) throw new TypeError('Responsive framing requires a physical camera.');
  const measured = viewport.read(plan.projection.cssPerspective);
  const stageBounds = measured.bounds;
  const aspectRatio = stageBounds.width / stageBounds.height;
  const narrowPortraitProgress = smoothstep(
    fit.narrowPortraitAspectRatio,
    fit.portraitAspectRatio,
    aspectRatio,
  );
  const landscapeProgress = smoothstep(
    fit.portraitAspectRatio,
    fit.squareAspectRatio,
    aspectRatio,
  );
  const widthShare = fit.portraitBaseWidthShare +
    fit.narrowPortraitWidthShareGain * (1 - narrowPortraitProgress) +
    fit.landscapeWidthShareGain * landscapeProgress;
  const mobilePreviewBounds = mobile
    ? { top: measured.previewTop ?? 0 }
    : null;
  const maximumMobileDiameter = mobile && mobilePreviewBounds && mobilePreviewBounds.top > 0
    ? mobilePreviewBounds.top * fit.maximumMobilePreviewShare
    : Number.POSITIVE_INFINITY;
  // A phone frames the body in the area its header and drawer leave open, a step larger than the
  // authored portrait share: the open area is what the viewer actually sees.
  // An elongated body reaches past its volume-equivalent diameter; its framing scale keeps the whole shape in the area.
  const openHeight = mobile && measured.openArea ? measured.openArea.bottom - measured.openArea.top : null;
  const openShare = MOBILE_OPEN_AREA_SHARE * (plan.framingScale ?? 1);
  const targetDiameter = openHeight !== null
    ? Math.min(stageBounds.width * Math.max(widthShare, openShare), openHeight * openShare)
    : Math.min(
      stageBounds.width * widthShare,
      stageBounds.height * fit.maximumHeightShare,
      maximumMobileDiameter,
    );
  const framingRatio = targetDiameter / plan.logicalBodyDiameter;
  const zoom = framingRatio * framingReferenceZoom;
  return Object.freeze({ model: fit.model, widthShare, zoom });
}
