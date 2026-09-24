import { isArray } from '@cssearth/core';
import type { PreparedMaterialTrack, PreparedMaterialBank, PreparedMaterialRotation } from '../../src/renderers/css/rendering/prepared-material.ts';
export interface MaterialPhaseRemap {lowerTransition: readonly [number, number]; plateau: readonly [number, number]; upperTransition: readonly [number, number]; plateauViewZ: number;}
export type MaterialFrameSource = {count: number; samples: readonly (readonly [number, number, number])[]}
  | {count: number; samples?: undefined; source: string; minimum: number; maximum: number; baseFrame: number; maximumFrame?: number; span?: number; remap?: MaterialPhaseRemap | null;};
export interface MaterialSourceTrack extends Omit<PreparedMaterialTrack, 'frame' | 'banks' | 'rotation' | 'defaultFrame'> {
  frame: MaterialFrameSource;
  banks: readonly (PreparedMaterialBank & { rows?: readonly {row: number; resource: string; firstFrame?:number; lastFrame?:number}[] })[];
  demand: {capacity: number; defaultFrame: number};
  rotation: (PreparedMaterialRotation & {source?: string}) | null;
}
export interface MaterialSourcePlan {sun?: {referenceViewDirection?: readonly number[]} | null; materials: readonly MaterialSourceTrack[];}

// Source lighting is normalized during preparation. Runtime selects by view Z.
export function prepareFrameLookup(count: number, frameAtPhase: (phase: number) => number) {
  if (!Number.isSafeInteger(count) || count < 1 || typeof frameAtPhase !== "function") {
    throw new TypeError("Material lookup requires a positive frame count and phase mapping.");
  }
  const frameFor = (phase: number) => {
    const frame = frameAtPhase(phase);
    if (!Number.isSafeInteger(frame) || frame < 0 || frame >= count) {
      throw new TypeError("Material phase must select a finite integer inside its prepared bank.");
    }
    return frame;
  };
  const first = frameFor(-1), last = frameFor(1), ascending = last >= first;
  const indices = [first], thresholds = [];
  for (let step = 0; step < Math.abs(last - first); step++) {
    const frame = first + step * (ascending ? 1 : -1);
    const next = frame + (ascending ? 1 : -1);
    let low = -1, high = 1;
    for (let i = 0; i < 55; i++) {
      const middle = (low + high)/2;
      if (ascending ? frameFor(middle) >= next : frameFor(middle) <= next) high = middle;
      else low = middle;
    }
    thresholds.push(high); indices.push(next);
  }
  return { count, thresholds, indices };
}

function remap(value: number, mapping: MaterialPhaseRemap | null | undefined) {
  if (!mapping) return value;
  const [a,b] = mapping.lowerTransition, [c,d] = mapping.plateau, [e,f] = mapping.upperTransition;
  if (value <= a || value >= f) return value;
  if (value < b) { const t=(value-a)/(b-a); return value*(1-t)+mapping.plateauViewZ*t; }
  if (value >= c && value <= d) return mapping.plateauViewZ;
  const t=(value-e)/(f-e); return mapping.plateauViewZ*(1-t)+value*t;
}

export function prepareMaterialTracks(plan: MaterialSourcePlan): PreparedMaterialTrack[] {
  const reference = plan.sun?.referenceViewDirection?.map((x, i) => i ? -x : x);
  return plan.materials.map(track => {
    const source = track.frame;
    let frame;
    if (source.samples) {
      if (!isArray(source.samples) || source.samples.length !== source.count || source.samples.some(direction =>
        !isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite) || Math.abs(Math.hypot(...direction)-1) > 1e-5)) {
        throw new TypeError("Material samples must contain one unit light direction per frame.");
      }
      const samples = source.samples.map((direction, index) => ({ phase: direction[2], index })).sort((a,b) => a.phase-b.phase);
      frame = { count: source.count, indices: samples.map(sample => sample.index),
        thresholds: samples.slice(1).map((sample, i) => (sample.phase+samples[i].phase)/2) };
    } else {
      if (!["sun-z", "prepared-light-z", "reference-sun-z"].includes(source.source)) throw new TypeError("Prepare material phase samples from the source lighting.");
      frame = prepareFrameLookup(source.count, phase => {
        const value = remap(source.source === "reference-sun-z" ? (reference ?? (() => { throw new TypeError("Reference material lighting is missing."); })())[2]-phase : phase, source.remap);
        return Math.round(Math.max(0, Math.min(source.maximumFrame ?? source.count-1,
          source.baseFrame + (value-source.minimum)/(source.maximum-source.minimum)*(source.span ?? source.count-1))));
      });
    }
    const banks = track.banks.map(bank => ({ ...bank,
      frames: bank.frames.map(address => {
        const rows = [...(bank.rows ?? [])].sort((a,b) => Math.abs(a.row-(address.row ?? 0))-Math.abs(b.row-(address.row ?? 0)) || a.row-b.row);
        return { ...address, prewarm: address.row === null ? [] : rows.filter(row => row.resource !== address.resource)
          .slice(0, Math.max(0, track.demand.capacity-1)).map(row => row.resource) };
      }),
    }));
    const { demand, rotation, ...rest } = track;
    const preparedRotation = rotation === null ? null : (({source: _source, ...value}) => value)(rotation);
    return { ...rest, frame, banks, defaultFrame: demand.defaultFrame,
      rotation: rotation === null ? null : preparedRotation };
  });
}
