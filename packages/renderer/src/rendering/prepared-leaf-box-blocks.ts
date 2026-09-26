import { transformPreparedPoint } from '@cssearth/core';
import { walkSilhouetteLevels, type PreparedSilhouetteSteps } from './prepared-silhouette-steps.js';
import { unseenTextureWrites, type PreparedTexturePlacements } from './prepared-texture-levels.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

// Leaf boxes by group (tools/prepared/leaf-box.mts). Every leaf reads the silhouette step `binding.property`; the prepared
// groups say which leaves share one. A block of surface leaves (named in the placements) takes the step for the body's
// diameter as it would look if the whole body sat at the block's nearest depth: the sharpest at the centre of a close
// view, less at the limb, the first behind the body or off screen. Any other group (rings, shells) follows the silhouette.
// A step is written on the group's own leaves, so only they restyle, and a change repaints each of them: the changes are
// queued, the groups furthest below their need first, a few per frame, and groups that only shrink (memory, never
// sharpness) after every sharpening has landed. A group's turn writes its latest need, so during a fast zoom a block skips
// the steps it fell behind, and one that leaves the screen first is never sharpened.

/** Leaves repainted per frame, to start with: a whole-body switch of the Moon's 448 leaves took 300 ms in the iOS
 * simulator, so 16 leaves are about 10 ms there. A leaf's repaint cost differs from body to body (Haumea's took four
 * times the Moon's), so the budget follows the frames it causes: after a frame longer than SLOW_FRAME_MS it halves and
 * the queue waits a frame; after a short one it grows back. A frame takes at least one group. */
const START_LEAVES_PER_FRAME = 16, MAXIMUM_LEAVES_PER_FRAME = 64, SLOW_FRAME_MS = 25, QUICK_FRAME_MS = 20;
/** A step change resizes its leaves, and a resized leaf is drawn again before the frame that shows it: WebKit repaints
 * it, and Chrome with a GPU rasters it again and decodes its image at the new size (on a Saturn wheel zoom, 131 ms of
 * decodes inside the gesture and a presented-frame p95 of 33 ms against 17 ms). A transform alone reuses what was drawn.
 * So nothing switches while the camera moves: SETTLE_MS after the last view change the queue applies the final steps,
 * and every step the gesture passed through is skipped. A stepped mouse wheel leaves gaps between notches (up to 666 ms
 * in a recorded Saturn zoom); at 150 ms groups switched between notches and Chrome presented 31 frames with missing
 * content while it rastered them mid-zoom. SETTLE_MS outlasts those gaps. */
const SETTLE_MS = 750;
/** Detail beyond what the view needs is kept, as a tile cache keeps tiles the view left (lru-cache's maxSize, MapLibre's
 * out-of-view cache, Cesium's cacheBytes), up to EXTRA_BYTES; past it the groups needed longest ago shrink back to their
 * need first. No browser reports its layer memory or budget to the page (navigator.deviceMemory and
 * measureUserAgentSpecificMemory are Chromium only, and neither covers compositor layers), so the bytes are estimated from
 * each group's prepared box. One cap, not a share of the view's need: a share lets a long exploration grow past the full
 * boxes. In the iPhone simulator a zoom to 40× into the Moon and back kept 4 MB beyond the need (187 MB at rest, 191 MB
 * back out; main 291 MB), so the cap holds about eight such dives. */
const EXTRA_BYTES = 32 * 2 ** 20;

export interface LeafBoxBlocksView {
  projection?: PhysicalProjection | null; silhouetteDiameter: number | null | undefined; motionAtRest?: boolean;
  viewportWidth?: number; viewportHeight?: number;
}
export type LeafBoxBinding = { property: string; placements?: PreparedTexturePlacements; groups: Readonly<Record<string, readonly number[]>>;
  /** Each group's full box area (CSS px²) and area-weighted density, for the memory estimate. */
  groupSizes?: Readonly<Record<string, readonly number[]>> } & PreparedSilhouetteSteps;
type Need = { level: number; need: number };

/** The step each group needs for this view: the level index into `binding.levels`, and the diameter that chose it. */
export function leafBoxBlockNeeds(binding: LeafBoxBinding, view: LeafBoxBlocksView, previous: ReadonlyMap<string, Need>) {
  const { placements, levels, hysteresis } = binding, needs = new Map<string, Need>();
  const projection = view.projection;
  // A spinning body leaves the placements behind: every group takes the body's own step, as texture pages take one level.
  const placed = placements && projection && view.motionAtRest === true && view.viewportWidth! > 0 && view.viewportHeight! > 0;
  const unseen = placed ? unseenTextureWrites(placements, projection, { width: view.viewportWidth!, height: view.viewportHeight! }) : null;
  // Eye coordinates carry the scene's scale: the body and each block are measured in them.
  const scale = projection ? Math.hypot(projection.eyeFromScene[0], projection.eyeFromScene[1], projection.eyeFromScene[2]) : 0;
  const body = placed ? transformPreparedPoint(projection.eyeFromScene, placements.body.center[0], placements.body.center[1], placements.body.center[2], 1) : null;
  const bodyDiameter = placed ? 2 * placements.body.radius * scale : 0;
  // No leaf is nearer than the body's own nearest point: a wide block's bounding sphere reaches in front of the surface.
  const nearest = placed ? -body!.z - placements.body.radius * scale : 0;
  for (const name of Object.keys(binding.groups)) {
    const before = previous.get(name), write = placed ? placements.writes[name] : undefined;
    if (!write) {
      const diameter = view.silhouetteDiameter;
      if (diameter == null || !Number.isFinite(diameter)) { if (before) needs.set(name, before); continue; }
      needs.set(name, { level: walkSilhouetteLevels(levels, hysteresis, diameter, before?.level), need: diameter });
      continue;
    }
    if (unseen!.has(name)) { needs.set(name, { level: 0, need: 0 }); continue; }
    const centre = transformPreparedPoint(projection!.eyeFromScene, write.center[0], write.center[1], write.center[2], 1);
    const depth = Math.max(nearest, -centre.z - write.radius * scale);
    // A block reaching the camera plane shows at any size: it takes the last step.
    const need = depth > 0 ? projection!.focalPixels * bodyDiameter / depth : Infinity;
    const diameter = Number.isFinite(need) ? need : levels.at(-1)!.minimumDiameter;
    needs.set(name, { level: walkSilhouetteLevels(levels, hysteresis, diameter, before?.level), need });
  }
  return needs;
}

/** Which queued groups to write this frame: sharpenings first, the most under-stepped and then the nearest leading, and
 * shrinks, the most over-stepped first, only once no sharpening waits; up to `budget` leaves. While the camera moves
 * nothing is written, except a group that shows no step yet. `shrinkable`, when given, limits the shrinks to those groups. */
export function nextLeafBoxWrites(wanted: ReadonlyMap<string, Need>, written: ReadonlyMap<string, number>, leavesOf: (name: string) => number,
  budget = START_LEAVES_PER_FRAME, moving = false, shrinkable: ReadonlySet<string> | null = null) {
  const sharpen: [string, number, number][] = [], shrink: [string, number, number][] = [];
  for (const [name, { level, need }] of wanted) {
    const current = written.get(name);
    if (current === undefined) sharpen.push([name, level, need]);
    else if (moving) continue;
    else if (level > current) sharpen.push([name, level - current, need]);
    else if (level < current && (!shrinkable || shrinkable.has(name))) shrink.push([name, current - level, need]);
  }
  const order = (a: [string, number, number], b: [string, number, number]) => b[1] - a[1] || b[2] - a[2];
  const queue = sharpen.length ? sharpen : shrink;
  const chosen: string[] = [];
  let leaves = 0;
  for (const [name] of queue.sort(order)) {
    if (chosen.length && leaves + leavesOf(name) > budget) break;
    chosen.push(name); leaves += leavesOf(name);
  }
  return chosen;
}

/** The groups to shrink so the detail kept beyond the view's need fits the budget: none while it fits, otherwise the
 * groups needed longest ago first. Layer bytes are box area × factor² × DPR² × 4, from each group's prepared size. */
export function leafBoxShrinkable(binding: LeafBoxBinding, wanted: ReadonlyMap<string, Need>, written: ReadonlyMap<string, number>,
  lastNeeded: ReadonlyMap<string, number>, devicePixelRatio: number): Set<string> | null {
  const sizes = binding.groupSizes;
  if (!sizes) return null;
  const bytes = (name: string, level: number) => {
    const [area = 0, density = 0] = sizes[name] ?? [];
    const factor = Math.min(1, Number(binding.levels[level]!.value) * density);
    return area * factor * factor * devicePixelRatio * devicePixelRatio * 4;
  };
  let extra = 0;
  const over: [string, number, number][] = [];
  for (const [name, { level }] of wanted) {
    const current = written.get(name);
    if (current !== undefined && current > level) { const saving = bytes(name, current) - bytes(name, level); extra += saving; over.push([name, lastNeeded.get(name) ?? -Infinity, saving]); }
  }
  const chosen = new Set<string>();
  for (const [name, , saving] of over.sort((a, b) => a[1] - b[1])) {
    if (extra <= EXTRA_BYTES) break;
    chosen.add(name); extra -= saving;
  }
  return chosen;
}

/** Publishes one binding's group steps. `read(name)` is the step a group shows now; `write(name, value)` writes it on the
 * group's leaves. Without an animation frame (a native response, a test) every group is written at once; in a browser the
 * queue drains a few groups per frame, publications or not, and wakes SETTLE_MS after the camera stops. */
export function createLeafBoxBlocks(binding: LeafBoxBinding, read: (name: string) => string, write: (name: string, value: string) => void,
  frame: ((callback: (now?: number) => void) => unknown) | null = globalThis.requestAnimationFrame?.bind(globalThis) ?? null,
  { clock = () => globalThis.performance?.now() ?? Date.now(), later = (callback: () => void, ms: number) => { globalThis.setTimeout(callback, ms); },
    devicePixelRatio = globalThis.devicePixelRatio ?? 1 }:
    { clock?: () => number; later?: (callback: () => void, ms: number) => void; devicePixelRatio?: number } = {}) {
  let needs = new Map<string, Need>(), scheduled = false, budget = START_LEAVES_PER_FRAME, wrote = false, last: number | null = null;
  let published = -Infinity, waking = false;
  // When each group last needed all of its current step.
  const lastNeeded = new Map<string, number>();
  const written = new Map<string, number>();
  for (const name of Object.keys(binding.groups)) {
    const level = binding.levels.findIndex(level => level.value === read(name));
    if (level >= 0) written.set(name, level);
  }
  const apply = (names: readonly string[]) => {
    for (const name of names) { const level = needs.get(name)!.level; write(name, binding.levels[level]!.value); written.set(name, level); }
    return names.length;
  };
  const drain = (now?: number) => {
    scheduled = false;
    // The frame since the last write carried its repaint: pace the next writes by what it cost.
    const spent = wrote && last !== null && now !== undefined ? now - last : null;
    last = now ?? null;
    if (spent !== null && spent > SLOW_FRAME_MS) { budget = Math.max(1, budget / 2); wrote = false; schedule(); return; }
    if (spent !== null && spent < QUICK_FRAME_MS) budget = Math.min(MAXIMUM_LEAVES_PER_FRAME, budget * 1.5);
    const time = clock(), still = time - published, moving = still < SETTLE_MS;
    const shrinkable = moving ? null : leafBoxShrinkable(binding, needs, written, lastNeeded, devicePixelRatio);
    const chosen = nextLeafBoxWrites(needs, written, name => binding.groups[name]?.length ?? 1, budget, moving, shrinkable);
    wrote = apply(chosen) > 0;
    if (wrote) schedule();
    // The camera stopped less than SETTLE_MS ago: wake when it has been still long enough.
    else if (moving && !waking) { waking = true; later(() => { waking = false; schedule(); }, SETTLE_MS - still); }
  };
  const schedule = () => { if (!scheduled && frame) { scheduled = true; frame(drain); } };
  return {
    publish(view: LeafBoxBlocksView) {
      needs = leafBoxBlockNeeds(binding, view, needs);
      published = clock();
      for (const [name, { level }] of needs) { const current = written.get(name); if (current === undefined || level >= current) lastNeeded.set(name, published); }
      if (!frame) { apply([...needs].filter(([name, need]) => written.get(name) !== need.level).map(([name]) => name)); return; }
      // While the camera moves nothing switches: request no frame, only a wake for when it has stayed still. A group
      // that shows no step yet is written on the next frame.
      if ([...needs.keys()].some(name => !written.has(name))) schedule();
      else if (!waking) { waking = true; later(() => { waking = false; schedule(); }, SETTLE_MS); }
    },
    /** The published level of every group, for tests and probes. */
    written: () => new Map(written),
  };
}
