import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssCameraAxesFromOrientation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { admitStableLabels } from '../labels/stable-label-layout.js';
import { offAxisFrame, silhouetteEllipse } from '../solar-system/heliocentric-geometry.js';
import { createLabelBudget, labelImportance, type LabelBudget } from '../labels/universe-label-policy.js';

export interface ProjectedGalaxy {
  readonly navigable?: boolean;
  readonly shown?: boolean;
  readonly placement?: number;
  readonly object: PreparedCatalogObject;
  readonly x: number;
  readonly y: number;
  readonly distanceM: number;
  readonly labelRect: LabelScreenRect;
  readonly alternateLabelRects?: readonly LabelScreenRect[];
}

/** Only the observer projection is runtime work; every astronomical position is prepared. */
export function projectCatalogPosition(positionM: readonly number[], world: WorldCameraPose, viewport: WorldCameraViewport) {
  const rotation = cssCameraAxesFromOrientation(world.pose.orientationXyzw);
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

/** Resolve the prepared cloud bounds once; catalogue stars do not enlarge this box. */
export function catalogVolumeCorners(frame: DensityVolumeFrame): readonly (readonly number[])[] {
  const r = worldRotationFromQuaternion(frame.localToReferenceXyzw);
  return [0, 1, 2, 3, 4, 5, 6, 7].map(index => {
    const [x, y, z] = [0, 1, 2].map(axis =>
      (index & (1 << axis) ? frame.boundsUnits.max[axis]! : frame.boundsUnits.min[axis]!) * frame.metersPerUnit);
    return [frame.originM[0] + r[0] * x! + r[1] * y! + r[2] * z!,
      frame.originM[1] + r[3] * x! + r[4] * y! + r[5] * z!,
      frame.originM[2] + r[6] * x! + r[7] * y! + r[8] * z!];
  });
}

/** Keep the label above the whole projected cloud, including during an orbit. */
export function projectCatalogBounds(cornersM: readonly (readonly number[])[], world: WorldCameraPose, viewport: WorldCameraViewport) {
  const points = cornersM.map(corner => projectCatalogPosition(corner, world, viewport));
  // A cloud crossing the observer plane has no finite screen bounds.
  if (!points.length || points.some(point => point === null)) return null;
  return { left: Math.min(...points.map(point => point!.x)), right: Math.max(...points.map(point => point!.x)),
    top: Math.min(...points.map(point => point!.y)), bottom: Math.max(...points.map(point => point!.y)) };
}

function priority(object: PreparedCatalogObject): number {
  if (object.status === 'candidate') return 0;
  return labelImportance(isPreparedCluster(object) ? 'galaxy-cluster' : isPreparedNebula(object) ? 'nebula' : 'galaxy', !isPreparedCluster(object) && Boolean(object.detailedObjectId));
}

/** Foreground exclusions win; selection, major objects, then stable distance/id ties. */
export function admitGalaxyLabels(candidates: readonly ProjectedGalaxy[], blockers: readonly LabelScreenRect[], selectedId: string | null,
  budget: LabelBudget = createLabelBudget(Infinity, Infinity, [], blockers)) {
  const ranked = [...candidates].sort((a, b) => priority(b.object) - priority(a.object) || a.distanceM - b.distanceM || a.object.id.localeCompare(b.object.id));
  const stable = ranked.map((candidate, index) => ({
    id: candidate.object.id, candidate, navigable: candidate.navigable ?? (isPreparedCluster(candidate.object) || Boolean(candidate.object.detailedObjectId)),
    pinned: Number(candidate.object.id === selectedId), priority: ranked.length - index,
    shown: candidate.shown ?? false, previousPlacement: candidate.placement ?? 0,
    placements: [candidate.labelRect, ...candidate.alternateLabelRects ?? []].map((rect, slot) => ({ slot, rect })),
  }));
  return admitStableLabels(stable, budget, (_, rect) => !blockers.some(blocker => labelRectsOverlap(blocker, rect)))
    .map(({ candidate: { candidate }, placement, rect }) => ({ ...candidate, placement, labelRect: rect }));
}
