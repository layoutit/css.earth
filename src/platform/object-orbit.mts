import type { ObjectInteractionOptions as RendererObjectInteractionOptions } from "../renderers/css/navigation/object-interaction-controls.ts";
import type { RuntimePolicy } from "../renderers/css/navigation/runtime-policy.ts";
import type { NavigationCamera, TrackballMetrics, CameraDelta, ControlsUpdate, DestinationMotion, CameraPlan, CameraUpdate, CameraAngles, CameraPose, Vector3 } from "../renderers/css/navigation/types.ts";
import type { CameraSkyPlan, CameraOrientationOptions, CubicSkyCameraOrientation } from "../renderers/css/navigation/camera-orientation.ts";
import type { PerspectiveDolly, PerspectiveWorldContext } from "./perspective-dolly.mts";
import type { LegacySharedCamera, PhysicalSharedCamera } from "../renderers/css/navigation/view-url.ts";
import type { DirectionalSunPlan } from "../renderers/css/solar-system/directional-sun-coordinate.ts";
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from "../renderers/css/navigation/world-camera.ts";
import type { PositionM } from '@cssearth/engine';
import type { PhysicalProjection } from "../renderers/css/rendering/physical-projection.ts";
export interface OrbitStateUpdate { pitch?: number; controlPitch?: number; controlYaw?: number; zoom?: number; distance?: number; distanceKilometers?: number; bodyCenterKilometers?: PositionM; pose?: CameraPose; }
export type OrbitState = { pitch: number; controlPitch: number; controlYaw: number; zoom: number; pose: CameraPose } & Partial<ReturnType<PerspectiveDolly['state']>>;
export interface OrbitPublication extends CameraAngles { sceneMatrix: string; skyboxMatrix: string; sunViewDirection: Vector3 | null; skySunViewDirection: Vector3 | null; counterRotation: string; counterRotationFor(localMatrix: string | DOMMatrix | null): string; zoom: number; projection?: PhysicalProjection; distance?: number; focal?: number; viewportWidth?: number; viewportHeight?: number; stageViewport?: WorldCameraViewport; principalOffset?: readonly number[]; body?: ReturnType<PerspectiveDolly['publish']>['body']; levelOfDetail?: ReturnType<PerspectiveDolly['levelOfDetail']>; }
export type OrbitCubicSky = { root: HTMLElement; setOrientation(options: { matrix: string; zoom: number; defaultZoom: number }): void; };
export interface RetainedOrbitOptions { preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean; stage: HTMLElement; inputSurface: HTMLElement; cameraElement: HTMLElement; sceneElement: HTMLElement; cubicSky: OrbitCubicSky; skyPlan: CameraSkyPlan; directionalSunPlan?: DirectionalSunPlan | null; worldContext?: PerspectiveWorldContext; cameraPlan: CameraPlan; viewport?: import("../renderers/css/navigation/camera-viewport.ts").CameraViewport; objectId: string; mobilePreviewElement?: HTMLElement | null; onPublish?: (publication: OrbitPublication) => void; onInteractionStart?: () => void; onInteractionEnd?: () => void; onError(error: unknown): void; requireSun?: boolean; }
export type ObjectInteractionOptions = Omit<RendererObjectInteractionOptions, "runtimePolicy" | "surfaceFlyToHitTest">;
export type OrbitOrientation = Pick<CubicSkyCameraOrientation, 'scene' | 'sceneMatrix' | 'skybox' | 'counterRotation' | 'reset' | 'rebaseScene' | 'prepareFlight' | 'restore' | 'rotate' | 'snapshot'>;
export type OrbitDragController = { update(options: ControlsUpdate): void; stop(): void; flyTo(options: DestinationMotion): Promise<{ completed: boolean }>; stats(): Readonly<Record<string, unknown>>; destroy(): void; invalidateTrackball(): void; };
export type OrbitWheelController = { update(options?: ControlsUpdate): void; stop(): void; stats(): Readonly<{ events?: number }>; destroy(): void; };
export type OrbitResponsivePolicy = { readonly mobile: boolean; destroy(): void };
export type OrbitMediaQuery = MediaQueryList;
export interface OrbitServices { createPolyCamera?: (state: { target: Vector3; rotX: number; rotY: number; zoom: number; distance: number }) => NavigationCamera; createCubicSkyCameraOrientation?: (options: CameraOrientationOptions) => OrbitOrientation; createUnboundedMatrixDragControls?: (options: Parameters<typeof createUnboundedMatrixDragControls>[0]) => OrbitDragController; createPreparedWheelZoomControls?: (options: Parameters<typeof createPreparedWheelZoomControls>[0]) => OrbitWheelController; bindResponsiveOrbitPolicy?: RuntimePolicy['bindResponsiveOrbitPolicy']; selectPreparedResponsiveZoom?: (options: Parameters<typeof selectPreparedResponsiveZoom>[0]) => { zoom: number; model: string; widthShare: number }; HTMLElement?: { [Symbol.hasInstance](value: unknown): boolean }; matchMedia?: (query: string) => OrbitMediaQuery; MutationObserver?: typeof MutationObserver; }
export type RetainedCubicSkyOrbit = ReturnType<typeof createRetainedCubicSkyOrbit>;
import { createPreparedCameraPublisher } from "./prepared-camera-runtime.mts";
import { createPolyCamera } from "@layoutit/polycss";
import { bindResponsiveOrbitPolicy, MOBILE_VIEWPORT_QUERY } from "../../site/runtime-policy.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { sampleDestinationFlight } from "./destination-flight.mts";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mts";
import { directAngularDegreesPerTrackballRadius, interactionTrackball, directPitchResponseForZoom } from "./trackball-drag-inertia.mts";
import { createPreparedWheelZoomControls } from "./prepared-wheel-zoom.mts";
import { createCubicSkyCameraOrientation } from "./camera-orientation.mts";
import { preparedScenePitch, clamp } from "@cssearth/engine";
import { selectPreparedResponsiveZoom, measureRetainedPlanetTrackball } from "./camera-layout.mts";
import { createUnboundedMatrixDragControls } from "./camera-input.mts";

const nativeServices = { createPolyCamera, createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom, createUnboundedMatrixDragControls, createPreparedWheelZoomControls };

export function createObjectInteractionControls({
  inputSurface,
  camera,
  trackballMetrics,
  sceneMatrix,
  rotate,
  minimumZoom,
  maximumZoom,
  dolly = null,
  onStart,
  onEnd,
  onError = null,
}: ObjectInteractionOptions, services: Pick<OrbitServices, 'createUnboundedMatrixDragControls' | 'createPreparedWheelZoomControls'> = {}) {
  const { createUnboundedMatrixDragControls: createUnboundedMatrixDragControls = nativeServices.createUnboundedMatrixDragControls, createPreparedWheelZoomControls: createPreparedWheelZoomControls = nativeServices.createPreparedWheelZoomControls } = services;
  if (typeof sceneMatrix !== "function") {
    throw new TypeError("Object interaction controls require the current scene matrix.");
  }
  const lifetime = createSceneLifetime();
  const fail = (error: unknown) => {
    const cleanup = lifetime.destroy();
    const failure = cleanup.length ? new AggregateError([error, ...cleanup], error instanceof Error ? error.message : String(error), { cause:error }) : error;
    if (onError === null) throw failure;
    onError(failure);
  };
  try {
  const interactionTrackballMetrics = () =>
    interactionTrackball(trackballMetrics());
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface,
    onError: fail,
    trackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      angularDegreesPerTrackballRadius:
        directAngularDegreesPerTrackballRadius(camera.state.zoom),
      pitchResponse: directPitchResponseForZoom(camera.state.zoom),
    }),
    flyToTrackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      sceneMatrix: sceneMatrix(),
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: camera.state.zoom,
      minimumZoom,
      maximumZoom,
    }),
    onPointerStart: () => wheelControls.stop(),
    onStart,
    onEnd,
    rotate,
  });
  lifetime.onDispose(() => dragControls.destroy());
  // The motion observer must receive each wheel event before zoom starts.
  const wheelControls = createPreparedWheelZoomControls({
    inputSurface,
    onError: fail,
    camera,
    trackballMetrics: interactionTrackballMetrics,
    rotate(delta) {
      rotate(delta);
      // Measure the changed camera only if a held pointer moves again.
      dragControls.invalidateTrackball();
    },
    minimumZoom,
    maximumZoom,
    dolly,
  });
  lifetime.onDispose(() => wheelControls.destroy());
  return Object.freeze({
    update(options: ControlsUpdate) {
      if (lifetime.disposed) return;
      wheelControls.update(options);
      dragControls.update(options);
    },
    stop() {
      wheelControls.stop();
      dragControls.stop();
    },
    flyTo(options: DestinationMotion) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      wheelControls.stop();
      return dragControls.flyTo(options);
    },
    stats: () => Object.freeze({
      ...dragControls.stats(),
      wheelZoom: wheelControls.stats(),
    }),
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Object input cleanup failed.");
    },
  });
  } catch (error) {
    const cleanup = lifetime.destroy();
    if (cleanup.length) throw new AggregateError([error, ...cleanup], error instanceof Error ? error.message : String(error), { cause:error });
    throw error;
  }
}

export function createRetainedCubicSkyOrbit({
  stage,
  inputSurface,
  cameraElement,
  sceneElement,
  cubicSky,
  skyPlan,
  directionalSunPlan = null,
  cameraPlan,
  objectId,
  mobilePreviewElement,
  onPublish = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
  requireSun = true,
}: RetainedOrbitOptions, services: OrbitServices = {}) {
  const { createPolyCamera: createPolyCamera = nativeServices.createPolyCamera, createCubicSkyCameraOrientation: createCubicSkyCameraOrientation = nativeServices.createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy: bindResponsiveOrbitPolicy = nativeServices.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom = nativeServices.selectPreparedResponsiveZoom, HTMLElement = globalThis.HTMLElement, matchMedia = query => stage.ownerDocument.defaultView!.matchMedia(query) } = services;
  const hasDirectionalSun = directionalSunPlan !== null;
  // The stars ride the scene matrix when the sky was registered to it.
  const skyTracksScene = skyPlan?.cameraContract === "scene-locked-unbounded-accumulated-matrix3d";
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
      ? new AggregateError([error, ...cleanupErrors], error instanceof Error ? error.message : String(error), { cause: error }) : error);
  };
  const guardNative = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => (...args: Args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) { retireFailure(error); }
  };
  try {
  const camera: NavigationCamera = createPolyCamera({
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
    skyPlan,
    requireSun: hasDirectionalSun ? false : requireSun,
    sunDirection: directionalSunPlan?.localDirection,
    sunReferenceViewDirection: directionalSunPlan?.referenceViewDirection,
    skyTracksScene,
  });
  const safeCamera = Object.freeze({
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
  const minimumZoom = () => cameraPlan.minimumZoom;
  const maximumZoom = () => cameraPlan.maximumZoom;
  const lightDirection = viewSunDirectionToPreparedLightDirection;
  let publications = 0;
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ?? null;
  const publishCamera = createPreparedCameraPublisher({
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
  let responsiveFit: ReturnType<typeof selectPreparedResponsiveZoom> | null = null;
  const publish = () => {
    if (lifetime.disposed) return;
    const sceneMatrix = orientation.scene();
    const sky = orientation.skybox();
    const zoom = safeCamera.state.zoom;
    const skyboxChanged = sky.matrix !== publishedSkyboxMatrix;
    const zoomChanged = zoom !== publishedZoom;
    publishCamera({ sceneMatrix, zoom });
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
    onPublish(Object.freeze({
      sceneMatrix,
      skyboxMatrix: sky.matrix,
      sunViewDirection: materialSunViewDirection,
      skySunViewDirection,
      counterRotation: orientation.counterRotation()!,
      counterRotationFor(localMatrix: string | DOMMatrix | null) {
        return orientation.counterRotation(localMatrix)!;
      },

      controlPitch: safeCamera.state.rotX,
      controlYaw: safeCamera.state.rotY,
      zoom,
    }));
    publications += 1;
  };
  const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
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
  const controls = createObjectInteractionControls({
    inputSurface,
    onError: retireFailure,
    camera: safeCamera,
    trackballMetrics: () => measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
      sceneScale: cameraPlan.sceneScale,
    }),
    sceneMatrix: () => orientation.scene(),
    rotate: publishCameraDelta,
    minimumZoom: minimumZoom(),
    maximumZoom: maximumZoom(),
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
  });
  safeCamera.update({ zoom: responsiveFit!.zoom });
  const initialResponsiveZoom = responsiveFit!.zoom;
  const windowTarget = stage.ownerDocument.defaultView;
  const handleViewportResize = guardNative(() => {
    responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement,
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      mobilePreviewElement,
    });
    publish();
  });
  lifetime.onDispose(() => windowTarget?.removeEventListener("resize", handleViewportResize));
  windowTarget?.addEventListener("resize", handleViewportResize, {
    passive: true,
  });
  publish();
  constructing = false;
  return Object.freeze({
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    rebaseScene(change: DOMMatrix) {
      if (lifetime.disposed) return;
      try { orientation.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState({ controlPitch, controlYaw, controlRoll = 0, zoom, transition }: CameraAngles & { zoom: number; controlRoll?: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } }) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      try {
      if (![controlPitch, controlYaw, controlRoll, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
      controls.stop();
      const start = { ...safeCamera.state };
      const targetZoom = transition?.preserveZoom ? start.zoom : clamp(zoom, minimumZoom(), maximumZoom());
      const flight = orientation.prepareFlight({ controlPitch, controlYaw, controlRoll });
      const sample = (progress: number) => {
        const ease = progress * progress * (3 - 2 * progress);
        const frame = transition ? { rotation: ease, zoom: start.zoom * (targetZoom / start.zoom) ** ease } : sampleDestinationFlight({ startZoom: start.zoom, targetZoom,
          overviewZoom: cameraPlan.defaultZoom, angularDistance: flight.angularDistance }, progress);
        safeCamera.update({ rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
          rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation, zoom: frame.zoom });
        flight.sample(frame.rotation);
        publish();
      };
      if (windowTarget!.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        sample(1);
        return Promise.resolve({ completed: true });
      }
      return controls.flyTo({ sample, durationMilliseconds: transition?.durationMilliseconds });
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
    setState({ pitch, controlPitch = pitch, controlYaw, zoom, distance, distanceKilometers, pose }: OrbitStateUpdate = {}) {
      if (lifetime.disposed) return this.state();
      try {
      controls.stop();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      if (distance !== undefined || distanceKilometers !== undefined) {
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
      publish();
      } catch (error) { retireFailure(error); throw error; }
      return this.state();
    },
    state() {
      const state = {
        pitch: safeCamera.state.rotX,
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      };
      Object.defineProperty(state, "pose", {
        value: orientation.snapshot(),
      });
      return Object.freeze(state) as OrbitState;
    },
    sharedState() {
      const state = this.state();
      return { controlPitch: state.controlPitch, controlYaw: state.controlYaw, zoom: state.zoom, pose: state.pose };
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
        responsiveFitModel: responsiveFit!.model,
        responsiveWidthShare: responsiveFit!.widthShare,
        responsiveBaseZoom: responsiveFit!.zoom,
        publications,
        interactionStarts,
        interactionEnds,
        dragInertia: controls.stats(),
        runtimeGeometryPreparation: false,
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
