import type { WorldFramePresenter } from './world-frame-presenter.js';
import { createObjectInteractionControls } from './object-interaction-controls.js';
import type { InteractionServices } from './object-interaction-controls.js';
export { createObjectInteractionControls } from './object-interaction-controls.js';
export type { ObjectInteractionOptions, InteractionServices } from './object-interaction-controls.js';
import { errorMessage } from './types.js';
import type { RuntimePolicy } from './runtime-policy.js';
import type { NavigationCamera, TrackballMetrics, CameraDelta, ControlsUpdate, DestinationMotion, CameraPlan, CameraUpdate, CameraAngles, CameraPose, Vector3 } from './types.js';
import type { CameraSkyPlan } from './camera-orientation.js';
import type { PerspectiveDolly, PerspectiveWorldContext } from './perspective-dolly.js';
import type { PhysicalSharedCamera } from './view-url.js';
import type { RetainedCubicSky } from '../solar-system/cubic-sky-runtime.js';
import type { DirectionalSunPlan } from '../solar-system/directional-sun-coordinate.js';
import { offAxisFrame, rotationFromMatrix3d } from '../solar-system/heliocentric-geometry.js';
import { apply as applyRotation, blendOrientations, composeRotations, heldRotation, sceneUp, rotationsDiffer, transposeRotation, turnAboutUp } from './free-camera.js';
import type { CameraViewState, ViewMode } from './free-camera.js';
import { bindFreeCameraInput } from './free-camera-input.js';
import { worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import type { PositionM } from '@cssearth/engine';
import { bindWorldCameraPicking } from './world-camera-picking.js';
import { hitsProjectedBody } from './world-camera-hit.js';
import { prepareSurfaceTargetRotation } from './surface-target.js';
import { worldQuaternionFromRotation, worldRotationCss, worldRotationFromQuaternion } from './world-camera-math.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';
import { createPreparedFocusNavigation } from './prepared-focus.js';
import type { PreparedNavigationFocus, PreparedFocusFlightOptions } from './prepared-focus.js';
export interface OrbitStateUpdate { pitch?: number; controlPitch?: number; controlYaw?: number; zoom?: number; distance?: number; distanceKilometers?: number; bodyCenterKilometers?: PositionM; pose?: CameraPose; }
export type OrbitState = { pitch: number; controlPitch: number; controlYaw: number; zoom: number; pose: CameraPose } & Partial<ReturnType<PerspectiveDolly['state']>>;
export interface OrbitPublication extends CameraAngles { worldCamera?: WorldCameraPose; sceneMatrix: string; skyboxMatrix: string; sunViewDirection: Vector3 | null; skySunViewDirection: Vector3 | null; counterRotation: string; counterRotationFor(localMatrix: string | DOMMatrix | null): string; zoom: number; projection?: PhysicalProjection; distance?: number; focal?: number; viewportWidth?: number; viewportHeight?: number; stageViewport?: WorldCameraViewport; principalOffset?: readonly number[]; body?: ReturnType<PerspectiveDolly['publish']>['body']; levelOfDetail?: ReturnType<PerspectiveDolly['levelOfDetail']>; }
export interface RetainedOrbitOptions { framePresenter?: WorldFramePresenter; preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean; stage: HTMLElement; inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; cameraElement: HTMLElement; sceneElement: HTMLElement; cubicSky: RetainedCubicSky; skyPlan: CameraSkyPlan; directionalSunPlan?: DirectionalSunPlan | null; worldContext?: PerspectiveWorldContext; cameraPlan: CameraPlan; viewport?: import('./camera-viewport.js').CameraViewport; objectId: string; mobilePreviewElement?: HTMLElement | null; onPublish?: (publication: OrbitPublication) => void; onViewChange?: (view: CameraViewState) => void; onInteractionStart?: () => void; onInteractionEnd?: () => void; onError(error: unknown): void; requireSun?: boolean; revealGroups?: readonly (readonly HTMLElement[])[];
  /** False while the mesh has no committed material; it stays hidden until then. */
  canReveal?: () => boolean; }
export interface OrbitServices extends InteractionServices { createPolyCamera?: typeof createPolyCamera; createCubicSkyCameraOrientation?: typeof createCubicSkyCameraOrientation; bindResponsiveOrbitPolicy?: RuntimePolicy['bindResponsiveOrbitPolicy']; selectPreparedResponsiveZoom?: typeof selectPreparedResponsiveZoom; createPerspectiveDolly?: typeof createPerspectiveDolly; HTMLElement?: typeof HTMLElement; matchMedia?: (query: string) => MediaQueryList; MutationObserver?: typeof MutationObserver; }
export type RetainedCubicSkyOrbit = ReturnType<typeof createRetainedCubicSkyOrbit>;
import { createPreparedCameraPublisher } from "../rendering/prepared-camera-runtime.js";
import { createPolyCamera } from "@layoutit/polycss";

import { createSceneLifetime } from "@cssearth/engine";
import { sampleDestinationFlight } from "@cssearth/engine";
import { viewSunDirectionToPhysicalLightDirection, viewSunDirectionToPreparedLightDirection } from "../solar-system/directional-sun-coordinate.js";
import { createPerspectiveDolly } from "./perspective-dolly.js";
import { directAngularDegreesPerTrackballRadius, interactionTrackball, directPitchResponseForZoom } from "@cssearth/engine";
import { createPreparedWheelZoomControls } from "./prepared-wheel-zoom.js";
import { createCubicSkyCameraOrientation } from "./camera-orientation.js";
import { preparedScenePitch, clamp } from "@cssearth/engine";
import { selectPreparedResponsiveZoom, measureRetainedPlanetTrackball } from "./camera-layout.js";
import { createUnboundedMatrixDragControls } from "./camera-input.js";

const nativeServices = { createPolyCamera, createCubicSkyCameraOrientation, selectPreparedResponsiveZoom, createUnboundedMatrixDragControls, createPreparedWheelZoomControls, createPerspectiveDolly };

export function createRetainedCubicSkyOrbit({
  stage,
  runtimePolicy,
  inputSurface,
  cameraElement,
  sceneElement,
  revealGroups,
  canReveal,
  cubicSky,
  skyPlan,
  directionalSunPlan = null,
  // A physical world context gives the orbit its perspective camera, which
  // frames by dolly (cameraPlan.projection); the Sun's direction in
  // directionalSunPlan is observed, so it rides the scene.
  worldContext,
  framePresenter,
  preparedSurfaceHitTest,
  cameraPlan,
  viewport,
  objectId,
  mobilePreviewElement,
  onPublish = () => {},
  onViewChange = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
  requireSun = true,
}: RetainedOrbitOptions, services: OrbitServices = {}) {
  const { createPolyCamera: createPolyCamera = nativeServices.createPolyCamera, createCubicSkyCameraOrientation: createCubicSkyCameraOrientation = nativeServices.createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy: bindResponsiveOrbitPolicy = runtimePolicy.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom = nativeServices.selectPreparedResponsiveZoom, HTMLElement = globalThis.HTMLElement, matchMedia = (query: string) => { const view = stage.ownerDocument.defaultView; if (!view) throw new Error("Orbit document has no window."); return view.matchMedia(query); }, createPerspectiveDolly: createPerspectiveDolly = nativeServices.createPerspectiveDolly, MutationObserver = globalThis.MutationObserver } = services;
  const hasDirectionalSun = directionalSunPlan !== null;
  const perspectiveCamera = worldContext !== undefined;
  if (worldContext !== undefined && cameraPlan?.projection?.model !== "css-perspective-shared-with-sky") {
    throw new TypeError("A physical world context requires the shared perspective camera.");
  }
  // The stars ride the scene matrix when the sky was registered to it.
  const effectiveSkyPlan = worldContext?.sceneRegistration === undefined
    ? skyPlan
    : Object.freeze({ ...skyPlan,
      cameraContract: "scene-locked-unbounded-accumulated-matrix3d",
      sceneRegistration: worldContext.sceneRegistration,
    });
  const skyTracksScene = effectiveSkyPlan?.cameraContract === "scene-locked-unbounded-accumulated-matrix3d";
  const numericFields = [
    cameraPlan?.minimumControlPitchDegrees,
    cameraPlan?.maximumControlPitchDegrees,
    cameraPlan?.defaultControlPitchDegrees,
    cameraPlan?.defaultControlYawDegrees,
    cameraPlan?.initialScenePitchDegrees,
    cameraPlan?.maximumScenePitchDegrees,
    cameraPlan?.minimumZoom,
    cameraPlan?.maximumZoom,
    cameraPlan?.defaultZoom,
    cameraPlan?.sceneScale,
    cameraPlan?.logicalBodyDiameter,
  ];
  if (!(stage instanceof HTMLElement) ||
      !(inputSurface instanceof HTMLElement) ||
      !(cameraElement instanceof HTMLElement) ||
      !(sceneElement instanceof HTMLElement) ||
      cubicSky?.root?.isConnected !== true ||
      cameraPlan?.cameraModel !== "accumulated-matrix3d" ||
      cameraPlan?.pitchBounded !== false || cameraPlan?.yawBounded !== false ||
      numericFields.some((value) => !Number.isFinite(value)) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      typeof onPublish !== "function" ||
      typeof onError !== "function" ||
      typeof onInteractionStart !== "function" ||
      typeof onInteractionEnd !== "function") {
    throw new TypeError("Shared retained cubic-sky orbit is invalid.");
  }
  const lifetime = createSceneLifetime();
  let constructing = true;
  const retireFailure = (error: unknown) => {
    if (constructing) throw error;
    if (lifetime.disposed) return;
    const cleanupErrors = lifetime.destroy();
    onError(cleanupErrors.length
      ? new AggregateError([error, ...cleanupErrors], errorMessage(error), { cause: error }) : error);
  };
  const guardNative = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => (...args: Args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) { retireFailure(error); }
  };
  try {
  // The perspective dolly owns the camera state (pose plus distance, zoom as
  // the framing alias) and the projection; the scaled camera keeps the
  // prepared PolyCSS state.
  const perspective = worldContext ? createPerspectiveDolly({
    cameraPlan, worldContext, cameraElement, sceneElement,
    skyElement: cubicSky.root, stage, viewport, ...(revealGroups ? { revealGroups } : {}), ...(canReveal ? { canReveal } : {}),
  }) : null;
  const requireWorldPerspective = (frame: PreparedWorldCameraFrame) => {
    if (!perspective || !worldContext || !skyTracksScene) throw new TypeError('This object has no physical world camera.');
    if (Math.abs(frame.metersPerUnit / (worldContext.kilometersPerUnit * 1000) - 1) > 1e-9 ||
        Math.abs(frame.bodyRadiusM / (worldContext.bodyRadiusUnits * worldContext.kilometersPerUnit * 1000) - 1) > 1e-9) {
      throw new TypeError('World frame units disagree with the mounted presentation.');
    }
    return perspective;
  };
  const camera: NavigationCamera = perspective ? perspective.camera : createPolyCamera({
    target: [0, 0, 0],
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    zoom: cameraPlan.defaultZoom,
    distance: 0,
  });
  const orientation = createCubicSkyCameraOrientation({
    controlPitch: camera.state.rotX,
    controlYaw: camera.state.rotY,
    cameraPlan,
    skyPlan: effectiveSkyPlan,
    requireSun: hasDirectionalSun ? false : requireSun,
    sunDirection: directionalSunPlan?.localDirection,
    sunReferenceViewDirection: directionalSunPlan?.referenceViewDirection,
    // An observed Sun stays fixed in the prepared scene frame instead of
    // following the presentation sky, and the material below uses the
    // physical light map: a Sun on screen means the camera sees the night
    // side.
    sunTracksScene: perspectiveCamera && directionalSunPlan !== null,
    skyTracksScene,
  });
  const preparedFocus = perspective ? createPreparedFocusNavigation({ camera, physical: perspective,
    rotation: () => rotationFromMatrix3d(orientation.sceneMatrix()),
    setRotation: rotation => orientation.setSceneRotation(rotation), publish: () => publish(),
    stop: () => controls.stop(), flyTo: motion => controls.flyTo(motion),
    framingZoom: worldContext?.framingReferenceZoom ?? cameraPlan.defaultZoom,
    logicalBodyDiameter: cameraPlan.logicalBodyDiameter, maximumZoom: cameraPlan.maximumZoom,
  }) : null;
  const safeCamera = preparedFocus?.camera ?? Object.freeze({
    get state() { return camera.state; },
    update(partial: CameraUpdate) {
      camera.update({
        ...partial,
        ...(partial.zoom === undefined ? {} : {
          zoom: clamp(
            partial.zoom,
            cameraPlan.minimumZoom,
            cameraPlan.maximumZoom,
          ),
        }),
      });
    },
  });
  // The zoom alias's bounds: the prepared bounds, or for a dolly the prepared
  // close framing and the whole-orbit distance seen through the same alias.
  const minimumZoom = () => perspective ? perspective.minimumZoom() : cameraPlan.minimumZoom;
  const maximumZoom = () => cameraPlan.maximumZoom;
  const lightDirection = perspectiveCamera
    ? viewSunDirectionToPhysicalLightDirection
    : viewSunDirectionToPreparedLightDirection;
  let publications = 0;
  let viewMode: ViewMode = 'orbit';
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ?? null;
  const publishCamera = perspective ? null : createPreparedCameraPublisher({
    cameraElement, sceneElement, objectId,
    defaultZoom: cameraPlan.defaultZoom,
    sceneScale: cameraPlan.sceneScale,
  });
  let publishedSkyboxMatrix: string | null = null;
  let publishedZoom: number | null = null;
  let materialSunViewDirection = hasDirectionalSun &&
      skySunViewDirection !== null
    ? lightDirection(skySunViewDirection)
    : skySunViewDirection;
  let responsiveFit: ReturnType<typeof selectPreparedResponsiveZoom>;
  let projected: ReturnType<PerspectiveDolly["publish"]> | null = null;
  let viewportEpoch = 0, requestedPublication = 0, presentedPublication = 0;
  let presentedWorld: WorldCameraPose | null = null;
  const publicationState = () => ({ requestedRevision: requestedPublication, presentedRevision: presentedPublication, presentedWorld });
  const publish = (signal?: AbortSignal) => {
    if (lifetime.disposed) return;
    // Free-camera input and zoom land on the held orientation; a flight or restore keeps its own until it settles.
    if (viewMode === 'free' && freeHeld) holdFree();
    // Resolve the active input pivot before an asynchronous frame captures the physical observer.
    preparedFocus?.syncRotation();
    const sceneMatrix = orientation.scene();
    const sky = orientation.skybox();
    const zoom = safeCamera.state.zoom;
    const controlPitch = safeCamera.state.rotX, controlYaw = safeCamera.state.rotY;
    const captured = framePresenter && perspective && worldContext
      ? perspective.prepare(orientation.sceneMatrix(), sceneMatrix) : null;
    const counterRotationFor = captured ? orientation.captureCounterRotation()
      : (local: string | DOMMatrix | null = null) => orientation.counterRotation(local);
    const revision = ++requestedPublication, epoch = viewportEpoch;
    const current = () => !lifetime.disposed && epoch === viewportEpoch;
    const commit = () => {
    if (!current()) return;
    const skyboxChanged = sky.matrix !== publishedSkyboxMatrix;
    const zoomChanged = zoom !== publishedZoom;
    // The body, resolved relative to the camera in float64.
    if (perspective) projected = captured ? captured.commit() : perspective.publish(orientation.sceneMatrix(), sceneMatrix);
    else publishCamera!({ sceneMatrix, zoom });
    if (skyboxChanged || zoomChanged) {
      cubicSky.setOrientation({
        matrix: sky.matrix,
        zoom,
        defaultZoom: cameraPlan.defaultZoom,
      });
      publishedSkyboxMatrix = sky.matrix;
    }
    publishedZoom = zoom;
    if (skyboxChanged) {
      skySunViewDirection = sky.sunViewDirection;
      materialSunViewDirection = hasDirectionalSun &&
          skySunViewDirection !== null
        ? lightDirection(skySunViewDirection)
        : skySunViewDirection;
    }
    presentedPublication = revision;
    if (captured?.world) presentedWorld = captured.world;
    onPublish(Object.freeze({
      sceneMatrix,
      skyboxMatrix: sky.matrix,
      sunViewDirection: materialSunViewDirection,
      skySunViewDirection,
      counterRotation: counterRotationFor(),
      counterRotationFor,
      ...(captured?.world ? { worldCamera: captured.world } : {}),
      controlPitch,
      controlYaw,
      zoom,
      // The dolly's facts: the eye, the projected body and its level of
      // detail, for presentations that fit overlays to the silhouette and
      // choose their material source from the stage.
      ...(projected === null ? {} : {
        distance: projected.distance,
        projection: projected.projection,
        focal: projected.focal,
        viewportWidth: projected.viewportWidth,
        viewportHeight: projected.viewportHeight,
        stageViewport: projected.stageViewport,
        principalOffset: projected.principalOffset,
        body: projected.body,
        levelOfDetail: projected.levelOfDetail,
      }),
    }));
    publications += 1;
    };
    if (captured?.world && framePresenter) return framePresenter.present({
      world: captured.world, viewport: captured.viewport, commit, current, fail: retireFailure }, signal);
    else commit();
  };
  const adoptWorldCamera = (world: WorldCameraPose, frame: PreparedWorldCameraFrame, signal?: AbortSignal) => {
    if (lifetime.disposed) return;
    try {
      requireWorldPerspective(frame);
      controls.stop();
      releaseFree();
      preparedFocus!.adopt(world, frame);
      return publish(signal);
    } catch (error) { retireFailure(error); throw error; }
  };
  // The free camera: the same camera unlocked from the body, holding the world
  // vertical at a chosen elevation, panned and turned instead of orbited.
  const freePolicy = runtimePolicy.FREE_CAMERA;
  const freeAvailable = perspective !== null && worldContext !== undefined && skyTracksScene && freePolicy !== undefined;
  let elevation = freePolicy?.elevationDegrees ?? 0;
  // One world vertical for every object, carried into this object's scene frame.
  const up = freeAvailable ? sceneUp(worldContext!.frame, freePolicy.upReference) : null;
  const holdFree = () => {
    const current = rotationFromMatrix3d(orientation.sceneMatrix());
    const next = heldRotation(current, up!, elevation);
    if (rotationsDiffer(current, next)) orientation.setSceneRotation(next);
  };
  const reportView = () => onViewChange(Object.freeze({ mode: viewMode, elevationDegrees: elevation }));
  // The body centre in eye space, including the centred dolly's implicit one.
  const eyeBodyCenter = (): [number, number, number] => {
    const explicit = perspective!.bodyCenter();
    if (explicit) return [explicit[0], explicit[1], explicit[2]];
    const optics = perspective!.viewport(), distance = safeCamera.state.distance;
    const axis = offAxisFrame(optics.focalPixels, optics.principalOffsetPixels);
    return [distance * axis.sinTheta * axis.radial[0]!, distance * axis.sinTheta * axis.radial[1]!, -distance * axis.cosTheta];
  };
  const panFree = (dxPixels: number, dyPixels: number) => {
    // A pan leaves the focus a flight arrived at: zoom then follows the screen centre.
    preparedFocus?.clear();
    const center = eyeBodyCenter(), perPixel = -center[2] / perspective!.viewport().focalPixels;
    let x = center[0] + dxPixels * perPixel, y = center[1] + dyPixels * perPixel;
    // Panning reaches across the mounted system, not into empty space beyond it.
    const reach = Math.max(perspective!.maximumExtent(), 3 * worldContext!.bodyRadiusUnits), lateral = Math.hypot(x, y);
    if (lateral > reach) { x *= reach / lateral; y *= reach / lateral; }
    perspective!.setBodyCenter([x, y, center[2]]);
    publish();
  };
  // Turns and tilts pivot on the screen centre at the body's depth, or on the body itself; an active focus keeps its own pivot.
  const reorientFree = (next: readonly number[], aroundBody = false) => {
    const current = rotationFromMatrix3d(orientation.sceneMatrix());
    if (!aroundBody && !preparedFocus?.current() && perspective!.bodyCenter() !== null) {
      const center = eyeBodyCenter(), moved = applyRotation(composeRotations(next, transposeRotation(current)), [center[0], center[1], 0]);
      perspective!.setBodyCenter([moved[0], moved[1], center[2] + moved[2]]);
    }
    orientation.setSceneRotation(next);
    publish();
  };
  const turnFree = (degrees: number, aroundBody = false) => {
    freeHeld = true;
    const current = rotationFromMatrix3d(orientation.sceneMatrix());
    reorientFree(composeRotations(turnAboutUp(current, up!, degrees), current), aroundBody);
  };
  const setElevation = (degrees: number, aroundBody = false) => {
    const next = clamp(degrees, 0, 90);
    if (next === elevation) return;
    elevation = next;
    if (viewMode === 'free') { freeHeld = true; reorientFree(heldRotation(rotationFromMatrix3d(orientation.sceneMatrix()), up!, elevation), aroundBody); }
    reportView();
  };
  const tiltFree = (degrees: number, aroundBody = false) => setElevation(elevation + degrees, aroundBody);
  // A flight, restore or handoff owns the orientation while it moves. Once it has been still briefly, the view eases
  // back to level about the body. Input that starts meanwhile levels at once.
  let freeHeld = true, settleTimer: number | null = null;
  const suspendFree = () => {
    if (viewMode !== 'free') return;
    freeHeld = false;
    if (settleTimer !== null) { stage.ownerDocument.defaultView?.clearTimeout(settleTimer); settleTimer = null; }
  };
  const releaseFree = () => {
    if (viewMode !== 'free' || lifetime.disposed) return;
    suspendFree();
    settleTimer = stage.ownerDocument.defaultView!.setTimeout(() => { settleTimer = null; levelFree(); }, 250);
  };
  const freeFlight = <T,>(start: () => Promise<T>): Promise<T> => {
    suspendFree();
    return start().then(result => { releaseFree(); return result; });
  };
  lifetime.onDispose(() => { if (settleTimer !== null) stage.ownerDocument.defaultView?.clearTimeout(settleTimer); });
  const levelFree = () => {
    if (viewMode !== 'free' || freeHeld || lifetime.disposed) return;
    const current = rotationFromMatrix3d(orientation.sceneMatrix());
    const from = worldQuaternionFromRotation(current), target = worldQuaternionFromRotation(heldRotation(current, up!, elevation));
    const settle = (progress: number) => {
      if (freeHeld || lifetime.disposed) return;
      orientation.setSceneRotation(worldRotationFromQuaternion(blendOrientations(from, target, progress * progress * (3 - 2 * progress))));
      if (progress >= 1) freeHeld = true;
      publish();
    };
    if (stage.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) { settle(1); return; }
    void controls.flyTo({ sample: settle, durationMilliseconds: 450 });
  };
  const freeInput = freeAvailable ? bindFreeCameraInput({
    inputSurface,
    turnDegreesPerPixel: freePolicy.turnDegreesPerPixel,
    onStart() { freeHeld = true; interactionStarts += 1; onInteractionStart(); },
    onEnd() { interactionEnds += 1; onInteractionEnd(); reportView(); },
    pan: panFree,
    turn: turnFree,
    tilt: tiltFree,
    hitsBody: (clientX, clientY) => surfaceHitTest?.(clientX, clientY) === true,
    // About a quarter turn across the body's radius, so the surface keeps pace with the pointer.
    bodyDegreesPerPixel: () => 90 / perspective!.trackball().radius,
    zoomBy(factor) { safeCamera.update({ zoom: clamp(safeCamera.state.zoom * factor, minimumZoom(), maximumZoom()) }); publish(); },
    onError: retireFailure,
  }) : null;
  if (freeInput) lifetime.onDispose(() => freeInput.destroy());
  const mobileQuery = matchMedia(runtimePolicy.MOBILE_VIEWPORT_QUERY);
  const publishCameraDelta = ({
    controlPitchDelta,
    controlYawDelta,
    zoom,
    distance,
    rotation,
  }: CameraDelta) => {
    const previousPitch = safeCamera.state.rotX;
    safeCamera.update({
      rotX: previousPitch + controlPitchDelta,
      rotY: safeCamera.state.rotY + controlYawDelta,
      ...(zoom === undefined ? {} : { zoom }),
      ...(distance === undefined ? {} : { distance }),
    });
    orientation.rotate({
      renderedPitchDelta:
        preparedScenePitch(safeCamera.state.rotX, cameraPlan) -
          preparedScenePitch(previousPitch, cameraPlan),
      yawDelta: controlYawDelta,
      rotation,
    });
    publish();
  };
  const surfaceHitTest = perspective ? (clientX: number, clientY: number) => {
    if (preparedSurfaceHitTest && stage.dataset.lod !== 'marker' && stage.dataset.lod !== 'billboard') return preparedSurfaceHitTest(clientX, clientY);
    const body = projected?.body;
    if (!body) return false;
    const radius = worldContext?.bodyRadiusUnits;
    const cameraBounds = cameraPlan.projection ? viewport?.read(cameraPlan.projection.cssPerspective).bounds : null;
    return hitsProjectedBody(clientX, clientY, body, cameraBounds ?? cameraElement.getBoundingClientRect(), null,
      projected && radius ? { focalPixels: projected.focal,
        principalOffsetPixels: [projected.principalOffset[0]!, projected.principalOffset[1]!], bodyRadiusUnits: radius } : undefined);
  } : null;
  if (surfaceHitTest) lifetime.onDispose(bindWorldCameraPicking(inputSurface, stage,
    viewport ? () => viewport.read(cameraPlan.projection!.cssPerspective).bounds : undefined,
    (x, y) => stage.dataset.lod === 'geometry' && surfaceHitTest(x, y)));
  const controls = createObjectInteractionControls({
    inputSurface,
    runtimePolicy,
    onError: retireFailure,
    camera: safeCamera,
    trackballMetrics: () => perspective ? preparedFocus!.trackball(perspective.trackball()) : measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
      sceneScale: cameraPlan.sceneScale,
    }),
    sceneMatrix: () => orientation.scene(),
    rotate: publishCameraDelta,
    minimumZoom: minimumZoom(),
    maximumZoom: maximumZoom(),
    surfaceFlyToHitTest: surfaceHitTest ? (clientX, clientY) =>
      !preparedFocus!.current() && surfaceHitTest(clientX, clientY) : null,
    // The prepared wheel dolly: the eye moves along its axis, with no
    // surface anchor to hold.
    dolly: perspective
      ? Object.freeze({ stepPerDelta: cameraPlan.dolly!.wheelStepPerDelta })
      : null,
    onStart() {
      interactionStarts += 1;
      onInteractionStart();
    },
    onEnd() {
      interactionEnds += 1;
      onInteractionEnd();
    },
  }, services);
  lifetime.onDispose(() => controls.destroy());
  const inputPolicy = bindResponsiveOrbitPolicy({
    controls,
    inputSurface,
    mediaQuery: mobileQuery,
    onError: retireFailure,
  });
  lifetime.onDispose(() => inputPolicy.destroy());
  responsiveFit = selectPreparedResponsiveZoom({
    stage,
    cameraElement,
    plan: cameraPlan,
    mobile: inputPolicy.mobile,
    mobilePreviewElement,
    framingReferenceZoom: worldContext?.framingReferenceZoom, viewport,
  });
  safeCamera.update({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
  const windowTarget = stage.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Orbit document has no window.");
  const handleViewportResize = guardNative(() => {
    viewportEpoch++;
    // The dolly keeps its framing across the resize (the shared contract:
    // a breakpoint crossing preserves the camera state).
    perspective?.remeasure();
    responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement,
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      mobilePreviewElement,
      framingReferenceZoom: worldContext?.framingReferenceZoom, viewport,
    });
    publish();
  });
  if (viewport) lifetime.onDispose(viewport.subscribe(handleViewportResize));
  else {
    lifetime.onDispose(() => windowTarget?.removeEventListener("resize", handleViewportResize));
    windowTarget?.addEventListener("resize", handleViewportResize, {
      passive: true,
    });
    if (perspective && typeof MutationObserver === "function") {
      // The shell moves the render roots when the sidebar collapses; the eye
      // stays at the sky's vanishing point, so re-measure the offset then.
      const relayout = guardNative(() => {
        viewportEpoch++;
        perspective.remeasure();
        publish();
      });
      const sidebarObserver = new MutationObserver(relayout);
      sidebarObserver.observe(stage.ownerDocument.body, {
        attributes: true,
        attributeFilter: ["data-sidebar-collapsed"],
      });
      lifetime.onDispose(() => sidebarObserver.disconnect());
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.propertyName === "translate") relayout();
      };
      lifetime.onDispose(() => stage.removeEventListener("transitionend", onTransitionEnd));
      stage.addEventListener("transitionend", onTransitionEnd);
    }
  }
  function flyToOrientation({ controlPitch, controlYaw, controlRoll = 0, zoom, transition }: CameraAngles & { zoom: number; controlRoll?: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } }, { surfaceTarget = false } = {}): Promise<{ completed: boolean }> {
    try {
    if (![controlPitch, controlYaw, controlRoll, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
    controls.stop();
    preparedFocus?.clear();
    const start = { ...safeCamera.state };
    const targetZoom = transition?.preserveZoom ? start.zoom : clamp(zoom, minimumZoom(), maximumZoom());
    const viewport = perspective?.viewport();
    const targetRotation = surfaceTarget && perspective && viewport
      ? prepareSurfaceTargetRotation(perspective.bodyCenter() ??
        [-viewport.principalOffsetPixels[0], -viewport.principalOffsetPixels[1], -viewport.focalPixels]) : undefined;
    // CSS parsing quantizes coefficients; numerical camera state must keep
    // the original doubles so the proper-rotation invariant survives flight.
    const targetCorrection = targetRotation && new DOMMatrix([
      targetRotation[0], targetRotation[3], targetRotation[6], 0,
      targetRotation[1], targetRotation[4], targetRotation[7], 0,
      targetRotation[2], targetRotation[5], targetRotation[8], 0, 0, 0, 0, 1]);
    const roll = new DOMMatrix().rotateAxisAngle(0, 0, 1, controlRoll);
    const correction = targetCorrection ? targetCorrection.multiply(roll) : roll;
    const flight = orientation.prepareFlight({ controlPitch, controlYaw }, correction);
    const sample = (progress: number) => {
      const ease = progress * progress * (3 - 2 * progress);
      const frame = transition ? { rotation: ease, zoom: start.zoom * (targetZoom / start.zoom) ** ease } : sampleDestinationFlight({ startZoom: start.zoom, targetZoom,
        overviewZoom: cameraPlan.defaultZoom, angularDistance: flight.angularDistance }, progress);
      safeCamera.update({ rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
        rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation, zoom: frame.zoom });
      flight.sample(frame.rotation);
      publish();
    };
    if (transition?.durationMilliseconds === 0 || stage.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches === true) {
      sample(1);
      return Promise.resolve({ completed: true });
    }
    return controls.flyTo({ sample, durationMilliseconds: transition?.durationMilliseconds });
    } catch (error) { retireFailure(error); throw error; }
  }
  publish();
  constructing = false;
  return Object.freeze({
    publicationState,
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    currentResponsiveZoom: () => responsiveFit.zoom,
    setZoomOutCentering(enabled: boolean) { perspective?.setZoomOutCentering(enabled); },
    /** Orbit or free, optionally at a chosen elevation. False when this object has no physical world camera to free. */
    setViewMode(mode: ViewMode, elevationDegrees?: number): boolean {
      if (lifetime.disposed) return false;
      if (mode !== 'orbit' && mode !== 'free') throw new TypeError('Unknown view mode.');
      if (elevationDegrees !== undefined && !Number.isFinite(elevationDegrees)) throw new TypeError('Free camera elevation must be finite.');
      if (mode === viewMode) { if (elevationDegrees !== undefined) setElevation(elevationDegrees); return true; }
      if (elevationDegrees !== undefined) elevation = clamp(elevationDegrees, 0, 90);
      if (!freeAvailable) return false;
      try {
        controls.stop();
        viewMode = mode;
        const free = mode === 'free';
        perspective!.setLateralZoom(free);
        controls.update({ drag: !free });
        freeInput!.setEnabled(free);
        if (free) { suspendFree(); publish(); levelFree(); }
        else { freeHeld = true; if (settleTimer !== null) { windowTarget.clearTimeout(settleTimer); settleTimer = null; } publish(); }
        reportView();
        return true;
      } catch (error) { retireFailure(error); throw error; }
    },
    preparedFocus: () => preparedFocus?.current() ?? null,
    setPreparedFocus(focus: PreparedNavigationFocus | null, frame: PreparedWorldCameraFrame) {
      if (lifetime.disposed) return;
      requireWorldPerspective(frame);
      controls.stop();
      releaseFree();
      preparedFocus!.set(focus, frame);
      publish();
    },
    flyToPreparedFocus(focus: PreparedNavigationFocus, frame: PreparedWorldCameraFrame,
      viewport: WorldCameraViewport & { framingRadiusPixels: number }, options: PreparedFocusFlightOptions = {}) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      requireWorldPerspective(frame);
      return freeFlight(() => preparedFocus!.flyTo(focus, frame, viewport, { ...options,
        reducedMotion: options.reducedMotion ?? windowTarget.matchMedia('(prefers-reduced-motion: reduce)').matches }));
    },
    captureWorldCamera(frame: PreparedWorldCameraFrame): WorldCameraPose {
      const physical = requireWorldPerspective(frame);
      const rotation = rotationFromMatrix3d(orientation.sceneMatrix());
      const bodyCenterUnits = physical.bodyCenter();
      return bodyCenterUnits === null
        ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: safeCamera.state.distance }, frame, physical.viewport())
        : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame);
    },
    applyWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame): void {
      void adoptWorldCamera(world, frame);
    },
    /** As applyWorldCamera, resolving once the frame presenter has shown the pose. */
    presentWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame, signal: AbortSignal) {
      return adoptWorldCamera(world, frame, signal);
    },
    rebaseScene(change: DOMMatrix) {
      if (lifetime.disposed) return;
      try { orientation.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState(destination: CameraAngles & { zoom: number; controlRoll?: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } }, options: { surfaceTarget?: boolean } = {}) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      return freeFlight(() => flyToOrientation(destination, options));
    },
    // Native cache notifications report failures through the same fatal owner.
    invalidate: guardNative(publish),
    refresh() {
      if (lifetime.disposed) return;
      try { publish(); } catch (error) {
        retireFailure(error);
        // Synchronous callers (including selection commits) must stop too.
        throw error;
      }
    },
    setState({ pitch, controlPitch = pitch, controlYaw, zoom, distance, distanceKilometers, bodyCenterKilometers, pose }: OrbitStateUpdate = {}): OrbitState {
      if (lifetime.disposed) return this.state();
      try {
      controls.stop();
      preparedFocus?.clear();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      if (resetsOrientation || pose !== undefined) perspective?.centerBody();
      if ((distance !== undefined || distanceKilometers !== undefined || bodyCenterKilometers !== undefined) && !perspective) {
        throw new TypeError("Only a perspective camera dollies by distance.");
      }
      safeCamera.update({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(distanceKilometers !== undefined
          ? { distanceKilometers }
          : distance !== undefined
            ? { distance }
            : zoom === undefined ? {} : { zoom }),
      });
      if (pose !== undefined) {
        orientation.restore(pose);
      } else if (resetsOrientation) {
        orientation.reset({
          controlPitch: safeCamera.state.rotX,
          controlYaw: safeCamera.state.rotY,
        });
      }
      releaseFree();
      if (bodyCenterKilometers !== undefined && perspective && worldContext) {
        const scale = worldContext.kilometersPerUnit;
        perspective.setBodyCenter([bodyCenterKilometers[0] / scale, bodyCenterKilometers[1] / scale, bodyCenterKilometers[2] / scale]);
      }
      publish();
      } catch (error) { retireFailure(error); throw error; }
      return this.state();
    },
    state(): OrbitState {
      const pose = orientation.snapshot();
      const state = {
        pose,
        pitch: safeCamera.state.rotX,
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
        ...(perspective ? perspective.state() : {}),
      };
      if (!skyTracksScene) Object.defineProperty(state, "pose", { enumerable: false, value: pose });
      return Object.freeze(state);
    },
    sharedState(): PhysicalSharedCamera {
      const state = this.state();
      if (perspectiveCamera && skyTracksScene) {
        // One physical rotation owns the body, registered sky and Sun.
        // Dolly distance determines zoom; control angles are input bookkeeping.
        const pose = orientation.snapshot({ sceneOnly: true });
        if (pose.schema !== "cssearth-camera-pose@2" || state.distanceKilometers === undefined) throw new Error("Physical camera snapshot is unavailable.");
        const bodyCenterKilometers = state.bodyCenterKilometers;
        return { distanceKilometers: state.distanceKilometers, pose,
          ...(bodyCenterKilometers === undefined ? {} : { bodyCenterKilometers }) };
      }
      throw new Error("Shared views require the physical world camera.");
    },
    skyState() {
      return Object.freeze({
        sunViewDirection: skySunViewDirection === null
          ? null
          : Object.freeze([...skySunViewDirection]),
        sunVisible: skySunViewDirection === null ? false : skySunViewDirection[2] < 0,
      });
    },
    stats() {
      return Object.freeze({
        owner: "shared-retained-cubic-sky-orbit",
        viewMode, freeElevationDegrees: elevation,
        inputMode: "event-driven-unbounded-matrix-drag-wheel-pinch",
        enabledAxes: "unbounded-pitch-and-yaw",
        cameraModel: cameraPlan.cameraModel,
        pitchBounded: false,
        yawBounded: false,
        minimumPitchDegrees: cameraPlan.minimumControlPitchDegrees,
        maximumPitchDegrees: cameraPlan.maximumControlPitchDegrees,
        defaultControlPitchDegrees: cameraPlan.defaultControlPitchDegrees,
        defaultControlYawDegrees: cameraPlan.defaultControlYawDegrees,
        minimumZoom: minimumZoom(),
        maximumZoom: maximumZoom(),
        defaultZoom: cameraPlan.defaultZoom,
        responsiveFitModel: responsiveFit.model,
        responsiveWidthShare: responsiveFit.widthShare,
        responsiveBaseZoom: responsiveFit.zoom,
        publications,
        preparedFocusId: preparedFocus?.current()?.id ?? null,
        framePublication: publicationState(),
        interactionStarts,
        interactionEnds,
        dragInertia: controls.stats(),
        runtimeGeometryPreparation: false,
        ...(perspective ? {
          ...perspective.stats({ wheelDollies: controls.stats().wheelZoom?.events ?? 0 }),
          // Scene, sky orientation and the material fit.
          runtimeTransformStringWrites: publications * 3,
        } : {}),
      });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Cubic-sky orbit cleanup failed.");
    },
  });
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Cubic-sky orbit construction failed.", { cause: error });
    throw error;
  }
}
