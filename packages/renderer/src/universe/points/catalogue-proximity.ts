import { presentPhysicalPoseInVolume, eyeDistanceM, type WorldCameraPose } from '@cssearth/engine';
import type { PreparedCatalogueProximity } from '@cssearth/objects';
import { logarithmicFade } from '../world-context/context-scale.js';

/** A position inside the prepared stellar disc; turning or changing the lens cannot admit a bank. */
export function catalogueDiscOpacity(plan: PreparedCatalogueProximity, world: WorldCameraPose): number {
  const p = presentPhysicalPoseInVolume(world.pose, plan.frame).positionUnits, d = plan.disc;
  const radius = Math.hypot(p[0] - d.centerUnits[0], p[1] - d.centerUnits[1]), height = Math.abs(p[2] - d.centerUnits[2]);
  const smooth = (distance: number, extent: number) => { const t = Math.max(0, Math.min(1, (extent - distance) / (extent * d.fadeFraction))); return t*t*(3-2*t); };
  return smooth(radius,d.radiusUnits)*smooth(height,d.halfHeightUnits);
}
export function catalogueLevelOpacity(plan: PreparedCatalogueProximity, index: number, world: WorldCameraPose): number {
  const level = plan.levels[index]!, distance = eyeDistanceM(world.pose,plan.frame.originM)/plan.frame.metersPerUnit;
  const inner = plan.levels.at(-1)!.appearUnits;
  const near = inner ? 1-logarithmicFade(distance,inner[1],inner[0]) : 0;
  return catalogueDiscOpacity(plan,world) * (level.appearUnits ? 1-logarithmicFade(distance,level.appearUnits[1],level.appearUnits[0]) : 1) * (1-(1-level.nearOpacity)*near);
}
