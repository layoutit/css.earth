import { validateDragControlsOptions } from './camera-input-options.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
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
  type Throw = { -readonly [K in keyof DragThrow]: DragThrow[K] } & { previousTimestamp: number };
  /** One pressed pointer: its trackball, its latest sample and the orbit it has recorded. It ends with the press. */
  interface Press {
    readonly pointerId: number;
    /** Past the first moved sample: the press orbits instead of only holding. */
    dragging: boolean;
    /** A sky press orbits in the screen plane; a globe press follows the sphere under the pointer. */
    readonly sky: boolean;
    /** Started over the body's surface, for the pressed cursor. */
    readonly surface: boolean;
    trackball: TrackballMetrics;
    trackballInvalidated: boolean;
    x: number; y: number; timestamp: number;
    pitch: number; yaw: number;
    /** Samples since the last frame, published as one rotation per frame. */
    pending: (CameraDelta & { rotation: Quaternion }) | null;
    /** The measured frame cadence sizes the first inertia step on release. */
    cadenceFrame: number | null; cadenceTimestamp: number | null; frameMilliseconds: number;
  }
  let press: Press | null = null;
  /** What moves the camera between onStart and onEnd. A drag rotates; its throw keeps rotating as inertia. */
  type Motion = { readonly kind: 'idle' } | { readonly kind: 'drag' } | { readonly kind: 'fly-to' }
    | { readonly kind: 'inertia'; frame: number; readonly sky: boolean; readonly state: Throw };
  const IDLE: Motion = Object.freeze({ kind: 'idle' });
  let motion: Motion = IDLE;
  const announceRotation = (active: boolean) =>
    inputSurface.dispatchEvent(new CustomEvent('objectrotationchange', { bubbles: true, detail: { active } }));
  const projectSkyRotation = (trackball: TrackballMetrics, pointer: SphereDragInput) => {
    const projected = projectTrackballDelta({ ...trackball, ...pointer, radius: trackball.radius });
    return rotationFromAngularVelocity([
      -projected.pitchDegrees * Math.PI / 180,
      projected.yawDegrees * Math.PI / 180, 0,
    ], 1);
  };
  const history = createDragHistory();
  let inertiaStarts = 0, inertiaFrames = 0, inertiaCancels = 0;
  let pointerCancels = 0;
  const surfaceFlightScope = new AbortController();
  lifetime.onDispose(() => surfaceFlightScope.abort());
  const surfaceFlightActive = () => cameraMotion.owns(surfaceFlightScope.signal);
  // Camera motion owns the fly-to: it reports as one only while that ownership lasts.
  const currentMode = (): ActiveMode => surfaceFlightActive() ? 'fly-to' : motion.kind === 'fly-to' ? 'idle' : motion.kind;
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
  const frameClock = opacityClockFor(windowTarget);
  const requestFrame = (callback: FrameRequestCallback) => frameClock.request(guardNative(callback), 'input');
  const cancelFrame = (id: number) => frameClock.cancel(id);
  const flushPendingDrag = () => {
    const update = press?.pending;
    if (!update) return;
    press!.pending = null;
    rotate(update);
  };
  const measureCadence = (timestamp: number) => {
    const current = press;
    if (current === null) return;
    if (current.cadenceTimestamp !== null && timestamp > current.cadenceTimestamp) {
      current.frameMilliseconds = timestamp - current.cadenceTimestamp;
    }
    current.cadenceTimestamp = timestamp;
    flushPendingDrag();
    if (lifetime.disposed || press !== current) return;
    current.cadenceFrame = requestFrame(measureCadence);
  };
  /** The press ends: its cadence stops and its unpublished samples are dropped. */
  const endPress = (current: Press) => {
    if (current.cadenceFrame !== null) cancelFrame(current.cadenceFrame);
    if (press === current) press = null;
  };
  let pointerPosition: { x: number; y: number } | null = null;
  const overSurface = (x: number, y: number) => {
    if (surfaceFlyToHitTest) return surfaceFlyToHitTest(x, y);
    const metrics = trackballMetrics();
    return Math.hypot(x - metrics.centerX, y - metrics.centerY) <= metrics.surfaceRadius;
  };
  const syncCursor = () => {
    if (lifetime.disposed) return;
    const pressed = press !== null;
    const surface = press !== null ? press.surface : pointerPosition !== null && overSurface(pointerPosition.x, pointerPosition.y);
    const cursor = runtimePolicy.sceneCursor({ surface, pressed, enabled: drag });
    // Picking supplies a separate in-memory hover override; camera input owns
    // the base cursor without publishing a custom property into CSS.
    setBaseCursor(inputSurface, cursor ?? '');
  };
  /** A drag or fly-to begins the interaction; a drag's inertia continues it. */
  const startMotion = (next: Motion) => {
    const idle = motion.kind === 'idle';
    motion = next;
    if (idle) onStart();
  };
  const finishInteraction = () => {
    if (motion.kind === 'idle') return;
    const rotated = motion.kind === 'drag' || motion.kind === 'inertia';
    motion = IDLE;
    if (rotated) announceRotation(false);
    onEnd();
  };
  const cancelInertia = () => {
    if (motion.kind !== 'inertia') return;
    cancelFrame(motion.frame);
    inertiaCancels += 1;
  };
  const cancelFlyTo = () => cameraMotion.cancel(surfaceFlightScope.signal);
  const cancelPointer = () => {
    const current = press;
    if (current === null) return;
    endPress(current);
    resetDragHistory(history);
    if (inputSurface.hasPointerCapture(current.pointerId)) {
      inputSurface.releasePointerCapture(current.pointerId);
    }
    pointerCancels += 1;
    syncCursor();
  };
  const interruptMotion = (nextMode: InterruptionMode) => {
    const previousMode = currentMode();
    if (previousMode === "idle" && press === null) return false;
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
    flyToStarts += 1;
    startMotion({ kind: 'fly-to' });
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
    const inertia = motion;
    if (inertia.kind !== 'inertia') return;
    const inertiaState = inertia.state;
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
      if (lifetime.disposed || motion !== inertia) return;
      inertiaFrames += 1;
    }
    if (step.active) inertia.frame = requestFrame(animateInertia);
    else finishInteraction();
  };
  const startInertia = (throwState: DragThrow, released: Press, releaseTimestamp: number, releaseFrameTimestamp: number | null) => {
    const { frameMilliseconds } = released;
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
    const state: Throw = {
      ...throwState,
      pitchDegreesPerMillisecond: firstStep.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: firstStep.yawDegreesPerMillisecond,
      previousTimestamp: releaseFrameTimestamp ?? releaseTimestamp,
    };
    inertiaStarts += 1;
    motion = { kind: 'inertia', sky: released.sky, state, frame: requestFrame(animateInertia) };
    return true;
  };
  // Two fingers pinch: the second touch ends the one-finger orbit, and the pair zooms through the shared wheel zoom as a
  // pinch wheel at the fingers' midpoint (runtimePolicy.WHEEL_ZOOM_PINCH), the way the surface minimap does.
  const touches = new Map<number, { x: number; y: number }>();
  let pinchDistance: number | null = null;
  const touchSpread = () => {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const abandonOrbit = () => {
    const current = press;
    if (current === null) return;
    endPress(current);
    syncCursor();
    if (current.dragging) finishInteraction();
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
    if (!drag || press !== null || !runtimePolicy.isOrbitDragStart(event)) return;
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

    const surface = overSurface(event.clientX, event.clientY);
    pointerPosition = { x: event.clientX, y: event.clientY };
    const current: Press = press = { pointerId: event.pointerId, dragging: false, sky: startsOnSky || tumbleOnly, surface,
      trackball: measuredTrackball, trackballInvalidated: false, x: event.clientX, y: event.clientY, timestamp: event.timeStamp,
      pitch: 0, yaw: 0, pending: null, cadenceFrame: null, cadenceTimestamp: null, frameMilliseconds: 1000 / 60 };
    current.cadenceFrame = requestFrame(measureCadence);
    resetDragHistory(history);
    recordDragSample(history, { x: event.clientX, y: event.clientY, timestamp: event.timeStamp, pitch: 0, yaw: 0 });
    syncCursor();
    inputSurface.setPointerCapture(event.pointerId);
  };
  const applyPointerSamples = (current: Press, event: PointerEvent) => {
    const coalesced = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [];
    const sampleEvents = coalesced.length > 0 ? coalesced : [event];
    let pitchDelta = 0;
    let yawDelta = 0;
    let rotation: Quaternion = [0, 0, 0, 1];
    for (const sampleEvent of sampleEvents) {
      if (Math.abs(sampleEvent.clientX - current.x) <= POINTER_POSITION_EPSILON &&
          Math.abs(sampleEvent.clientY - current.y) <= POINTER_POSITION_EPSILON) {
        continue;
      }
      if (!current.dragging) {
        // The press already interrupted every other motion, so the drag begins the interaction.
        current.dragging = true;
        startMotion({ kind: 'drag' });
        if (lifetime.disposed) return;
        announceRotation(true);
      }
      if (current.trackballInvalidated) {
        const measuredTrackball = trackballMetrics();
        if (!isTrackballMetrics(measuredTrackball)) {
          throw new TypeError("Unbounded matrix drag trackball is invalid.");
        }
        current.trackball = measuredTrackball;
        current.trackballInvalidated = false;
        resetDragHistory(history);
        current.pitch = 0;
        current.yaw = 0;
      }
      const { trackball } = current;
      const pointer = { previousX: current.x, previousY: current.y, currentX: sampleEvent.clientX, currentY: sampleEvent.clientY };
      const projected = projectTrackballDelta({ ...pointer, ...trackball });
      const fittedPitch = projected.pitchDegrees *
        (current.sky ? 1 : trackball.pitchResponse ?? TRACKBALL_DRAG_INERTIA.directPitchResponse);
      const spherePointer = { ...pointer, centerX: trackball.centerX, centerY: trackball.centerY,
        opticalCenterX: trackball.opticalCenterX, opticalCenterY: trackball.opticalCenterY,
        radius: trackball.surfaceRadius, focalLength: trackball.focalLength };
      const sampleRotation = current.sky ? projectSkyRotation(trackball, spherePointer) : projectSphereDrag(spherePointer);
      rotation = composeDragRotation(sampleRotation, rotation);
      pitchDelta += fittedPitch;
      yawDelta += projected.yawDegrees;
      current.pitch += fittedPitch;
      current.yaw += projected.yawDegrees;
      current.x = sampleEvent.clientX;
      current.y = sampleEvent.clientY;
      current.timestamp = sampleEvent.timeStamp;
      recordDragSample(history, { x: current.x, y: current.y, timestamp: current.timestamp, pitch: current.pitch, yaw: current.yaw });
    }
    if (pitchDelta !== 0 || yawDelta !== 0 ||
        Math.abs(rotation[0]) + Math.abs(rotation[1]) + Math.abs(rotation[2]) > 1e-12) {
      const update = {
        controlPitchDelta: pitchDelta,
        controlYawDelta: yawDelta,
        rotation,
      };
      const pending = current.pending;
      current.pending = pending === null ? update : {
        controlPitchDelta: pending.controlPitchDelta + pitchDelta,
        controlYawDelta: pending.controlYawDelta + yawDelta,
        rotation: composeDragRotation(rotation, pending.rotation),
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
        const deltaY = -Math.log(spread.distance / pinchDistance) * runtimePolicy.WHEEL_ZOOM_PINCH.touchWheelDeltaPerFingerLogStep;
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
    if (!drag || press === null || event.pointerId !== press.pointerId) return;
    event.preventDefault();
    applyPointerSamples(press, event);
  };
  const endPointer = (event: PointerEvent) => {
    if (touches.delete(event.pointerId) && pinchDistance !== null) {
      // The pinch ends with either finger; the other waits to be lifted before it can orbit again.
      if (touches.size < 2) pinchDistance = null;
      if (inputSurface.hasPointerCapture(event.pointerId)) inputSurface.releasePointerCapture(event.pointerId);
      return;
    }
    const current = press;
    if (current === null || event.pointerId !== current.pointerId) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    const releaseAge = event.timeStamp - current.timestamp;
    const freshRelease = releaseAge >= 0 &&
      releaseAge <= TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const { trackball } = current;
    const throwState = current.dragging && event.type === "pointerup" && freshRelease
      ? estimateDragThrow({ history, releaseTimestamp: event.timeStamp, trackball, frameMilliseconds: current.frameMilliseconds,
        projectRotation: current.sky ? pointer => projectSkyRotation(trackball, pointer) : undefined }) : null;
    if (throwState !== null) flushPendingDrag();
    else current.pending = null;
    if (lifetime.disposed) return;
    const releaseFrameTimestamp = current.cadenceTimestamp;
    endPress(current);
    syncCursor();
    if (inputSurface.hasPointerCapture(event.pointerId)) {
      inputSurface.releasePointerCapture(event.pointerId);
    }
    if (throwState !== null && startInertia(throwState, current, event.timeStamp, releaseFrameTimestamp)) return;
    if (current.dragging) finishInteraction();
  };
  const onWheel = (event: WheelEvent) => {
    if (!wheel || event.deltaY === 0) return;
    if (press !== null) {
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
      if (press !== null) press.trackballInvalidated = true;
      syncCursor();
    },
    stats() {
      return dragControlDiagnostics({ skyGesture: press?.sky ?? (motion.kind === 'inertia' && motion.sky), pointerActive: press !== null,
        inertiaActive: motion.kind === 'inertia', flyToActive: surfaceFlightActive(), surfaceFlyToEnabled: surfaceFlyToState !== null,
        activeMode: currentMode(), pointerDragging: press?.dragging ?? false, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels,
        interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    },
  });
}
