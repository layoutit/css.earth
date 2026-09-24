import type { WorldFramePresenter } from './world-frame-presenter.js';
import { createObjectInteractionControls } from './object-interaction-controls.js';
import type { InteractionServices } from './object-interaction-controls.js';
export { createObjectInteractionControls } from './object-interaction-controls.js';
export type { ObjectInteractionOptions, InteractionServices } from './object-interaction-controls.js';
import { errorMessage } from './types.js';
import type { RuntimePolicy } from './runtime-policy.js';
import type { CameraDelta, CameraPlan, CameraAngles, CameraPose, Vector3 } from './types.js';
import type { PerspectiveDolly, PerspectivePublication, PerspectiveWorldContext } from './perspective-dolly.js';
import type { PhysicalSharedCamera } from './view-url.js';
import type { DirectionalSunPlan } from '../solar-system/directional-sun-coordinate.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import type { PositionM } from '@cssearth/engine';
import { bindWorldCameraPicking } from './world-camera-picking.js';
import { hitsProjectedBody } from './world-camera-hit.js';
import { prepareSurfaceTargetRotation } from './surface-target.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';
import { prepareFocusFlight } from './prepared-focus.js';
import type { PreparedNavigationFocus, PreparedFocusFlightOptions } from './prepared-focus.js';
export interface OrbitStateUpdate { pitch?: number; controlPitch?: number; controlYaw?: number; zoom?: number; distance?: number; distanceKilometers?: number; bodyCenterKilometers?: PositionM; pose?: CameraPose; }
export type OrbitState = { pitch: number; controlPitch: number; controlYaw: number; zoom: number; pose: CameraPose } & ReturnType<PerspectiveDolly['state']>;
export interface OrbitPublication extends CameraAngles { worldCamera: WorldCameraPose; sceneMatrix: string; sunViewDirection: Vector3 | null; skySunViewDirection: Vector3 | null; counterRotation: string; counterRotationFor(localMatrix: string | DOMMatrix | null): string; zoom: number; projection: PhysicalProjection; distance: number; focal: number; viewportWidth: number; viewportHeight: number; stageViewport: WorldCameraViewport; principalOffset: readonly number[]; body: PerspectivePublication['body']; levelOfDetail: ReturnType<PerspectiveDolly['levelOfDetail']>; }
export interface RetainedOrbitOptions { framePresenter: WorldFramePresenter; preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean; stage: HTMLElement; inputSurface: HTMLElement; cameraMotion: import('./camera-motion.js').CameraMotion; runtimePolicy: RuntimePolicy; cameraElement: HTMLElement; sceneElement: HTMLElement; directionalSunPlan?: DirectionalSunPlan | null; worldContext: PerspectiveWorldContext; cameraPlan: CameraPlan; viewport: import('./camera-viewport.js').CameraViewport; objectId: string; onPublish?: (publication: OrbitPublication) => void; onInteractionStart?: () => void; onInteractionEnd?: () => void; onError(error: unknown): void; revealGroups?: readonly (readonly HTMLElement[])[];
  /** False while the mesh has no committed material; it stays hidden until then. */
  canReveal?: () => boolean; }
export interface OrbitServices extends InteractionServices { createCameraOrientation?: typeof createCameraOrientation; bindResponsiveOrbitPolicy?: RuntimePolicy['bindResponsiveOrbitPolicy']; selectPreparedResponsiveZoom?: typeof selectPreparedResponsiveZoom; createPerspectiveDolly?: typeof createPerspectiveDolly; HTMLElement?: typeof HTMLElement; matchMedia?: (query: string) => MediaQueryList; }
export type RetainedCubicSkyOrbit = ReturnType<typeof createRetainedCubicSkyOrbit>;

import { createSceneLifetime } from "@cssearth/engine";
import { sampleDestinationFlight } from "@cssearth/engine";
import { viewSunDirectionToPhysicalLightDirection } from "../solar-system/directional-sun-coordinate.js";
import { createPerspectiveDolly, validatePerspectiveCameraPlan } from "./perspective-dolly.js";
import { createPreparedWheelZoomControls } from "./prepared-wheel-zoom.js";
import { createCameraOrientation } from "./camera-orientation.js";
import { clamp } from "@cssearth/engine";
import { selectPreparedResponsiveZoom } from "./camera-layout.js";
import { createUnboundedMatrixDragControls } from "./camera-input.js";

const nativeServices = { createCameraOrientation, selectPreparedResponsiveZoom, createUnboundedMatrixDragControls, createPreparedWheelZoomControls, createPerspectiveDolly };

export function createRetainedCubicSkyOrbit({
  stage,
  runtimePolicy,
  inputSurface,
  cameraMotion,
  cameraElement,
  sceneElement,
  revealGroups,
  canReveal,
  directionalSunPlan = null,
  // A physical world context gives the orbit its perspective camera, which
  // frames by dolly (cameraPlan.projection); the Sun's direction in
  // directionalSunPlan is observed, so it rides the scene.
  worldContext,
  framePresenter,
  preparedSurfaceHitTest,
  cameraPlan: unvalidatedCameraPlan,
  viewport,
  objectId,
  onPublish = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
}: RetainedOrbitOptions, services: OrbitServices = {}) {
  const { createCameraOrientation: createCameraOrientation = nativeServices.createCameraOrientation, bindResponsiveOrbitPolicy: bindResponsiveOrbitPolicy = runtimePolicy.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom = nativeServices.selectPreparedResponsiveZoom, HTMLElement = globalThis.HTMLElement, matchMedia = (query: string) => { const view = stage.ownerDocument.defaultView; if (!view) throw new Error("Orbit document has no window."); return view.matchMedia(query); }, createPerspectiveDolly: createPerspectiveDolly = nativeServices.createPerspectiveDolly } = services;
  const cameraPlan = validatePerspectiveCameraPlan(unvalidatedCameraPlan);
  if (!worldContext || !viewport || !framePresenter || !cameraMotion) throw new TypeError('Object orbit requires its shared world and viewport.');
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
  const flightScope = new AbortController();
  lifetime.onDispose(() => flightScope.abort());
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
  // One physical observer owns rotation, distance and projection.
  const perspective = createPerspectiveDolly({
    cameraPlan, worldContext, cameraElement, sceneElement, sunDirection: directionalSunPlan?.localDirection,
    stage, viewport, ...(revealGroups ? { revealGroups } : {}), ...(canReveal ? { canReveal } : {}),
  }, createCameraOrientation);
  const validateWorldFrame = (frame: PreparedWorldCameraFrame) => {
    if (Math.abs(frame.metersPerUnit / (worldContext.kilometersPerUnit * 1000) - 1) > 1e-9 ||
        Math.abs(frame.bodyRadiusM / (worldContext.bodyRadiusUnits * worldContext.kilometersPerUnit * 1000) - 1) > 1e-9) {
      throw new TypeError('World frame units disagree with the mounted presentation.');
    }
  };
  const camera = perspective.camera;
  const minimumZoom = () => camera.minimumZoom();
  const maximumZoom = () => camera.maximumZoom();
  let publications = 0;
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ?? null;
  let responsiveFit: ReturnType<typeof selectPreparedResponsiveZoom>;
  let projected: PerspectivePublication | null = null;
  let viewportEpoch = 0, requestedPublication = 0, presentedPublication = 0;
  let presentedWorld: WorldCameraPose | null = null;
  const publicationState = () => ({ requestedRevision: requestedPublication, presentedRevision: presentedPublication, presentedWorld });
  const publish = (signal?: AbortSignal) => {
    if (lifetime.disposed) return;
    const captured = perspective.prepare();
    const { scenePresentation: sceneMatrix, sunDirection, zoom, controlPitch, controlYaw, counterRotationFor } = captured;
    const revision = ++requestedPublication, epoch = viewportEpoch;
    const current = () => !lifetime.disposed && epoch === viewportEpoch;
    const commit = () => {
      if (!current()) return;
      // Commit the captured physical observer before publishing its material view.
      projected = captured.commit();
      skySunViewDirection = sunDirection;
      const materialSunViewDirection = skySunViewDirection === null ? null
        : viewSunDirectionToPhysicalLightDirection(skySunViewDirection);
      presentedPublication = revision;
      presentedWorld = captured.world;
      onPublish(Object.freeze({
        sceneMatrix,
        sunViewDirection: materialSunViewDirection,
        skySunViewDirection,
        counterRotation: counterRotationFor(),
        counterRotationFor,
        worldCamera: captured.world,
        controlPitch,
        controlYaw,
        zoom,
        // The dolly's facts: the eye, the projected body and its level of
        // detail, for presentations that fit overlays to the silhouette and
        // choose their material source from the stage.
        distance: projected.distance,
        projection: projected.projection,
        focal: projected.focal,
        viewportWidth: projected.viewportWidth,
        viewportHeight: projected.viewportHeight,
        stageViewport: projected.stageViewport,
        principalOffset: projected.principalOffset,
        body: projected.body,
        levelOfDetail: projected.levelOfDetail,
      }));
      publications += 1;
    };
    return framePresenter.present({
      world: captured.world, viewport: captured.viewport, commit, current, fail: retireFailure }, signal);
  };
  const adoptWorldCamera = (world: WorldCameraPose, frame: PreparedWorldCameraFrame, signal?: AbortSignal) => {
    if (lifetime.disposed) return;
    try {
      validateWorldFrame(frame);
      controls.stop();
      camera.adopt(world, frame);
      return publish(signal);
    } catch (error) { retireFailure(error); throw error; }
  };
  const mobileQuery = matchMedia(runtimePolicy.MOBILE_VIEWPORT_QUERY);
  const publishCameraDelta = (delta: CameraDelta, signal?: AbortSignal) => { camera.rotate(delta); return publish(signal); };
  const surfaceHitTest = (clientX: number, clientY: number) => {
    if (preparedSurfaceHitTest && stage.dataset.lod !== 'marker' && stage.dataset.lod !== 'billboard') return preparedSurfaceHitTest(clientX, clientY);
    const body = projected?.body;
    if (!body) return false;
    const radius = worldContext.bodyRadiusUnits;
    const cameraBounds = viewport.read(cameraPlan.projection.cssPerspective).bounds;
    return hitsProjectedBody(clientX, clientY, body, cameraBounds, null,
      projected && radius ? { focalPixels: projected.focal,
        principalOffsetPixels: [projected.principalOffset[0]!, projected.principalOffset[1]!], bodyRadiusUnits: radius } : undefined);
  };
  lifetime.onDispose(bindWorldCameraPicking(inputSurface, stage,
    () => viewport.read(cameraPlan.projection.cssPerspective).bounds,
    (x, y) => stage.dataset.lod === 'geometry' && surfaceHitTest(x, y)));
  const controls = createObjectInteractionControls({
    inputSurface,
    cameraMotion,
    runtimePolicy,
    onError: retireFailure,
    camera,
    trackballMetrics: () => perspective.trackball(),
    sceneMatrix: () => camera.scene(),
    rotate: publishCameraDelta,
    minimumZoom: minimumZoom(),
    maximumZoom: maximumZoom(),
    surfaceFlyToHitTest: (clientX, clientY) => !camera.focus() && surfaceHitTest(clientX, clientY),
    // The prepared wheel dolly: the eye moves along its axis, with no
    // surface anchor to hold.
    dolly: Object.freeze({ stepPerDelta: cameraPlan.dolly.wheelStepPerDelta }),
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
    plan: cameraPlan,
    mobile: inputPolicy.mobile,
    framingReferenceZoom: worldContext.framingReferenceZoom, viewport,
  });
  camera.dolly({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
  const windowTarget = stage.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Orbit document has no window.");
  const flyCamera = (sample: (progress: number) => void, durationMilliseconds: number, signal?: AbortSignal) => {
    if (lifetime.disposed || signal?.aborted) return Promise.resolve({ completed: false });
    interactionStarts++; onInteractionStart();
    const flight = cameraMotion.fly({ windowTarget, durationMilliseconds,
      signal: signal ? AbortSignal.any([flightScope.signal, signal]) : flightScope.signal,
      inputSpeedUp: runtimePolicy.FLIGHT_WHEEL_SPEEDUP,
      sample(progress, signal) { sample(progress); return publish(signal); },
      onFinish: guardNative(() => { interactionEnds++; onInteractionEnd(); }),
    });
    return flight.finished.catch(error => { retireFailure(error); return { completed: false }; });
  };
  const handleViewportResize = guardNative(() => {
    viewportEpoch++;
    // The dolly keeps its framing across the resize (the shared contract:
    // a breakpoint crossing preserves the camera state).
    perspective.remeasure();
    responsiveFit = selectPreparedResponsiveZoom({
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      framingReferenceZoom: worldContext.framingReferenceZoom, viewport,
    });
    publish();
  });
  lifetime.onDispose(viewport.subscribe(handleViewportResize));
  publish();
  constructing = false;
  return Object.freeze({
    publicationState,
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    currentResponsiveZoom: () => responsiveFit.zoom,
    setZoomOutCentering(enabled: boolean) { camera.setZoomOutCentering(enabled); },
    preparedFocus: () => camera.focus() ?? null,
    setPreparedFocus(focus: PreparedNavigationFocus | null, frame: PreparedWorldCameraFrame) {
      if (lifetime.disposed) return;
      validateWorldFrame(frame);
      cameraMotion.cancel();
      controls.stop();
      camera.setFocus(focus, frame);
      publish();
    },
    async flyToPreparedFocus(focus: PreparedNavigationFocus, frame: PreparedWorldCameraFrame,
      viewport: WorldCameraViewport & { framingRadiusPixels: number }, options: PreparedFocusFlightOptions = {}) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      validateWorldFrame(frame);
      if (options.signal?.aborted) return Promise.resolve({ completed: false });
      const plan = prepareFocusFlight(camera, focus, frame, viewport, options.durationMilliseconds);
      cameraMotion.cancel(); controls.stop();
      camera.setFocus(plan.focus, frame);
      publish();
      const reduced = options.reducedMotion ?? windowTarget.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return flyCamera(plan.sample, reduced ? 0 : plan.durationMilliseconds, options.signal);
    },
    captureWorldCamera(frame: PreparedWorldCameraFrame): WorldCameraPose {
      validateWorldFrame(frame);
      return camera.capture(frame);
    },
    /** Flight writes carry their cancellation signal and acknowledge presentation. */
    applyWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame, signal?: AbortSignal) {
      if (signal?.aborted) return Promise.resolve(false);
      if (!signal) cameraMotion.cancel();
      return adoptWorldCamera(world, frame, signal);
    },
    rebaseScene(change: DOMMatrix) {
      if (lifetime.disposed) return;
      try { camera.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState({ controlPitch, controlYaw, controlRoll = 0, zoom, transition }: CameraAngles & { zoom: number; controlRoll?: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } }, { surfaceTarget = false, signal }: { surfaceTarget?: boolean; signal?: AbortSignal } = {}) {
      if (lifetime.disposed || signal?.aborted) return Promise.resolve({ completed: false });
      try {
      if (![controlPitch, controlYaw, controlRoll, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
      cameraMotion.cancel();
      controls.stop();
      camera.clearFocus();
      const start = { ...camera.state };
      const targetZoom = transition?.preserveZoom ? start.zoom : clamp(zoom, minimumZoom(), maximumZoom());
      const viewport = perspective.viewport();
      const targetRotation = surfaceTarget
        ? prepareSurfaceTargetRotation(camera.bodyCenter() ??
          [-viewport.principalOffsetPixels[0], -viewport.principalOffsetPixels[1], -viewport.focalPixels]) : undefined;
      // CSS parsing quantizes coefficients; numerical camera state must keep
      // the original doubles so the proper-rotation invariant survives flight.
      const targetCorrection = targetRotation && new DOMMatrix([
        targetRotation[0], targetRotation[3], targetRotation[6], 0,
        targetRotation[1], targetRotation[4], targetRotation[7], 0,
        targetRotation[2], targetRotation[5], targetRotation[8], 0, 0, 0, 0, 1]);
      const roll = new DOMMatrix().rotateAxisAngle(0, 0, 1, controlRoll);
      const correction = targetCorrection ? targetCorrection.multiply(roll) : roll;
      const flight = camera.prepareFlight({ controlPitch, controlYaw }, correction);
      const sample = (progress: number) => {
        const ease = progress * progress * (3 - 2 * progress);
        const frame = transition ? { rotation: ease, zoom: start.zoom * (targetZoom / start.zoom) ** ease } : sampleDestinationFlight({ startZoom: start.zoom, targetZoom,
          overviewZoom: cameraPlan.defaultZoom, angularDistance: flight.angularDistance }, progress);
        flight.sample(frame.rotation, { rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
          rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation, zoom: frame.zoom });
      };
      if (transition?.durationMilliseconds === 0 || windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return flyCamera(sample, 0, signal);
      }
      return flyCamera(sample, transition?.durationMilliseconds ?? 4500, signal);
      } catch (error) { retireFailure(error); throw error; }
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
      cameraMotion.cancel();
      controls.stop();
      camera.restore({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(distanceKilometers !== undefined ? { distanceKilometers }
          : distance !== undefined ? { distance } : zoom === undefined ? {} : { zoom }),
      }, pose, bodyCenterKilometers);
      publish();
      } catch (error) { retireFailure(error); throw error; }
      return this.state();
    },
    state(): OrbitState {
      const pose = camera.snapshot();
      const state = {
        pose,
        pitch: camera.state.rotX,
        controlPitch: camera.state.rotX,
        controlYaw: camera.state.rotY,
        zoom: camera.state.zoom,
        ...perspective.state(),
      };
      return Object.freeze(state);
    },
    sharedState(): PhysicalSharedCamera {
      const state = this.state();
      const bodyCenterKilometers = state.bodyCenterKilometers;
      return { distanceKilometers: state.distanceKilometers, pose: state.pose,
        ...(bodyCenterKilometers === undefined ? {} : { bodyCenterKilometers }) };
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
        preparedFocusId: camera.focus()?.id ?? null,
        flightActive: cameraMotion.signal !== undefined,
        framePublication: publicationState(),
        interactionStarts,
        interactionEnds,
        dragInertia: controls.stats(),
        runtimeGeometryPreparation: false,
        ...perspective.stats({ wheelDollies: controls.stats().wheelZoom?.events ?? 0 }),
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
