import { createPreparedCameraPublisher } from "./prepared-camera-runtime.mjs";
import { createPolyCamera } from "@layoutit/polycss";
import { bindResponsiveOrbitPolicy, MOBILE_VIEWPORT_QUERY } from "../../site/runtime-policy.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { sampleDestinationFlight } from "./destination-flight.mjs";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mjs";
import { googleEarthDirectAngularDegreesPerTrackballRadius, googleEarthInteractionTrackball, directPitchResponseForZoom } from "./google-earth-drag-inertia.mjs";
import { createPreparedWheelZoomControls } from "./prepared-wheel-zoom.mjs";
import { createCubicSkyCameraOrientation } from "./camera-orientation.mjs";
import { preparedScenePitch, clamp } from "./camera-math.mjs";
import { selectPreparedResponsiveZoom, measureRetainedPlanetTrackball } from "./camera-layout.mjs";
import { createUnboundedMatrixDragControls } from "./camera-input.mjs";

const nativeServices = { createPolyCamera, createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom, createUnboundedMatrixDragControls, createPreparedWheelZoomControls };

export function createObjectInteractionControls({
  inputSurface,
  camera,
  trackballMetrics,
  sceneMatrix,
  rotate,
  minimumZoom,
  maximumZoom,
  onStart,
  onEnd,
  onError = null,
}, services = {}) {
  const { createUnboundedMatrixDragControls: createUnboundedMatrixDragControls = nativeServices.createUnboundedMatrixDragControls, createPreparedWheelZoomControls: createPreparedWheelZoomControls = nativeServices.createPreparedWheelZoomControls } = services;
  if (typeof sceneMatrix !== "function") {
    throw new TypeError("Object interaction controls require the current scene matrix.");
  }
  const lifetime = createSceneLifetime();
  const fail = error => {
    const cleanup = lifetime.destroy();
    const failure = cleanup.length ? new AggregateError([error, ...cleanup], error.message, { cause:error }) : error;
    if (onError === null) throw failure;
    onError(failure);
  };
  try {
  const interactionTrackballMetrics = () =>
    googleEarthInteractionTrackball(trackballMetrics());
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface,
    onError: fail,
    trackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      angularDegreesPerTrackballRadius:
        googleEarthDirectAngularDegreesPerTrackballRadius(camera.state.zoom),
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
  });
  lifetime.onDispose(() => wheelControls.destroy());
  return Object.freeze({
    update(options) {
      if (lifetime.disposed) return;
      wheelControls.update(options);
      dragControls.update(options);
    },
    stop() {
      wheelControls.stop();
      dragControls.stop();
    },
    flyTo(options) {
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
    if (cleanup.length) throw new AggregateError([error, ...cleanup], error.message, { cause:error });
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
  directionalSun = null,
  directionalSunPlan = null,
  cameraPlan,
  objectId,
  mobilePreviewElement,
  onPublish = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
  requireSun = true,
}, services = {}) {
  const { createPolyCamera: createPolyCamera = nativeServices.createPolyCamera, createCubicSkyCameraOrientation: createCubicSkyCameraOrientation = nativeServices.createCubicSkyCameraOrientation, bindResponsiveOrbitPolicy: bindResponsiveOrbitPolicy = nativeServices.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom = nativeServices.selectPreparedResponsiveZoom, HTMLElement = globalThis.HTMLElement, matchMedia = query => stage.ownerDocument.defaultView.matchMedia(query) } = services;
  const hasDirectionalSun = directionalSun !== null ||
    directionalSunPlan !== null;
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
      (hasDirectionalSun && (
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
  const retireFailure = (error) => {
    if (constructing) throw error;
    if (lifetime.disposed) return;
    const cleanupErrors = lifetime.destroy();
    onError(cleanupErrors.length
      ? new AggregateError([error, ...cleanupErrors], error.message, { cause: error }) : error);
  };
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) { retireFailure(error); }
  };
  try {
  const camera = createPolyCamera({
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
  });
  const safeCamera = Object.freeze({
    get state() { return camera.state; },
    update(partial) {
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
  let publications = 0;
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ??
    skyPlan.sun?.initialViewDirection ?? null;
  let sunPresentation = directionalSun?.state() ?? null;
  const publishCamera = createPreparedCameraPublisher({
    cameraElement, sceneElement, objectId,
    defaultZoom: cameraPlan.defaultZoom,
    sceneScale: cameraPlan.sceneScale,
  });
  let publishedSkyboxMatrix = null;
  let publishedZoom = null;
  let materialSunViewDirection = hasDirectionalSun &&
      skySunViewDirection !== null
    ? viewSunDirectionToPreparedLightDirection(skySunViewDirection)
    : skySunViewDirection;
  let responsiveFit = null;
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
      sunPresentation = skySunViewDirection === null
        ? null
        : directionalSun?.setViewDirection(skySunViewDirection) ?? null;
      materialSunViewDirection = hasDirectionalSun &&
          skySunViewDirection !== null
        ? viewSunDirectionToPreparedLightDirection(skySunViewDirection)
        : skySunViewDirection;
    }
    onPublish(Object.freeze({
      sceneMatrix,
      skyboxMatrix: sky.matrix,
      sunViewDirection: materialSunViewDirection,
      skySunViewDirection,
      sunPresentation,
      counterRotation: orientation.counterRotation(),
      counterRotationFor(localMatrix) {
        return orientation.counterRotation(localMatrix);
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
    rotation,
  }) => {
    const previousPitch = safeCamera.state.rotX;
    safeCamera.update({
      rotX: previousPitch + controlPitchDelta,
      rotY: safeCamera.state.rotY + controlYawDelta,
      ...(zoom === undefined ? {} : { zoom }),
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
    minimumZoom: cameraPlan.minimumZoom,
    maximumZoom: cameraPlan.maximumZoom,
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
  safeCamera.update({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
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
    rebaseScene(change) {
      if (lifetime.disposed) return;
      try { orientation.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState({ controlPitch, controlYaw, zoom }) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      try {
      if (![controlPitch, controlYaw, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
      controls.stop();
      const start = { ...safeCamera.state };
      const targetZoom = clamp(zoom, cameraPlan.minimumZoom, cameraPlan.maximumZoom);
      const flight = orientation.prepareFlight({ controlPitch, controlYaw });
      const sample = progress => {
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
    setState({ pitch, controlPitch = pitch, controlYaw, zoom, pose } = {}) {
      if (lifetime.disposed) return this.state();
      try {
      controls.stop();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      safeCamera.update({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(zoom === undefined ? {} : { zoom }),
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
      return Object.freeze(state);
    },
    skyState() {
      const currentSunPresentation = directionalSun?.state() ??
        sunPresentation;
      return Object.freeze({
        sunViewDirection: skySunViewDirection === null
          ? null
          : Object.freeze([...skySunViewDirection]),
        sunVisible: currentSunPresentation?.visible ??
          (skySunViewDirection === null ? false : skySunViewDirection[2] < 0),
        sunClassification: currentSunPresentation?.classification ??
          (skySunViewDirection === null ? "absent" : "cubemap-baked"),
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
        minimumZoom: cameraPlan.minimumZoom,
        maximumZoom: cameraPlan.maximumZoom,
        defaultZoom: cameraPlan.defaultZoom,
        responsiveFitModel: responsiveFit.model,
        responsiveWidthShare: responsiveFit.widthShare,
        responsiveBaseZoom: responsiveFit.zoom,
        publications,
        directionalSunBillboardCount: hasDirectionalSun ? 1 : 0,
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
