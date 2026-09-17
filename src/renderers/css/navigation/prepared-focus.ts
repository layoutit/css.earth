import { createSelectionFlight, createSelectionFlightSample, sampleSelectionFlightInto } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { PerspectiveDolly } from './perspective-dolly.js';
import type { CameraUpdate, DestinationMotion, MotionCompletion, NavigationCamera, TrackballMetrics } from './types.js';
import { presentWorldCamera, worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { rotateWorldPosition, scaleWorldPosition, transposeWorldRotation, validateWorldPosition } from './world-camera-math.js';
import type { WorldRotation } from './world-camera-math.js';
import { createWorldSelectionTarget } from './selection-target.js';

/** A prepared navigation bound, independent of the mounted detail's physical radius. */
export interface PreparedNavigationFocus {
  readonly id: string;
  readonly positionM: PositionM;
  readonly framingRadiusM: number;
  readonly limits: { readonly minimumDistanceM: number; readonly maximumDistanceM: number };
  readonly upReference?: PositionM;
  readonly arrivalDistanceM?: number;
}
export interface PreparedFocusFlightOptions {
  readonly signal?: AbortSignal;
  readonly reducedMotion?: boolean;
  readonly durationMilliseconds?: number;
}

interface Options {
  camera: NavigationCamera;
  physical: PerspectiveDolly;
  rotation(): WorldRotation;
  setRotation(rotation: WorldRotation): void;
  publish(): void;
  stop(): void;
  flyTo(motion: DestinationMotion): Promise<MotionCompletion>;
  framingZoom: number;
  logicalBodyDiameter: number;
  maximumZoom: number;
}

/** Input pivots can change without changing the detail frame or allocating another camera. */
export function createPreparedFocusNavigation(options: Options) {
  const { camera, physical } = options;
  let active: { focus: PreparedNavigationFocus; frame: PreparedWorldCameraFrame;
    offsetUnits: PositionM; rotatedOffset: PositionM; centerUnits: PositionM } | null = null;
  function capture(frame: PreparedWorldCameraFrame): WorldCameraPose {
    const rotation = options.rotation(), bodyCenterUnits = physical.bodyCenter();
    return bodyCenterUnits === null
      ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: camera.state.distance }, frame, physical.viewport())
      : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame);
  }
  function adopt(world: WorldCameraPose, frame: PreparedWorldCameraFrame) {
    const presentation = presentWorldCamera(world, frame, physical.viewport());
    physical.setBodyCenter(presentation.bodyCenterUnits);
    options.setRotation(presentation.rotation);
    if (active) {
      active.rotatedOffset = rotateWorldPosition(presentation.rotation, active.offsetUnits);
      active.centerUnits = add(presentation.bodyCenterUnits, active.rotatedOffset);
    }
  }
  function syncRotation() {
    if (!active) return;
    const nextOffset = rotateWorldPosition(options.rotation(), active.offsetUnits);
    // Apply only the changed pivot offset. Subtracting two galaxy-scale positions
    // on an unchanged publication would erase a nearby detail's metre-scale eye.
    if (nextOffset.some((value, axis) => value !== active!.rotatedOffset[axis])) {
      physical.setBodyCenter(add(physical.bodyCenter()!, subtract(active.rotatedOffset, nextOffset)));
      active.rotatedOffset = nextOffset;
    }
  }
  function set(focus: PreparedNavigationFocus | null, frame: PreparedWorldCameraFrame) {
    if (focus === null) { active = null; return; }
    const validated = validatePreparedNavigationFocus(focus);
    const presentation = presentWorldCamera(capture(frame), frame, physical.viewport());
    const offsetUnits = scaleWorldPosition(rotateWorldPosition(transposeWorldRotation(frame.presentationToReference),
      subtract(validated.positionM, frame.originM)), 1 / frame.metersPerUnit);
    const rotatedOffset = rotateWorldPosition(presentation.rotation, offsetUnits);
    const centerUnits = add(presentation.bodyCenterUnits, rotatedOffset);
    if (!(Math.hypot(...centerUnits) > 0)) throw new RangeError('The observer cannot orbit from the prepared focus centre.');
    // Materialise a centred detail dolly before changing its input pivot.
    physical.setBodyCenter(presentation.bodyCenterUnits);
    active = { focus: validated, frame, offsetUnits, rotatedOffset, centerUnits };
  }
  const focusZoom = () => {
    if (!active) return camera.state.zoom;
    const distanceM = Math.hypot(...active.centerUnits) * active.frame.metersPerUnit;
    // A framing bound is not a solid body: this alias remains defined inside it.
    return Math.min(options.maximumZoom, physical.viewport().focalPixels * active.focus.framingRadiusM /
      distanceM * 2 / options.logicalBodyDiameter * options.framingZoom);
  };
  const inputCamera: NavigationCamera = Object.freeze({
    get state() { return active ? { ...camera.state, distance: Math.hypot(...active.centerUnits), zoom: focusZoom() } : camera.state; },
    update(partial: CameraUpdate) {
      if (!active) { camera.update(partial); return; }
      const oldDistance = Math.hypot(...active.centerUnits);
      const requested = partial.distanceKilometers !== undefined ? partial.distanceKilometers * 1000 / active.frame.metersPerUnit
        : partial.distance ?? (partial.zoom === undefined ? oldDistance : oldDistance * focusZoom() / partial.zoom);
      if (!Number.isFinite(requested) || requested <= 0) throw new TypeError('Prepared focus distance must be positive and finite.');
      const { minimumDistanceM, maximumDistanceM } = active.focus.limits;
      // Restored observers outside the authored interval remain stationary until dolly input.
      if (requested !== oldDistance) {
        const next = Math.max(Math.min(minimumDistanceM / active.frame.metersPerUnit, oldDistance),
          Math.min(Math.max(maximumDistanceM / active.frame.metersPerUnit, oldDistance), requested));
        const nextCenter = scaleWorldPosition(active.centerUnits, next / oldDistance);
        physical.setBodyCenter(add(physical.bodyCenter()!, subtract(nextCenter, active.centerUnits)));
        active.centerUnits = nextCenter;
      }
      camera.update({ ...(partial.rotX === undefined ? {} : { rotX: partial.rotX }),
        ...(partial.rotY === undefined ? {} : { rotY: partial.rotY }) });
    },
  });
  return Object.freeze({
    camera: inputCamera, capture, adopt, syncRotation, set,
    current: () => active?.focus ?? null,
    clear() { active = null; },
    trackball(base: TrackballMetrics): TrackballMetrics {
      if (!active) return base;
      const [x, y, z] = active.centerUnits, depth = -z;
      const visible = depth > 0;
      const radius = Math.max(base.viewportWidth / 5, Math.min(base.viewportWidth,
        visible ? base.focalLength * active.focus.framingRadiusM / active.frame.metersPerUnit / depth : 0));
      return { ...base, centerX: visible ? (base.opticalCenterX ?? base.centerX) + base.focalLength * x / depth : base.viewportCenterX ?? base.centerX,
        centerY: visible ? (base.opticalCenterY ?? base.centerY) + base.focalLength * y / depth : base.viewportCenterY ?? base.centerY,
        radius, surfaceRadius: radius };
    },
    async flyTo(focus: PreparedNavigationFocus, frame: PreparedWorldCameraFrame,
      viewport: WorldCameraViewport & { framingRadiusPixels: number }, flightOptions: PreparedFocusFlightOptions = {}): Promise<MotionCompletion> {
      const checked = validatePreparedNavigationFocus(focus);
      if (flightOptions.signal?.aborted) return { completed: false };
      const milliseconds = flightOptions.durationMilliseconds;
      if (milliseconds !== undefined && (!Number.isFinite(milliseconds) || milliseconds <= 0)) throw new TypeError('Focus flight duration must be positive.');
      const from = capture(frame);
      // This temporary framing input describes only the destination; the detail always uses frame.
      const target = createWorldSelectionTarget(from, { ...frame, originM: checked.positionM,
        bodyRadiusM: checked.framingRadiusM, orbitUpReference: checked.upReference }, viewport);
      const offset = subtract(target.pose.positionM, checked.positionM);
      const distance = Math.hypot(...offset);
      const arrival = Math.max(checked.limits.minimumDistanceM,
        Math.min(checked.limits.maximumDistanceM, checked.arrivalDistanceM ?? distance));
      const to = { ...target.pose, positionM: add(checked.positionM, scaleWorldPosition(offset, arrival / distance)) };
      const flight = createSelectionFlight({ from: from.pose, to, focusPositionM: checked.positionM,
        ...(milliseconds === undefined ? {} : { durationS: milliseconds / 1000 }) });
      const value = createSelectionFlightSample();
      options.stop();
      set(checked, frame);
      options.publish();
      const sample = (progress: number) => {
        sampleSelectionFlightInto(flight, progress * flight.durationS, value);
        adopt({ ...from, pose: { positionM: value.positionM, orientationXyzw: value.orientationXyzw } }, frame);
        options.publish();
      };
      if (flightOptions.reducedMotion) { sample(1); return { completed: true }; }
      const abort = () => options.stop();
      flightOptions.signal?.addEventListener('abort', abort, { once: true });
      try { return await options.flyTo({ sample, durationMilliseconds: flight.durationS * 1000 }); }
      finally { flightOptions.signal?.removeEventListener('abort', abort); }
    },
  });
}

function validatePreparedNavigationFocus(focus: PreparedNavigationFocus): PreparedNavigationFocus {
  if (!focus || typeof focus.id !== 'string' || !/^[a-z0-9][a-z0-9:._+-]{0,127}$/iu.test(focus.id) ||
    !Number.isFinite(focus.framingRadiusM) || focus.framingRadiusM <= 0 ||
    !Number.isFinite(focus.limits?.minimumDistanceM) || focus.limits.minimumDistanceM <= 0 ||
    !Number.isFinite(focus.limits?.maximumDistanceM) || focus.limits.maximumDistanceM <= focus.limits.minimumDistanceM ||
    (focus.arrivalDistanceM !== undefined && (!Number.isFinite(focus.arrivalDistanceM) || focus.arrivalDistanceM <= 0))) {
    throw new TypeError('Prepared navigation focus metadata is invalid.');
  }
  validateWorldPosition(focus.positionM);
  if (focus.upReference !== undefined) {
    validateWorldPosition(focus.upReference);
    if (Math.abs(Math.hypot(...focus.upReference) - 1) > 1e-9) throw new TypeError('Prepared focus up must be a unit reference direction.');
  }
  return Object.freeze({ ...focus, positionM: Object.freeze([...focus.positionM]) as PositionM,
    limits: Object.freeze({ ...focus.limits }),
    ...(focus.upReference === undefined ? {} : { upReference: Object.freeze([...focus.upReference]) as PositionM }) });
}
function add(a: PositionM, b: PositionM): PositionM { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: PositionM, b: PositionM): PositionM { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
