import type { PlannedWorldContext } from './world-context-planner.js';
import type { OrbitSegment } from '../solar-system/types.js';

type Body = PlannedWorldContext['projectedBodies'][number];
type BodyValues = Omit<Body, 'index' | 'segments'>;
export const ContextChange = { marker: 1, indicator: 2, label: 4, orbit: 8, all: 15 } as const;
export interface OrbitPatch {
  count: number;
  indices: Uint32Array;
  segments: Float64Array;
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
/** Every transported body field has one comparison here; the type keeps the list
 * complete, so the encoder never walks keys or allocates a set per body per frame. */
const sameValue = (a: unknown, b: unknown) => a === b;
const sameNumbers = (a: readonly number[] | undefined, b: readonly number[] | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.length === b.length && a.every((value, index) => value === b[index]));
const sameBounds = (a: Body['orbitBounds'], b: Body['orbitBounds']) =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);
const sameAppearance = (a: Body['orbitAppearance'], b: Body['orbitAppearance']) => a === b || (a.width === b.width && a.opacity === b.opacity);
const COMPARE: { readonly [K in keyof BodyValues]-?: (a: Body[K], b: Body[K]) => boolean } = {
  x: sameValue, y: sameValue, diameter: sameValue, markerOpacity: sameValue, visible: sameValue, annotationVisible: sameValue,
  hovered: sameValue, lineWidth: sameValue, orbitVisibility: sameValue, labelShown: sameValue, labelPlacement: sameValue,
  indicatorShown: sameValue, indicatorCutout: sameValue, labelPosition: sameNumbers, orbitBounds: sameBounds, orbitAppearance: sameAppearance,
};
const VALUE_KEYS = Object.keys(COMPARE) as (keyof BodyValues)[];
function changedValues(old: Body | undefined, body: Body): Partial<BodyValues> | null {
  let values: Partial<BodyValues> | null = null;
  for (const key of VALUE_KEYS) {
    if (old && (COMPARE[key] as (a: unknown, b: unknown) => boolean)(old[key], body[key])) continue;
    if (!old && body[key] === undefined) continue;
    const value = body[key];
    // The object fields are a number list and flat records of numbers; a shallow copy detaches them exactly, without
    // structuredClone's per-call cost on every moving body of every frame.
    (values ??= {} as Partial<BodyValues>)[key] = (Array.isArray(value) ? value.slice() : value && typeof value === 'object' ? { ...value } : value) as never;
  }
  return values;
}
const markerShown = (b: Body) => (b.visible || (b.annotationVisible && (b.indicatorShown || b.labelShown))) && b.markerOpacity > 0;
/** The paint mask of a patch, read before it merges: a field in `values` is one the
 * encoder found changed, so presence alone decides, and the retained body object is
 * updated in place instead of being rebuilt every frame. */
function changedPaint(old: Body | undefined, values: Partial<BodyValues>, orbitPatched: boolean): number {
  if (!old) return ContextChange.all;
  const has = (key: keyof BodyValues) => key in values;
  const next = <K extends keyof BodyValues>(key: K): Body[K] => (has(key) ? values[key] : old[key]) as Body[K];
  const moved = has('x') || has('y');
  let mask = 0;
  const shownBefore = markerShown(old), shownAfter = (next('visible') || (next('annotationVisible') && (next('indicatorShown') || next('labelShown')))) && next('markerOpacity') > 0;
  if (has('visible') || has('markerOpacity') || ((shownBefore || shownAfter) && (moved || has('diameter')))) mask |= ContextChange.marker;
  // The pseudo consumes resolved visibility; its continuous zoom alpha belongs
  // to the billboard. Eligibility alpha is planner state, not another paint.
  if (has('indicatorShown') || ((old.indicatorShown || next('indicatorShown')) && moved)) mask |= ContextChange.indicator;
  if (has('labelShown') || has('hovered') || has('annotationVisible') || has('markerOpacity') || has('labelPosition')) mask |= ContextChange.label;
  if (has('orbitVisibility') || has('lineWidth') || orbitPatched) mask |= ContextChange.orbit;
  return mask;
}

/** The worker owns one copied baseline, never the planner's borrowed chord arrays.
 * Deltas name the last acknowledged DOM publication. Discarded work forces a full
 * repair packet; it cannot silently become the next frame's baseline. */
export function createWorldContextFrameEncoder() {
  // `acknowledgedId` names the frame whose DOM the client actually committed.
  // The state of an encoded frame stays aside until it is acknowledged, so a
  // frame the client discards leaves the delta chain intact.
  let committedId = 0, committed = new Map<number, Body>();
  let pendingId = 0, pending: Map<number, Body> | null = null;
  return (id: number, acknowledgedId: number, frame: PlannedWorldContext): WorldContextFrame => {
    if (pending && acknowledgedId === pendingId) { committed = pending; committedId = pendingId; }
    pending = null;
    const baseId = acknowledgedId === committedId ? committedId : 0;
    const previous = committed;
    const next = new Map<number, Body>(), updates: BodyPatch[] = [];
    for (const body of frame.projectedBodies) {
      const old = baseId ? previous.get(body.index) : undefined;
      const values = changedValues(old, body);
      let orbit: OrbitPatch | undefined, copied: OrbitSegment[] | undefined;
      if (!old || old.segments.length !== body.segments.length || body.segments.some((segment, i) => !sameNumbers(old.segments[i], segment))) {
        const indices: number[] = [], segments: number[] = [];
        copied = [];
        for (let i = 0; i < body.segments.length; i++) {
          // Baseline chords are never mutated, so an unchanged one is shared rather than copied again.
          if (old && sameNumbers(old.segments[i], body.segments[i])) { copied.push(old.segments[i]!); continue; }
          indices.push(i); segments.push(...body.segments[i]);
          copied.push([...body.segments[i]] as OrbitSegment);
        }
        orbit = { count: body.segments.length, indices: Uint32Array.from(indices), segments: Float64Array.from(segments) };
      }
      if (values || orbit) updates.push({ index: body.index, values: values ?? {}, ...(orbit ? { orbit } : {}) });
      // An unchanged body keeps its baseline object; only changes copy.
      let retained = old!;
      if (!old || values || orbit) {
        retained = { ...old, ...values, index: body.index } as Body;
        retained.segments = copied ?? old!.segments;
      }
      next.set(body.index, retained);
    }
    pending = next; pendingId = id;
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
        const mask = changedPaint(old, update.values, update.orbit !== undefined);
        const body = old ?? ({ index: update.index } as Body);
        Object.assign(body, update.values);
        if (update.orbit) {
          const patch = update.orbit;
          if (patch.segments.length !== patch.indices.length * 5) throw new Error('Orbit patch columns have different lengths.');
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
          for (let i = 0; i < patch.indices.length; i++) {
            const slot = patch.indices[i];
            if (slot >= patch.count) throw new Error('Orbit patch exceeds its prepared count.');
            const segment = segments[slot] as number[] | undefined;
            const target = segment ?? [0, 0, 0, 0, 0];
            for (let column = 0; column < 5; column++) target[column] = patch.segments[i * 5 + column];
            if (!segment) segments[slot] = target as unknown as OrbitSegment;
          }
          segments.length = patch.count;
          body.segments = segments; orbits.set(update.index, patch);
        }
        if (!body.segments) throw new Error('World context frame omitted an initial orbit bank.');
        changes.set(update.index, mask); bodies.set(update.index, body);
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
      // Changed bodies are keyed by prepared body index, which is not their position
      // in the projected list once only the locators publish.
      const changed = Array.from(changes.keys(), index => bodies.get(index)!);
      return { frame: { ...header, projectedBodies } as PlannedWorldContext, changes, changed, orbits };
    },
  };
}
