import type { PreparedCssVolume, VolumeVector } from '@cssearth/objects';
import { presentPhysicalPoseInVolume, cssViewFromOrientation, worldRotationFromQuaternion } from '@cssearth/engine';
import type { VolumeCameraPublication, VolumeLocalCamera, PreparedVolumeCameraTransform } from './types.js';
const AXES = ['x', 'y', 'z'] as const;

export function preparedVolumeCameraTransform(publication: VolumeCameraPublication, frame: PreparedCssVolume['frame'], unitScale = 50): PreparedVolumeCameraTransform {
  if (publication.world.referenceFrame !== frame.referenceFrame || publication.world.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('Prepared volume and world camera use different reference frames.');
  }
  const { viewport } = publication;
  if (!(unitScale > 0) || !Number.isFinite(unitScale) || !(viewport.focalPixels > 0) ||
      viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError('Prepared volume camera transform inputs are invalid.');
  }
  const local = presentPhysicalPoseInVolume(publication.world.pose, frame);
  const view = cameraView(local);
  const [px, py, pz] = local.positionUnits;
  const [ox, oy] = viewport.principalOffsetPixels;
  const rotation = cssVolumeRotation(local);
  return Object.freeze({ rotation: Object.freeze([...rotation]),
    translationCssPixels: Object.freeze([
      ox - dot(view, 0, [px, py, pz]) * unitScale,
      oy - dot(view, 3, [px, py, pz]) * unitScale,
      viewport.focalPixels - dot(view, 6, [px, py, pz]) * unitScale,
    ] as [number, number, number]), focalPixels: viewport.focalPixels });
}

function cssVolumeRotation(camera: VolumeLocalCamera): readonly number[] {
  const view = cameraView(camera);
  // PolyCSS receives prepared vertices in [y,x,z] order. This is the single
  // renderer-owned CSS reflection; the physical quaternion remains proper.
  return [view[1]!, view[0]!, view[2]!, view[4]!, view[3]!, view[5]!, view[7]!, view[6]!, view[8]!];
}

function cameraView(camera: VolumeLocalCamera): readonly number[] {
  return cssViewFromOrientation(camera.orientationXyzw);
}

export function axisWeights(camera: VolumeLocalCamera, stacks: PreparedCssVolume['stacks'],
  bounds: PreparedCssVolume['frame']['boundsUnits']): readonly { weight: number; opticalGain: number }[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: VolumeVector = [matrix[2]!, matrix[5]!, matrix[8]!];
  const length = Math.hypot(...back);
  const cosines = AXES.map((axis, index) => {
    const normal = stacks.find(stack => stack.axis === axis)?.normalUnits;
    return Math.abs(normal ? normal.reduce((sum, value, i) => sum + value * back[i]!, 0) : back[index]!) / length;
  });
  const extents = AXES.map((_, index) => bounds.max[index]! - bounds.min[index]!), thinnest = Math.min(...extents);
  const thin = extents.indexOf(thinnest), aspect = thinnest / Math.max(...extents);
  let weights: number[];
  const drawn = AXES.map(axis => (stacks.find(stack => stack.axis === axis)?.leaves.length ?? 0) > 0);
  if (aspect < .5 && drawn.every(Boolean)) {
    // The thin stack owns oblique views. At shallow angles, dissolve side banks
    // across their azimuth bisector too: an argmax there swaps whole images at 45 degrees.
    const sideMaximum = Math.max(...cosines.filter((_, index) => index !== thin));
    const sideWeights = cosines.map((cosine, index) => {
      const t = index === thin ? 0 : Math.max(0, Math.min(1, (cosine - sideMaximum + .16) / .16));
      return t * t * (3 - 2 * t);
    });
    const sideTotal = sideWeights.reduce((sum, weight) => sum + weight, 0);
    // Perspective spreads local sight angles across a nearby thin volume. Keep
    // the side bank longer there; outside one long frame extent the accepted
    // far-view window is unchanged. Smoothstep gives zero slope at both ends.
    const distance = Math.hypot(...camera.positionUnits.map((value, index) => value - (bounds.min[index]! + bounds.max[index]!) / 2));
    const approach = Math.max(0, Math.min(1, 1 - distance / Math.max(...extents)));
    const proximity = approach * approach * (3 - 2 * approach);
    const edge = Math.max(.02, aspect) + .4 * proximity;
    const t = Math.max(0, Math.min(1, (cosines[thin]! - edge * .5) / (edge * .5)));
    const face = t * t * (3 - 2 * t);
    weights = AXES.map((_, index) => index === thin ? face : (1 - face) * sideWeights[index]! / sideTotal);
  } else {
    const strengths = cosines.map((value, index) => drawn[index] ? value * Math.sqrt(thinnest / extents[index]!) : 0);
    const maximum = Math.max(...strengths);
    weights = strengths.map((value, index) => {
      if (!drawn[index]) return 0;
      const t = Math.max(0, Math.min(1, (value - maximum + .16) / .16));
      return t * t * (3 - 2 * t);
    });
  }
  return weights.map((weight, index) => ({ weight, opticalGain: weight > 0 ? Math.max(1, 1 / cosines[index]!) : 1 }));
}

function dot(matrix: readonly number[], offset: number, point: VolumeVector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
