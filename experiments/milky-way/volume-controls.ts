import { clamp } from '../../packages/engine/src/navigation/camera-math.js';
import { projectGoogleEarthTrackballDelta } from '../../packages/engine/src/navigation/google-earth-drag-inertia.js';

export type VolumeVector = readonly [number, number, number];
export interface VolumeCamera {
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly distance: number;
  readonly target: VolumeVector;
  readonly position: VolumeVector;
  /** Camera axes in native prepared-volume world coordinates (+Z is up). */
  readonly right: VolumeVector;
  readonly up: VolumeVector;
  /** Points from target toward the eye. */
  readonly back: VolumeVector;
}
export interface VolumeCameraInput {
  readonly yawRadians?: number;
  readonly pitchRadians?: number;
  readonly distance?: number;
  readonly target?: VolumeVector;
}
export interface VolumeControlsOptions {
  readonly element: HTMLElement;
  readonly onChange: (camera: VolumeCamera) => void;
  readonly initial?: VolumeCameraInput;
  readonly presets?: Readonly<Record<string, VolumeCameraInput>>;
  readonly worldRadius?: number;
}
export interface VolumeControls {
  camera(): VolumeCamera;
  setCamera(camera: VolumeCameraInput): void;
  preset(name: string): void;
  reset(): void;
  destroy(): void;
}

type MutableCamera = {
  yawRadians: number;
  pitchRadians: number;
  distance: number;
  target: [number, number, number];
};

type Drag = { readonly pointerId: number; readonly mode: 'orbit' | 'pan'; x: number; y: number };

const DEGREE = Math.PI / 180;
const MAX_PITCH = 89 * DEGREE;

/**
 * Browser controls for prepared PolyCSS3D volume polygons. The caller owns
 * camera-to-CSS conversion: publishing a translated target is what preserves
 * slice parallax rather than selecting a different image.
 */
export function mountVolumeControls({
  element,
  onChange,
  initial = {},
  presets = {},
  worldRadius = 10,
}: VolumeControlsOptions): VolumeControls {
  if (!(element instanceof HTMLElement) || typeof onChange !== 'function' ||
      !Number.isFinite(worldRadius) || worldRadius <= 0) {
    throw new TypeError('Milky Way volume controls require an element, callback and positive world radius.');
  }
  const baseline = normalize(initial, worldRadius);
  let state: MutableCamera = copy(baseline);
  let drag: Drag | null = null;
  let disposed = false;
  const initialCursor = element.style.cursor;
  const initialTouchAction = element.style.touchAction;

  const publish = () => {
    if (disposed) return;
    onChange(snapshot(state));
  };
  const endDrag = (pointerId: number) => {
    if (drag?.pointerId !== pointerId) return;
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    drag = null;
    element.style.cursor = 'grab';
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return;
    if (editable(event.target)) return;
    event.preventDefault();
    element.focus({ preventScroll: true });
    drag = { pointerId: event.pointerId, mode: event.button === 2 || event.shiftKey ? 'pan' : 'orbit', x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);
    element.style.cursor = drag.mode === 'pan' ? 'move' : 'grabbing';
  };
  const pointerMove = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    const previous = drag;
    drag = { ...previous, x: event.clientX, y: event.clientY };
    if (previous.mode === 'orbit') orbit(state, element, previous.x, previous.y, event.clientX, event.clientY);
    else pan(state, element, previous.x, previous.y, event.clientX, event.clientY);
    publish();
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = wheelPixels(event, element);
    state.distance = clamp(state.distance * Math.exp(delta * 0.0015), minimumDistance(worldRadius), worldRadius * 16);
    publish();
  };
  const contextMenu = (event: MouseEvent) => event.preventDefault();
  // There is intentionally no double-click flight or picking path on empty volume space.
  const doubleClick = (event: MouseEvent) => event.preventDefault();
  const pointerUp = (event: PointerEvent) => endDrag(event.pointerId);
  const keyDown = (event: KeyboardEvent) => {
    if (element.ownerDocument.activeElement !== element || editable(event.target)) return;
    const { right, up, back } = basis(state.yawRadians, state.pitchRadians);
    const step = worldRadius / 10;
    const direction = event.key.toLowerCase();
    const vector = direction === 'w' ? negate(back) : direction === 's' ? back :
      direction === 'a' ? negate(right) : direction === 'd' ? right :
        direction === 'q' ? negate(up) : direction === 'e' ? up : null;
    if (vector === null) return;
    event.preventDefault();
    state.target = add(state.target, vector, step);
    publish();
  };

  element.style.touchAction = 'none';
  element.style.cursor = 'grab';
  element.addEventListener('pointerdown', pointerDown);
  element.addEventListener('pointermove', pointerMove);
  element.addEventListener('pointerup', pointerUp);
  element.addEventListener('pointercancel', pointerUp);
  element.addEventListener('lostpointercapture', pointerUp);
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('contextmenu', contextMenu);
  element.addEventListener('dblclick', doubleClick);
  element.addEventListener('keydown', keyDown);
  publish();

  return Object.freeze({
    camera: () => snapshot(state),
    setCamera: (next: VolumeCameraInput) => { state = merge(state, next, worldRadius); publish(); },
    preset: (name: string) => {
      const preset = presets[name];
      if (preset === undefined) throw new RangeError(`Unknown Milky Way camera preset: ${name}.`);
      state = normalize(preset, worldRadius, baseline);
      publish();
    },
    reset: () => { state = copy(baseline); publish(); },
    destroy: () => {
      if (disposed) return;
      disposed = true;
      if (drag !== null && element.hasPointerCapture(drag.pointerId)) element.releasePointerCapture(drag.pointerId);
      drag = null;
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerUp);
      element.removeEventListener('lostpointercapture', pointerUp);
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('contextmenu', contextMenu);
      element.removeEventListener('dblclick', doubleClick);
      element.removeEventListener('keydown', keyDown);
      element.style.cursor = initialCursor;
      element.style.touchAction = initialTouchAction;
    },
  });
}

function orbit(state: MutableCamera, element: HTMLElement, previousX: number, previousY: number, x: number, y: number): void {
  const bounds = element.getBoundingClientRect();
  const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
  const delta = projectGoogleEarthTrackballDelta({
    previousX, previousY, currentX: x, currentY: y,
    centerX: (bounds.left + bounds.right) / 2, centerY: (bounds.top + bounds.bottom) / 2,
    radius, angularDegreesPerTrackballRadius: 90,
  });
  state.yawRadians = wrap(state.yawRadians - delta.yawDegrees * DEGREE);
  state.pitchRadians = clamp(state.pitchRadians + delta.pitchDegrees * DEGREE, -MAX_PITCH, MAX_PITCH);
}

function pan(state: MutableCamera, element: HTMLElement, previousX: number, previousY: number, x: number, y: number): void {
  const bounds = element.getBoundingClientRect();
  const pixels = Math.max(1, Math.min(bounds.width, bounds.height));
  const scale = state.distance * 1.25 / pixels;
  const { right, up } = basis(state.yawRadians, state.pitchRadians);
  const dx = (x - previousX) * scale;
  const dy = (y - previousY) * scale;
  state.target = [
    state.target[0] - right[0] * dx + up[0] * dy,
    state.target[1] - right[1] * dx + up[1] * dy,
    state.target[2] - right[2] * dx + up[2] * dy,
  ];
}

function normalize(input: VolumeCameraInput, radius: number, fallback: MutableCamera = { yawRadians: 0, pitchRadians: 0, distance: radius * 3, target: [0, 0, 0] }): MutableCamera {
  return merge(fallback, input, radius);
}

function merge(base: MutableCamera, input: VolumeCameraInput, radius: number): MutableCamera {
  const yaw = input.yawRadians ?? base.yawRadians;
  const pitch = input.pitchRadians ?? base.pitchRadians;
  const distance = input.distance ?? base.distance;
  const target = input.target ?? base.target;
  if (![yaw, pitch, distance, ...target].every(Number.isFinite) || target.length !== 3) {
    throw new TypeError('Milky Way camera values must be finite three-dimensional coordinates.');
  }
  return { yawRadians: wrap(yaw), pitchRadians: clamp(pitch, -MAX_PITCH, MAX_PITCH), distance: clamp(distance, minimumDistance(radius), radius * 16), target: [target[0], target[1], target[2]] };
}

function snapshot(state: MutableCamera): VolumeCamera {
  const { right, up, back } = basis(state.yawRadians, state.pitchRadians);
  const position: VolumeVector = [
    state.target[0] + back[0] * state.distance,
    state.target[1] + back[1] * state.distance,
    state.target[2] + back[2] * state.distance,
  ];
  return Object.freeze({ yawRadians: state.yawRadians, pitchRadians: state.pitchRadians, distance: state.distance, target: Object.freeze([...state.target]) as VolumeVector, position: Object.freeze(position) as VolumeVector, right, up, back });
}

function copy(state: MutableCamera): MutableCamera {
  return { ...state, target: [...state.target] as [number, number, number] };
}

function cross(a: VolumeVector, b: VolumeVector): VolumeVector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function basis(yaw: number, pitch: number): { readonly right: VolumeVector; readonly up: VolumeVector; readonly back: VolumeVector } {
  // yaw=0 is an eye on +X; positive yaw turns toward +Y. +Z is native world
  // up, matching the prepared xyz slice source before the CSS axis mapping.
  const back: VolumeVector = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)];
  const right = unit([-Math.sin(yaw), Math.cos(yaw), 0]);
  return Object.freeze({ right, up: unit(cross(back, right)), back });
}

function unit(vector: VolumeVector): VolumeVector {
  const length = Math.hypot(...vector);
  return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 1, 0];
}

function negate(vector: VolumeVector): VolumeVector {
  return [-vector[0], -vector[1], -vector[2]];
}

function add(position: VolumeVector, direction: VolumeVector, distance: number): [number, number, number] {
  return [position[0] + direction[0] * distance, position[1] + direction[1] * distance, position[2] + direction[2] * distance];
}

function minimumDistance(radius: number): number {
  return radius * 0.02;
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable ||
    target.matches('input, textarea, select, button, [contenteditable="true"]'));
}

function wrap(angle: number): number {
  return ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function wheelPixels(event: WheelEvent, element: HTMLElement): number {
  return event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight : 1);
}
