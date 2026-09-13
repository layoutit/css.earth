import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { offAxisFrame, silhouetteEllipse } from '../solar-system/heliocentric-geometry.js';

export interface ProjectedGalaxy {
  readonly object: PreparedCatalogObject;
  readonly x: number;
  readonly y: number;
  readonly distanceM: number;
  readonly labelRect: LabelScreenRect;
}

/** Only the observer projection is runtime work; every astronomical position is prepared. */
export function projectCatalogPosition(positionM: readonly number[], world: WorldCameraPose, viewport: WorldCameraViewport) {
  const rotation = worldRotationFromQuaternion(world.pose.orientationXyzw);
  const dx = positionM[0] - world.pose.positionM[0];
  const dy = positionM[1] - world.pose.positionM[1];
  const dz = positionM[2] - world.pose.positionM[2];
  const x = rotation[0] * dx + rotation[3] * dy + rotation[6] * dz;
  const y = rotation[1] * dx + rotation[4] * dy + rotation[7] * dz;
  const depth = -(rotation[2] * dx + rotation[5] * dy + rotation[8] * dz);
  if (!(depth > 0)) return null;
  return { x: viewport.principalOffsetPixels[0] + viewport.focalPixels * x / depth,
    y: viewport.principalOffsetPixels[1] + viewport.focalPixels * y / depth,
    distanceM: Math.hypot(dx, dy, dz), depthM: depth };
}

/** Project a prepared spherical aperture; this outline is an annotation, not a gas surface. */
export function projectCatalogAperture(radiusM: number, point: NonNullable<ReturnType<typeof projectCatalogPosition>>, viewport: WorldCameraViewport) {
  const axis = offAxisFrame(viewport.focalPixels, [viewport.principalOffsetPixels[0] - point.x, viewport.principalOffsetPixels[1] - point.y]);
  if (!(radiusM > 0 && radiusM < point.distanceM * axis.cosTheta)) return null;
  const ellipse = silhouetteEllipse(radiusM, viewport.focalPixels, point.distanceM, axis);
  return { x: point.x + ellipse.centre[0], y: point.y + ellipse.centre[1],
    a: ellipse.radialSemiAxis, b: ellipse.tangentialSemiAxis,
    angle: Math.atan2(axis.radial[1], axis.radial[0]) * 180 / Math.PI };
}

function priority(object: PreparedCatalogObject): number {
  if (isPreparedCluster(object) || isPreparedNebula(object) || object.detailedObjectId) return 0;
  if (object.status === 'candidate') return 3;
  return object.hostId ? 2 : 1;
}

/** Foreground exclusions win; selection, major objects, then stable distance/id ties. */
export function admitGalaxyLabels(candidates: readonly ProjectedGalaxy[], blockers: readonly LabelScreenRect[], selectedId: string | null, limit = 12) {
  const sorted = [...candidates].sort((a, b) => Number(b.object.id === selectedId) - Number(a.object.id === selectedId) ||
    priority(a.object) - priority(b.object) || a.distanceM - b.distanceM ||
    a.object.id.localeCompare(b.object.id));
  const accepted: ProjectedGalaxy[] = [];
  for (const candidate of sorted) {
    if (accepted.length >= limit) break;
    if (blockers.some(rect => labelRectsOverlap(rect, candidate.labelRect)) ||
        accepted.some(other => labelRectsOverlap(other.labelRect, candidate.labelRect))) continue;
    accepted.push(candidate);
  }
  return accepted;
}
