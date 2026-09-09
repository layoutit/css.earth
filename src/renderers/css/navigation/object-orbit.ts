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
import type { LegacySharedCamera, PhysicalSharedCamera } from './view-url.js';
import type { RetainedCubicSky } from '../solar-system/cubic-sky-runtime.js';
import type { RetainedDirectionalSun, DirectionalSunPlan } from '../solar-system/directional-sun-runtime.js';
import type { mountRetainedHeliocentricView } from '../solar-system/heliocentric-view-runtime.js';
import type { SunProjection } from '../solar-system/heliocentric-view.js';
import { rotationFromMatrix3d } from '../solar-system/heliocentric-view.js';
import { presentWorldCamera, worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import type { PositionM } from '@cssearth/engine';
import { bindWorldCameraPicking } from './world-camera-picking.js';
import { hitsProjectedBody } from './world-camera-hit.js';
import { prepareSurfaceTargetRotation } from './surface-target.js';
import { worldRotationCss } from './world-camera-math.js';
import type { PhysicalProjection } from '../rendering/physical-projection.js';
export interface OrbitStateUpdate { pitch?: number; controlPitch?: number; controlYaw?: number; zoom?: number; distance?: number; distanceKilometers?: number; bodyCenterKilometers?: PositionM; pose?: CameraPose; }
export type OrbitState = { pitch: number; controlPitch: number; controlYaw: number; zoom: number; pose: CameraPose } & Partial<ReturnType<PerspectiveDolly['state']>>;
export interface OrbitPublication extends CameraAngles { worldCamera?: WorldCameraPose; sceneMatrix: string; skyboxMatrix: string; sunViewDirection: Vector3 | null; skySunViewDirection: Vector3 | null; sunPresentation: SunProjection | ReturnType<RetainedDirectionalSun['state']> | null; counterRotation: string; counterRotationFor(localMatrix: string | DOMMatrix | null): string; zoom: number; projection?: PhysicalProjection; distance?: number; focal?: number; viewportWidth?: number; viewportHeight?: number; stageViewport?: WorldCameraViewport; principalOffset?: readonly number[]; body?: ReturnType<PerspectiveDolly['publish']>['body']; levelOfDetail?: ReturnType<PerspectiveDolly['levelOfDetail']>; }
export interface RetainedOrbitOptions { framePresenter?: WorldFramePresenter; preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean; stage: HTMLElement; inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; cameraElement: HTMLElement; sceneElement: HTMLElement; cubicSky: RetainedCubicSky; skyPlan: CameraSkyPlan; directionalSun?: RetainedDirectionalSun | null; directionalSunPlan?: DirectionalSunPlan | null; heliocentric?: ReturnType<typeof mountRetainedHeliocentricView> | null; worldContext?: PerspectiveWorldContext; cameraPlan: CameraPlan; viewport?: import('./camera-viewport.js').CameraViewport; objectId: string; mobilePreviewElement?: HTMLElement | null; onPublish?: (publication: OrbitPublication) => void; onInteractionStart?: () => void; onInteractionEnd?: () => void; onError(error: unknown): void; requireSun?: boolean; }
export interface OrbitServices extends InteractionServices { createPolyCamera?: typeof createPolyCamera; createCubicSkyCameraOrientation?: typeof createCubicSkyCameraOrientation; bindResponsiveOrbitPolicy?: RuntimePolicy['bindResponsiveOrbitPolicy']; selectPreparedResponsiveZoom?: typeof selectPreparedResponsiveZoom; createPerspectiveDolly?: typeof createPerspectiveDolly; HTMLElement?: typeof HTMLElement; matchMedia?: (query: string) => MediaQueryList; MutationObserver?: typeof MutationObserver; }
export type RetainedCubicSkyOrbit = ReturnType<typeof createRetainedCubicSkyOrbit>;
import { createPreparedCameraPublisher } from "../rendering/prepared-camera-runtime.js";
import { createPolyCamera } from "@layoutit/polycss";

import { createSceneLifetime } from "@cssearth/engine";
import { sampleDestinationFlight } from "@cssearth/engine";
import { viewSunDirectionToPhysicalLightDirection, viewSunDirectionToPreparedLightDirection } from "../solar-system/directional-sun-coordinate.js";
import { createPerspectiveDolly } from "./perspective-dolly.js";
import { googleEarthDirectAngularDegreesPerTrackballRadius, googleEarthInteractionTrackball, directPitchResponseForZoom } from "@cssearth/engine";
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
  cubicSky,
  skyPlan,
  directionalSun = null,
  directionalSunPlan = null,
  // A mounted heliocentric view (see heliocentric-view-runtime.mjs) replaces
  // the directional Sun billboard: the Sun is real geometry projected with a
  // perspective camera that frames by dolly (cameraPlan.projection), and the
  // Sun's direction in directionalSunPlan is observed, so it rides the scene.
  heliocentric = null,
  worldContext,
  framePresenter,
  preparedSurfaceHitTest,
  cameraPlan,
  viewport,
  objectId,
  mobilePreviewElement,
  onPublish = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
  requireSun = true,
}: RetainedOrbitOptions, services: OrbitServices = {}) {
  const { createPolyCamera: createPolyCamera = nativeServices.createPolyCamera, createCubicSkyCameraOrientation: createCubicSkyCameraOrientation = nativeServices.createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy: bindResponsiveOrbitPolicy = runtimePolicy.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom = nativeServices.selectPreparedResponsiveZoom, HTMLElement = globalThis.HTMLElement, matchMedia = (query: string) => { const view = stage.ownerDocument.defaultView; if (!view) throw new Error("Orbit document has no window."); return view.matchMedia(query); }, createPerspectiveDolly: createPerspectiveDolly = nativeServices.createPerspectiveDolly, MutationObserver = globalThis.MutationObserver } = services;
  const hasDirectionalSun = directionalSun !== null ||
    directionalSunPlan !== null;
  const perspectiveCamera = heliocentric !== null || worldContext !== undefined;
  if (heliocentric !== null && (directionalSun !== null || directionalSunPlan === null ||
      cameraPlan?.projection?.model !== "css-perspective-shared-with-sky" ||
      heliocentric.sunRoot?.isConnected !== true ||
      heliocentric.overlay?.isConnected !== true)) {
    throw new TypeError("Heliocentric orbit requires the observed Sun plan and the mounted view.");
  }
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
      (hasDirectionalSun && !perspectiveCamera && (
        directionalSun?.root?.isConnected !== true ||
        directionalSunPlan === null
      )) ||
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
  const perspective = perspectiveCamera ? createPerspectiveDolly({
    cameraPlan, heliocentric, worldContext, cameraElement, sceneElement,
    skyElement: cubicSky.root, stage, viewport,
  }) : null;
  const requireWorldPerspective = (frame: PreparedWorldCameraFrame) => {
    if (!perspective || !skyTracksScene) throw new TypeError('This object has no physical world camera.');
    const units = worldContext ?? (heliocentric ? {
      kilometersPerUnit: heliocentric.plan.units.kilometersPerUnit,
      bodyRadiusUnits: heliocentric.plan.units.bodyRadiusUnits,
    } : null);
    if (!units || Math.abs(frame.metersPerUnit / (units.kilometersPerUnit * 1000) - 1) > 1e-9 ||
        Math.abs(frame.bodyRadiusM / (units.bodyRadiusUnits * units.kilometersPerUnit * 1000) - 1) > 1e-9) {
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
    sunTracksScene: heliocentric !== null ||
      (worldContext !== undefined && directionalSunPlan?.localDirection !== undefined),
    skyTracksScene,
  });
  const safeCamera = perspective ? camera : Object.freeze({
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
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ??
    skyPlan.sun?.initialViewDirection ?? null;
  let sunPresentation: OrbitPublication["sunPresentation"] = directionalSun?.state() ?? null;
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
  const publish = () => {
    if (lifetime.disposed) return;
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
    // The Sun and the orbit, resolved relative to the camera in float64; the
    // same projection places the body.
    if (perspective) {
      heliocentric?.setSkyView?.({ matrix: sky.matrix, exposure: cubicSky.starExposure?.() ?? null });
      projected = captured ? captured.commit() : perspective.publish(orientation.sceneMatrix(), sceneMatrix);
    }
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
      sunPresentation = skySunViewDirection === null
        ? null
        : directionalSun?.setViewDirection(skySunViewDirection) ?? null;
      materialSunViewDirection = hasDirectionalSun &&
          skySunViewDirection !== null
        ? lightDirection(skySunViewDirection)
        : skySunViewDirection;
    }
    if (projected) sunPresentation = projected.sun ?? null;
    presentedPublication = revision;
    if (captured?.world) presentedWorld = captured.world;
    onPublish(Object.freeze({
      sceneMatrix,
      skyboxMatrix: sky.matrix,
      sunViewDirection: materialSunViewDirection,
      skySunViewDirection,
      sunPresentation,
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
    if (captured?.world && framePresenter) framePresenter.present({
      world: captured.world, viewport: captured.viewport, commit, current, fail: retireFailure });
    else commit();
  };
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
    const marker = heliocentric?.marker ?? null;
    const markerBounds = marker !== null && !marker.hidden && Number(marker.style.opacity) > 0
      ? marker.getBoundingClientRect() : null;
    const radius = worldContext?.bodyRadiusUnits ?? heliocentric?.plan.units.bodyRadiusUnits;
    const cameraBounds = cameraPlan.projection ? viewport?.read(cameraPlan.projection.cssPerspective).bounds : null;
    return hitsProjectedBody(clientX, clientY, body, cameraBounds ?? cameraElement.getBoundingClientRect(), markerBounds,
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
    trackballMetrics: () => perspective ? perspective.trackball() : measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
      sceneScale: cameraPlan.sceneScale,
    }),
    sceneMatrix: () => orientation.scene(),
    rotate: publishCameraDelta,
    minimumZoom: minimumZoom(),
    maximumZoom: maximumZoom(),
    surfaceFlyToHitTest: surfaceHitTest,
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
  publish();
  constructing = false;
  return Object.freeze({
    publicationState,
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    currentResponsiveZoom: () => responsiveFit.zoom,
    setZoomOutCentering(enabled: boolean) { perspective?.setZoomOutCentering(enabled); },
    captureWorldCamera(frame: PreparedWorldCameraFrame): WorldCameraPose {
      const physical = requireWorldPerspective(frame);
      const rotation = rotationFromMatrix3d(orientation.sceneMatrix());
      const bodyCenterUnits = physical.bodyCenter();
      return bodyCenterUnits === null
        ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: safeCamera.state.distance }, frame, physical.viewport())
        : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame);
    },
    applyWorldCamera(world: WorldCameraPose, frame: PreparedWorldCameraFrame) {
      if (lifetime.disposed) return;
      try {
        const physical = requireWorldPerspective(frame);
        const presentation = presentWorldCamera(world, frame, physical.viewport());
        controls.stop();
        physical.setBodyCenter(presentation.bodyCenterUnits);
        orientation.setSceneRotation(presentation.rotation);
        publish();
      } catch (error) { retireFailure(error); throw error; }
    },
    rebaseScene(change: DOMMatrix) {
      if (lifetime.disposed) return;
      try { orientation.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState({ controlPitch, controlYaw, zoom }: CameraAngles & { zoom: number }, { surfaceTarget = false } = {}) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      try {
      if (![controlPitch, controlYaw, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
      controls.stop();
      const start = { ...safeCamera.state };
      const targetZoom = clamp(zoom, minimumZoom(), maximumZoom());
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
      const flight = orientation.prepareFlight({ controlPitch, controlYaw }, targetCorrection);
      const sample = (progress: number) => {
        const frame = sampleDestinationFlight({ startZoom: start.zoom, targetZoom,
          overviewZoom: cameraPlan.defaultZoom, angularDistance: flight.angularDistance }, progress);
        safeCamera.update({ rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
          rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation, zoom: frame.zoom });
        flight.sample(frame.rotation);
        publish();
      };
      if (windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        sample(1);
        return Promise.resolve({ completed: true });
      }
      return controls.flyTo({ sample });
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
      controls.stop();
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
      if (bodyCenterKilometers !== undefined && perspective) {
        const scale = heliocentric?.plan.units.kilometersPerUnit ?? worldContext!.kilometersPerUnit;
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
    sharedState(): LegacySharedCamera | PhysicalSharedCamera {
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
      const pose = state.pose;
      if (pose.schema !== "cssearth-camera-pose@1") throw new Error("Legacy camera snapshot is unavailable.");
      return { controlPitch: state.controlPitch, controlYaw: state.controlYaw, zoom: state.zoom, pose };
    },
    skyState() {
      const currentSunPresentation = directionalSun?.state() ??
        sunPresentation;
      const view = heliocentric?.state() ?? null;
      return Object.freeze({
        sunViewDirection: skySunViewDirection === null
          ? null
          : Object.freeze([...skySunViewDirection]),
        sunVisible: currentSunPresentation?.visible ??
          (skySunViewDirection === null ? false : skySunViewDirection[2] < 0),
        sunClassification: currentSunPresentation?.classification ??
          (skySunViewDirection === null ? "absent" : "cubemap-baked"),
        ...(view === null ? {} : {
          // The dolly's level of detail (the stage, the crossfade opacities).
          lod: perspective!.levelOfDetail(),
          sunCenterNdc: view.sun?.centerNdc ?? null,
          sunSpriteDiameter: view.sun?.spriteDiameter ?? null,
          orbitPieceCount: view.orbitPieceCount,
          orbitOpacity: view.orbitOpacity,
          bodyMarkerOpacity: view.markerOpacity,
          trailSpans: view.trailSpans ?? null,
          captions: view.captions ?? null,
          ...(view.systemOpacity === undefined ? {} : {
            planetarySystem: Object.freeze({
              opacity: view.systemOpacity,
              orbitPieceCount: view.systemPieceCount,
              markerVisibleCount: view.systemMarkerVisibleCount,
              bodies: view.systemBodies,
              sunMarkerOpacity: view.sunMarkerOpacity,
              sunMarkerVisible: view.sunMarkerVisible,
            }),
          }),
        }),
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
        framePublication: publicationState(),
        directionalSunBillboardCount: hasDirectionalSun ? 1 : 0,
        interactionStarts,
        interactionEnds,
        dragInertia: controls.stats(),
        runtimeGeometryPreparation: false,
        ...(perspective ? {
          ...perspective.stats({ wheelDollies: controls.stats().wheelZoom?.events ?? 0 }),
          // Scene, sky orientation, the Sun billboard and the material fit,
          // plus one per visible orbit piece.
          runtimeTransformStringWrites: publications * 4,
          orbitPieceCount: heliocentric?.state().orbitPieceCount ?? 0,
          orbitPoolOverflows: heliocentric?.state().orbitPoolOverflows ?? 0,
          systemOrbitPieceCount: heliocentric?.state().systemPieceCount ?? 0,
          systemPoolOverflows: heliocentric?.state().systemPoolOverflows ?? 0,
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
