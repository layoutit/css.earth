import { isOrbitDragStart, SKYBOX_DRAG_ENABLED } from "../../site/runtime-policy.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "./sphere-drag.mjs";
import { advanceGoogleEarthDragThrow, createGoogleEarthDragHistory, estimateGoogleEarthDragThrow, GOOGLE_EARTH_DRAG_INERTIA, projectGoogleEarthTrackballDelta, recordGoogleEarthDragSample, resetGoogleEarthDragHistory } from "./google-earth-drag-inertia.mjs";
import { GOOGLE_EARTH_SURFACE_FLY_TO, planGoogleEarthSurfaceFlyTo, sampleGoogleEarthSurfaceFlyTo } from "./google-earth-surface-fly-to.mjs";
import { conjugateRotation, isTrackballMetrics } from "./camera-math.mjs";

const POINTER_POSITION_EPSILON = 1e-6;

export function createUnboundedMatrixDragControls({
  inputSurface,
  trackballMetrics,
  flyToTrackballMetrics = trackballMetrics,
  rotate,
  surfaceFlyToState = null,
  onPointerStart = () => {},
  onStart = () => {},
  onEnd = () => {},
  onError = null,
}) {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof trackballMetrics !== "function" ||
      typeof flyToTrackballMetrics !== "function" ||
      typeof rotate !== "function" ||
      (surfaceFlyToState !== null &&
        typeof surfaceFlyToState !== "function") ||
      typeof onPointerStart !== "function" ||
      typeof onStart !== "function" || typeof onEnd !== "function" ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Unbounded matrix drag controls are invalid.");
  }
  const lifetime = createSceneLifetime();
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) {
      if (onError === null) throw error;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], error.message, { cause: error }) : error);
    }
  };
  let drag = true;
  let wheel = true;
  let pointerId = null;
  let pointerDragging = false;
  let previousX = 0;
  let previousY = 0;
  let accumulatedPitch = 0;
  let accumulatedYaw = 0;
  let activeTrackball = null;
  let skyGesture = false;
  const projectSkyRotation = pointer => {
    const projected = projectGoogleEarthTrackballDelta({
      ...activeTrackball, ...pointer, radius: activeTrackball.radius,
    });
    return rotationFromAngularVelocity([
      -projected.pitchDegrees * Math.PI / 180,
      projected.yawDegrees * Math.PI / 180, 0,
    ], 1);
  };
  let trackballInvalidated = false;
  let previousPointerTimestamp = null;
  let cadenceFrame = null;
  let previousCadenceTimestamp = null;
  let frameMilliseconds = 1000 / 60;
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
  const destinationFlight = { starts: 0, frames: 0, completions: 0, cancels: 0 };

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
  const requestFrame = (callback) => windowTarget.requestAnimationFrame(guardNative(callback));
  const cancelFrame = windowTarget.cancelAnimationFrame.bind(windowTarget);
  let pendingDrag = null;
  const flushPendingDrag = () => {
    if (pendingDrag === null) return;
    const update = pendingDrag;
    pendingDrag = null;
    rotate(update);
  };
  const cancelCadence = () => {
    if (cadenceFrame !== null) cancelFrame(cadenceFrame);
    cadenceFrame = null;
    previousCadenceTimestamp = null;
  };
  const measureCadence = timestamp => {
    if (previousCadenceTimestamp !== null && timestamp > previousCadenceTimestamp) {
      frameMilliseconds = timestamp - previousCadenceTimestamp;
    }
    previousCadenceTimestamp = timestamp;
    flushPendingDrag();
    if (lifetime.disposed) return;
    cadenceFrame = requestFrame(measureCadence);
  };
  const syncCursor = () => {
    if (lifetime.disposed) return;
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
    const motion = flyToMotion;
    flyToFrame = null;
    flyToMotion = null;
    if (motion?.sample) { destinationFlight.cancels++; motion.finish(false); }
    else flyToCancels += 1;
  };
  const cancelPointer = () => {
    pendingDrag = null;
    cancelCadence();
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
    if (flyToMotion.sample) {
      const motion = flyToMotion;
      const progress = Math.min(1, Math.max(0, timestamp - motion.startedAt) / motion.durationMilliseconds);
      motion.sample(progress);
      if (lifetime.disposed || flyToMotion !== motion) return;
      destinationFlight.frames++;
      if (progress < 1) flyToFrame = requestFrame(animateFlyTo);
      else {
        flyToFrame = null;
        flyToMotion = null;
        destinationFlight.completions++;
        motion.finish(true);
        finishInteraction();
      }
      return;
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
    const zoom = sample.zoom;
    rotate({
      controlPitchDelta:
        sample.pitchDeltaDegrees - flyToMotion.previousPitchDelta,
      controlYawDelta:
        sample.yawDeltaDegrees - flyToMotion.previousYawDelta,
      zoom,
      rotation: composeDragRotation(
        sample.rotation,
        conjugateRotation(flyToMotion.previousRotation),
      ),
    });
    if (lifetime.disposed) return;
    flyToMotion.previousPitchDelta = sample.pitchDeltaDegrees;
    flyToMotion.previousYawDelta = sample.yawDeltaDegrees;
    flyToMotion.previousRotation = sample.rotation;
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
  let completedDoublePress = null;
  const beginSurfaceFlyTo = (event) => {
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
    if (plan === null) return false;
    event.preventDefault();
    cancelPointer();
    const wasInteractionActive = interactionActive;
    replaceCameraMotion("fly-to");
    flyToMotion = {
      plan,
      startedAt: null,
      previousPitchDelta: 0,
      previousYawDelta: 0,
      previousRotation: [0, 0, 0, 1],
    };
    flyToStarts += 1;
    if (!wasInteractionActive) {
      interactionActive = true;
      onStart();
    }
    if (lifetime.disposed) return;
    flyToFrame = requestFrame(animateFlyTo);
    return true;
  };
  const onMouseDown = event => {
    if (event.detail !== 2 || event.button !== 0) return;
    // Native Qt starts a flight on the second press. Browser dblclick arrives
    // after its release, so recognize that same press via MouseEvent.detail.
    if (beginSurfaceFlyTo(event)) completedDoublePress = {
      x:event.clientX, y:event.clientY, timestamp:event.timeStamp,
    };
  };
  const onDoubleClick = event => {
    const prior = completedDoublePress;
    completedDoublePress = null;
    if (prior && event.clientX === prior.x && event.clientY === prior.y &&
        event.timeStamp >= prior.timestamp && event.timeStamp - prior.timestamp < 1000) {
      event.preventDefault();
      return;
    }
    beginSurfaceFlyTo(event);
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
        rotation: rotationFromAngularVelocity(
          inertiaState.angularVelocity,
          elapsedMilliseconds * Math.hypot(
            step.pitchDegreesPerMillisecond, step.yawDegreesPerMillisecond,
          ) / inertiaState.initialSpeedDegreesPerMillisecond,
        ),
      });
      if (lifetime.disposed) return;
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
  const startInertia = (throwState, releaseTimestamp, releaseFrameTimestamp) => {
    if (throwState === null) return false;
    // The release frame projects the pointer and advances the first coast
    // step. Compose both rotations before publishing the retained scene.
    const firstStep = advanceGoogleEarthDragThrow({
      ...throwState,
      elapsedMilliseconds: frameMilliseconds,
    });
    rotate({
      rotation: composeDragRotation(
        rotationFromAngularVelocity(throwState.angularVelocity,
          frameMilliseconds * Math.hypot(firstStep.pitchDegreesPerMillisecond,
            firstStep.yawDegreesPerMillisecond) /
              throwState.initialSpeedDegreesPerMillisecond),
        throwState.launchRotation,
      ),
      controlPitchDelta: throwState.pitchDegreesPerMillisecond * frameMilliseconds +
        firstStep.pitchDeltaDegrees,
      controlYawDelta: throwState.yawDegreesPerMillisecond * frameMilliseconds +
        firstStep.yawDeltaDegrees,
    });
    if (lifetime.disposed) return false;
    inertiaState = {
      ...throwState,
      pitchDegreesPerMillisecond: firstStep.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: firstStep.yawDegreesPerMillisecond,
      previousTimestamp: releaseFrameTimestamp ?? releaseTimestamp,
    };
    activeMode = "inertia";
    inertiaStarts += 1;
    inertiaFrame = requestFrame(animateInertia);
    return true;
  };
  const onPointerDown = (event) => {
    if (!drag || pointerId !== null || !isOrbitDragStart(event)) return;
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const startsOnSky = Math.hypot(
      event.clientX - measuredTrackball.centerX,
      event.clientY - measuredTrackball.centerY,
    ) > measuredTrackball.surfaceRadius;
    if (!SKYBOX_DRAG_ENABLED && startsOnSky) return;
    // Mouse compatibility events carry the second-press click count. Blocking
    // them here would postpone double-click flights until the final release.
    if (event.pointerType !== "mouse") event.preventDefault();
    onPointerStart();
    if (lifetime.disposed) return;
    interruptMotion("pointer");
    if (lifetime.disposed) return;

    // Keep the chosen mapping until release, including crossings of the limb.
    skyGesture = startsOnSky;
    pointerId = event.pointerId;
    pointerDragging = false;
    previousX = event.clientX;
    previousY = event.clientY;
    previousPointerTimestamp = event.timeStamp;
    accumulatedPitch = 0;
    accumulatedYaw = 0;
    pendingDrag = null;
    activeTrackball = measuredTrackball;
    trackballInvalidated = false;
    frameMilliseconds = 1000 / 60;
    cadenceFrame = requestFrame(measureCadence);
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
    let rotation = [0, 0, 0, 1];
    for (const sampleEvent of sampleEvents) {
      if (Math.abs(sampleEvent.clientX - previousX) <=
            POINTER_POSITION_EPSILON &&
          Math.abs(sampleEvent.clientY - previousY) <=
            POINTER_POSITION_EPSILON) {
        continue;
      }
      if (!pointerDragging) {
        // Pointer ownership persists when wheel zoom changes the camera.
        const wasInteractionActive = interactionActive;
        replaceCameraMotion("drag");
        pointerDragging = true;
        if (!wasInteractionActive) {
          interactionActive = true;
          onStart();
          if (lifetime.disposed) return;
        }
      }
      if (trackballInvalidated) {
        const measuredTrackball = trackballMetrics();
        if (!isTrackballMetrics(measuredTrackball)) {
          throw new TypeError("Unbounded matrix drag trackball is invalid.");
        }
        activeTrackball = measuredTrackball;
        trackballInvalidated = false;
        // Velocity from before zoom belongs to a different screen projection.
        resetGoogleEarthDragHistory(history);
        accumulatedPitch = 0;
        accumulatedYaw = 0;
      }
      const projected = projectGoogleEarthTrackballDelta({
        previousX,
        previousY,
        currentX: sampleEvent.clientX,
        currentY: sampleEvent.clientY,
        ...activeTrackball,
      });
      const fittedPitch = projected.pitchDegrees *
        (skyGesture ? 1 : activeTrackball.pitchResponse ??
          GOOGLE_EARTH_DRAG_INERTIA.directPitchResponse);
      const sampleRotation = (skyGesture ? projectSkyRotation : projectSphereDrag)({
        previousX,
        previousY,
        currentX: sampleEvent.clientX,
        currentY: sampleEvent.clientY,
        centerX: activeTrackball.centerX,
        centerY: activeTrackball.centerY,
        opticalCenterX: activeTrackball.opticalCenterX,
        opticalCenterY: activeTrackball.opticalCenterY,
        radius: activeTrackball.surfaceRadius,
        focalLength: activeTrackball.focalLength,
      });
      rotation = composeDragRotation(sampleRotation, rotation);
      pitchDelta += fittedPitch;
      yawDelta += projected.yawDegrees;
      accumulatedPitch += fittedPitch;
      accumulatedYaw += projected.yawDegrees;
      previousX = sampleEvent.clientX;
      previousY = sampleEvent.clientY;
      previousPointerTimestamp = sampleEvent.timeStamp;
      recordGoogleEarthDragSample(history, {
        x: sampleEvent.clientX,
        y: sampleEvent.clientY,
        timestamp: sampleEvent.timeStamp,
        pitch: accumulatedPitch,
        yaw: accumulatedYaw,
      });
    }
    if (pitchDelta !== 0 || yawDelta !== 0 ||
        Math.abs(rotation[0]) + Math.abs(rotation[1]) + Math.abs(rotation[2]) > 1e-12) {
      const update = {
        controlPitchDelta: pitchDelta,
        controlYawDelta: yawDelta,
        rotation,
      };
      pendingDrag = pendingDrag === null ? update : {
        controlPitchDelta: pendingDrag.controlPitchDelta + pitchDelta,
        controlYawDelta: pendingDrag.controlYawDelta + yawDelta,
        rotation: composeDragRotation(rotation, pendingDrag.rotation),
      };
      return update;
    }
    return null;
  };
  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event) => {
    if (event.pointerId !== pointerId) return;
    const wasDragging = pointerDragging;
    // Native Qt release consumes the existing movement history. The release
    // location is not another movement and cannot refresh a paused drag.
    const releaseAge = event.timeStamp - previousPointerTimestamp;
    const freshRelease = releaseAge >= 0 &&
      releaseAge <= GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const throwState = wasDragging && event.type === "pointerup" && freshRelease
      ? estimateGoogleEarthDragThrow({ history, releaseTimestamp: event.timeStamp,
        trackball: activeTrackball, frameMilliseconds,
        projectRotation: skyGesture ? projectSkyRotation : undefined }) : null;
    // A rejected release clears the native rotation pending for the next
    // present. A throw keeps that movement as part of its launch.
    if (throwState !== null) flushPendingDrag();
    else pendingDrag = null;
    if (lifetime.disposed) return;
    const releaseFrameTimestamp = previousCadenceTimestamp;
    cancelCadence();
    pointerId = null;
    pointerDragging = false;
    syncCursor();
    if (inputSurface.hasPointerCapture(event.pointerId)) {
      inputSurface.releasePointerCapture(event.pointerId);
    }
    if (throwState !== null) {
      if (startInertia(throwState, event.timeStamp, releaseFrameTimestamp)) return;
    }
    if (wasDragging) finishInteraction();
  };
  const onWheel = (event) => {
    if (!wheel || event.deltaY === 0) return;
    if (pointerId !== null) {
      // Native held-button controls consume the wheel and end the grab.
      // The zoom controller observes defaultPrevented on the same event.
      event.preventDefault();
      interruptMotion("wheel");

      return;
    }
    if (activeMode !== "inertia" && activeMode !== "fly-to") return;
    // Native fly-wheel rest trace: the first wheel receipt stops the flight.
    // Cancel its pending frame before the wheel controller starts publishing.
    interruptMotion("wheel");
  };
  lifetime.onDispose(() => interruptMotion("destroy"));
  try {
    for (const [name, callback, options] of [
      ["pointerdown", onPointerDown],
      ["pointermove", onPointerMove],
      ["pointerup", endPointer],
      ["pointercancel", endPointer],
      ["lostpointercapture", endPointer],
      ["mousedown", onMouseDown],
      ["dblclick", onDoubleClick],
      ["wheel", onWheel, { passive: false }],
    ]) {
      const guarded = guardNative(callback);
      lifetime.onDispose(() => inputSurface.removeEventListener(name, guarded));
      inputSurface.addEventListener(name, guarded, options);
    }
    lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
    lifetime.onDispose(() => inputSurface.style.removeProperty("cursor"));
    const cancelDestination = guardNative(event => {
      if (flyToMotion?.sample && (event.key === "Escape" || inputSurface.ownerDocument?.hidden)) interruptMotion("programmatic");
    });
    for (const [target,type] of [[windowTarget,"keydown"],[inputSurface.ownerDocument,"visibilitychange"]]) {
      if (!target?.addEventListener || !target?.removeEventListener) continue;
      lifetime.onDispose(() => target.removeEventListener(type,cancelDestination));
      target.addEventListener(type,cancelDestination);
    }
    inputSurface.style.userSelect = "none";
    syncCursor();
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Drag controls construction failed.", { cause: error });
    throw error;
  }
  return Object.freeze({
    flyTo({ sample, durationMilliseconds = 4500 }) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      if (typeof sample !== "function" || !Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new TypeError("Invalid destination camera motion.");
      }
      try {
        interruptMotion("programmatic");
        activeMode = "fly-to";
        interactionActive = true;
        destinationFlight.starts++;
        onStart();
        if (lifetime.disposed) return Promise.resolve({ completed: false });
        const completion = new Promise(resolve => {
          flyToMotion = { sample, durationMilliseconds, startedAt: null, finish: completed => resolve({ completed }) };
        });
        flyToFrame = requestFrame(animateFlyTo);
        return completion;
      } catch (error) {
        flyToMotion?.finish?.(false);
        const cleanup = lifetime.destroy();
        if (cleanup.length) throw new AggregateError([error, ...cleanup], error.message, { cause: error });
        throw error;
      }
    },
    update(options) {
      if (lifetime.disposed) return;
      if (options.drag !== undefined) drag = options.drag;
      if (options.wheel !== undefined) wheel = options.wheel;
      if (!drag) interruptMotion("disabled");
      syncCursor();
    },
    stop() {
      if (lifetime.disposed) return;
      interruptMotion("programmatic");
    },
    invalidateTrackball() {
      if (pointerId !== null) trackballInvalidated = true;
    },
    stats() {
      return Object.freeze({
        schema: GOOGLE_EARTH_DRAG_INERTIA.schema,
        projection: skyGesture && (pointerId !== null || inertiaState !== null)
          ? "screen-plane-orbit" : "screen-space-sphere",
        historyStorage: "fixed-capacity-float64-ring",
        activeMode,
        activeMotionCount:
          Number(pointerDragging) + Number(inertiaFrame !== null) +
          Number(flyToFrame !== null),
        pendingPointer: pointerId !== null && !pointerDragging,
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
          active: flyToFrame !== null && !flyToMotion?.sample,
          starts: flyToStarts,
          frames: flyToFrames,
          completions: flyToCompletions,
          cancels: flyToCancels,
        }),
        destinationFlyTo: Object.freeze({ ...destinationFlight, active: Boolean(flyToMotion?.sample) }),
      });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    },
  });
}

// Object adapters supply rendering and camera facts. This is the sole assembly
// point for shared drag, fly-to and wheel behavior, including their lifecycle.
