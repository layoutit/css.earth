import {
  createPolyCamera,
  createPolyOrbitControls,
} from "@layoutit/polycss";

import {
  bindResponsiveOrbitPolicy,
  MOBILE_VIEWPORT_QUERY,
} from "../../site/runtime-policy.mjs";
import { validatePreparedCubicSky } from "./cubic-sky-contract.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "./directional-sun-coordinate.mjs";
import { validateDirectionalSunPlan } from
  "./directional-sun-contract.mjs";
import {
  advanceGoogleEarthDragThrow,
  createGoogleEarthDragHistory,
  estimateGoogleEarthDragThrow,
  GOOGLE_EARTH_DRAG_INERTIA,
  googleEarthDirectAngularDegreesPerTrackballRadius,
  projectGoogleEarthTrackballDelta,
  recordGoogleEarthDragSample,
  resetGoogleEarthDragHistory,
} from "./google-earth-drag-inertia.mjs";
import {
  GOOGLE_EARTH_SURFACE_FLY_TO,
  planGoogleEarthSurfaceFlyTo,
  sampleGoogleEarthSurfaceFlyTo,
} from "./google-earth-surface-fly-to.mjs";

export function mountRetainedCubicSky({
  host,
  plan,
  imageDensity,
  objectId,
  requireSun = true,
}) {
  validatePreparedCubicSky(plan, { requireSun });
  if (!(host instanceof HTMLElement) || ![1, 2].includes(imageDensity) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId)) {
    throw new TypeError("Retained cubic sky mount arguments are invalid.");
  }
  const root = document.createElement("div");
  root.className = `planet-cubic-sky ${objectId}-skybox`;
  root.ariaHidden = "true";
  if (plan.projection?.cssPerspective) {
    root.style.setProperty(
      "--planet-cubic-sky-camera-distance",
      plan.projection.cssPerspective,
    );
  }
  const cube = document.createElement("div");
  cube.className = `planet-cubic-sky-cube ${objectId}-skybox-cube`;
  const orientation = document.createElement("div");
  orientation.className =
    `planet-cubic-sky-orientation ${objectId}-skybox-orientation`;
  for (const face of plan.faces) {
    const element = document.createElement("div");
    element.className =
      `planet-cubic-sky-face planet-cubic-sky-${face.id} ` +
      `${objectId}-skybox-face ${objectId}-skybox-${face.id}`;
    const selectedUrl = imageDensity === 2 ? face.url2x : face.url;
    const selectedHighContrastUrl = imageDensity === 2
      ? face.highContrastUrl2x
      : face.highContrastUrl;
    element.style.setProperty(
      "--planet-cubic-sky-standard-image",
      `url("${selectedUrl}")`,
    );
    element.style.setProperty(
      "--planet-cubic-sky-high-contrast-image",
      `url("${selectedHighContrastUrl}")`,
    );
    orientation.appendChild(element);
  }
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);
  let publishedMatrix = null;
  let publishedZoomScale = null;
  return Object.freeze({
    root,
    cube,
    orientation,
    faceCount: orientation.querySelectorAll(".planet-cubic-sky-face").length,
    setOrientation({ matrix, zoom, defaultZoom }) {
      if (typeof matrix !== "string" || !Number.isFinite(zoom) ||
          !Number.isFinite(defaultZoom) || defaultZoom <= 0) {
        throw new TypeError("Retained cubic sky camera publication is invalid.");
      }
      if (matrix !== publishedMatrix) {
        orientation.style.transform = matrix;
        cube.style.setProperty(`--${objectId}-skybox-orientation`, matrix);
        publishedMatrix = matrix;
      }
      const zoomScale = 1 + plan.cameraZoomResponse *
        (zoom / defaultZoom - 1);
      if (zoomScale !== publishedZoomScale) {
        root.style.setProperty("--planet-cubic-sky-zoom", String(zoomScale));
        root.style.setProperty(`--${objectId}-skybox-zoom`, String(zoomScale));
        publishedZoomScale = zoomScale;
      }
    },
    destroy() {
      root.remove();
    },
  });
}

export function createCubicSkyCameraOrientation({
  controlPitch,
  controlYaw,
  cameraPlan,
  skyPlan,
  requireSun = true,
  sunDirection = skyPlan?.sun?.localDirection ?? null,
  sunReferenceViewDirection = null,
}) {
  validatePreparedCubicSky(skyPlan, { requireSun });
  if (sunDirection !== null && (
    !Array.isArray(sunDirection) || sunDirection.length !== 3 ||
    sunDirection.some((component) => !Number.isFinite(component)) ||
    Math.abs(Math.hypot(...sunDirection) - 1) > 1e-9
  )) {
    throw new TypeError("Cubic-sky Sun direction is invalid.");
  }
  if (sunReferenceViewDirection !== null && (
    !Array.isArray(sunReferenceViewDirection) ||
    sunReferenceViewDirection.length !== 3 ||
    sunReferenceViewDirection.some((component) =>
      !Number.isFinite(component)) ||
    Math.abs(Math.hypot(...sunReferenceViewDirection) - 1) > 1e-9
  )) {
    throw new TypeError("Cubic-sky Sun reference view direction is invalid.");
  }
  const referenceSceneMatrix = createSceneMatrix(
    cameraPlan.materialReferenceControlPitchDegrees ?? controlPitch,
    cameraPlan.materialReferenceControlYawDegrees ?? controlYaw,
    cameraPlan,
  );
  let sceneMatrix;
  let skyboxMatrix;
  let sunViewMatrix;
  let scenePresentation = null;
  let skyboxPresentation = null;
  let counterMatrix = null;
  let billboardCounterMatrix = null;
  const counterPresentations = new Map();
  const billboardCounterPresentations = new Map();
  const invalidatePresentations = () => {
    scenePresentation = null;
    skyboxPresentation = null;
    counterMatrix = null;
    billboardCounterMatrix = null;
    counterPresentations.clear();
    billboardCounterPresentations.clear();
  };
  const reset = ({ controlPitch: nextPitch, controlYaw: nextYaw }) => {
    const renderedPitch = preparedScenePitch(nextPitch, cameraPlan);
    const skyboxPitch = cameraPlan.initialScenePitchDegrees +
      skyPlan.cameraPitchResponse *
        (renderedPitch - cameraPlan.initialScenePitchDegrees);
    sceneMatrix = createSceneMatrix(nextPitch, nextYaw, cameraPlan);
    const resetSkyboxMatrix = new DOMMatrix()
      .rotateAxisAngle(
        1,
        0,
        0,
        skyboxPitch + skyPlan.presentationPitchOffsetDegrees,
      )
      .rotateAxisAngle(0, 0, 1, skyPlan.presentationYawOffsetDegrees);
    skyboxMatrix = new DOMMatrix()
      .rotateAxisAngle(0, 1, 0, -nextYaw)
      .multiply(resetSkyboxMatrix);
    sunViewMatrix = new DOMMatrix()
      .rotateAxisAngle(
        1,
        0,
        0,
        (renderedPitch - cameraPlan.initialScenePitchDegrees) *
          skyPlan.cameraPitchResponse,
      )
      .rotateAxisAngle(
        0,
        1,
        0,
        -(nextYaw - cameraPlan.defaultControlYawDegrees),
      );
    invalidatePresentations();
  };
  reset({ controlPitch, controlYaw });
  return Object.freeze({
    reset,
    rotate({ renderedPitchDelta, yawDelta }) {
      sceneMatrix = new DOMMatrix()
        .rotateAxisAngle(1, 0, 0, renderedPitchDelta)
        .rotateAxisAngle(0, 1, 0, yawDelta)
        .multiply(sceneMatrix);
      skyboxMatrix = new DOMMatrix()
        .rotateAxisAngle(
          1,
          0,
          0,
          renderedPitchDelta * skyPlan.cameraPitchResponse,
        )
        .rotateAxisAngle(0, 1, 0, -yawDelta)
        .multiply(skyboxMatrix);
      sunViewMatrix = new DOMMatrix()
        .rotateAxisAngle(
          1,
          0,
          0,
          renderedPitchDelta * skyPlan.cameraPitchResponse,
        )
        .rotateAxisAngle(0, 1, 0, -yawDelta)
        .multiply(sunViewMatrix);
      invalidatePresentations();
    },
    scene() {
      scenePresentation ??= formatMatrix3d(sceneMatrix);
      return scenePresentation;
    },
    counterRotation(localMatrix = null) {
      if (counterPresentations.has(localMatrix)) {
        return counterPresentations.get(localMatrix);
      }
      counterMatrix ??= sceneMatrix.inverse().multiply(referenceSceneMatrix);
      if (localMatrix === null) {
        const presentation = formatMatrix3d(counterMatrix);
        counterPresentations.set(null, presentation);
        return presentation;
      }
      const local = typeof localMatrix === "string"
        ? new DOMMatrix(localMatrix)
        : localMatrix;
      if (!(local instanceof DOMMatrix)) {
        throw new TypeError("Cubic-sky local counter basis is invalid.");
      }
      const presentation = formatMatrix3d(
        local.inverse().multiply(counterMatrix).multiply(local),
      );
      counterPresentations.set(localMatrix, presentation);
      return presentation;
    },
    billboardCounterRotation(localMatrix = null) {
      if (billboardCounterPresentations.has(localMatrix)) {
        return billboardCounterPresentations.get(localMatrix);
      }
      scenePresentation ??= formatMatrix3d(sceneMatrix);
      billboardCounterMatrix ??= new DOMMatrix(
        `scale(${cameraPlan.sceneScale}) ${scenePresentation}`,
      ).inverse();
      if (localMatrix === null) {
        const presentation = formatMatrix3d(billboardCounterMatrix);
        billboardCounterPresentations.set(null, presentation);
        return presentation;
      }
      const local = typeof localMatrix === "string"
        ? new DOMMatrix(localMatrix)
        : localMatrix;
      if (!(local instanceof DOMMatrix)) {
        throw new TypeError("Cubic-sky billboard counter basis is invalid.");
      }
      const presentation = formatMatrix3d(
        local.inverse().multiply(billboardCounterMatrix),
      );
      billboardCounterPresentations.set(localMatrix, presentation);
      return presentation;
    },
    skybox() {
      if (skyboxPresentation !== null) return skyboxPresentation;
      const sunViewDirection = sunReferenceViewDirection
        ? Object.freeze(transformDirection(
          sunViewMatrix,
          sunReferenceViewDirection,
        ))
        : sunDirection
          ? Object.freeze(transformDirection(
            skyboxMatrix,
            sunDirection,
          ))
          : null;
      skyboxPresentation = Object.freeze({
        matrix: formatMatrix3d(skyboxMatrix),
        sunViewDirection,
      });
      return skyboxPresentation;
    },
  });
}

export function createUnboundedMatrixDragControls({
  inputSurface,
  trackballMetrics,
  flyToTrackballMetrics = trackballMetrics,
  rotate,
  surfaceFlyToState = null,
  onStart = () => {},
  onEnd = () => {},
}) {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof trackballMetrics !== "function" ||
      typeof flyToTrackballMetrics !== "function" ||
      typeof rotate !== "function" ||
      (surfaceFlyToState !== null &&
        typeof surfaceFlyToState !== "function") ||
      typeof onStart !== "function" || typeof onEnd !== "function") {
    throw new TypeError("Unbounded matrix drag controls are invalid.");
  }
  let drag = true;
  let wheel = true;
  let pointerId = null;
  let pointerDragging = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let previousX = 0;
  let previousY = 0;
  let accumulatedPitch = 0;
  let accumulatedYaw = 0;
  let activeTrackball = null;
  const history = createGoogleEarthDragHistory();
  let inertiaFrame = null;
  let inertiaState = null;
  let interactionActive = false;
  let activeMode = "idle";
  let inertiaStarts = 0;
  let inertiaFrames = 0;
  let inertiaCancels = 0;
  let pointerCancels = 0;
  let flyToFrame = null;
  let flyToMotion = null;
  let flyToStarts = 0;
  let flyToFrames = 0;
  let flyToCompletions = 0;
  let flyToCancels = 0;
  let wheelCoexistences = 0;
  let wheelTargetRebases = 0;
  const interruptionCounts = {
    drag: 0,
    pointer: 0,
    wheel: 0,
    "fly-to": 0,
    programmatic: 0,
    disabled: 0,
    destroy: 0,
  };
  let lastInterruption = null;
  const windowTarget = inputSurface.ownerDocument.defaultView;
  const requestFrame = windowTarget.requestAnimationFrame.bind(windowTarget);
  const cancelFrame = windowTarget.cancelAnimationFrame.bind(windowTarget);
  const syncCursor = () => {
    inputSurface.style.cursor = drag ? "grab" : "";
  };
  const finishInteraction = () => {
    if (!interactionActive) return;
    interactionActive = false;
    activeMode = "idle";
    onEnd();
  };
  const cancelInertia = () => {
    if (inertiaFrame === null) return;
    cancelFrame(inertiaFrame);
    inertiaFrame = null;
    inertiaState = null;
    inertiaCancels += 1;
  };
  const cancelFlyTo = () => {
    if (flyToFrame === null) return;
    cancelFrame(flyToFrame);
    flyToFrame = null;
    flyToMotion = null;
    flyToCancels += 1;
  };
  const cancelPointer = () => {
    if (pointerId === null) return;
    const activePointerId = pointerId;
    pointerId = null;
    pointerDragging = false;
    resetGoogleEarthDragHistory(history);
    activeTrackball = null;
    if (inputSurface.hasPointerCapture(activePointerId)) {
      inputSurface.releasePointerCapture(activePointerId);
    }
    pointerCancels += 1;
    syncCursor();
  };
  const interruptMotion = (nextMode) => {
    const previousMode = activeMode;
    const hadActivity = previousMode !== "idle" || pointerId !== null;
    if (!hadActivity) return false;
    cancelInertia();
    cancelFlyTo();
    cancelPointer();
    finishInteraction();
    if (previousMode !== "idle") {
      interruptionCounts[nextMode] += 1;
      lastInterruption = Object.freeze({
        from: previousMode,
        to: nextMode,
      });
    }
    return true;
  };
  const replaceCameraMotion = (nextMode) => {
    const previousMode = activeMode;
    if (previousMode === "inertia") cancelInertia();
    if (previousMode === "fly-to") cancelFlyTo();
    if (previousMode !== "idle" && previousMode !== nextMode) {
      interruptionCounts[nextMode] += 1;
      lastInterruption = Object.freeze({
        from: previousMode,
        to: nextMode,
      });
    }
    activeMode = nextMode;
    return previousMode;
  };
  const animateFlyTo = (timestamp) => {
    if (flyToMotion === null) return;
    if (flyToMotion.startedAt === null) flyToMotion.startedAt = timestamp;
    const currentZoom = surfaceFlyToState?.()?.zoom;
    if (Number.isFinite(currentZoom) && flyToMotion.lastPublishedZoom > 0) {
      const externalZoomRatio = currentZoom / flyToMotion.lastPublishedZoom;
      if (Math.abs(externalZoomRatio - 1) > 1e-9) {
        flyToMotion.zoomScale *= externalZoomRatio;
      }
    }
    const progress = Math.min(
      1,
      Math.max(0, timestamp - flyToMotion.startedAt) /
        GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds,
    );
    const sample = sampleGoogleEarthSurfaceFlyTo(
      flyToMotion.plan,
      progress,
    );
    const zoom = Math.min(
      flyToMotion.plan.maximumZoom,
      Math.max(
        flyToMotion.plan.minimumZoom,
        sample.zoom * flyToMotion.zoomScale,
      ),
    );
    rotate({
      controlPitchDelta:
        sample.pitchDeltaDegrees - flyToMotion.previousPitchDelta,
      controlYawDelta:
        sample.yawDeltaDegrees - flyToMotion.previousYawDelta,
      zoom,
    });
    flyToMotion.previousPitchDelta = sample.pitchDeltaDegrees;
    flyToMotion.previousYawDelta = sample.yawDeltaDegrees;
    flyToMotion.lastPublishedZoom = zoom;
    flyToFrames += 1;
    if (!sample.complete) {
      flyToFrame = requestFrame(animateFlyTo);
      return;
    }
    flyToFrame = null;
    flyToMotion = null;
    flyToCompletions += 1;
    finishInteraction();
  };
  const onDoubleClick = (event) => {
    if (!drag || surfaceFlyToState === null || event.button !== 0) return;
    const measuredTrackball = flyToTrackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const cameraState = surfaceFlyToState();
    const plan = planGoogleEarthSurfaceFlyTo({
      clientX: event.clientX,
      clientY: event.clientY,
      trackball: measuredTrackball,
      currentZoom: cameraState?.zoom,
      minimumZoom: cameraState?.minimumZoom,
      maximumZoom: cameraState?.maximumZoom,
    });
    if (plan === null) return;
    event.preventDefault();
    const wasInteractionActive = interactionActive;
    replaceCameraMotion("fly-to");
    flyToMotion = {
      plan,
      startedAt: null,
      previousPitchDelta: 0,
      previousYawDelta: 0,
      zoomScale: 1,
      lastPublishedZoom: plan.startZoom,
    };
    flyToStarts += 1;
    if (!wasInteractionActive) {
      interactionActive = true;
      onStart();
    }
    flyToFrame = requestFrame(animateFlyTo);
  };
  const animateInertia = (timestamp) => {
    if (inertiaState === null) return;
    const elapsedMilliseconds = Math.max(
      0,
      timestamp - inertiaState.previousTimestamp,
    );
    const step = advanceGoogleEarthDragThrow({
      pitchDegreesPerMillisecond:
        inertiaState.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: inertiaState.yawDegreesPerMillisecond,
      initialSpeedDegreesPerMillisecond:
        inertiaState.initialSpeedDegreesPerMillisecond,
      elapsedMilliseconds,
    });
    inertiaState.previousTimestamp = timestamp;
    inertiaState.pitchDegreesPerMillisecond =
      step.pitchDegreesPerMillisecond;
    inertiaState.yawDegreesPerMillisecond = step.yawDegreesPerMillisecond;
    if (step.pitchDeltaDegrees !== 0 || step.yawDeltaDegrees !== 0) {
      rotate({
        controlPitchDelta: step.pitchDeltaDegrees,
        controlYawDelta: step.yawDeltaDegrees,
      });
      inertiaFrames += 1;
    }
    if (step.active) {
      inertiaFrame = requestFrame(animateInertia);
    } else {
      inertiaFrame = null;
      inertiaState = null;
      finishInteraction();
    }
  };
  const startInertia = (releaseTimestamp) => {
    const throwState = estimateGoogleEarthDragThrow({
      history,
      releaseTimestamp,
    });
    if (throwState === null) return false;
    inertiaState = {
      ...throwState,
      previousTimestamp: releaseTimestamp,
    };
    activeMode = "inertia";
    inertiaStarts += 1;
    inertiaFrame = requestFrame(animateInertia);
    return true;
  };
  const onPointerDown = (event) => {
    if (!drag || pointerId !== null || event.isPrimary === false ||
        event.button !== 0) return;
    event.preventDefault();
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    interruptMotion("pointer");
    pointerId = event.pointerId;
    pointerDragging = false;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    previousX = event.clientX;
    previousY = event.clientY;
    accumulatedPitch = 0;
    accumulatedYaw = 0;
    activeTrackball = measuredTrackball;
    resetGoogleEarthDragHistory(history);
    recordGoogleEarthDragSample(history, {
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      pitch: accumulatedPitch,
      yaw: accumulatedYaw,
    });
    inputSurface.style.cursor = "grabbing";
    inputSurface.setPointerCapture(event.pointerId);
  };
  const applyPointerSamples = (event) => {
    const coalesced = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [];
    const sampleEvents = coalesced.length > 0 ? coalesced : [event];
    let pitchDelta = 0;
    let yawDelta = 0;
    for (const sampleEvent of sampleEvents) {
      if (pointerDragging && sampleEvent.clientX === previousX &&
          sampleEvent.clientY === previousY) {
        continue;
      }
      if (!pointerDragging) {
        const displacement = Math.hypot(
          sampleEvent.clientX - pointerDownX,
          sampleEvent.clientY - pointerDownY,
        );
        if (displacement <
            GOOGLE_EARTH_DRAG_INERTIA.minimumThrowDisplacementPixels) {
          continue;
        }
        const wasInteractionActive = interactionActive;
        replaceCameraMotion("drag");
        pointerDragging = true;
        if (!wasInteractionActive) {
          interactionActive = true;
          onStart();
        }
      }
      const projected = projectGoogleEarthTrackballDelta({
        previousX,
        previousY,
        currentX: sampleEvent.clientX,
        currentY: sampleEvent.clientY,
        ...activeTrackball,
      });
      const fittedPitch = projected.pitchDegrees *
        GOOGLE_EARTH_DRAG_INERTIA.directPitchResponse;
      pitchDelta += fittedPitch;
      yawDelta += projected.yawDegrees;
      accumulatedPitch += fittedPitch;
      accumulatedYaw += projected.yawDegrees;
      previousX = sampleEvent.clientX;
      previousY = sampleEvent.clientY;
      recordGoogleEarthDragSample(history, {
        x: sampleEvent.clientX,
        y: sampleEvent.clientY,
        timestamp: sampleEvent.timeStamp,
        pitch: accumulatedPitch,
        yaw: accumulatedYaw,
      });
    }
    if (pitchDelta !== 0 || yawDelta !== 0) {
      rotate({
        controlPitchDelta: pitchDelta,
        controlYawDelta: yawDelta,
      });
    }
  };
  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event) => {
    if (event.pointerId !== pointerId) return;
    const wasDragging = pointerDragging;
    pointerId = null;
    pointerDragging = false;
    syncCursor();
    if (inputSurface.hasPointerCapture(event.pointerId)) {
      inputSurface.releasePointerCapture(event.pointerId);
    }
    if (wasDragging && event.type === "pointerup" &&
        startInertia(event.timeStamp)) return;
    if (wasDragging) finishInteraction();
  };
  const onWheel = () => {
    if (!wheel || (activeMode !== "inertia" && activeMode !== "fly-to")) {
      return;
    }
    wheelCoexistences += 1;
    if (activeMode !== "fly-to" || flyToMotion === null) return;
    const motion = flyToMotion;
    const publishedZoom = motion.lastPublishedZoom;
    windowTarget.queueMicrotask(() => {
      if (flyToMotion !== motion || activeMode !== "fly-to") return;
      const wheelZoom = surfaceFlyToState?.()?.zoom;
      if (!Number.isFinite(wheelZoom) || publishedZoom <= 0) return;
      const targetZoom = clamp(
        motion.plan.targetZoom * Math.pow(
          wheelZoom / publishedZoom,
          GOOGLE_EARTH_SURFACE_FLY_TO.wheelTargetResponse,
        ),
        motion.plan.minimumZoom,
        motion.plan.maximumZoom,
      );
      if (Math.abs(targetZoom - motion.plan.targetZoom) < 1e-9) return;
      motion.plan = Object.freeze({ ...motion.plan, targetZoom });
      rotate({
        controlPitchDelta: 0,
        controlYawDelta: 0,
        zoom: publishedZoom,
      });
      wheelTargetRebases += 1;
    });
  };
  inputSurface.addEventListener("pointerdown", onPointerDown);
  inputSurface.addEventListener("pointermove", onPointerMove);
  inputSurface.addEventListener("pointerup", endPointer);
  inputSurface.addEventListener("pointercancel", endPointer);
  inputSurface.addEventListener("dblclick", onDoubleClick);
  inputSurface.addEventListener("wheel", onWheel, { passive: true });
  inputSurface.style.userSelect = "none";
  syncCursor();
  return Object.freeze({
    update(options) {
      if (options.drag !== undefined) drag = options.drag;
      if (options.wheel !== undefined) wheel = options.wheel;
      if (!drag) interruptMotion("disabled");
      syncCursor();
    },
    stop() {
      interruptMotion("programmatic");
    },
    stats() {
      return Object.freeze({
        schema: GOOGLE_EARTH_DRAG_INERTIA.schema,
        projection: "screen-space-sphere",
        historyStorage: "fixed-capacity-float64-ring",
        activeMode,
        activeMotionCount:
          Number(pointerDragging) + Number(inertiaFrame !== null) +
          Number(flyToFrame !== null),
        pendingPointer: pointerId !== null && !pointerDragging,
        wheelCoexistences,
        wheelTargetRebases,
        active: inertiaFrame !== null,
        starts: inertiaStarts,
        frames: inertiaFrames,
        cancels: inertiaCancels,
        pointerCancels,
        interruptions: Object.freeze({ ...interruptionCounts }),
        lastInterruption,
        surfaceFlyTo: Object.freeze({
          schema: GOOGLE_EARTH_SURFACE_FLY_TO.schema,
          qualification: GOOGLE_EARTH_SURFACE_FLY_TO.qualification,
          enabled: surfaceFlyToState !== null,
          active: flyToFrame !== null,
          starts: flyToStarts,
          frames: flyToFrames,
          completions: flyToCompletions,
          cancels: flyToCancels,
        }),
      });
    },
    destroy() {
      interruptMotion("destroy");
      inputSurface.removeEventListener("pointerdown", onPointerDown);
      inputSurface.removeEventListener("pointermove", onPointerMove);
      inputSurface.removeEventListener("pointerup", endPointer);
      inputSurface.removeEventListener("pointercancel", endPointer);
      inputSurface.removeEventListener("dblclick", onDoubleClick);
      inputSurface.removeEventListener("wheel", onWheel);
      inputSurface.style.removeProperty("cursor");
      inputSurface.style.removeProperty("user-select");
    },
  });
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
  requireSun = true,
}) {
  const hasDirectionalSun = directionalSun !== null ||
    directionalSunPlan !== null;
  validatePreparedCubicSky(skyPlan, {
    requireSun: hasDirectionalSun ? false : requireSun,
  });
  if (hasDirectionalSun) validateDirectionalSunPlan(directionalSunPlan);
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
      typeof onInteractionStart !== "function" ||
      typeof onInteractionEnd !== "function") {
    throw new TypeError("Shared retained cubic-sky orbit is invalid.");
  }
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
  let destroyed = false;
  let publications = 0;
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ??
    skyPlan.sun?.initialViewDirection ?? null;
  let sunPresentation = directionalSun?.state() ?? null;
  let publishedSceneMatrix = null;
  let publishedSkyboxMatrix = null;
  let publishedZoom = null;
  let materialSunViewDirection = hasDirectionalSun &&
      skySunViewDirection !== null
    ? viewSunDirectionToPreparedLightDirection(skySunViewDirection)
    : skySunViewDirection;
  let responsiveFit = null;
  const publish = () => {
    if (destroyed) return;
    const sceneMatrix = orientation.scene();
    const sky = orientation.skybox();
    const zoom = safeCamera.state.zoom;
    const sceneChanged = sceneMatrix !== publishedSceneMatrix;
    const skyboxChanged = sky.matrix !== publishedSkyboxMatrix;
    const zoomChanged = zoom !== publishedZoom;
    if (sceneChanged) {
      sceneElement.style.transform =
        `scale(${cameraPlan.sceneScale}) ${sceneMatrix}`;
      publishedSceneMatrix = sceneMatrix;
    }
    if (skyboxChanged || zoomChanged) {
      cubicSky.setOrientation({
        matrix: sky.matrix,
        zoom,
        defaultZoom: cameraPlan.defaultZoom,
      });
      publishedSkyboxMatrix = sky.matrix;
    }
    if (zoomChanged) {
      const zoomScale = zoom / cameraPlan.defaultZoom;
      cameraElement.style.scale =
        `calc(var(--${objectId}-shell-scale) / (` +
        `var(--planet-viewport-zoom-divisor) / ${zoomScale}))`;
      publishedZoom = zoom;
    }
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
      billboardCounterRotation: orientation.billboardCounterRotation(),
      billboardCounterRotationFor(localMatrix) {
        return orientation.billboardCounterRotation(localMatrix);
      },
      controlPitch: safeCamera.state.rotX,
      controlYaw: safeCamera.state.rotY,
      zoom,
    }));
    publications += 1;
  };
  const scene = Object.freeze({
    host: inputSurface,
    cameraEl: cameraElement,
    sceneElement,
    camera: safeCamera,
    applyCamera: publish,
  });
  const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface,
    trackballMetrics: () => Object.freeze({
      ...measureRetainedPlanetTrackball({
        stage,
        cameraElement,
        logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
      }),
      angularDegreesPerTrackballRadius:
        googleEarthDirectAngularDegreesPerTrackballRadius(
          safeCamera.state.zoom,
        ),
    }),
    flyToTrackballMetrics: () => measureRetainedPlanetFlyToDisc({
      stage,
      cameraElement,
      logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: safeCamera.state.zoom,
      minimumZoom: cameraPlan.minimumZoom,
      maximumZoom: cameraPlan.maximumZoom,
    }),
    onStart() {
      interactionStarts += 1;
      onInteractionStart();
    },
    onEnd() {
      interactionEnds += 1;
      onInteractionEnd();
    },
    rotate({ controlPitchDelta, controlYawDelta, zoom }) {
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
      });
      publish();
    },
  });
  // Register this after the motion observer. The wheel update remains an
  // independent zoom channel; an active throw or fly-to rebases on its result.
  const wheelControls = createPolyOrbitControls(scene, {
    drag: false,
    wheel: !mobileQuery.matches,
    minZoom: cameraPlan.minimumZoom,
    maxZoom: cameraPlan.maximumZoom,
  });
  const controls = Object.freeze({
    update(options) {
      wheelControls.update(options);
      dragControls.update(options);
    },
    destroy() {
      dragControls.destroy();
      wheelControls.destroy();
    },
  });
  const inputPolicy = bindResponsiveOrbitPolicy({
    controls,
    inputSurface,
    mediaQuery: mobileQuery,
  });
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
  const handleViewportResize = () => {
    responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement,
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      mobilePreviewElement,
    });
    publish();
  };
  windowTarget?.addEventListener("resize", handleViewportResize, {
    passive: true,
  });
  publish();
  return Object.freeze({
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    refresh: publish,
    setState({ pitch, controlPitch = pitch, controlYaw, zoom } = {}) {
      dragControls.stop();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      safeCamera.update({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(zoom === undefined ? {} : { zoom }),
      });
      if (resetsOrientation) {
        orientation.reset({
          controlPitch: safeCamera.state.rotX,
          controlYaw: safeCamera.state.rotY,
        });
      }
      publish();
      return this.state();
    },
    state() {
      return Object.freeze({
        pitch: safeCamera.state.rotX,
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      });
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
        dragInertia: dragControls.stats(),
        runtimeGeometryPreparation: false,
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      windowTarget?.removeEventListener("resize", handleViewportResize);
      inputPolicy.destroy();
      controls.destroy();
    },
  });
}

export function preparedScenePitch(controlPitchDegrees, plan) {
  const progress = (
    controlPitchDegrees - plan.defaultControlPitchDegrees
  ) / (
    plan.maximumControlPitchDegrees - plan.defaultControlPitchDegrees
  );
  return plan.initialScenePitchDegrees * (1 - progress);
}

export function selectPreparedResponsiveZoom({
  stage,
  cameraElement,
  plan,
  mobile,
  mobilePreviewElement,
}) {
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
  const shellScale = cameraBounds.width / stageBounds.width;
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
  const maximumMobileDiameter = mobile && mobilePreviewBounds?.top > 0
    ? mobilePreviewBounds.top * fit.maximumMobilePreviewShare
    : Number.POSITIVE_INFINITY;
  const targetDiameter = Math.min(
    stageBounds.width * widthShare,
    stageBounds.height * fit.maximumHeightShare,
    maximumMobileDiameter,
  );
  const zoom = clamp(
    targetDiameter / (plan.logicalBodyDiameter * shellScale),
    fit.minimumZoom,
    fit.maximumZoom,
  );
  return Object.freeze({ model: fit.model, widthShare, zoom });
}

function formatMatrix3d(matrix) {
  return `matrix3d(${[
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ].map((value) => Math.abs(value) < 1e-12
    ? 0
    : Number(value.toFixed(12))).join(",")})`;
}

function createSceneMatrix(controlPitch, controlYaw, cameraPlan) {
  return new DOMMatrix()
    .rotateAxisAngle(1, 0, 0, preparedScenePitch(controlPitch, cameraPlan))
    .rotateAxisAngle(0, 1, 0, controlYaw);
}

function transformDirection(matrix, direction) {
  const transformed = [
    matrix.m11 * direction[0] + matrix.m21 * direction[1] +
      matrix.m31 * direction[2],
    matrix.m12 * direction[0] + matrix.m22 * direction[1] +
      matrix.m32 * direction[2],
    matrix.m13 * direction[0] + matrix.m23 * direction[1] +
      matrix.m33 * direction[2],
  ];
  const length = Math.hypot(...transformed);
  return transformed.map((value) => value / length);
}

export function measureRetainedPlanetTrackball({
  stage,
  cameraElement,
  logicalBodyDiameter,
}) {
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = cameraElement.getBoundingClientRect();
  const computedScale = cameraElement.ownerDocument.defaultView
    .getComputedStyle(cameraElement).scale;
  const scale = retainedPlanetUniformScale(computedScale) ?? Math.min(
    cameraBounds.width / stageBounds.width,
    cameraBounds.height / stageBounds.height,
  );
  const metrics = {
    centerX: (cameraBounds.left + cameraBounds.right) / 2,
    centerY: (cameraBounds.top + cameraBounds.bottom) / 2,
    radius: logicalBodyDiameter * scale / 2,
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
}) {
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

export function retainedPlanetUniformScale(value) {
  if (typeof value !== "string" || value === "none") return null;
  const components = value.trim().split(/\s+/u).slice(0, 2)
    .map(Number);
  if (components.length === 0 || components.some((component) =>
    !Number.isFinite(component) || component <= 0)) return null;
  return Math.min(...components);
}

function isTrackballMetrics(metrics) {
  return metrics !== null && typeof metrics === "object" &&
    Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) &&
    Number.isFinite(metrics.radius) && metrics.radius > 0;
}

function smoothstep(minimum, maximum, value) {
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
