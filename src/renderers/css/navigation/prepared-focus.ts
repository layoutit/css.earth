import { createSelectionFlight, createSelectionFlightSample, sampleSelectionFlightInto } from '@cssearth/engine';
import type { OrientationXyzw, PositionM } from '@cssearth/engine';
import type { PerspectiveDolly } from './perspective-dolly.js';
import type { CameraUpdate, DestinationMotion, MotionCompletion, NavigationCamera, TrackballMetrics } from './types.js';
import { presentWorldCamera, worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { rotateWorldPosition, scaleWorldPosition, transposeWorldRotation, validateWorldPosition, worldQuaternionFromRotation } from './world-camera-math.js';
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
      // A prepared focus is a catalogue object every dataset shows as seen from here, so the flight arrives on that line of
      // sight whatever the previous view faced. Keeping the previous direction could land behind it, looking back at the Sun.
      if (frame.referenceFrame !== 'sun-icrf') throw new TypeError(`Prepared focus ${checked.id} needs a Sun-centred frame for its line of sight, not ${frame.referenceFrame}.`);
      const sightline = { ...from, pose: { ...from.pose, orientationXyzw: sightlineOrientation(checked.positionM, checked.upReference, viewport) } };
      // This temporary framing input describes only the destination; the detail always uses frame.
      const target = createWorldSelectionTarget(sightline, { ...frame, originM: checked.positionM,
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
/** A camera at the Sun's side looking at `positionM` (Sun-centred ICRF), with `up` (celestial north unless the focus states one)
 * up on screen: north up and east left, as a sky image shows it. Axes are +x right, +y up, +z toward the eye. */
export function sightlineOrientation(positionM: PositionM, up: PositionM = [0, 0, 1],
  viewport: Pick<WorldCameraViewport, 'principalOffsetPixels' | 'focalPixels'> = { principalOffsetPixels: [0, 0], focalPixels: 1 }): OrientationXyzw {
  const length = Math.hypot(...positionM);
  if (!(length > 0)) throw new RangeError('A focus at the Sun has no line of sight.');
  const eye = scaleWorldPosition(positionM, -1 / length);
  // A sightline along the pole has no north on screen; any perpendicular up keeps the pose defined.
  const upward = Math.hypot(...cross(up, eye)) > 1e-9 ? up : [1, 0, 0] as PositionM;
  const right = normalize(cross(upward, eye)), top = cross(eye, right);
  const axes = [right[0], top[0], eye[0], right[1], top[1], eye[1], right[2], top[2], eye[2]];
  // The focus is drawn at the principal point, beside the panel, not on the view axis. Turn the camera so the ray through
  // that point, not the axis, lies on the sightline: the object is then seen exactly as from here.
  const [x, y] = viewport.principalOffsetPixels;
  const ray = normalize([x, -y, viewport.focalPixels]);
  const axis = cross(ray, [0, 0, 1]), sine = Math.hypot(...axis), cosine = ray[2];
  if (!(sine > 1e-12)) return worldQuaternionFromRotation(axes);
  const [kx, ky, kz] = scaleWorldPosition(axis, 1 / sine), c = 1 - cosine;
  const turn = [cosine + kx * kx * c, kx * ky * c - kz * sine, kx * kz * c + ky * sine,
    ky * kx * c + kz * sine, cosine + ky * ky * c, ky * kz * c - kx * sine,
    kz * kx * c - ky * sine, kz * ky * c + kx * sine, cosine + kz * kz * c];
  return worldQuaternionFromRotation([0, 1, 2].flatMap(row => [0, 1, 2].map(column =>
    axes[row * 3]! * turn[column]! + axes[row * 3 + 1]! * turn[3 + column]! + axes[row * 3 + 2]! * turn[6 + column]!)));
}
function cross(a: PositionM, b: PositionM): PositionM { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a: PositionM): PositionM { return scaleWorldPosition(a, 1 / Math.hypot(...a)); }
function add(a: PositionM, b: PositionM): PositionM { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: PositionM, b: PositionM): PositionM { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
