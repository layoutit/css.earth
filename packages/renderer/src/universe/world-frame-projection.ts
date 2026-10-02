import { rayHitsSphereBefore } from '@cssearth/engine';
import { createSphereChordTest } from '../solar-system/prepared-ring-projection.js';
import type { Vector3 } from '@cssearth/engine';

interface WorldPoint {
  readonly id: string;
  readonly positionM: Vector3;
  readonly radiusM: number;
}

/** One observer owns point projections and sphere queries for this publication.
 * The prepared registry supplies identities; no result survives into another view. */
export function createWorldFrameProjection(focus: WorldPoint, selected: WorldPoint,
  toEye: (point: Vector3) => Vector3, project: (eye: Vector3) => readonly number[]) {
  const eyes = new Map<string, Vector3>();
  const eye = (point: WorldPoint): Vector3 => {
    let value = eyes.get(point.id);
    if (!value) { value = toEye(point.positionM); eyes.set(point.id, value); }
    return value;
  };
  const spheres = new Map<string, ReturnType<typeof sphere>>();
  function sphere(point: WorldPoint) {
    const center = eye(point);
    // The ray from the eye to a point in front of it (z < 0) never reaches z > 0, so a sphere wholly behind the eye plane
    // hides nothing there. Chords reach the chord test only after near clipping, so none of them can meet it either.
    // Without this, the Sun behind the camera on a sunlit view sent every chord of every drawn orbit through the
    // detailed split.
    if (center[2] - point.radiusM > 0) return { id: point.id, mayOcclude: () => false, cover: () => 0,
      hidden: (target: Vector3) => target[2] > 0 && rayHitsSphereBefore(target, center, point.radiusM) };
    const distance = Math.hypot(...center), angle = Math.asin(Math.min(1, point.radiusM / distance));
    return { id: point.id,
      hidden: (target: Vector3) => rayHitsSphereBefore(target, center, point.radiusM),
      mayOcclude: createSphereChordTest(center, point.radiusM, project),
      // How much of a farther sphere's disc this one's disc covers, from their angular radii and separation:
      // 0 none, 1 part, 2 all. atan2 keeps the separation exact for small angles, where acos loses it.
      cover(target: Vector3, radius: number) {
        const targetDistance = Math.hypot(...target);
        if (!(targetDistance > distance)) return 0;
        const separation = Math.atan2(Math.hypot(target[1] * center[2] - target[2] * center[1],
          target[2] * center[0] - target[0] * center[2], target[0] * center[1] - target[1] * center[0]),
        target[0] * center[0] + target[1] * center[1] + target[2] * center[2]);
        const targetAngle = Math.asin(Math.min(1, radius / targetDistance));
        return separation >= angle + targetAngle ? 0 : separation + targetAngle <= angle ? 2 : 1;
      } };
  }
  const getSphere = (point: WorldPoint) => {
    let value = spheres.get(point.id);
    if (!value) { value = sphere(point); spheres.set(point.id, value); }
    return value;
  };
  const base = [...new Map([focus, selected].map(point => [point.id, point])).values()].map(getSphere);
  const query = (occluders: typeof base) => ({
    hidden(target: Vector3, exceptId?: string) {
      for (const occluder of occluders) if (occluder.id !== exceptId && occluder.hidden(target)) return true;
      return false;
    },
    /** `true` when one occluder hides a sphere's whole disc, else the id of one that hides part of it, else null. */
    cover(target: Vector3, radius: number, exceptId?: string): string | true | null {
      let part: string | null = null;
      for (const occluder of occluders) {
        if (occluder.id === exceptId) continue;
        const cover = occluder.cover(target, radius);
        if (cover === 2) return true;
        if (cover === 1) part ??= occluder.id;
      }
      return part;
    },
    mayOcclude(start: readonly number[], end: readonly number[]) {
      for (const occluder of occluders) if (occluder.mayOcclude(start, end)) return true;
      return false;
    },
  });
  const common = query(base);
  const parents = new Map<string, typeof common>();
  return { eye,
    occlusion(parent: WorldPoint | null) {
      if (!parent || base.some(occluder => occluder.id === parent.id)) return common;
      let value = parents.get(parent.id);
      if (!value) { value = query([...base, getSphere(parent)]); parents.set(parent.id, value); }
      return value;
    },
  };
}
