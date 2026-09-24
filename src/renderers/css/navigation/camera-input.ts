import { validateDragControlsOptions } from './camera-input-options.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { MatrixDragControlsOptions } from './camera-input-options.js';
export type { MatrixDragControlsOptions } from './camera-input-options.js';
import { dragControlDiagnostics } from './camera-input-diagnostics.js';
import type { ActiveMode, InterruptionMode } from './camera-input-diagnostics.js';
import { bindCameraInputListeners } from './camera-input-listeners.js';
import { errorMessage } from './types.js';
import type { TrackballMetrics, CameraDelta, ControlsUpdate, Quaternion } from './types.js';
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
  const surfaceFlightScope = new AbortController();
  lifetime.onDispose(() => surfaceFlightScope.abort());
  const surfaceFlightActive = () => cameraMotion.owns(surfaceFlightScope.signal);
  let flyToStarts = 0, flyToFrames = 0, flyToCompletions = 0, flyToCancels = 0;
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
  const cancelFlyTo = () => cameraMotion.cancel(surfaceFlightScope.signal);
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
    const previousMode = surfaceFlightActive() ? "fly-to" : activeMode;
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
  const beginDrag = () => {
    const nextMode = "drag";
    const previousMode = surfaceFlightActive() ? "fly-to" : activeMode;
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
    interruptMotion("fly-to");
    const wasInteractionActive = interactionActive;
    flyToStarts += 1;
    if (!wasInteractionActive) {
      interactionActive = true;
      onStart();
    }
    if (lifetime.disposed) return;
    let previousPitchDelta = 0, previousYawDelta = 0;
    let previousRotation: Quaternion = [0, 0, 0, 1];
    const flight = cameraMotion.fly({ windowTarget, signal: surfaceFlightScope.signal,
      durationMilliseconds: SURFACE_FLY_TO.durationMilliseconds,
      onFinish(completed) { if (completed) flyToCompletions++; else flyToCancels++; guardNative(finishInteraction)(); },
      sample(progress, signal) {
      const sample = sampleSurfaceFlyTo(plan, progress);
      const publication = rotate({ controlPitchDelta: sample.pitchDeltaDegrees - previousPitchDelta,
        controlYawDelta: sample.yawDeltaDegrees - previousYawDelta, zoom: sample.zoom,
        rotation: composeDragRotation(sample.rotation, conjugateRotation(previousRotation)) }, signal);
      previousPitchDelta = sample.pitchDeltaDegrees;
      previousYawDelta = sample.yawDeltaDegrees;
      previousRotation = sample.rotation;
      flyToFrames++;
      return publication;
    } });
    void flight.finished.catch(guardNative((error: unknown) => { throw error; }));
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
  // Two fingers pinch: the second touch ends the one-finger orbit, and the pair zooms through the shared wheel zoom as a
  // pinch wheel at the fingers' midpoint (runtimePolicy.TOUCH_PINCH_WHEEL_DELTA), the way the surface minimap does.
  const touches = new Map<number, { x: number; y: number }>();
  let pinchDistance: number | null = null;
  const touchSpread = () => {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const abandonOrbit = () => {
    if (pointerId === null) return;
    const wasDragging = pointerDragging;
    pendingDrag = null;
    cancelCadence();
    pointerId = null;
    pointerDragging = false;
    syncCursor();
    if (wasDragging) finishInteraction();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2 && wheel && pinchDistance === null) {
      event.preventDefault();
      abandonOrbit();
      if (lifetime.disposed) return;
      pinchDistance = touchSpread().distance;
      inputSurface.setPointerCapture(event.pointerId);
      return;
    }
    if (!drag || pointerId !== null || !runtimePolicy.isOrbitDragStart(event)) return;
    if (cameraMotion.hurryForInput()) { event.preventDefault(); return; }
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
        beginDrag();
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
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchDistance !== null && touches.size === 2 && touches.has(event.pointerId)) {
      event.preventDefault();
      const spread = touchSpread();
      if (spread.distance > 0 && pinchDistance > 0 && spread.distance !== pinchDistance) {
        const deltaY = -Math.log(spread.distance / pinchDistance) * runtimePolicy.TOUCH_PINCH_WHEEL_DELTA;
        pinchDistance = spread.distance;
        inputSurface.dispatchEvent(new windowTarget.WheelEvent("wheel", {
          bubbles: true, cancelable: true, ctrlKey: true, deltaY, deltaMode: 0, clientX: spread.x, clientY: spread.y }));
      }
      return;
    }
    if (event.isPrimary && event.pointerType !== 'touch') {
      pointerPosition = { x: event.clientX, y: event.clientY };
      syncCursor();
    }
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event: PointerEvent) => {
    if (touches.delete(event.pointerId) && pinchDistance !== null) {
      // The pinch ends with either finger; the other waits to be lifted before it can orbit again.
      if (touches.size < 2) pinchDistance = null;
      if (inputSurface.hasPointerCapture(event.pointerId)) inputSurface.releasePointerCapture(event.pointerId);
      return;
    }
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
    if (cameraMotion.hurryForInput()) { event.preventDefault(); return; }
    interruptMotion("wheel");
    cameraMotion.cancel();
  };
  lifetime.onDispose(() => { interruptMotion("destroy"); clearCursor(inputSurface); });
  try {
    bindCameraInputListeners({ inputSurface, windowTarget, lifetime, guardNative,
      onPointerDown, onPointerMove, endPointer, onMouseDown, onDoubleClick, onWheel,
      onMotionCommand: guardNative((event: Event) => {
        if ("key" in event && event.key === "Escape") cameraMotion.hurryForInput();
        // A hidden page paints nothing; finish at the destination instead of where it hid.
        else if (inputSurface.ownerDocument.hidden) cameraMotion.arrive();
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
        inertiaActive: inertiaFrame !== null, flyToActive: surfaceFlightActive(), surfaceFlyToEnabled: surfaceFlyToState !== null,
        activeMode: surfaceFlightActive() ? "fly-to" : activeMode, pointerDragging, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels,
        interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    },
  });
}
