export type MatrixDragControlsOptions = Omit<RendererDragControlsOptions, "runtimePolicy" | "surfaceFlyToHitTest">;
import type { MatrixDragControlsOptions as RendererDragControlsOptions } from "../renderers/css/navigation/camera-input-options.ts";
import type { ActiveMode, InterruptionMode } from "../renderers/css/navigation/camera-input-diagnostics.ts";
import type { TrackballMetrics, CameraDelta, ControlsUpdate, DestinationMotion, MotionCompletion, Quaternion } from "../renderers/css/navigation/types.ts";
import type { SphereDragInput } from "@cssearth/engine";
import type { DragThrow } from "@cssearth/engine";
import type { FlyToMotion } from "../renderers/css/navigation/camera-input-options.ts";
export type MatrixDragControls = ReturnType<typeof createUnboundedMatrixDragControls>;
import { isOrbitDragStart, SKYBOX_DRAG_ENABLED } from "../../site/runtime-policy.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "@cssearth/engine";
import { advanceDragThrow, createDragHistory, estimateDragThrow, TRACKBALL_DRAG_INERTIA, projectTrackballDelta, recordDragSample, resetDragHistory } from "./trackball-drag-inertia.mts";
import { SURFACE_FLY_TO, planSurfaceFlyTo, sampleSurfaceFlyTo } from "./surface-fly-to.mts";
import { conjugateRotation, isTrackballMetrics } from "@cssearth/engine";

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
}: MatrixDragControlsOptions) {
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
  const guardNative = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => (...args: Args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) {
      if (onError === null) throw error;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], error instanceof Error ? error.message : String(error), { cause: error }) : error);
    }
  };
  let drag = true;
  let wheel = true;
  let pointerId: number | null = null;
  let pointerDragging = false;
  let previousX = 0;
  let previousY = 0;
  let accumulatedPitch = 0;
  let accumulatedYaw = 0;
  let activeTrackball: TrackballMetrics | null = null;
  let skyGesture = false;
  const projectSkyRotation = (pointer: SphereDragInput) => {
    if (activeTrackball === null) throw new Error("Sky drag has no active trackball.");
    const projected = projectTrackballDelta({
      ...activeTrackball, ...pointer, radius: activeTrackball.radius,
    });
    return rotationFromAngularVelocity([
      -projected.pitchDegrees * Math.PI / 180,
      projected.yawDegrees * Math.PI / 180, 0,
    ], 1);
  };
  let trackballInvalidated = false;
  let previousPointerTimestamp: number | null = null;
  let cadenceFrame: number | null = null;
  let previousCadenceTimestamp: number | null = null;
  let frameMilliseconds = 1000 / 60;
  const history = createDragHistory();
  let inertiaFrame: number | null = null;
  let inertiaState: ({ -readonly [K in keyof DragThrow]: DragThrow[K] } & { previousTimestamp: number }) | null = null;
  let interactionActive = false;
  let activeMode: ActiveMode = "idle";
  let inertiaStarts = 0;
  let inertiaFrames = 0;
  let inertiaCancels = 0;
  let pointerCancels = 0;
  let flyToFrame: number | null = null;
  let flyToMotion: FlyToMotion | null = null;
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
  let lastInterruption: { from: ActiveMode; to: InterruptionMode } | null = null;
  const windowTarget = inputSurface.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Input document has no window.");
  const requestFrame = (callback: FrameRequestCallback) => windowTarget.requestAnimationFrame(guardNative(callback));
  const cancelFrame = windowTarget.cancelAnimationFrame.bind(windowTarget);
  let pendingDrag: (CameraDelta & { rotation: Quaternion }) | null = null;
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
  const measureCadence = (timestamp: number) => {
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
    resetDragHistory(history);
    activeTrackball = null;
    if (inputSurface.hasPointerCapture(activePointerId)) {
      inputSurface.releasePointerCapture(activePointerId);
    }
    pointerCancels += 1;
    syncCursor();
  };
  const interruptMotion = (nextMode: InterruptionMode) => {
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
  const replaceCameraMotion = (nextMode: "drag" | "fly-to") => {
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
  const animateFlyTo = (timestamp: number) => {
    if (flyToMotion === null) return;
    if (flyToMotion.startedAt === null) flyToMotion.startedAt = timestamp;
    if (flyToMotion.sample) {
      const motion = flyToMotion;
      const progress = Math.min(1, Math.max(0, timestamp - (motion.startedAt ?? timestamp)) / motion.durationMilliseconds);
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
        SURFACE_FLY_TO.durationMilliseconds,
    );
    const sample = sampleSurfaceFlyTo(
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
  let completedDoublePress: { x: number; y: number; timestamp: number } | null = null;
  const beginSurfaceFlyTo = (event: MouseEvent) => {
    if (!drag || surfaceFlyToState === null || event.button !== 0) return;
    const measuredTrackball = flyToTrackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const cameraState = surfaceFlyToState();
    const plan = planSurfaceFlyTo({
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
  const onMouseDown = (event: MouseEvent) => {
    if (event.detail !== 2 || event.button !== 0) return;
    // Native Qt starts a flight on the second press. Browser dblclick arrives
    // after its release, so recognize that same press via MouseEvent.detail.
    if (beginSurfaceFlyTo(event)) completedDoublePress = {
      x:event.clientX, y:event.clientY, timestamp:event.timeStamp,
    };
  };
  const onDoubleClick = (event: MouseEvent) => {
    const prior = completedDoublePress;
    completedDoublePress = null;
    if (prior && event.clientX === prior.x && event.clientY === prior.y &&
        event.timeStamp >= prior.timestamp && event.timeStamp - prior.timestamp < 1000) {
      event.preventDefault();
      return;
    }
    beginSurfaceFlyTo(event);
  };
  const animateInertia = (timestamp: number) => {
    if (inertiaState === null) return;
    const elapsedMilliseconds = Math.max(
      0,
      timestamp - inertiaState.previousTimestamp,
    );
    const step = advanceDragThrow({
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
  const startInertia = (throwState: DragThrow | null, releaseTimestamp: number, releaseFrameTimestamp: number | null) => {
    if (throwState === null) return false;
    // The release frame projects the pointer and advances the first coast
    // step. Compose both rotations before publishing the retained scene.
    const firstStep = advanceDragThrow({
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
  const onPointerDown = (event: PointerEvent) => {
    if (!drag || pointerId !== null || !isOrbitDragStart(event)) return;
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const startsOnSky = Math.hypot(
      event.clientX - measuredTrackball.centerX,
      event.clientY - measuredTrackball.centerY,
    ) > measuredTrackball.surfaceRadius;
    // A tumble-only trackball (perspective plans that opt in) takes every
    // press as a sky press: the screen-plane orbit mapping, wherever the
    // pointer is, so the scene tumbles about the screen axes instead of
    // twisting about the view axis outside the disc.
    const tumbleOnly = measuredTrackball.tumbleOnly === true;
    if (!SKYBOX_DRAG_ENABLED && startsOnSky && !tumbleOnly) return;
    // Mouse compatibility events carry the second-press click count. Blocking
    // them here would postpone double-click flights until the final release.
    if (event.pointerType !== "mouse") event.preventDefault();
    onPointerStart();
    if (lifetime.disposed) return;
    interruptMotion("pointer");
    if (lifetime.disposed) return;

    // Keep the chosen mapping until release, including crossings of the limb.
    skyGesture = startsOnSky || tumbleOnly;
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
    resetDragHistory(history);
    recordDragSample(history, {
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      pitch: accumulatedPitch,
      yaw: accumulatedYaw,
    });
    inputSurface.style.cursor = "grabbing";
    inputSurface.setPointerCapture(event.pointerId);
  };
  const applyPointerSamples = (event: PointerEvent) => {
    if (activeTrackball === null) throw new Error("Pointer drag has no active trackball.");
    const coalesced = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [];
    const sampleEvents = coalesced.length > 0 ? coalesced : [event];
    let pitchDelta = 0;
    let yawDelta = 0;
    let rotation: Quaternion = [0, 0, 0, 1];
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
        resetDragHistory(history);
        accumulatedPitch = 0;
        accumulatedYaw = 0;
      }
      const projected = projectTrackballDelta({
        previousX,
        previousY,
        currentX: sampleEvent.clientX,
        currentY: sampleEvent.clientY,
        ...activeTrackball,
      });
      const fittedPitch = projected.pitchDegrees *
        (skyGesture ? 1 : activeTrackball.pitchResponse ??
          TRACKBALL_DRAG_INERTIA.directPitchResponse);
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
      recordDragSample(history, {
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
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (activeTrackball === null || previousPointerTimestamp === null) throw new Error("Pointer release has no active drag.");
    const wasDragging = pointerDragging;
    // Native Qt release consumes the existing movement history. The release
    // location is not another movement and cannot refresh a paused drag.
    const releaseAge = event.timeStamp - previousPointerTimestamp;
    const freshRelease = releaseAge >= 0 &&
      releaseAge <= TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const throwState = wasDragging && event.type === "pointerup" && freshRelease
      ? estimateDragThrow({ history, releaseTimestamp: event.timeStamp,
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
  const onWheel = (event: WheelEvent) => {
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
    const listen = <K extends keyof HTMLElementEventMap>(name: K, callback: (event: HTMLElementEventMap[K]) => unknown, options?: AddEventListenerOptions) => {
      const guarded = guardNative(callback);
      lifetime.onDispose(() => inputSurface.removeEventListener(name, guarded));
      inputSurface.addEventListener(name, guarded, options);
    };
    listen("pointerdown", onPointerDown);
    listen("pointermove", onPointerMove);
    listen("pointerup", endPointer);
    listen("pointercancel", endPointer);
    listen("lostpointercapture", endPointer);
    listen("mousedown", onMouseDown);
    listen("dblclick", onDoubleClick);
    listen("wheel", onWheel, { passive: false });
    lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
    lifetime.onDispose(() => inputSurface.style.removeProperty("cursor"));
    const cancelDestination = guardNative((event: Event) => {
      if (flyToMotion?.sample && (("key" in event && event.key === "Escape") || inputSurface.ownerDocument?.hidden)) interruptMotion("programmatic");
    });
    for (const [target,type] of [[windowTarget,"keydown"],[inputSurface.ownerDocument,"visibilitychange"]] as const) {
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
    flyTo({ sample, durationMilliseconds = 4500 }: DestinationMotion) {
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
        const completion = new Promise<MotionCompletion>(resolve => {
          flyToMotion = { sample, durationMilliseconds, startedAt: null, elapsedMilliseconds: 0, previousTimestamp: null, speed: 1, finish: completed => resolve({ completed }) };
        });
        flyToFrame = requestFrame(animateFlyTo);
        return completion;
      } catch (error) {
        flyToMotion?.finish?.(false);
        const cleanup = lifetime.destroy();
        if (cleanup.length) throw new AggregateError([error, ...cleanup], error instanceof Error ? error.message : String(error), { cause: error });
        throw error;
      }
    },
    update(options: ControlsUpdate) {
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
        schema: TRACKBALL_DRAG_INERTIA.schema,
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
          schema: SURFACE_FLY_TO.schema,
          qualification: SURFACE_FLY_TO.qualification,
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
