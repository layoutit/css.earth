import type { DensityVolumeFrame } from '@cssearth/bake/volume';
export type InspectionPose = 'front' | 'x-minus-60' | 'x-minus-30' | 'x-plus-30' | 'x-plus-60' |
  'y-minus-60' | 'y-minus-30' | 'y-plus-30' | 'y-plus-60' | 'edge-x' | 'edge-y' | 'manual';
const POSE_OFFSETS: Record<Exclude<InspectionPose, 'manual'>, readonly [number, number]> = {
  front: [0, 0], 'x-minus-60': [-60, 0], 'x-minus-30': [-30, 0], 'x-plus-30': [30, 0], 'x-plus-60': [60, 0],
  'y-minus-60': [0, -60], 'y-minus-30': [0, -30], 'y-plus-30': [0, 30], 'y-plus-60': [0, 60],
  'edge-x': [90, 0], 'edge-y': [0, 90],
};
export interface InspectionCameraUpdate { rotX?: number; rotY?: number; zoom?: number; distance?: number }
export interface InspectionCameraDelta { controlPitchDelta: number; controlYawDelta: number; zoom?: number; distance?: number; rotation?: readonly number[] }
interface CameraValues { rotX: number; rotY: number; zoom: number; distance: number }
export interface InspectionCameraConfiguration { frame: DensityVolumeFrame | null; projectionScale: number; eastLeft: boolean }
export interface InspectionCameraBindings {
  inputSurface: HTMLElement;
  camera: { readonly state: Readonly<CameraValues>; update(value: InspectionCameraUpdate): void };
  trackballMetrics(): { centerX: number; centerY: number; radius: number; surfaceRadius: number; focalLength: number; viewportWidth: number; tumbleOnly: true };
  sceneMatrix(): string;
  rotate(delta: InspectionCameraDelta): void;
  onStart(): void; onEnd(): void; onError(error: unknown): void;
}
export interface InspectionCameraBackend<Publication> {
  rotationFromQuaternion(value: readonly [number, number, number, number]): readonly number[];
  connect(bindings: InspectionCameraBindings): { stop(): void; destroy(): void };
  publication(frame: DensityVolumeFrame, rotation: DOMMatrix, distance: number, radius: number,
    viewport: { width: number; height: number; focal: number }): Publication;
}
export interface RetainedInspectionCamera {
  pose: InspectionPose; rotation: DOMMatrix; rotX: number; rotY: number; distance: number;
  cameraScale: number; projectionScale: number;
}

/** Retained numeric camera; the host owns scene selection, storage, status and input policy. */
export function createInspectionCamera<Publication>(options: {
  host: HTMLElement; backend: InspectionCameraBackend<Publication>;
  configuration(): InspectionCameraConfiguration;
  render(publication: Publication): void; changed(): void; error(error: unknown): void;
}) {
  const { host, backend } = options;
  let disposed = false, frameRequest = 0, revision = 0;
  let radius = 1, fitDistance = 6, width = 1, height = 1, focal = 1, cameraScale = 1;
  let pose: InspectionPose = 'front', rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
  const values = { rotX: 0, rotY: 0, zoom: 1, distance: fitDistance };
  const schedule = () => { if (!disposed && !frameRequest) frameRequest = requestAnimationFrame(() => { frameRequest = 0; publish(); }); };
  const camera = { get state() { return values; }, update(partial: InspectionCameraUpdate) {
    if (partial.rotX !== undefined) values.rotX = partial.rotX;
    if (partial.rotY !== undefined) values.rotY = partial.rotY;
    if (partial.distance !== undefined) values.distance = Math.max(radius * .02, Math.min(fitDistance * 100, partial.distance));
    else if (partial.zoom !== undefined) values.distance = fitDistance / Math.max(.01, Math.min(100, partial.zoom));
    values.zoom = fitDistance / values.distance; schedule();
  } };
  function rotate(delta: InspectionCameraDelta) {
    if (options.configuration().eastLeft) delta = { ...delta, controlYawDelta: -delta.controlYawDelta,
      ...(delta.rotation ? { rotation: [delta.rotation[0]!, -delta.rotation[1]!, -delta.rotation[2]!, delta.rotation[3]!] } : {}) };
    const changedRotation = Boolean(delta.rotation) || delta.controlPitchDelta !== 0 || delta.controlYawDelta !== 0;
    camera.update({ rotX: values.rotX + delta.controlPitchDelta, rotY: values.rotY + delta.controlYawDelta,
      ...(delta.zoom === undefined ? {} : { zoom: delta.zoom }), ...(delta.distance === undefined ? {} : { distance: delta.distance }) });
    const m = delta.rotation ? backend.rotationFromQuaternion([delta.rotation[0]!, delta.rotation[1]!, delta.rotation[2]!, delta.rotation[3]!]) : null;
    const increment = m
      ? new DOMMatrix([m[0]!, m[3]!, m[6]!, 0, m[1]!, m[4]!, m[7]!, 0, m[2]!, m[5]!, m[8]!, 0, 0, 0, 0, 1])
      : new DOMMatrix().rotateAxisAngle(1, 0, 0, delta.controlPitchDelta).rotateAxisAngle(0, 1, 0, delta.controlYawDelta);
    rotation = increment.multiply(rotation); revision++;
    if (changedRotation) { pose = 'manual'; options.changed(); }
  }
  const controls = backend.connect({ inputSurface: host, camera,
    trackballMetrics() { const rect = host.getBoundingClientRect(), projected = focal * radius / values.distance;
      return { centerX: rect.x + width / 2, centerY: rect.y + height / 2, radius: Math.max(width / 5, Math.min(width, projected)),
        surfaceRadius: projected, focalLength: focal, viewportWidth: width, tumbleOnly: true }; },
    sceneMatrix: () => rotation.toString(), rotate,
    onStart() { host.style.cursor = 'grabbing'; }, onEnd() { host.style.cursor = 'grab'; }, onError: options.error,
  });
  function publish() {
    const frame = options.configuration().frame; if (disposed || !frame) return;
    options.render(backend.publication(frame, rotation, values.distance, radius, { width, height, focal }));
    host.dataset.cameraRevision = String(revision); host.dataset.distance = String(values.distance);
  }
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    focal = Math.max(width, height) * 1.15 * options.configuration().projectionScale * cameraScale; schedule();
  }
  const observer = new ResizeObserver(measure); observer.observe(host); measure();
  function reset() {
    controls.stop(); cameraScale = 1; pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1; values.rotX = values.rotY = 0; revision++; schedule();
  }
  function referenceView(referenceRadius: number | undefined, declaredDistances: readonly (number | undefined)[]) {
    const frame = options.configuration().frame; if (!frame) throw new Error('The prepared object is still loading.');
    const referenceDistance = Math.hypot(...frame.originM) / frame.metersPerUnit;
    if (!(referenceDistance > 0) || referenceRadius === undefined || !(referenceRadius > 0))
      throw new Error('Earth view requires a physical observer and a shared prepared framing radius.');
    if (declaredDistances.some(value => value !== undefined && Math.abs(value - referenceDistance) > 1e-12 * referenceDistance))
      throw new TypeError('Earth observer distance differs from the prepared physical frame.');
    controls.stop();
    const baseFocal = Math.max(width, height) * 1.15 * options.configuration().projectionScale;
    cameraScale = referenceDistance * Math.min(width, height) * .32 / (referenceRadius * baseFocal);
    pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = referenceDistance; values.zoom = fitDistance / values.distance; values.rotX = values.rotY = 0; revision++;
    host.dataset.earthFramingRadius = String(referenceRadius); schedule();
  }
  function fitCloud() {
    const frame = options.configuration().frame; if (!frame) throw new Error('The prepared object is still loading.');
    const bounds = frame.boundsUnits;
    const cloudRadius = Math.max(radius, Math.hypot(...bounds.max.map((value, index) => Math.max(Math.abs(value), Math.abs(bounds.min[index]!)))));
    controls.stop(); cameraScale = 1; pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(cloudRadius * 2, focal * cloudRadius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1; values.rotX = values.rotY = 0; revision++; schedule();
  }
  function applyPose(value: InspectionPose) {
    if (value === 'manual' || !(value in POSE_OFFSETS)) throw new TypeError('Manual camera pose is controlled by pointer input.');
    const [rotX, rotY] = POSE_OFFSETS[value]; controls.stop(); pose = value;
    const base = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
    rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, rotX).rotateAxisAngle(0, 1, 0, rotY).multiply(base);
    values.rotX = rotX; values.rotY = rotY; revision++; schedule();
  }
  function retain(): RetainedInspectionCamera {
    return { pose, rotation: new DOMMatrix(Array.from(rotation.toFloat64Array())), rotX: values.rotX, rotY: values.rotY,
      distance: values.distance, cameraScale, projectionScale: options.configuration().projectionScale };
  }
  function restore(saved: RetainedInspectionCamera) {
    controls.stop(); cameraScale = saved.cameraScale * saved.projectionScale / options.configuration().projectionScale;
    pose = saved.pose; rotation = saved.rotation; measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.rotX = saved.rotX; values.rotY = saved.rotY; values.distance = saved.distance; values.zoom = fitDistance / values.distance; revision++; schedule();
  }
  return { get pose() { return pose; }, get values() { return values; }, schedule, publish, measure, reset, referenceView, fitCloud,
    applyPose, retain, restore, stop: () => controls.stop(), setRadius(value: number) { radius = value; },
    destroy() { if (disposed) return; disposed = true; cancelAnimationFrame(frameRequest); observer.disconnect(); controls.destroy(); } };
}
