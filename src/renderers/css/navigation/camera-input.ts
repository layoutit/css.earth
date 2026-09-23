import type { createCameraFlight } from './camera-flight.js';
import { validateDragControlsOptions } from './camera-input-options.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { MatrixDragControlsOptions } from './camera-input-options.js';
export type { MatrixDragControlsOptions } from './camera-input-options.js';
import { dragControlDiagnostics } from './camera-input-diagnostics.js';
import type { ActiveMode, InterruptionMode } from './camera-input-diagnostics.js';
import { bindCameraInputListeners } from './camera-input-listeners.js';
import { errorMessage } from './types.js';
import type { TrackballMetrics, CameraDelta, ControlsUpdate, DestinationMotion, MotionCompletion, Quaternion } from './types.js';
import type { SphereDragInput } from "@cssearth/engine";
import type { DragThrow } from "@cssearth/engine";
export type MatrixDragControls = ReturnType<typeof createUnboundedMatrixDragControls>;
import { createSceneLifetime } from "@cssearth/engine";
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "@cssearth/engine";
import { advanceDragThrow, createDragHistory, estimateDragThrow, TRACKBALL_DRAG_INERTIA, projectTrackballDelta, recordDragSample, resetDragHistory } from "@cssearth/engine";
import { SURFACE_FLY_TO, planSurfaceFlyTo, sampleSurfaceFlyTo } from "./surface-fly-to.js";
import { conjugateRotation, isTrackballMetrics } from "@cssearth/engine";
import { clearCursor, setBaseCursor } from './cursor-state.js';
const POINTER_POSITION_EPSILON = 1e-6;
export function createUnboundedMatrixDragControls({
  inputSurface, cameraMotion, runtimePolicy, trackballMetrics,
  flyToTrackballMetrics = trackballMetrics,
  rotate,
  surfaceFlyToState = null,
  surfaceFlyToHitTest = null,
  onPointerStart = () => {}, onStart = () => {}, onEnd = () => {},
  onError = null,
}: MatrixDragControlsOptions) {
  validateDragControlsOptions({ inputSurface, cameraMotion, runtimePolicy, trackballMetrics, flyToTrackballMetrics,
    rotate, surfaceFlyToState, surfaceFlyToHitTest, onPointerStart, onStart, onEnd, onError });
  const lifetime = createSceneLifetime();
  const guardNative = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => (...args: Args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) {
      if (onError === null) throw error;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], errorMessage(error), { cause: error }) : error);
    }
  };
  let drag = true, wheel = true;
  let pointerId: number | null = null;
  let pointerDragging = false;
  let rotating = false;
  const setRotating = (active: boolean) => {
    if (rotating === active) return;
    rotating = active;
    inputSurface.dispatchEvent(new CustomEvent('objectrotationchange', { bubbles: true, detail: { active } }));
  };
  let previousX = 0, previousY = 0;
  let accumulatedPitch = 0, accumulatedYaw = 0;
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
  let inertiaStarts = 0, inertiaFrames = 0, inertiaCancels = 0;
  let pointerCancels = 0;
  let flyToMotion: (ReturnType<typeof createCameraFlight> & { destination: boolean; arrive(): void }) | null = null;
  let flyToStarts = 0, flyToFrames = 0, flyToCompletions = 0, flyToCancels = 0;
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
  // The document's one frame clock, shared with picking and the world publish:
  // input resolves before the presentation that reads it, in one browser callback.
  const frameClock = createOpacityClock(windowTarget);
  lifetime.onDispose(() => frameClock.destroy());
  const requestFrame = (callback: FrameRequestCallback) => frameClock.request(guardNative(callback), 'input');
  const cancelFrame = (id: number) => frameClock.cancel(id);
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
  let pointerPosition: { x: number; y: number } | null = null;
  let surfaceGesture = false;
  const overSurface = (x: number, y: number) => {
    if (surfaceFlyToHitTest) return surfaceFlyToHitTest(x, y);
    const metrics = trackballMetrics();
    return Math.hypot(x - metrics.centerX, y - metrics.centerY) <= metrics.surfaceRadius;
  };
  const syncCursor = () => {
    if (lifetime.disposed) return;
    const pressed = pointerId !== null;
    const surface = pressed ? surfaceGesture : pointerPosition !== null && overSurface(pointerPosition.x, pointerPosition.y);
    const cursor = runtimePolicy.sceneCursor({ surface, pressed, enabled: drag });
    // Picking supplies a separate in-memory hover override; camera input owns
    // the base cursor without publishing a custom property into CSS.
    setBaseCursor(inputSurface, cursor ?? '');
  };
  const finishInteraction = () => {
    if (!interactionActive) return;
    interactionActive = false;
    activeMode = "idle";
    setRotating(false);
    onEnd();
  };
  const cancelInertia = () => {
    if (inertiaFrame === null) return;
    cancelFrame(inertiaFrame);
    inertiaFrame = null;
    inertiaState = null;
    inertiaCancels += 1;
  };
  const cancelFlyTo = () => flyToMotion?.cancel();
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
  // Stopping a destination flight strands the camera between its endpoints, often with the
  // target off screen. Input hurries the arrival instead, as it does for world navigation.
  const hurryDestination = () => {
    if (!flyToMotion?.destination) return false;
    flyToMotion.hurry(runtimePolicy.FLIGHT_WHEEL_SPEEDUP);
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
  const startFlight = (destination: boolean, sample: (progress: number) => void, durationMilliseconds: number, signal?: AbortSignal) => {
    const publish = guardNative((progress: number) => {
      sample(progress);
      if (lifetime.disposed || flyToMotion !== owner) return;
      if (destination) destinationFlight.frames++; else flyToFrames++;
    });
    const motion = cameraMotion.start({ signal, windowTarget: {
      requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame, performance: windowTarget.performance,
    }, onFinish(completed) {
      flyToMotion = null;
      if (destination) { if (completed) destinationFlight.completions++; else destinationFlight.cancels++; }
      else if (completed) flyToCompletions++; else flyToCancels++;
      guardNative(finishInteraction)();
    }, advance(elapsedS) {
      const progress = Math.min(1, elapsedS * 1000 / durationMilliseconds);
      publish(progress);
      return progress === 1 ? 'complete' : 'presented';
    } });
    const owner = { ...motion, destination, arrive() { publish(1); motion.complete(); } };
    if (!motion.signal.aborted) flyToMotion = owner;
    return motion.finished;
  };
  let completedDoublePress: { x: number; y: number; timestamp: number } | null = null;
  const beginSurfaceFlyTo = (event: MouseEvent) => {
    if (!drag || surfaceFlyToState === null || event.button !== 0) return;
    if (surfaceFlyToHitTest !== null && !surfaceFlyToHitTest(event.clientX, event.clientY)) return false;
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
    replaceCameraMotion("fly-to");
    const wasInteractionActive = interactionActive;
    flyToStarts += 1;
    if (!wasInteractionActive) {
      interactionActive = true;
      onStart();
    }
    if (lifetime.disposed) return;
    let previousPitchDelta = 0, previousYawDelta = 0;
    let previousRotation: Quaternion = [0, 0, 0, 1];
    void startFlight(false, progress => {
      const sample = sampleSurfaceFlyTo(plan, progress);
      rotate({ controlPitchDelta: sample.pitchDeltaDegrees - previousPitchDelta,
        controlYawDelta: sample.yawDeltaDegrees - previousYawDelta, zoom: sample.zoom,
        rotation: composeDragRotation(sample.rotation, conjugateRotation(previousRotation)) });
      previousPitchDelta = sample.pitchDeltaDegrees;
      previousYawDelta = sample.yawDeltaDegrees;
      previousRotation = sample.rotation;
    }, SURFACE_FLY_TO.durationMilliseconds);
    return true;
  };
  const onMouseDown = (event: MouseEvent) => {
    if (event.detail !== 2 || event.button !== 0) return;
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
    if (!drag || pointerId !== null || !runtimePolicy.isOrbitDragStart(event)) return;
    if (hurryDestination()) { event.preventDefault(); return; }
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const startsOnSky = Math.hypot(
      event.clientX - measuredTrackball.centerX,
      event.clientY - measuredTrackball.centerY,
    ) > measuredTrackball.surfaceRadius;
    const tumbleOnly = measuredTrackball.tumbleOnly === true;
    if (!runtimePolicy.SKYBOX_DRAG_ENABLED && startsOnSky && !tumbleOnly) return;
    if (event.pointerType !== "mouse") event.preventDefault();
    onPointerStart();
    if (lifetime.disposed) return;
    interruptMotion("pointer");
    cameraMotion.cancel();
    if (lifetime.disposed) return;

    skyGesture = startsOnSky || tumbleOnly;
    surfaceGesture = overSurface(event.clientX, event.clientY);
    pointerPosition = { x: event.clientX, y: event.clientY };
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
    syncCursor();
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
        const wasInteractionActive = interactionActive;
        replaceCameraMotion("drag");
        pointerDragging = true;
        if (!wasInteractionActive) {
          interactionActive = true;
          onStart();
          if (lifetime.disposed) return;
        }
        setRotating(true);
      }
      if (trackballInvalidated) {
        const measuredTrackball = trackballMetrics();
        if (!isTrackballMetrics(measuredTrackball)) {
          throw new TypeError("Unbounded matrix drag trackball is invalid.");
        }
        activeTrackball = measuredTrackball;
        trackballInvalidated = false;
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
    if (event.isPrimary && event.pointerType !== 'touch') {
      pointerPosition = { x: event.clientX, y: event.clientY };
      syncCursor();
    }
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    const wasDragging = pointerDragging;
    const releaseAge = event.timeStamp - previousPointerTimestamp!;
    const freshRelease = releaseAge >= 0 &&
      releaseAge <= TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const throwState = wasDragging && event.type === "pointerup" && freshRelease
      ? estimateDragThrow({ history, releaseTimestamp: event.timeStamp,
        trackball: activeTrackball!, frameMilliseconds,
        projectRotation: skyGesture ? projectSkyRotation : undefined }) : null;
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
      event.preventDefault();
      interruptMotion("wheel");

      return;
    }
    if (hurryDestination()) { event.preventDefault(); return; }
    interruptMotion("wheel");
    cameraMotion.cancel();
  };
  lifetime.onDispose(() => { interruptMotion("destroy"); clearCursor(inputSurface); });
  try {
    bindCameraInputListeners({ inputSurface, windowTarget, lifetime, guardNative,
      onPointerDown, onPointerMove, endPointer, onMouseDown, onDoubleClick, onWheel,
      cancelDestination: guardNative((event: Event) => {
        if (!flyToMotion?.destination) return;
        if ("key" in event && event.key === "Escape") hurryDestination();
        // A hidden page paints nothing; finish at the destination instead of where it hid.
        else if (inputSurface.ownerDocument.hidden) flyToMotion.arrive();
      }),
    });
    inputSurface.style.userSelect = "none";
    syncCursor();
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Drag controls construction failed.", { cause: error });
    throw error;
  }
  return Object.freeze({
    flyTo({ sample, durationMilliseconds = 4500, signal }: DestinationMotion): Promise<MotionCompletion> {
      if (lifetime.disposed || signal?.aborted) return Promise.resolve({ completed: false });
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
        return startFlight(true, sample, durationMilliseconds, signal);
      } catch (error) {
        cancelFlyTo();
        const cleanup = lifetime.destroy();
        if (cleanup.length) throw new AggregateError([error, ...cleanup], errorMessage(error), { cause: error });
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
      syncCursor();
    },
    stats() {
      return dragControlDiagnostics({ skyGesture, pointerActive: pointerId !== null,
        inertiaActive: inertiaFrame !== null, flyToActive: flyToMotion !== null,
        destinationActive: Boolean(flyToMotion?.destination), surfaceFlyToEnabled: surfaceFlyToState !== null,
        activeMode, pointerDragging, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels,
        interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels, destinationFlight });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    },
  });
}
