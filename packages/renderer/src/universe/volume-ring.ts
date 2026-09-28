import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { projectVolumeSphere } from '../volume/projected-volume-visibility.js';

/** The smallest ring: the size of every other context marker. */
export const VOLUME_RING_MIN_DIAMETER_PX = 16;

export interface VolumeRingProjection { readonly x: number; readonly y: number; readonly radiusPixels: number }

/**
 * The screen circle around a volume drawn as a cloud: the tangent cone of the sphere its image fills, so the ring
 * encloses the whole drawing from any side. Null inside that sphere or behind the camera, where no ring can enclose it.
 */
export function projectVolumeRing(world: WorldCameraPose, viewport: WorldCameraViewport, frame: DensityVolumeFrame, radiusUnits: number): VolumeRingProjection | null {
  if (!(radiusUnits > 0)) throw new TypeError(`A volume ring needs a positive radius, got ${radiusUnits} units.`);
  const { x, y, depth, distance, inside } = projectVolumeSphere(world, viewport, frame, radiusUnits);
  if (inside || !(depth > 0)) return null;
  const radiusPixels = viewport.focalPixels * radiusUnits / (depth > radiusUnits ? depth : Math.sqrt(distance * distance - radiusUnits * radiusUnits));
  return { x, y, radiusPixels: Math.max(VOLUME_RING_MIN_DIAMETER_PX / 2, radiusPixels) };
}

/** A context-marker ring that grows to enclose a volume; hidden until placed. */
export function createVolumeRing(document: Document, id: string): HTMLElement {
  const ring = document.createElement('span');
  ring.className = 'prepared-context-marker';
  ring.dataset.volumeRing = id;
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = `position:absolute;left:0;top:0;width:${VOLUME_RING_MIN_DIAMETER_PX}px;height:${VOLUME_RING_MIN_DIAMETER_PX}px;opacity:0;visibility:hidden;pointer-events:none`;
  return ring;
}

/**
 * Centre the ring on the volume and size it to enclose it. A transform would scale the ring's line with it, so the
 * box itself follows the camera, rounded to whole pixels so a still camera writes nothing (a paint exception in
 * docs/performance/motion-freezes-membership.md).
 */
export function placeVolumeRing(ring: HTMLElement, projection: VolumeRingProjection): void {
  const size = `${Math.round(2 * projection.radiusPixels)}px`;
  if (ring.style.width !== size) { ring.style.width = size; ring.style.height = size; }
  ring.style.transform = `translate(${format(projection.x)}px,${format(projection.y)}px) translate(-50%,-50%)`;
}

function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(3)).toString(); }
