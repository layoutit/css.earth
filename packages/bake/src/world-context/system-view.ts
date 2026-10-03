import type { PreparedSystemViewCandidate, PreparedSystemView, PreparedWorldContextData as PreparedWorldContext } from '@cssearth/objects';
import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { OrbitalState, Vector3 } from './spatial-context.ts';

export interface SystemViewPolicy {
  readonly minimumRadiusShare: number;
  readonly elevationsDegrees: readonly number[];
  readonly azimuthStepDegrees: number;
}

/** Bake candidate views, member positions and complete-orbit bounds. Runtime only projects these. */
export function prepareSystemView(parent: Pick<PreparedWorldContext['focus'], 'id' | 'positionM' | 'radiusM'>,
  bodies: PreparedWorldContext['bodies'], states: Readonly<Record<string, OrbitalState>>,
  policy: SystemViewPolicy, orbitCenters: Readonly<Record<string, { readonly centerBodyId: string }>> = {}): PreparedSystemView | undefined {
  validatePolicy(policy);
  // A placed body carries no orbit and belongs to no system view. A body orbiting a named centre placed off the parent (a
  // circumbinary planet around its host and companion's centre of mass) belongs to the parent's system.
  const members = orderMembers(bodies.filter(body => body.orbit !== undefined &&
    (body.orbit.centerBodyId === parent.id || orbitCenters[body.orbit.centerBodyId]?.centerBodyId === parent.id)), states);
  if (!members.length) return undefined;
  // The share drops members known to be small. An unmeasured radius (0, a star known from its orbit alone) is not known small.
  const main = members.filter(member => member.radiusM === 0 || member.radiusM >= members[0]!.radiusM * policy.minimumRadiusShare);
  return bakeView(parent, candidateFrames(parent, main, states, policy), main, member => member.orbit!.verticesM);
}

/** Frame a star with the stars bound to it that have no orbit in the record (a wide binary's companion): the camera fits
 * the stars at their prepared positions. The pair's orbital plane is not in the record, so the candidate angles stand
 * about a plane through the farthest companion that holds the frame's pole as nearly as it can: a camera choice, not a
 * measurement. Members are listed farthest first. */
export function prepareBoundView(parent: ViewParent, companions: PreparedWorldContext['bodies'], policy: SystemViewPolicy): PreparedSystemView | undefined {
  validatePolicy(policy);
  if (!companions.length) return undefined;
  const offset = (body: ViewMember) => body.positionM.map((value, axis) => value - parent.positionM[axis]!) as unknown as Vector3;
  const members = [...companions].sort((a, b) => Math.hypot(...offset(b)) - Math.hypot(...offset(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const radial = offset(members[0]!), along = unit(radial);
  const across = (axis: Vector3) => axis.map((value, index) => value - along[index]! * dot(axis, along)) as unknown as Vector3;
  const pole = across([0, 0, 1]);
  const normal = unit(Math.hypot(...pole) > 1e-6 ? pole : across([1, 0, 0]));
  return bakeView(parent, framesAbout(parent, normal, radial, policy), members, member => [member.positionM]);
}

/** Frame a group by its members' prepared positions, from the plane bodies' candidate angles.
 * Positions, not orbits: an open trajectory would otherwise fit hundreds of AU. */
export function prepareGroupView(parent: ViewParent, planeBodies: PreparedWorldContext['bodies'],
  members: PreparedWorldContext['bodies'], states: Readonly<Record<string, OrbitalState>>,
  policy: SystemViewPolicy): PreparedSystemView | undefined {
  validatePolicy(policy);
  const plane = orderMembers(planeBodies, states), group = orderMembers(members, states);
  if (!plane.length || !group.length) return undefined;
  return bakeView(parent, candidateFrames(parent, plane, states, policy), group, member => [member.positionM]);
}

type ViewParent = Pick<PreparedWorldContext['focus'], 'id' | 'positionM' | 'radiusM'>;
type ViewMember = PreparedWorldContext['bodies'][number];
interface CandidateFrame { readonly cameraToReference: readonly number[]; project(position: Vector3): Vector3; }

function validatePolicy(policy: SystemViewPolicy) {
  if (!(policy.minimumRadiusShare >= 0 && policy.minimumRadiusShare <= 1)
    || !policy.elevationsDegrees.length || policy.elevationsDegrees.some(value => !(value > 0 && value < 90))
    || !(policy.azimuthStepDegrees > 0 && policy.azimuthStepDegrees <= 360 && Number.isInteger(360 / policy.azimuthStepDegrees))) {
    throw new TypeError('System views require oblique elevations and an azimuth step dividing 360 degrees.');
  }
}

function orderMembers(members: readonly ViewMember[], states: Readonly<Record<string, OrbitalState>>): ViewMember[] {
  return [...members].sort((a, b) => b.radiusM - a.radiusM || states[a.id]!.semiMajorAxisM - states[b.id]!.semiMajorAxisM
    || a.positionM[0] - b.positionM[0] || a.positionM[1] - b.positionM[1] || a.positionM[2] - b.positionM[2]);
}

/** Oblique candidate angles about the main members' shared orbital plane. */
function candidateFrames(parent: ViewParent, main: readonly ViewMember[], states: Readonly<Record<string, OrbitalState>>,
  policy: SystemViewPolicy): CandidateFrame[] {
  const reference = states[main[0]!.id]!.normal;
  // Retrograde motion must not cancel a shared orbital plane.
  const normal = unit(main.reduce((sum, member) => {
    const normal = states[member.id]!.normal;
    const sign = dot(normal, reference) < 0 ? -1 : 1;
    return sum.map((value, axis) => value + sign * normal[axis]!) as unknown as Vector3;
  }, [0, 0, 0] as Vector3));
  const radial = main[0]!.positionM.map((value, axis) => value - parent.positionM[axis]!) as unknown as Vector3;
  return framesAbout(parent, normal, radial, policy);
}

/** Oblique candidate angles about the plane of `normal`, starting from the direction of `radial` in it. */
function framesAbout(parent: ViewParent, normal: Vector3, radial: Vector3, policy: SystemViewPolicy): CandidateFrame[] {
  const baseRight = unit(radial.map((value, axis) => value - normal[axis]! * dot(radial, normal)) as unknown as Vector3);
  const inPlane = cross(normal, baseRight);
  const frames: CandidateFrame[] = [];
  for (const degrees of policy.elevationsDegrees) for (let azimuth = 0; azimuth < 360; azimuth += policy.azimuthStepDegrees) {
    const elevation = degrees * Math.PI / 180, angle = azimuth * Math.PI / 180;
    const tangent = inPlane.map((value, axis) => value * Math.cos(angle) + baseRight[axis]! * Math.sin(angle)) as unknown as Vector3;
    const back = unit(normal.map((value, axis) => value * Math.sin(elevation) + tangent[axis]! * Math.cos(elevation)) as unknown as Vector3);
    // Project orbital north upwards, keeping roll consistent across candidates.
    const right = unit(cross(tangent, normal)), down = cross(back, right);
    frames.push({
      cameraToReference: [right[0], down[0], back[0], right[1], down[1], back[1], right[2], down[2], back[2]],
      project(position: Vector3): Vector3 {
        const relative = position.map((value, axis) => value - parent.positionM[axis]!) as unknown as Vector3;
        return [dot(relative, right), dot(relative, down), dot(relative, back)];
      },
    });
  }
  return frames;
}

/** Enclose the parent and every member's prepared extent from each candidate angle. */
function bakeView(parent: ViewParent, frames: readonly CandidateFrame[], members: readonly ViewMember[],
  extent: (member: ViewMember) => readonly Vector3[]): PreparedSystemView {
  const candidates: PreparedSystemViewCandidate[] = frames.map(frame => {
    const minimum = [-parent.radiusM, -parent.radiusM, -parent.radiusM];
    const maximum = [parent.radiusM, parent.radiusM, parent.radiusM];
    for (const member of members) for (const vertex of extent(member)) {
      const position = frame.project(vertex);
      for (let axis = 0; axis < 3; axis++) {
        minimum[axis] = Math.min(minimum[axis]!, position[axis]! - member.radiusM);
        maximum[axis] = Math.max(maximum[axis]!, position[axis]! + member.radiusM);
      }
    }
    return Object.freeze({
      cameraToReference: Object.freeze([...frame.cameraToReference]),
      minimumM: Object.freeze(minimum) as unknown as Vector3,
      maximumM: Object.freeze(maximum) as unknown as Vector3,
      memberPositionsM: Object.freeze(members.map(member => Object.freeze(frame.project(member.positionM)))),
    });
  });
  return Object.freeze({ memberIds: Object.freeze(members.map(member => member.id)),
    memberRadiiM: Object.freeze(members.map(member => member.radiusM)), candidates: Object.freeze(candidates) });
}

function unit(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  if (!(length > 0)) throw new TypeError('System view needs a defined orbital plane.');
  return vector.map(value => value / length) as unknown as Vector3;
}
