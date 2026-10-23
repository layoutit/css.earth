// A prepared volume's camera projection and axis-stack weights, shared by the runtime that draws its slabs and the bake
// that fits pictures to what that runtime draws. Inputs are described by shape: the engine names no prepared-record type.
import { cssViewFromOrientation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose } from '../navigation/world-camera-conversion.js';
import { presentPhysicalPoseInVolume, type AxisAlignedBounds, type ScaledCameraPose, type ScaledFocusFrame } from './scaled-focus-frame.js';

type Vector = readonly [number, number, number];
const AXES = ['x', 'y', 'z'] as const;

/** The projected camera of a prepared volume: its CSS rotation, translation and focal length. */
export interface PreparedVolumeCameraTransform {
  readonly rotation: readonly number[];
  readonly translationCssPixels: readonly [number, number, number];
  readonly focalPixels: number;
}

/** What a projection reads of a publication: the world camera and the viewport's focal length and principal offset. */
export interface VolumeProjectionPublication {
  readonly world: WorldCameraPose;
  readonly viewport: { readonly focalPixels: number; readonly principalOffsetPixels: readonly number[] };
}

/** A volume frame a world camera can be presented in. */
export interface VolumeProjectionFrame extends ScaledFocusFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
}

/** An axis stack as the weights read it: its axis, optional normal and how many slices it draws. */
export interface WeightedVolumeStack {
  readonly axis: string;
  readonly normalUnits?: Vector;
  readonly leaves: { readonly length: number };
}

export function preparedVolumeCameraTransform(publication: VolumeProjectionPublication, frame: VolumeProjectionFrame, unitScale = 50): PreparedVolumeCameraTransform {
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
  const [ox, oy] = viewport.principalOffsetPixels as [number, number];
  const rotation = cssVolumeRotation(local);
  return Object.freeze({ rotation: Object.freeze([...rotation]),
    translationCssPixels: Object.freeze([
      ox - dot(view, 0, [px, py, pz]) * unitScale,
      oy - dot(view, 3, [px, py, pz]) * unitScale,
      viewport.focalPixels - dot(view, 6, [px, py, pz]) * unitScale,
    ] as [number, number, number]), focalPixels: viewport.focalPixels });
}

function cssVolumeRotation(camera: ScaledCameraPose): readonly number[] {
  const view = cameraView(camera);
  // PolyCSS receives prepared vertices in [y,x,z] order. This is the single
  // renderer-owned CSS reflection; the physical quaternion remains proper.
  return [view[1]!, view[0]!, view[2]!, view[4]!, view[3]!, view[5]!, view[7]!, view[6]!, view[8]!];
}

function cameraView(camera: ScaledCameraPose): readonly number[] {
  return cssViewFromOrientation(camera.orientationXyzw);
}

export function axisWeights(camera: ScaledCameraPose, stacks: readonly WeightedVolumeStack[],
  bounds: AxisAlignedBounds): readonly { weight: number; opticalGain: number }[] {
  const matrix = worldRotationFromQuaternion(camera.orientationXyzw);
  const back: Vector = [matrix[2]!, matrix[5]!, matrix[8]!];
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

/** The merged slab's actual mounted opacity, shared with offline picture preparation. */
export function mergedOpticalOpacity(opticalGain: number): number {
  return Math.min(0.999, Math.max(0.001, Math.round(Math.min(3, opticalGain) / 3 * 255) / 255));
}

/** A far side picture turned about the prepared vertical centre line through `leaf`; it never follows camera elevation. */
export function cylindricalSideTransform(leaf: { readonly style: { readonly transform: string }; readonly centerUnits: readonly number[] }, azimuth: number): string {
  const m = leaf.style.transform.slice(9, -1).split(',').map(Number);
  const [x, y] = [leaf.centerUnits[1]! * 50, leaf.centerUnits[0]! * 50];
  const c = Math.cos(azimuth), s = Math.sin(azimuth);
  for (const offset of [0, 4, 8, 12]) {
    const a = m[offset]! - (offset === 12 ? x : 0), b = m[offset + 1]! - (offset === 12 ? y : 0);
    m[offset] = c * a + s * b + (offset === 12 ? x : 0);
    m[offset + 1] = -s * a + c * b + (offset === 12 ? y : 0);
  }
  return `matrix3d(${m.join(',')})`;
}

function dot(matrix: readonly number[], offset: number, point: Vector): number {
  return matrix[offset]! * point[0] + matrix[offset + 1]! * point[1] + matrix[offset + 2]! * point[2];
}
