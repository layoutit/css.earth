import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createSphereChordTest } from '../solar-system/prepared-ring-projection.js';
import type { Vector3 } from '../solar-system/types.js';

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
    if (center[2] - point.radiusM > 0) return { id: point.id, mayOcclude: () => false,
      hidden: (target: Vector3) => target[2] > 0 && rayHitsSphereBefore(target, center, point.radiusM) };
    return { id: point.id,
      hidden: (target: Vector3) => rayHitsSphereBefore(target, center, point.radiusM),
      mayOcclude: createSphereChordTest(center, point.radiusM, project) };
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
