import { cross3 as cross } from '../../../platform/vector3.mts';
import { createSelectionFlight, createSelectionFlightSample, sampleSelectionFlightInto } from '@cssearth/engine';
import type { OrientationXyzw, PositionM } from '@cssearth/engine';
import type { PreparedCamera } from './prepared-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraViewport } from './world-camera.js';
import { scaleWorldPosition, validateWorldPosition, worldQuaternionFromRotation } from './world-camera-math.js';
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

export function prepareFocusFlight(camera: PreparedCamera, focus: PreparedNavigationFocus, frame: PreparedWorldCameraFrame,
  viewport: WorldCameraViewport & { framingRadiusPixels: number }, milliseconds?: number) {
  const checked = validatePreparedNavigationFocus(focus);
  if (milliseconds !== undefined && (!Number.isFinite(milliseconds) || milliseconds <= 0)) throw new TypeError('Focus flight duration must be positive.');
  const from = camera.capture(frame);
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
  const sample = (progress: number) => {
    sampleSelectionFlightInto(flight, progress * flight.durationS, value);
    camera.adopt({ ...from, pose: { positionM: value.positionM, orientationXyzw: value.orientationXyzw } }, frame);
  };
  return { focus: checked, sample, durationMilliseconds: flight.durationS * 1000 };
}

export function validatePreparedNavigationFocus(focus: PreparedNavigationFocus): PreparedNavigationFocus {
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
function normalize(a: PositionM): PositionM { return scaleWorldPosition(a, 1 / Math.hypot(...a)); }
function add(a: PositionM, b: PositionM): PositionM { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: PositionM, b: PositionM): PositionM { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
