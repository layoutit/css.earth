import type { PlannedWorldContext } from './world-context-planner.js';
import type { OrbitSegment } from '../solar-system/heliocentric-view.js';

type Body = PlannedWorldContext['projectedBodies'][number];
type BodyValues = Omit<Body, 'index' | 'segments' | 'transforms'>;
export const ContextChange = { marker: 1, indicator: 2, label: 4, orbit: 8, all: 15 } as const;
export interface OrbitPatch {
  count: number;
  indices: Uint32Array;
  segments: Float64Array;
  transforms: string[];
}
interface BodyPatch { index: number; values: Partial<BodyValues>; orbit?: OrbitPatch; }
export interface WorldContextFrame extends Omit<PlannedWorldContext, 'projectedBodies'> {
  id: number;
  baseId: number;
  members: Uint32Array;
  updates: BodyPatch[];
}
export type WorldContextPublication = PlannedWorldContext | WorldContextFrame;

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => same(
    (a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
const markerShown = (b: Body) => (b.visible || (b.annotationVisible && (b.indicatorShown || b.labelShown))) && b.markerOpacity > 0;
function changedPaint(old: Body | undefined, next: Body): number {
  if (!old) return ContextChange.all;
  let mask = 0;
  if (old.visible !== next.visible || old.markerOpacity !== next.markerOpacity ||
      ((markerShown(old) || markerShown(next)) && (old.x !== next.x || old.y !== next.y || old.diameter !== next.diameter))) mask |= ContextChange.marker;
  // The pseudo consumes resolved visibility; its continuous zoom alpha belongs
  // to the billboard. Eligibility alpha is planner state, not another paint.
  if (old.indicatorShown !== next.indicatorShown ||
      ((old.indicatorShown || next.indicatorShown) && (old.x !== next.x || old.y !== next.y))) mask |= ContextChange.indicator;
  if (old.labelShown !== next.labelShown || old.hovered !== next.hovered ||
      old.annotationVisible !== next.annotationVisible || old.markerOpacity !== next.markerOpacity ||
      !same(old.labelPosition, next.labelPosition)) mask |= ContextChange.label;
  if (old.orbitVisibility !== next.orbitVisibility || old.lineWidth !== next.lineWidth ||
      old.segments !== next.segments || old.transforms !== next.transforms) mask |= ContextChange.orbit;
  return mask;
}

/** The worker owns one copied baseline, never the planner's borrowed chord arrays.
 * Deltas name the last acknowledged DOM publication. Discarded work forces a full
 * repair packet; it cannot silently become the next frame's baseline. */
export function createWorldContextFrameEncoder() {
  let previousId = 0, previous = new Map<number, Body>();
  return (id: number, committedId: number, frame: PlannedWorldContext): WorldContextFrame => {
    const baseId = committedId === previousId ? previousId : 0;
    const next = new Map<number, Body>(), updates: BodyPatch[] = [];
    for (const body of frame.projectedBodies) {
      const old = baseId ? previous.get(body.index) : undefined;
      const values: Partial<BodyValues> = {};
      for (const key of [...new Set([...Object.keys(old ?? {}), ...Object.keys(body)])] as (keyof Body)[]) {
        if (key === 'index' || key === 'segments' || key === 'transforms') continue;
        if (!old || !same(old[key], body[key])) {
          const value = body[key];
          (values as Record<string, unknown>)[key] = value && typeof value === 'object' ? structuredClone(value) : value;
        }
      }
      const indices: number[] = [], segments: number[] = [], transforms: string[] = [];
      for (let i = 0; i < body.segments.length; i++) {
        if (old && old.transforms[i] === body.transforms[i] && same(old.segments[i], body.segments[i])) continue;
        indices.push(i); segments.push(...body.segments[i]);
        transforms.push(body.transforms[i]);
      }
      const orbit = !old || indices.length || old.segments.length !== body.segments.length ? {
        count: body.segments.length, indices: Uint32Array.from(indices), segments: Float64Array.from(segments), transforms,
      } : undefined;
      if (Object.keys(values).length || orbit) updates.push({ index: body.index, values, ...(orbit ? { orbit } : {}) });
      const retained = { ...old, ...values, index: body.index } as Body;
      retained.segments = orbit ? body.segments.map(segment => [...segment] as OrbitSegment) : old!.segments;
      retained.transforms = orbit ? [...body.transforms] : old!.transforms;
      next.set(body.index, retained);
    }
    previous = next; previousId = id;
    const { projectedBodies, ...header } = frame;
    return { ...header, id, baseId, members: Uint32Array.from(projectedBodies.map(body => body.index)), updates };
  };
}
export function contextFrameTransfers(frame: WorldContextFrame): ArrayBuffer[] {
  return [frame.members.buffer, ...frame.updates.flatMap(update => update.orbit
    ? [update.orbit.indices.buffer, update.orbit.segments.buffer] : [])] as ArrayBuffer[];
}

/** Receive only at presentation, not when a worker message arrives. Unchanged
 * bodies/chords retain their JS identity as well as their DOM identity. */
export function createWorldContextFrameReceiver() {
  let committedId = 0;
  const bodies = new Map<number, Body>();
  let members: Uint32Array = new Uint32Array(), projectedBodies: Body[] = [];
  return {
    get committedId() { return committedId; },
    invalidate() { committedId = 0; bodies.clear(); members = new Uint32Array(); projectedBodies = []; },
    accept(packet: WorldContextFrame) {
      if (packet.baseId !== 0 && packet.baseId !== committedId) throw new Error('World context publication baseline is stale.');
      if (!packet.baseId) { bodies.clear(); members = new Uint32Array(); }
      const changes = new Map<number, number>(), orbits = new Map<number, OrbitPatch>();
      for (const update of packet.updates) {
        const old = bodies.get(update.index);
        const body = { ...old, ...update.values, index: update.index } as Body;
        if (update.orbit) {
          const patch = update.orbit;
          if (patch.segments.length !== patch.indices.length * 5 || patch.transforms.length !== patch.indices.length) throw new Error('Orbit patch columns have different lengths.');
          if (!Number.isSafeInteger(patch.count) || patch.count < 0) throw new Error('Orbit patch has an invalid count.');
          const oldCount = old?.segments.length ?? 0;
          let nextNewSlot = oldCount;
          // Validate growth before touching the retained bank. New slots are
          // ordered by the encoder and must all be supplied, even on re-entry.
          for (const slot of patch.indices) {
            if (slot >= patch.count) throw new Error('Orbit patch exceeds its prepared count.');
            if (slot >= oldCount && slot !== nextNewSlot++) throw new Error('Orbit patch omitted a new slot.');
          }
          if (patch.count > oldCount && nextNewSlot !== patch.count) throw new Error('Orbit patch omitted a new slot.');
          // One mounted receiver owns these numeric slots. Reuse them instead
          // of allocating a subarray and a five-number array for every chord
          // every time the shared camera moves. Returned views are borrowed
          // until the next accept, just like the worker's projection bank.
          const segments = old ? old.segments as OrbitSegment[] : [];
          const transforms = old ? old.transforms : [];
          for (let i = 0; i < patch.indices.length; i++) {
            const slot = patch.indices[i];
            if (slot >= patch.count) throw new Error('Orbit patch exceeds its prepared count.');
            const segment = segments[slot] as number[] | undefined;
            const target = segment ?? [0, 0, 0, 0, 0];
            for (let column = 0; column < 5; column++) target[column] = patch.segments[i * 5 + column];
            if (!segment) segments[slot] = target as unknown as OrbitSegment;
            transforms[slot] = patch.transforms[i];
          }
          segments.length = patch.count; transforms.length = patch.count;
          body.segments = segments; body.transforms = transforms; orbits.set(update.index, patch);
        }
        if (!body.segments || !body.transforms) throw new Error('World context frame omitted an initial orbit bank.');
        changes.set(update.index, changedPaint(old, body) | (update.orbit ? ContextChange.orbit : 0)); bodies.set(update.index, body);
      }
      if (members.length !== packet.members.length || members.some((index, i) => index !== packet.members[i])) {
        members = packet.members;
        projectedBodies = Array.from(members, index => {
          const body = bodies.get(index);
          if (!body) throw new Error('World context frame omitted a retained identity.');
          return body;
        });
        const retained = new Set(members);
        for (const index of bodies.keys()) if (!retained.has(index)) bodies.delete(index);
      } else {
        for (let i = 0; i < members.length; i++) projectedBodies[i] = bodies.get(members[i])!;
      }
      const { id, baseId, members: _members, updates, ...header } = packet;
      committedId = id;
      return { frame: { ...header, projectedBodies } as PlannedWorldContext, changes, orbits };
    },
  };
}
