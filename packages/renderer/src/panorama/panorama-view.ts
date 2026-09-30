/** The look-around view of one surface panorama: its prepared sky cube around a camera that only turns. */
import { advanceDragThrow, createDragHistory, estimateDragThrow, recordDragSample, resetDragHistory } from '@cssearth/engine';
import type { OrientationXyzw } from '@cssearth/engine';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { worldQuaternionFromRotation, type WorldRotation } from '../navigation/world-camera-math.js';
import type { PreparedSurfacePanorama } from './types.js';
import type { SurfacePanoramaPolicy } from '../navigation/runtime-policy.js';

const INITIAL_ELEVATION_DEG = -8, ELEVATION_LIMIT_DEG = 89;
const RAD = Math.PI / 180;

export interface SurfacePanoramaView {
  readonly root: HTMLElement;
  /** Azimuth clockwise from north and elevation of the view's centre, and its horizontal field of view, in degrees. */
  readonly look: () => { readonly azimuthDeg: number; readonly elevationDeg: number; readonly fieldOfViewDeg: number };
  destroy(): void;
}

/** The camera's rotation (columns: its right, up and toward-the-eye axes) in the panorama frame, x north, y west, z up. */
export function panoramaOrientation(azimuthDeg: number, elevationDeg: number): OrientationXyzw {
  const a = azimuthDeg * RAD, p = elevationDeg * RAD;
  const forward = [Math.cos(p) * Math.cos(a), -Math.cos(p) * Math.sin(a), Math.sin(p)] as const;
  const right = [-Math.sin(a), -Math.cos(a), 0] as const;
  const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]] as const;
  const rotation: WorldRotation = [right[0], up[0], -forward[0], right[1], up[1], -forward[1], right[2], up[2], -forward[2]];
  return worldQuaternionFromRotation(rotation);
}

export function mountSurfacePanoramaView({ host, panorama, policy, resolveUrl, onError, onZoomOut }: {
  host: HTMLElement; panorama: PreparedSurfacePanorama;
  /** The application's look-around policy (site/runtime-policy.mts). */
  policy: SurfacePanoramaPolicy;
  /** Called when the reader zooms out past the widest view. */
  onZoomOut?: () => void;
  /** A prepared `/scenes/` address to the URL the page reads it from (the published asset origin, or itself). */
  resolveUrl: (address: string) => string;
  onError: (error: unknown) => void;
}): SurfacePanoramaView {
  const document = host.ownerDocument, windowTarget = document.defaultView;
  if (!windowTarget) throw new TypeError('A panorama view needs a mounted window.');
  const root = document.createElement('div');
  root.className = 'surface-panorama-view';
  root.dataset.panorama = panorama.id;
  const before = document.createElement('span');
  before.className = 'surface-panorama-anchor';
  root.appendChild(before);
  host.appendChild(root);
  const addresses = new Map(panorama.sky.faces.map((face, index) => [face.texturePath, panorama.faces[index]!]));
  const sky = mountPreparedCssSky({ host: root, before, payload: panorama.sky, resources: panorama.resources,
    resolveResource: path => { const address = addresses.get(path); if (!address) throw new TypeError(`Panorama ${panorama.id} has no face ${path}.`); return resolveUrl(address); } });

  let azimuthDeg = 0, elevationDeg: number = INITIAL_ELEVATION_DEG, fieldOfViewDeg: number = policy.fieldOfView.initialDeg, frame = 0, coast = 0, destroyed = false;
  const publish = () => {
    frame = 0;
    if (destroyed) return;
    try {
      const width = root.clientWidth, height = root.clientHeight;
      if (!width || !height) return;
      sky.publish({ referenceFrame: panorama.sky.referenceFrame, epochJdTt: panorama.sky.epochJdTt, pose: { positionM: [0, 0, 0], orientationXyzw: panoramaOrientation(azimuthDeg, elevationDeg) } },
        { focalPixels: width / 2 / Math.tan(fieldOfViewDeg * RAD / 2), principalOffsetPixels: [0, 0], widthPixels: width, heightPixels: height });
    } catch (error) { onError(error); }
  };
  const schedule = () => { if (!frame) frame = windowTarget.requestAnimationFrame(publish); };
  const look = (pitchDeg: number, yawDeg: number) => {
    azimuthDeg = (((azimuthDeg + yawDeg) % 360) + 360) % 360;
    elevationDeg = Math.max(-ELEVATION_LIMIT_DEG, Math.min(ELEVATION_LIMIT_DEG, elevationDeg + pitchDeg));
  };
  let overshoot = 1, overshootAt = 0;
  const zoom = (factor: number) => {
    const now = windowTarget.performance.now();
    if (factor > 1 && fieldOfViewDeg >= policy.fieldOfView.maximumDeg) {
      overshoot = now - overshootAt > policy.zoomOutExit.gapMs ? factor : overshoot * factor;
      overshootAt = now;
      if (overshoot >= policy.zoomOutExit.overshoot && onZoomOut) { overshoot = 1; onZoomOut(); }
      return;
    }
    overshoot = 1;
    fieldOfViewDeg = Math.max(policy.fieldOfView.minimumDeg, Math.min(policy.fieldOfView.maximumDeg, fieldOfViewDeg * factor));
    schedule();
  };

  // The meshes' throw: the same drag history, release estimate, speed caps and damping (TRACKBALL_DRAG_INERTIA). The sampled
  // pitch and yaw are the look angles themselves, so the throw's rates turn the view directly.
  const history = createDragHistory(), still: OrientationXyzw = [0, 0, 0, 1];
  const trackball = { centerX: 0, centerY: 0, radius: 1, surfaceRadius: 1, focalLength: 1, viewportWidth: 1 };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const stopCoast = () => { if (coast) windowTarget.cancelAnimationFrame(coast); coast = 0; };
  const glide = (state: { pitchDegreesPerMillisecond: number; yawDegreesPerMillisecond: number; initialSpeedDegreesPerMillisecond: number; previous: number }) => {
    coast = windowTarget.requestAnimationFrame(timestamp => {
      const step = advanceDragThrow({ ...state, elapsedMilliseconds: Math.max(0, timestamp - state.previous) });
      look(step.pitchDeltaDegrees, step.yawDeltaDegrees); publish();
      Object.assign(state, { pitchDegreesPerMillisecond: step.pitchDegreesPerMillisecond, yawDegreesPerMillisecond: step.yawDegreesPerMillisecond, previous: timestamp });
      if (step.active) glide(state); else coast = 0;
    });
  };
  const spread = () => { const [a, b] = [...pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    stopCoast();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    root.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) { pinch = spread(); return; }
    resetDragHistory(history);
    recordDragSample(history, { x: event.clientX, y: event.clientY, timestamp: event.timeStamp, pitch: elevationDeg, yaw: azimuthDeg });
  };
  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    if (pointers.size === 2) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const now = spread();
      if (pinch > 0 && now > 0) zoom(pinch / now);
      pinch = now;
      return;
    }
    const degreesPerPixel = fieldOfViewDeg / Math.max(1, root.clientWidth);
    const samples = event.getCoalescedEvents?.().length ? event.getCoalescedEvents() : [event];
    let last = previous;
    for (const sample of samples) {
      look((sample.clientY - last.y) * degreesPerPixel, -(sample.clientX - last.x) * degreesPerPixel);
      last = { x: sample.clientX, y: sample.clientY };
      recordDragSample(history, { x: last.x, y: last.y, timestamp: sample.timeStamp, pitch: elevationDeg, yaw: azimuthDeg });
    }
    pointers.set(event.pointerId, last);
    schedule();
  };
  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size) { pinch = 0; resetDragHistory(history); return; }
    if (event.type !== 'pointerup') return;
    const thrown = estimateDragThrow({ history, releaseTimestamp: event.timeStamp, trackball, projectRotation: () => still });
    if (thrown) glide({ ...thrown, previous: windowTarget.performance.now() });
  };
  const wheel = (event: WheelEvent) => { event.preventDefault(); stopCoast(); zoom(Math.exp(event.deltaY * policy.wheelZoomPerDelta)); };
  const keys = (event: KeyboardEvent) => {
    const step = fieldOfViewDeg / 10, turns: Record<string, [number, number]> = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [step, 0], ArrowDown: [-step, 0] };
    const turn = turns[event.key];
    if (turn) { event.preventDefault(); stopCoast(); look(turn[0], turn[1]); schedule(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.9); }
    else if (event.key === '-') { event.preventDefault(); zoom(1 / 0.9); }
  };
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', `${panorama.title}: drag or use the arrow keys to look around, scroll or pinch to zoom`);
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('wheel', wheel, { passive: false });
  root.addEventListener('keydown', keys);
  const resize = new windowTarget.ResizeObserver(schedule);
  resize.observe(root);
  schedule();

  return Object.freeze({ root,
    look: () => ({ azimuthDeg, elevationDeg, fieldOfViewDeg }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopCoast();
      if (frame) windowTarget.cancelAnimationFrame(frame);
      resize.disconnect();
      sky.destroy();
      root.remove();
    } });
}
