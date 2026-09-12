import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { PointReference, PreparedPointFieldSelection } from '@cssearth/engine';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPointFieldSelection } from './point-field-selection.js';
import { createPointSample, pointLuminanceVisible, samplePreparedPoint } from './point-field-projection.js';
import type { PreparedCssPointField, PointFieldVector } from './types.js';

// Stable prepared identities, independent of the DOM slot that currently owns them.
export const pointId = (point: PointReference) => point.index * 2 + Number(point.kind === 'node');
export interface PointFrameState {
  committedId: number;
  active: Uint32Array;
  outgoing: Uint32Array;
  select: boolean;
}
interface PointValue { shown: boolean; transform: string; alpha: number; }
interface ProjectedPointValue extends PointValue { x: number; y: number; size: number; }
export interface PreparedPointFrame {
  id: number;
  baseId: number;
  selectionEvaluated: boolean;
  selection?: PreparedPointFieldSelection;
  retained: Uint32Array;
  indices: Uint32Array;
  shown: Uint8Array;
  alphas: Float64Array;
  transforms: string[];
  projectedCount: number;
}

/** Decode/project the prepared bank in the world worker. No scene assets are generated.
 * A delta is usable only against the explicitly acknowledged publication. If a
 * plan was discarded, the next response repairs the baseline with full values. */
export function createPointFramePlanner(payload: PreparedCssPointField) {
  const select = createPointFieldSelection(payload);
  const samples = new Map<number, ReturnType<typeof createPointSample>>();
  let previousId = 0, previous = new Map<number, ProjectedPointValue>();
  return (id: number, state: PointFrameState, world: WorldCameraPose, viewport: WorldCameraViewport,
    occluder?: { positionM: PointFieldVector; radiusM: number }): PreparedPointFrame => {
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt ||
        !(viewport.widthPixels! > 0 && viewport.heightPixels! > 0)) {
      throw new TypeError('Prepared point frame requires matching epoch and measured viewport.');
    }
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw));
    const focal = viewport.focalPixels, [ox, oy] = viewport.principalOffsetPixels;
    const halfWidth = viewport.widthPixels! / 2, halfHeight = viewport.heightPixels! / 2;
    let selection: PreparedPointFieldSelection | undefined;
    if (state.select) {
      const next = select({ eyeUnits: local.positionUnits, viewRotation: rotation, focalPx: focal,
        viewportHalfWidthPx: halfWidth + Math.abs(ox), viewportHalfHeightPx: halfHeight + Math.abs(oy) });
      const active = new Set(state.active);
      if (active.size !== next.representatives.length || next.representatives.some(point => !active.has(pointId(point)))) selection = next;
    }
    const identities = new Set([...state.active, ...state.outgoing]);
    for (const point of selection?.representatives ?? []) identities.add(pointId(point));
    const localOccluder = occluder && presentPhysicalPoseInVolume({ positionM: occluder.positionM,
      orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
    const occluderRelative = localOccluder?.map((value, axis) => value - local.positionUnits[axis]) as PointFieldVector | undefined;
    const occluderRadius = (occluder?.radiusM ?? 0) / payload.frame.metersPerUnit;
    const baseId = state.committedId === previousId ? previousId : 0;
    const next = new Map<number, ProjectedPointValue>();
    const indices: number[] = [], shown: number[] = [], alphas: number[] = [], transforms: string[] = [];
    for (const identity of identities) {
      const point = identity % 2 === 0 ? payload.stars[identity / 2] : payload.nodes[(identity - 1) / 2];
      if (!point) throw new TypeError('Point frame references an unavailable prepared identity.');
      let sample = samples.get(identity);
      if (!sample) { sample = createPointSample(); samples.set(identity, sample); }
      const p = samplePreparedPoint(sample, point, payload, local.positionUnits, rotation, focal, ox, oy);
      const visible = p.depth > 0 && pointLuminanceVisible(p.light.luminance, 'coverageAnchor' in point && point.coverageAnchor) &&
        !(occluderRelative && rayHitsSphereBefore(p.relative, occluderRelative, occluderRadius)) &&
        Math.abs(p.x) < halfWidth + p.size && Math.abs(p.y) < halfHeight + p.size;
      const prior = previous.get(identity);
      let value: ProjectedPointValue;
      if (visible) {
        // Exactly the existing publication precision; physical camera math is unchanged.
        const x = Math.round((p.x - p.size / 2) * 1000) / 1000;
        const y = Math.round((p.y - p.size / 2) * 1000) / 1000;
        const size = Math.round(p.size * 1000) / 1000;
        value = { shown: true, x, y, size,
          transform: prior?.shown && prior.x === x && prior.y === y && prior.size === size
            ? prior.transform : `translate(${x}px,${y}px) scale(${size / payload.atlas.tileSize})`,
          alpha: Math.round(p.light.luminance * 1e6) / 1e6 };
      } else value = { shown: false, transform: '', alpha: 0, x: 0, y: 0, size: 0 };
      next.set(identity, value);
      const old = baseId === 0 ? undefined : prior;
      if (old && old.shown === value.shown && old.transform === value.transform && old.alpha === value.alpha) continue;
      indices.push(identity); shown.push(Number(value.shown)); alphas.push(value.alpha); transforms.push(value.transform);
    }
    for (const identity of samples.keys()) if (!identities.has(identity)) samples.delete(identity);
    previous = next; previousId = id;
    return { id, baseId, selectionEvaluated: state.select, selection, retained: Uint32Array.from(identities), indices: Uint32Array.from(indices),
      shown: Uint8Array.from(shown), alphas: Float64Array.from(alphas), transforms, projectedCount: identities.size };
  };
}

export function pointFrameTransfers(frame: PreparedPointFrame): ArrayBuffer[] {
  return [frame.retained.buffer, frame.indices.buffer, frame.shown.buffer, frame.alphas.buffer] as ArrayBuffer[];
}

/** Only accepted publications advance this acknowledgement. No DOM or scheduler ownership. */
export function createPointFrameReceiver() {
  let committedId = 0;
  let values = new Map<number, PointValue>();
  return {
    get committedId() { return committedId; },
    get: (identity: number) => values.get(identity),
    invalidate() { committedId = 0; values.clear(); },
    accept(frame: PreparedPointFrame) {
      if (frame.baseId !== 0 && frame.baseId !== committedId) throw new Error('Point frame publication baseline is stale.');
      const count = frame.indices.length;
      if (frame.shown.length !== count || frame.alphas.length !== count || frame.transforms.length !== count) {
        throw new Error('Point frame columns have different lengths.');
      }
      const next = frame.baseId === 0 ? new Map<number, PointValue>() : new Map(values);
      for (let i = 0; i < count; i++) next.set(frame.indices[i], {
        shown: frame.shown[i] !== 0, transform: frame.transforms[i], alpha: frame.alphas[i],
      });
      const retained = new Set(frame.retained);
      for (const identity of next.keys()) if (!retained.has(identity)) next.delete(identity);
      for (const identity of retained) if (!next.has(identity)) throw new Error('Point frame omitted a newly visible identity.');
      values = next; committedId = frame.id;
    },
  };
}
