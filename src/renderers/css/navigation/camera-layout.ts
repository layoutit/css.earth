import type { CameraPlan, TrackballMetrics } from './types.js';
export interface ResponsiveZoomOptions { stage: HTMLElement; cameraElement: HTMLElement; plan: CameraPlan; mobile: boolean; mobilePreviewElement?: HTMLElement | null; framingReferenceZoom?: number; }
export interface TrackballLayoutOptions { stage: HTMLElement; cameraElement: HTMLElement; logicalBodyDiameter: number; sceneScale?: number; }
import { preparedCameraZoomScale } from "../rendering/prepared-camera-runtime.js";
import { BASE_TILE } from "@layoutit/polycss";
import { isTrackballMetrics, smoothstep, clamp } from "@cssearth/engine";

export function selectPreparedResponsiveZoom({
  stage,
  cameraElement,
  plan,
  mobile,
  mobilePreviewElement,
  framingReferenceZoom = plan.defaultZoom,
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
  const stageBounds = stage?.getBoundingClientRect();
  const cameraBounds = cameraElement?.getBoundingClientRect();
  if (!stageBounds?.width || !stageBounds.height || !cameraBounds.width) {
    throw new TypeError("Responsive planet viewport bounds are invalid.");
  }
  const shellScale = cameraBounds.width / stageBounds.width /
    preparedCameraZoomScale(cameraElement);
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
    ? mobilePreviewElement?.getBoundingClientRect()
    : null;
  const maximumMobileDiameter = mobile && mobilePreviewBounds && mobilePreviewBounds.top > 0
    ? mobilePreviewBounds.top * fit.maximumMobilePreviewShare
    : Number.POSITIVE_INFINITY;
  const targetDiameter = Math.min(
    stageBounds.width * widthShare,
    stageBounds.height * fit.maximumHeightShare,
    maximumMobileDiameter,
  );
  const framingRatio = targetDiameter / (plan.logicalBodyDiameter * shellScale);
  // A physical dolly names zoom relative to the authored default framing;
  // its distance bounds own the physical limits. The legacy scale bounds
  // cannot constrain the viewport's requested diameter on this path.
  const zoom = plan.projection?.model === 'css-perspective-shared-with-sky'
    ? framingRatio * framingReferenceZoom
    : clamp(framingRatio, fit.minimumZoom, fit.maximumZoom);
  return Object.freeze({ model: fit.model, widthShare, zoom });
}

export function measureRetainedPlanetTrackball({
  stage,
  cameraElement,
  logicalBodyDiameter,
  sceneScale = 1 / BASE_TILE,
}: TrackballLayoutOptions): TrackballMetrics {
  if (!Number.isFinite(sceneScale) || sceneScale <= 0) {
    throw new TypeError("Retained planet scene scale is invalid.");
  }
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = cameraElement.getBoundingClientRect();
  const view = cameraElement.ownerDocument.defaultView;
  if (!view) throw new Error("Camera document has no window.");
  const style = view.getComputedStyle(cameraElement);
  const scale = retainedPlanetUniformScale(style.scale) ?? Math.min(
    cameraBounds.width / stageBounds.width,
    cameraBounds.height / stageBounds.height,
  );
  const perspective = Number.parseFloat(style.perspective);
  const depthRadius = logicalBodyDiameter * BASE_TILE / 2;
  if (!Number.isFinite(perspective) || perspective <= depthRadius) {
    throw new TypeError("Retained planet camera perspective is invalid.");
  }
  const distance = perspective / depthRadius;
  const centerX = (cameraBounds.left + cameraBounds.right) / 2;
  const centerY = (cameraBounds.top + cameraBounds.bottom) / 2;
  const origin = style.perspectiveOrigin?.trim().split(/\s+/u) ?? [];
  const originOffset = (value: string | undefined, size: number) => value === undefined ? 0 :
    (value.endsWith("%") ? Number.parseFloat(value) / 100 * size :
      Number.parseFloat(value)) - size / 2;
  const surfaceRadius = perspective * sceneScale * scale /
    Math.sqrt(distance ** 2 - 1);
  const metrics = {
    centerX,
    centerY,
    opticalCenterX: centerX + scale * originOffset(origin[0],
      cameraElement.offsetWidth ?? cameraBounds.width / scale),
    opticalCenterY: centerY + scale * originOffset(origin[1],
      cameraElement.offsetHeight ?? cameraBounds.height / scale),
    radius: logicalBodyDiameter * scale / 2,
    surfaceRadius,
    focalLength: perspective * sceneScale * scale,
    viewportWidth: stageBounds.width,
    viewportCenterX: (stageBounds.left ?? 0) + stageBounds.width / 2,
    viewportCenterY: (stageBounds.top ?? 0) + stageBounds.height / 2,
  };
  if (!isTrackballMetrics(metrics)) {
    throw new TypeError("Retained planet trackball bounds are invalid.");
  }
  return metrics;
}

export function measureRetainedPlanetFlyToDisc({
  stage,
  cameraElement,
  logicalBodyDiameter,
}: Omit<TrackballLayoutOptions, "sceneScale">) {
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = cameraElement.getBoundingClientRect();
  const scale = Math.min(
    cameraBounds.width / stageBounds.width,
    cameraBounds.height / stageBounds.height,
  );
  const metrics = Object.freeze({
    centerX: (cameraBounds.left + cameraBounds.right) / 2,
    centerY: (cameraBounds.top + cameraBounds.bottom) / 2,
    radius: logicalBodyDiameter * scale / 2,
  });
  if (!isTrackballMetrics(metrics)) {
    throw new TypeError("Retained planet fly-to disc is invalid.");
  }
  return metrics;
}

export function retainedPlanetUniformScale(value: string) {
  if (typeof value !== "string" || value === "none") return null;
  const components = value.trim().split(/\s+/u).slice(0, 2)
    .map(Number);
  if (components.length === 0 || components.some((component) =>
    !Number.isFinite(component) || component <= 0)) return null;
  return Math.min(...components);
}
