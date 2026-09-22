import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { CameraPlan, PerspectiveCameraPlan, CameraUpdate, LevelOfDetailPlan, OrbitLineFade } from './types.js';
import type { BodyProjection } from '../solar-system/types.js';
import type { Matrix3dLike, VisibleRect } from '../solar-system/types.js';
import type { PositionM } from '@cssearth/engine';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';
import type { CameraViewport } from './camera-viewport.js';
import { presentWorldCamera, worldCameraFromCenteredPresentation, worldCameraFromPresentation, worldCameraSilhouetteDiameter } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { scaleWorldPosition, validateWorldPosition } from './world-camera-math.js';
export interface PerspectiveWorldContext {
  readonly frame: PreparedWorldCameraFrame;
  readonly bodyRadiusUnits: number;
  readonly maximumExtentUnits: number;
  readonly kilometersPerUnit: number;
  /** Optional authored alias calibration for legacy retained Sun framing. */
  readonly framingReferenceZoom?: number;
  /** Optional authored cubic-sky registration for a physical observer. */
  readonly sceneRegistration?: string;
  readonly onWorldPublish?: (world: WorldCameraPose, viewport: WorldCameraViewport) => void;
}
export interface PerspectiveDollyOptions { cameraPlan: CameraPlan; worldContext: PerspectiveWorldContext; cameraElement: HTMLElement; sceneElement: HTMLElement; skyElement: HTMLElement; stage: HTMLElement; viewport?: CameraViewport;
  /** Prepared activation groups of the mesh; a resolving mesh returns through them in stages. */
  revealGroups?: readonly (readonly HTMLElement[])[];
  /** False while the mesh has no committed material; it stays hidden until then. */
  canReveal?: () => boolean; }
export type PerspectiveDolly = ReturnType<typeof createPerspectiveDolly>;
import {
  distanceForSilhouetteRadius,
  rotationFromMatrix3d,
  silhouetteRadiusAtDistance,
} from "../solar-system/heliocentric-geometry.js";

// A true perspective camera for the shared orbit: the eye sits at the sky's
// vanishing point (the camera root's CSS perspective, re-read whenever the
// viewport or the shell layout changes) and frames by dolly. The prepared
// camera plan declares it with `projection.model`, its wheel `dolly`, the
// `orbitLineFade` and the `levelOfDetail` crossfade; the prepared world
// camera places the body in float64.
//
// Zoom stays the framing alias the responsive fit, the destination flights
// and the material overlays speak: silhouette diameter over the logical body
// diameter, times the default zoom.
//
// A plan may also opt into `drag: { model: "screen-axis-tumble" }`: every
// pointer sample is taken as if it started at the trackball's centre, so a
// drag anywhere on screen tumbles the scene about the screen axes. The
// shared virtual trackball twists the scene about the view axis once the
// pointer leaves its disc, which at a far dolly (the body a few pixels wide,
// the disc a fifth of the viewport) is nearly everywhere: measured as a
// 0.99 roll share and 11-27 degrees per 240 px stroke off-centre against
// 82 degrees of pure tumble at the centre. Rotation itself is unbounded on
// every path; the control pitch anchors in the plan calibrate the affine
// control-to-scene map and clamp nothing.
//
// The world context supplies the authored physical extent and publishes the
// same eye to the retained contextual layers.
export const PERSPECTIVE_PROJECTION_MODEL = "css-perspective-shared-with-sky";
export const SCENE_LOCKED_SKY_CAMERA_CONTRACT =
  "scene-locked-unbounded-accumulated-matrix3d";

export function isPerspectiveCameraPlan(plan: CameraPlan | null | undefined): plan is PerspectiveCameraPlan {
  return plan?.projection?.model === PERSPECTIVE_PROJECTION_MODEL;
}

function assertPerspectiveCameraPlan(plan: CameraPlan): asserts plan is PerspectiveCameraPlan {
  if (plan?.projection?.model !== PERSPECTIVE_PROJECTION_MODEL ||
      typeof plan.projection.cssPerspective !== "string" ||
      !plan.projection.cssPerspective ||
      plan.dolly?.model !== "multiplicative-wheel-distance" ||
      !Number.isFinite(plan.dolly.wheelStepPerDelta) ||
      !Number.isFinite(plan.dolly.minimumDistanceRadii) ||
      !Number.isFinite(plan.dolly.maximumDistanceOverOrbitExtent) ||
      (plan.drag !== undefined && plan.drag?.model !== "screen-axis-tumble") ||
      !plan.orbitLineFade ||
      !Number.isFinite(plan.orbitLineFade.visibleBelowDiscHeightShare) ||
      !Number.isFinite(plan.orbitLineFade?.hiddenAboveDiscHeightShare) ||
      !(plan.orbitLineFade.hiddenAboveDiscHeightShare >
        plan.orbitLineFade.visibleBelowDiscHeightShare) ||
      plan.levelOfDetail?.model !== "silhouette-diameter-crossfade" ||
      !(plan.levelOfDetail.billboardFadeStartDiscPixels >
        plan.levelOfDetail.billboardFullDiscPixels) ||
      !(plan.levelOfDetail.billboardFullDiscPixels >
        plan.levelOfDetail.markerFadeStartDiscPixels) ||
      !(plan.levelOfDetail.markerFadeStartDiscPixels >
        plan.levelOfDetail.markerFullDiscPixels) ||
      !(plan.levelOfDetail.markerFullDiscPixels > 0) ||
      !Number.isFinite(plan.logicalBodyDiameter) ||
      !(plan.defaultZoom > 0) || !(plan.maximumZoom > 0) ||
      !Number.isFinite(plan.sceneScale)) {
    throw new TypeError("Perspective camera contract drifted.");
  }


}

export function validatePerspectiveCameraPlan(plan: CameraPlan): PerspectiveCameraPlan {
  assertPerspectiveCameraPlan(plan);
  return plan;
}

// The stage from the projected disc. Presentation policy: a resolving body goes
// from its marker straight to its mesh; no billboard disc is drawn. The marker
// fades in over the mesh, which stays painted until the marker is opaque and
// then hides. The prepared billboard band only times the selected navigation
// marker's fade over the mesh (`proxyOpacity`).
export function levelOfDetailFor(levelOfDetail: LevelOfDetailPlan, silhouetteDiameter: number) {
  const proxyOpacity = clamp(
    (levelOfDetail.billboardFadeStartDiscPixels - silhouetteDiameter) /
      (levelOfDetail.billboardFadeStartDiscPixels -
        levelOfDetail.billboardFullDiscPixels),
    0,
    1,
  );
  const markerOpacity = clamp(
    (levelOfDetail.markerFadeStartDiscPixels - silhouetteDiameter) /
      (levelOfDetail.markerFadeStartDiscPixels -
        levelOfDetail.markerFullDiscPixels),
    0,
    1,
  );
  const stage = markerOpacity >= 1 ? "marker" : "geometry";
  return Object.freeze({
    stage,
    silhouetteDiameter,
    billboardOpacity: 0,
    markerOpacity,
    proxyOpacity,
  });
}

export function orbitLineOpacity(fade: OrbitLineFade, discHeightShare: number) {
  return clamp(
    (fade.hiddenAboveDiscHeightShare - discHeightShare) /
      (fade.hiddenAboveDiscHeightShare - fade.visibleBelowDiscHeightShare),
    0,
    1,
  );
}

export function createPerspectiveDolly({
  cameraPlan: unvalidatedCameraPlan,
  worldContext,
  cameraElement,
  sceneElement,
  skyElement,
  stage,
  viewport,
  revealGroups = [],
  canReveal,
}: PerspectiveDollyOptions) {
  const cameraPlan = validatePerspectiveCameraPlan(unvalidatedCameraPlan);
  // The shell's shared viewport; publication shadows the name with its own optics below.
  const sharedViewport = viewport;
  if (!worldContext) throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  const bodyRadius = worldContext.bodyRadiusUnits;
  const kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumExtent = worldContext.maximumExtentUnits;
  if (!(bodyRadius > 0) || !(kilometersPerUnit > 0) || !(maximumExtent > 0) ||
      !cameraElement?.style || !sceneElement?.style || !skyElement || !stage) {
    throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  }
  const levelOfDetail = cameraPlan.levelOfDetail;
  const framingReferenceZoom = worldContext.framingReferenceZoom ?? cameraPlan.defaultZoom;
  if (!(framingReferenceZoom > 0)) throw new TypeError('Perspective framing reference zoom must be positive.');
  if (Math.abs(worldContext.frame.metersPerUnit / (kilometersPerUnit * 1000) - 1) > 1e-9 ||
      Math.abs(worldContext.frame.bodyRadiusM / (bodyRadius * kilometersPerUnit * 1000) - 1) > 1e-9) {
    throw new TypeError('Perspective world context units disagree with its prepared frame.');
  }
  const maximumDistance = cameraPlan.dolly.maximumDistanceOverOrbitExtent * maximumExtent;
  // Object packages own their prepared perspective as data; the root is never
  // scaled, so its eye is the one the world context publishes.
  cameraElement.style.perspective = cameraPlan.projection.cssPerspective;
  cameraElement.style.scale = '1';
  const cameraState = {
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    distance: 0,
  };
  // Null is the original centred dolly. A world publication adopts a full
  // eye-space centre, retained across drag, wheel and viewport changes.
  let bodyCenter: PositionM | null = null;
  let zoomOutCentering = false;
  // The zoom alias last set, while the distance still corresponds to it: the
  // alias round trip through the focal length is exact only to floating
  // point, and a camera state set by zoom reads back the same number.
  let aliasZoom: number | null = null;
  let aliasDistance: number | null = null;
  let focal = 0;
  let viewportWidth = 1;
  let viewportHeight = 1;
  // The eye sits at the sky's vanishing point; the shell lays the body's root
  // out beside its chrome, so the body is viewed slightly off-axis. The
  // offset is the principal point relative to the root's centre.
  let principalOffset = Object.freeze([0, 0]);
  let stageViewport: WorldCameraViewport;
  // The stage's rectangle relative to the root's centre: what is actually on
  // screen when the shell lays the root out partly beyond the stage.
  let visibleRect: VisibleRect | null = null;
  let projectedBody: BodyProjection | null = null;
  let lod = levelOfDetailFor(levelOfDetail, Number.POSITIVE_INFINITY);
  let publishedSceneTransform: string | null = null;
  let transformWrites = 0;

  const measure = () => {
    if (viewport) {
      const snapshot = viewport.read(cameraPlan.projection.cssPerspective);
      focal = snapshot.focalPixels;
      viewportWidth = snapshot.bounds.width;
      viewportHeight = snapshot.bounds.height;
      // Centre the focus on the scene area the shell leaves open (a phone's header and drawer cover the rest).
      // The camera root moves there whole, so inside it the dolly stays on-axis; consumers in stage coordinates
      // (world context, sky, volumes) read the same shift as the stage viewport's principal offset.
      const open = snapshot.openArea;
      const offsetY = open ? (open.top + open.bottom) / 2 - (snapshot.bounds.top + viewportHeight / 2) : 0;
      principalOffset = Object.freeze([0, 0]);
      stageViewport = Object.freeze({ focalPixels: focal, widthPixels: viewportWidth,
        heightPixels: viewportHeight, principalOffsetPixels: [0, offsetY] as const });
      visibleRect = Object.freeze({ left: -viewportWidth / 2, right: viewportWidth / 2,
        top: -viewportHeight / 2 - offsetY, bottom: viewportHeight / 2 - offsetY });
      cameraElement.style.perspectiveOrigin = '50% 50%';
      cameraElement.style.translate = offsetY ? `0 ${formatNumber(offsetY)}px` : '';
      return;
    }
    const view = cameraElement.ownerDocument.defaultView;
    if (!view) throw new Error("Perspective camera document has no window.");
    const nextFocal = parseFloat(view.getComputedStyle(cameraElement).perspective);
    const bounds = cameraElement.getBoundingClientRect();
    if (!(nextFocal > 0) || !(bounds.width > 0) || !(bounds.height > 0)) {
      throw new Error("Perspective camera root has no projection.");
    }
    focal = nextFocal;
    viewportWidth = bounds.width;
    viewportHeight = bounds.height;
    const skyBounds = skyElement.getBoundingClientRect();
    const [skyOriginX, skyOriginY] = view.getComputedStyle(skyElement)
      .perspectiveOrigin.split(" ").map(parseFloat);
    principalOffset = Object.freeze([
      skyBounds.x + skyOriginX - (bounds.x + bounds.width / 2),
      skyBounds.y + skyOriginY - (bounds.y + bounds.height / 2),
    ].map((value) => Number.isFinite(value) ? value : 0));
    const stageBounds = stage.getBoundingClientRect();
    const rootCentre = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
    stageViewport = Object.freeze({ focalPixels: focal,
      widthPixels: stageBounds.width, heightPixels: stageBounds.height,
      principalOffsetPixels: [rootCentre[0] - stageBounds.x - stageBounds.width / 2 + principalOffset[0],
        rootCentre[1] - stageBounds.y - stageBounds.height / 2 + principalOffset[1]] as const });
    const candidate = {
      left: Math.max(stageBounds.x, bounds.x) - rootCentre[0],
      top: Math.max(stageBounds.y, bounds.y) - rootCentre[1],
      right: Math.min(stageBounds.x + stageBounds.width, bounds.x + bounds.width) - rootCentre[0],
      bottom: Math.min(stageBounds.y + stageBounds.height, bounds.y + bounds.height) - rootCentre[1],
    };
    visibleRect = candidate.right > candidate.left && candidate.bottom > candidate.top
      ? Object.freeze(candidate) : null;
    const origin = `calc(50% + ${formatNumber(principalOffset[0])}px) ` +
      `calc(50% + ${formatNumber(principalOffset[1])}px)`;
    cameraElement.style.perspectiveOrigin = origin;
  };
  const zoomToDistance = (zoom: number) => distanceForSilhouetteRadius(
    bodyRadius,
    focal,
    zoom / framingReferenceZoom * cameraPlan.logicalBodyDiameter / 2,
    principalOffset,
  );
  // The round trip through the distance is exact only to floating point;
  // the alias reports the prepared bound itself at the bound.
  const distanceToZoom = (distance: number) => {
    // The world observer may legally sit closer than the authored input
    // range. Saturate input calibration there without moving that observer
    // or asking a centred tangent cone that crosses the eye to define zoom.
    if (bodyCenter !== null && distance < minimumDistance()) return distanceToZoom(minimumDistance());
    const zoom = silhouetteRadiusAtDistance(bodyRadius, focal, distance, principalOffset) *
      2 / cameraPlan.logicalBodyDiameter * framingReferenceZoom;
    return Math.abs(zoom - cameraPlan.maximumZoom) < 1e-9 ? cameraPlan.maximumZoom : zoom;
  };
  const minimumDistance = () => Math.max(
    cameraPlan.dolly.minimumDistanceRadii * bodyRadius,
    zoomToDistance(cameraPlan.maximumZoom),
  );
  const clampDistance = (distance: number) =>
    clamp(distance, minimumDistance(), maximumDistance);
  const minimumZoom = () => distanceToZoom(maximumDistance);
  const maximumZoom = () => cameraPlan.maximumZoom;
  measure();
  // The prepared default framing until the responsive fit is selected: the
  // camera is never inside the body, even before its first publication.
  cameraState.distance = clampDistance(zoomToDistance(cameraPlan.defaultZoom));

  const camera = Object.freeze({
    get state() {
      return Object.freeze({
        rotX: cameraState.rotX,
        rotY: cameraState.rotY,
        distance: cameraState.distance,
        zoom: aliasZoom !== null && cameraState.distance === aliasDistance
          ? aliasZoom
          : distanceToZoom(cameraState.distance),
      });
    },
    update(partial: CameraUpdate) {
      const previousDistance = cameraState.distance;
      const constrain = bodyCenter === null ? clampDistance : (distance: number) => clamp(distance,
        Math.min(minimumDistance(), previousDistance), Math.max(maximumDistance, previousDistance));
      if (partial.rotX !== undefined) cameraState.rotX = partial.rotX;
      if (partial.rotY !== undefined) cameraState.rotY = partial.rotY;
      if (partial.distanceKilometers !== undefined) {
        cameraState.distance = constrain(partial.distanceKilometers / kilometersPerUnit);
      } else if (partial.distance !== undefined) {
        cameraState.distance = constrain(partial.distance);
      } else if (partial.zoom !== undefined) {
        const clampedZoom = clamp(partial.zoom, minimumZoom(), maximumZoom());
        const requested = zoomToDistance(clampedZoom);
        cameraState.distance = constrain(requested);
        aliasZoom = cameraState.distance === requested ? clampedZoom : null;
        aliasDistance = cameraState.distance;
      }
      if (bodyCenter !== null && cameraState.distance !== previousDistance) {
        if (zoomOutCentering && cameraState.distance > previousDistance) {
          // Dolly back along the content-centre ray. Its perpendicular offset
          // stays fixed in world units, so the body drifts toward the centre
          // naturally as the user zooms out. There is no separate camera turn.
          const axisLength = Math.hypot(principalOffset[0], principalOffset[1], focal);
          const axis: PositionM = [-principalOffset[0] / axisLength, -principalOffset[1] / axisLength, -focal / axisLength];
          const along = bodyCenter.reduce((sum, value, index) => sum + value * axis[index]!, 0);
          if (along > 0) {
            const across: PositionM = [bodyCenter[0] - axis[0] * along,
              bodyCenter[1] - axis[1] * along, bodyCenter[2] - axis[2] * along];
            const nextAlong = Math.sqrt(Math.max(0, cameraState.distance ** 2 - Math.hypot(...across) ** 2));
            bodyCenter = [across[0] + axis[0] * nextAlong, across[1] + axis[1] * nextAlong, across[2] + axis[2] * nextAlong];
          } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
        } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
      }
    },
  });

  // Presentation policy: the detailed mesh is drawn only once it outgrows its
  // proxy. In the marker stage the opaque marker or point-source star stands for
  // the body. A mesh there adds a few pixels yet keeps hundreds of composited 3D
  // leaves alive, so it leaves layout until the body resolves.
  // On entry its prepared groups join across frames, so the leaves' layers are
  // created across paints. Each frame admits whole groups up to a leaf budget:
  // a fixed frame count gave Uranus 384 leaves per frame, whose style, layerize
  // and paint took 15 ms and dropped the frame. The proxy beneath carries the
  // body's colour.
  const REVEAL_LEAVES_PER_FRAME = 128;
  const revealView = cameraElement.ownerDocument.defaultView;
  const revealClock = revealView && createOpacityClock(revealView);
  const revealed = new Uint8Array(revealGroups.length).fill(1);
  let revealCount = revealGroups.length, revealFrame: number | null = null;
  // Flight activation writes the same nodes while the scene is hidden, so the
  // entry reset checks each node rather than the cached group state.
  const revealTo = (count: number, reset = false) => {
    revealCount = count;
    for (let group = 0; group < revealed.length; group++) {
      const show = group < count ? 1 : 0;
      if (!reset && revealed[group] === show) continue;
      revealed[group] = show;
      const display = show ? '' : 'none';
      for (const node of revealGroups[group]!) if (node.style.display !== display) node.style.display = display;
    }
  };
  const continueReveal = () => {
    revealFrame = null;
    if (sceneElement.hidden || revealCount >= revealGroups.length) return;
    let count = revealCount, leaves = 0;
    do leaves += revealGroups[count++]!.length;
    while (count < revealGroups.length && leaves + revealGroups[count]!.length <= REVEAL_LEAVES_PER_FRAME);
    revealTo(count);
    if (revealCount < revealGroups.length) revealFrame = revealClock!.request(continueReveal);
  };
  const capturePresentation = (sceneMatrix: Matrix3dLike, scenePresentation: string) => ({
    distance: cameraState.distance, rotation: rotationFromMatrix3d(sceneMatrix), scenePresentation,
    bodyCenter: bodyCenter === null ? null : [...bodyCenter] as PositionM,
    focal, viewportWidth, viewportHeight, principalOffset, stageViewport,
  });
  function publishPresentation(snapshot: ReturnType<typeof capturePresentation>, publishedWorld: WorldCameraPose | null) {
      const { distance, rotation, focal, viewportWidth, viewportHeight,
        principalOffset, stageViewport, scenePresentation } = snapshot;
      const viewport = { focalPixels: focal, principalOffsetPixels: [principalOffset[0], principalOffset[1]] as const };
      const genericPresentation = publishedWorld ? presentWorldCamera(publishedWorld, worldContext.frame, viewport) : null;
      const [bodyX, bodyY, bodyZ] = genericPresentation?.translateCssPixels ?? [0, 0, focal - distance];
      if (publishedWorld) worldContext.onWorldPublish?.(publishedWorld, sharedViewport
        ? { focalPixels: focal, principalOffsetPixels: stageViewport.principalOffsetPixels } : viewport);
      const genericBody = genericPresentation === null ? undefined : genericBodyProjection(
        genericPresentation, bodyRadius, focal,
      );
      projectedBody = genericBody ?? null;
      if (projectedBody) lod = levelOfDetailFor(levelOfDetail, projectedBody.silhouetteDiameter);
      // A marker-stage body is its proxy (see the presentation policy above).
      // An undrawn mesh publishes no material, so it also waits for the one its
      // resolving camera commits instead of revealing an untextured globe.
      const hidden = lod.stage === 'marker' || (canReveal !== undefined && !canReveal());
      // A hidden scene draws nothing: its transform is formatted and written only
      // while shown, so marker-stage motion and fly-tos skip it, and the entry
      // below writes the current pose before the scene is shown.
      if (!hidden) {
        const transform =
          `translate3d(${formatNumber(bodyX)}px, ${formatNumber(bodyY)}px, ` +
          `${formatNumber(bodyZ)}px) ` +
          `scale3d(${cameraPlan.sceneScale}, ${cameraPlan.sceneScale}, ` +
          `${cameraPlan.sceneScale}) ${scenePresentation}`;
        if (transform !== publishedSceneTransform) {
          sceneElement.style.transform = transform;
          publishedSceneTransform = transform;
          transformWrites += 1;
        }
      }
      if (revealGroups.length && revealView) {
        if (hidden && revealFrame !== null) { revealClock!.cancel(revealFrame); revealFrame = null; }
        if (!hidden && sceneElement.hidden) {
          revealTo(0, true);
          revealFrame = revealClock!.request(continueReveal);
        }
      }
      if (sceneElement.hidden !== hidden) sceneElement.hidden = hidden;
      // Raw prepared scene coordinates to the physical eye. Overlay and page
      // consumers compose their own retained body transforms after this matrix.
      const scale = cameraPlan.sceneScale;
      const physicalProjection = physicalProjectionFromCamera(rotation,
        [bodyX - principalOffset[0], bodyY - principalOffset[1], bodyZ - focal], scale, viewport);
      return Object.freeze({
        distance,
        projection: physicalProjection,
        stageViewport,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        ...(genericBody === undefined ? {} : { body: genericBody, levelOfDetail: lod }),
      });
  }
  function preparePresentation(sceneMatrix: Matrix3dLike, scenePresentation: string) {
    const snapshot = capturePresentation(sceneMatrix, scenePresentation);
    const world = snapshot.bodyCenter === null
      ? worldCameraFromCenteredPresentation({ rotation: snapshot.rotation, distanceUnits: snapshot.distance }, worldContext.frame,
        { focalPixels: snapshot.focal, principalOffsetPixels: [snapshot.principalOffset[0], snapshot.principalOffset[1]] })
      : worldCameraFromPresentation({ rotation: snapshot.rotation, bodyCenterUnits: snapshot.bodyCenter }, worldContext.frame);
    return { world, viewport: snapshot.stageViewport,
      commit: () => publishPresentation(snapshot, world) };
  }

  return Object.freeze({
    camera,
    measure,
    viewport(): WorldCameraViewport {
      return { focalPixels: focal, principalOffsetPixels: [principalOffset[0], principalOffset[1]] };
    },
    bodyCenter: () => bodyCenter,
    setZoomOutCentering(enabled: boolean) { zoomOutCentering = enabled; },
    setBodyCenter(next: PositionM) {
      validateWorldPosition(next);
      const distance = Math.hypot(...next);
      if (distance <= bodyRadius) throw new RangeError('The world camera is inside the focused body.');
      bodyCenter = [next[0], next[1], next[2]];
      cameraState.distance = distance;
      aliasZoom = null;
    },
    centerBody() { bodyCenter = null; },
    // The alias bounds: the prepared close framing and the whole-orbit dolly
    // distance seen through the same alias.
    minimumZoom,
    maximumZoom,
    // Re-clamps the distance after the viewport (and so the focal length)
    // changed.
    reclamp() {
      camera.update({ distance: cameraState.distance });
    },
    // Re-measures the projection and keeps the framing: the zoom alias (the
    // silhouette's size on screen) survives a viewport or layout change the
    // way the scale camera's zoom does, so the distance follows the focal
    // length (clamped to the prepared bounds).
    remeasure() {
      const zoom = camera.state.zoom;
      measure();
      if (bodyCenter === null) camera.update({ zoom });
    },
    // Places the body for the accumulated scene rotation: its centre
    // `distance` from the eye on the line that projects to the root's centre,
    // then the rotation. The scene
    // scale must be uniform in three dimensions: a 2D scale() leaves the
    // body's depth unscaled, which a real perspective camera notices.
    prepare: preparePresentation,
    publish(sceneMatrix: Matrix3dLike, scenePresentation: string) {
      return preparePresentation(sceneMatrix, scenePresentation).commit();
    },
    // The drag trackball: the projected silhouette. A small body still orbits
    // comfortably: the trackball never shrinks below a fifth of the
    // viewport's short side, and the sphere the drag rides is that disc.
    trackball() {
      const sharedBounds = viewport?.read(cameraPlan.projection.cssPerspective).bounds;
      const bounds = sharedBounds ?? cameraElement.getBoundingClientRect();
      const stageBounds = sharedBounds ?? stage.getBoundingClientRect();
      const silhouette = projectedBody?.silhouette;
      const centerX = bounds.x + bounds.width / 2 + (silhouette?.centre[0] ?? 0);
      const centerY = bounds.y + bounds.height / 2 + (silhouette?.centre[1] ?? 0);
      const radius = Math.max(
        Number.isFinite(projectedBody?.silhouetteRadius) ? projectedBody!.silhouetteRadius
          : Math.hypot(viewportWidth, viewportHeight),
        Math.min(viewportWidth, viewportHeight) / 5,
      );
      return Object.freeze({
        centerX,
        centerY,
        opticalCenterX: bounds.x + bounds.width / 2 + principalOffset[0],
        opticalCenterY: bounds.y + bounds.height / 2 + principalOffset[1],
        radius,
        surfaceRadius: radius,
        focalLength: focal,
        viewportWidth: stageBounds.width,
        viewportCenterX: (stageBounds.left ?? 0) + stageBounds.width / 2,
        viewportCenterY: (stageBounds.top ?? 0) + stageBounds.height / 2,
        // Pointer samples are re-based to the centre: tumble everywhere.
        tumbleOnly: cameraPlan.drag?.model === "screen-axis-tumble",
      });
    },
    state() {
      const bodyCenterKilometers: PositionM | undefined = bodyCenter === null ? undefined
        : scaleWorldPosition(bodyCenter, kilometersPerUnit);
      return Object.freeze({
        distance: cameraState.distance,
        distanceKilometers: cameraState.distance * kilometersPerUnit,
        distanceRadii: cameraState.distance / bodyRadius,
        levelOfDetail: lod,
        focal,
        principalOffset,
        visibleRect,
        offAxisDegrees: projectedBody?.offAxisDegrees ?? null,
        silhouetteRadius: projectedBody?.silhouetteRadius ?? null,
        ...(bodyCenterKilometers === undefined ? {} : { bodyCenterKilometers }),
      });
    },
    levelOfDetail: () => lod,
    stats({ wheelDollies = 0 } = {}) {
      return Object.freeze({
        projection: cameraPlan.projection,
        dolly: Object.freeze({
          ...cameraPlan.dolly,
          minimumDistance: minimumDistance(),
          maximumDistance,
          minimumDistanceKilometers: minimumDistance() * kilometersPerUnit,
          maximumDistanceKilometers: maximumDistance * kilometersPerUnit,
          maximumDistanceOverOrbitExtentEffective: maximumDistance / maximumExtent,
          // The wheel is multiplicative: the whole range in log-distance,
          // and the mouse notches (100 delta units each) it takes end to end.
          logDistanceRange: Math.log(maximumDistance / minimumDistance()),
          wheelNotchesEndToEnd: Math.log(maximumDistance / minimumDistance()) /
            (cameraPlan.dolly.wheelStepPerDelta * 100),
          wheelDollies,
        }),
        levelOfDetail,
        orbitLineFade: cameraPlan.orbitLineFade,
        drag: cameraPlan.drag ?? null,
        // Nothing on any input path clamps the pitch or the yaw; the
        // control pitch anchors only calibrate the control-to-scene map.
        rotationBounds: "none",
        sceneTransformWrites: transformWrites,
      });
    },
  });
}

function genericBodyProjection(
  presentation: ReturnType<typeof presentWorldCamera>,
  bodyRadius: number,
  focal: number,
): BodyProjection {
  const silhouette = presentation.silhouette;
  const distance = presentation.distanceUnits;
  const depth = presentation.depthUnits;
  const silhouetteRadius = worldCameraSilhouetteDiameter(presentation, bodyRadius) / 2;
  const offAxisDegrees = Math.acos(Math.max(-1, Math.min(1, depth / distance))) * 180 / Math.PI;
  return Object.freeze({
    distance,
    depth,
    visible: silhouette !== null,
    screen: presentation.centerPixels,
    offAxisDegrees,
    silhouetteRadius,
    silhouetteDiameter: 2 * silhouetteRadius,
    silhouette,
    orthographicRadius: focal * bodyRadius / distance,
    translate: presentation.translateCssPixels,
  });
}

function formatNumber(value: number) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
