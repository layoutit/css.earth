import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { CameraPlan, PerspectiveCameraPlan, Vector3, LevelOfDetailPlan, OrbitLineFade } from './types.js';
import type { BodyProjection } from '../solar-system/types.js';
import type { VisibleRect } from '../solar-system/types.js';
import type { CameraViewport } from './camera-viewport.js';
import { presentWorldCamera, worldCameraSilhouetteDiameter } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { createPreparedCamera } from './prepared-camera.js';
import { createCameraOrientation } from './camera-orientation.js';
export interface PerspectiveWorldContext {
  readonly frame: PreparedWorldCameraFrame;
  readonly bodyRadiusUnits: number;
  readonly maximumExtentUnits: number;
  readonly kilometersPerUnit: number;
  /** Optional authored alias calibration for legacy retained Sun framing. */
  readonly framingReferenceZoom?: number;
  /** Optional authored cubic-sky registration for a physical observer. */
  readonly onWorldPublish?: (world: WorldCameraPose, viewport: WorldCameraViewport) => void;
}
export interface PerspectiveDollyOptions { sunDirection?: Vector3 | null; cameraPlan: CameraPlan; worldContext: PerspectiveWorldContext; cameraElement: HTMLElement; sceneElement: HTMLElement; stage: HTMLElement; viewport: CameraViewport;
  /** Prepared activation groups of the mesh; a resolving mesh returns through them in stages. */
  revealGroups?: readonly (readonly HTMLElement[])[];
  /** False while the mesh has no committed material; it stays hidden until then. */
  canReveal?: () => boolean; }
export type PerspectiveDolly = ReturnType<typeof createPerspectiveDolly>;
export type PerspectivePublication = ReturnType<ReturnType<PerspectiveDolly['prepare']>['commit']>;


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
  stage,
  viewport,
  revealGroups = [],
  canReveal,
  sunDirection,
}: PerspectiveDollyOptions, createOrientation = createCameraOrientation) {
  const cameraPlan = validatePerspectiveCameraPlan(unvalidatedCameraPlan);
  // The shell's shared viewport; publication shadows the name with its own optics below.
  if (!worldContext) throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  const bodyRadius = worldContext.bodyRadiusUnits;
  const kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumExtent = worldContext.maximumExtentUnits;
  if (!(bodyRadius > 0) || !(kilometersPerUnit > 0) || !(maximumExtent > 0) ||
      !cameraElement?.style || !sceneElement?.style || !viewport || !stage) {
    throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  }
  const levelOfDetail = cameraPlan.levelOfDetail;
  const framingReferenceZoom = worldContext.framingReferenceZoom ?? cameraPlan.defaultZoom;
  if (!(framingReferenceZoom > 0)) throw new TypeError('Perspective framing reference zoom must be positive.');
  if (Math.abs(worldContext.frame.metersPerUnit / (kilometersPerUnit * 1000) - 1) > 1e-9 ||
      Math.abs(worldContext.frame.bodyRadiusM / (bodyRadius * kilometersPerUnit * 1000) - 1) > 1e-9) {
    throw new TypeError('Perspective world context units disagree with its prepared frame.');
  }
  // Object packages own their prepared perspective as data; the root is never
  // scaled, so its eye is the one the world context publishes.
  cameraElement.style.perspective = cameraPlan.projection.cssPerspective;
  cameraElement.style.scale = '1';
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
      heightPixels: viewportHeight, principalOffsetPixels: [0, offsetY] as const,
      ...(snapshot.coveredTopPixels ? { coveredTopPixels: snapshot.coveredTopPixels } : {}) });
    visibleRect = Object.freeze({ left: -viewportWidth / 2, right: viewportWidth / 2,
      top: -viewportHeight / 2 - offsetY, bottom: viewportHeight / 2 - offsetY });
    cameraElement.style.perspectiveOrigin = '50% 50%';
    cameraElement.style.translate = offsetY ? `0 ${formatNumber(offsetY)}px` : '';
  };
  measure();
  const camera = createPreparedCamera(cameraPlan, worldContext,
    () => ({ focalPixels: focal, principalOffsetPixels: [principalOffset[0]!, principalOffset[1]!] }),
    sunDirection, createOrientation);
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
  function publishPresentation(snapshot: ReturnType<typeof camera.captureFrame> & { focal: number; viewportWidth: number; viewportHeight: number; principalOffset: readonly number[]; stageViewport: WorldCameraViewport }) {
      const { distance, rotation, focal, viewportWidth, viewportHeight,
        principalOffset, stageViewport, scenePresentation, world: publishedWorld } = snapshot;
      const viewport = { focalPixels: focal, principalOffsetPixels: [principalOffset[0], principalOffset[1]] as const };
      const genericPresentation = presentWorldCamera(publishedWorld, worldContext.frame, viewport);
      const [bodyX, bodyY, bodyZ] = genericPresentation.translateCssPixels;
      worldContext.onWorldPublish?.(publishedWorld, { focalPixels: focal, principalOffsetPixels: stageViewport.principalOffsetPixels });
      const genericBody = genericBodyProjection(genericPresentation, bodyRadius, focal);
      projectedBody = genericBody;
      lod = levelOfDetailFor(levelOfDetail, genericBody.silhouetteDiameter);
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
        body: genericBody, levelOfDetail: lod,
      });
  }
  function preparePresentation() {
    const captured = camera.captureFrame();
    const snapshot = { ...captured, focal, viewportWidth, viewportHeight, principalOffset, stageViewport };
    return { ...captured, viewport: stageViewport, commit: () => publishPresentation(snapshot) };
  }

  return Object.freeze({
    camera,
    viewport(): WorldCameraViewport {
      return { focalPixels: focal, principalOffsetPixels: [principalOffset[0]!, principalOffset[1]!] };
    },
    remeasure() {
      const zoom = camera.state.zoom;
      measure();
      camera.reframe(zoom);
    },
    prepare: preparePresentation,
    // The drag trackball: the projected silhouette. A small body still orbits
    // comfortably: the trackball never shrinks below a fifth of the
    // viewport's short side, and the sphere the drag rides is that disc.
    trackball() {
      const sharedBounds = viewport.read(cameraPlan.projection.cssPerspective).bounds;
      const bounds = sharedBounds;
      const stageBounds = sharedBounds;
      const silhouette = projectedBody?.silhouette;
      const centerX = bounds.x + bounds.width / 2 + (silhouette?.centre[0] ?? 0);
      const centerY = bounds.y + bounds.height / 2 + (silhouette?.centre[1] ?? 0);
      const radius = Math.max(
        Number.isFinite(projectedBody?.silhouetteRadius) ? projectedBody!.silhouetteRadius
          : Math.hypot(viewportWidth, viewportHeight),
        Math.min(viewportWidth, viewportHeight) / 5,
      );
      return camera.trackball(Object.freeze({
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
      }));
    },
    state() {
      const { distance, bodyCenterKilometers } = camera.detailState();
      return Object.freeze({
        distance,
        distanceKilometers: distance * kilometersPerUnit,
        distanceRadii: distance / bodyRadius,
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
      const { maximumDistance } = camera;
      return Object.freeze({
        projection: cameraPlan.projection,
        dolly: Object.freeze({
          ...cameraPlan.dolly,
          minimumDistance: camera.minimumDistance(),
          maximumDistance,
          minimumDistanceKilometers: camera.minimumDistance() * kilometersPerUnit,
          maximumDistanceKilometers: maximumDistance * kilometersPerUnit,
          maximumDistanceOverOrbitExtentEffective: maximumDistance / maximumExtent,
          // The wheel is multiplicative: the whole range in log-distance,
          // and the mouse notches (100 delta units each) it takes end to end.
          logDistanceRange: Math.log(maximumDistance / camera.minimumDistance()),
          wheelNotchesEndToEnd: Math.log(maximumDistance / camera.minimumDistance()) /
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
