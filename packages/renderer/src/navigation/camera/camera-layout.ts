import { type CameraPlan } from '@cssearth/objects';

/** The camera plan fields the responsive fit reads; a page bakes them for its startup cover (site/startup/startup-cover.mts). */
export type ResponsiveZoomPlan = Pick<CameraPlan, 'responsiveFit' | 'logicalBodyDiameter' | 'defaultZoom' | 'framingScale' | 'maximumBodyDiameterPixels' | 'projection'>;
export interface ResponsiveZoomOptions { plan: ResponsiveZoomPlan; mobile: boolean; framingReferenceZoom?: number; viewport: import('./camera-viewport.js').CameraViewport; }
import { smoothstep } from "@cssearth/engine";

/** Share of a portrait tablet's open scene area (between header and drawer) the focus body spans on arrival.
 * Leave more room around the body: .60 is a 20% smaller diameter than the previous .75 framing. */
export const MOBILE_OPEN_AREA_SHARE = .60;
/** Phones frame a little closer while leaving the tablet fit unchanged. */
export const PHONE_OPEN_AREA_SHARE = .72;
/** A star's widest disc on arrival, in CSS pixels. A star is a plain disc, so a window larger than a laptop's only
 * enlarges it: 799 px across in a 2560 × 1310 window read as too close, where a 1728 × 995 window gives 607 px
 * (2026-10-12). Planets and moons carry detail and keep growing with the window. */
export const STAR_MAXIMUM_DIAMETER_PIXELS = 600;

/** The camera plan with what its body's class adds to the prepared fit. A star's prepared camera carries the shares
 * every body has; its limit is the shell's, so no star is baked again to change it. */
export function classFramedCamera<Camera extends { maximumBodyDiameterPixels?: number }>(camera: Camera, classification: unknown): Camera {
  return classification === 'star' ? { ...camera, maximumBodyDiameterPixels: STAR_MAXIMUM_DIAMETER_PIXELS } : camera;
}

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
  const openShare = (stageBounds.width < 700 ? PHONE_OPEN_AREA_SHARE : MOBILE_OPEN_AREA_SHARE) * (plan.framingScale ?? 1);
  const fittedDiameter = openHeight !== null
    ? Math.min(stageBounds.width * Math.max(widthShare, openShare), openHeight * openShare)
    : Math.min(
      stageBounds.width * widthShare,
      stageBounds.height * fit.maximumHeightShare,
      maximumMobileDiameter,
    );
  const targetDiameter = Math.min(fittedDiameter, plan.maximumBodyDiameterPixels ?? Number.POSITIVE_INFINITY);
  const framingRatio = targetDiameter / plan.logicalBodyDiameter;
  const zoom = framingRatio * framingReferenceZoom;
  return Object.freeze({ model: fit.model, widthShare, zoom });
}
