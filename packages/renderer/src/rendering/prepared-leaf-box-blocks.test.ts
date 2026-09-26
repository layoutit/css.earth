import { expect, test } from 'vitest';
import { createLeafBoxBlocks, leafBoxBlockNeeds, leafBoxShrinkable, nextLeafBoxWrites, type LeafBoxBinding } from './prepared-leaf-box-blocks.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

// A body of radius 1000 scene units at the origin; three blocks: facing the camera, at the limb, and behind.
const binding: LeafBoxBinding = {
  property: '--silhouette-step', hysteresis: 0.2,
  levels: [16, 32, 64, 128, 256, 512, 1024, 2048].map((value, index) => ({ minimumDiameter: index === 0 ? 0 : value / 2, value: String(value) })),
  groups: { '--silhouette-step': [9], '--silhouette-step-0': [3, 4], '--silhouette-step-1': [5, 6], '--silhouette-step-2': [7, 8] },
  placements: { body: { center: [0, 0, 0], radius: 1000 }, writes: {
    '--silhouette-step-0': { center: [0, 0, 950], radius: 300, normal: [0, 0, 1], spread: 0.3 },
    '--silhouette-step-1': { center: [950, 0, 0], radius: 300, normal: [1, 0, 0], spread: 0.3 },
    '--silhouette-step-2': { center: [0, 0, -950], radius: 300, normal: [0, 0, -1], spread: 0.3 },
  } },
};
// A fake clock: `settle()` moves it past the queue's settle time, as if the camera had stopped.
const timing = () => { let now = 0; const wakes: (() => void)[] = [];
  return { clock: () => now, later: (callback: () => void) => { wakes.push(callback); }, settle: () => { now += 1000; wakes.splice(0).forEach(wake => wake()); } }; };
// The camera looks down -z from `distance` along +z.
const view = (distance: number) => ({ silhouetteDiameter: null, motionAtRest: true, viewportWidth: 400, viewportHeight: 800,
  projection: { focalPixels: 400, principalOffsetPixels: [0, 0], eyeFromScene: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -distance, 1] } as unknown as PhysicalProjection });

test('the eye transform may carry the scene scale: a block needs the same step either way', () => {
  const scaled = view(4000);
  const eye = [0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, -80, 1];
  const needs = leafBoxBlockNeeds(binding, { ...scaled, projection: { ...scaled.projection!, eyeFromScene: eye } as unknown as PhysicalProjection }, new Map());
  expect(needs.get('--silhouette-step-0')!.need).toBeCloseTo(400 * 2000 / 3000, 6);
});

test('each block needs the step for its own nearest depth; a block behind the body takes the first', () => {
  const needs = leafBoxBlockNeeds(binding, view(4000), new Map());
  const facing = needs.get('--silhouette-step-0')!, limb = needs.get('--silhouette-step-1')!, behind = needs.get('--silhouette-step-2')!;
  // Facing: its bounding sphere reaches 4000 - 950 - 300 = 2750, in front of the body's nearest point at 3000; no leaf is
  // nearer than that, so the body would be 400 × 2000 / 3000 px across there.
  expect(facing.need).toBeCloseTo(400 * 2000 / 3000, 6);
  expect(limb.need).toBeLessThan(facing.need);
  expect(behind).toEqual({ level: 0, need: 0 });
  // The whole body's step follows its silhouette, here unpublished, so it has no need yet.
  expect(needs.has('--silhouette-step')).toBe(false);
  const withSilhouette = leafBoxBlockNeeds(binding, { ...view(4000), silhouetteDiameter: 300 }, new Map());
  expect(binding.levels[withSilhouette.get('--silhouette-step')!.level]!.value).toBe('512');
  expect(binding.levels[facing.level]!.value).toBe('512');
});

test('a block whose turn comes late is written once, at its latest need', () => {
  const log: [string, string][] = [];
  const styles = new Map<string, string>(Object.keys(binding.groups).map(name => [name, '512']));
  const frames: (() => void)[] = [];
  const time = timing();
  const blocks = createLeafBoxBlocks(binding, name => styles.get(name) ?? '', (name, value) => { log.push([name, value]); styles.set(name, value); },
    callback => frames.push(callback), time);
  // A fast zoom: three views before the first frame runs, then the camera stops.
  for (const distance of [3600, 2400, 1600]) blocks.publish(view(distance));
  while (frames.length) frames.shift()!();
  time.settle();
  while (frames.length) frames.shift()!();
  expect(log.filter(([name]) => name === '--silhouette-step-0')).toEqual([['--silhouette-step-0', '2048']]);
});

test('while the camera moves nothing switches; once it settles the queue applies the final steps', () => {
  const written = new Map([['a', 5], ['b', 5], ['c', 5]]);
  const wanted = new Map([['a', { level: 7, need: 1 }], ['b', { level: 6, need: 1 }], ['c', { level: 0, need: 0 }]]);
  expect(nextLeafBoxWrites(wanted, written, () => 8, 64, true)).toEqual([]);
  expect(nextLeafBoxWrites(wanted, written, () => 8, 64, false)).toEqual(['a', 'b']);
});

test('sharpenings go first, most under-stepped first; shrinks wait until none are left', () => {
  const wanted = new Map([['a', { level: 7, need: 100 }], ['b', { level: 5, need: 900 }], ['c', { level: 6, need: 50 }], ['d', { level: 0, need: 0 }]]);
  const written = new Map([['a', 5], ['b', 5], ['c', 5], ['d', 5]]);
  // Groups of 14 leaves under a 28-leaf budget: two sharpen per frame; shrinks wait for them, then go the same way.
  expect(nextLeafBoxWrites(wanted, written, () => 14, 28)).toEqual(['a', 'c']);
  expect(nextLeafBoxWrites(new Map([['d', { level: 0, need: 0 }], ['b', { level: 4, need: 1 }]]), written, () => 14, 28)).toEqual(['d', 'b']);
  // A group larger than the budget still goes, alone.
  expect(nextLeafBoxWrites(wanted, written, () => 45, 28)).toEqual(['a']);
});

test('in a browser the queue drains a few blocks per frame; without frames every block is written at once', () => {
  const styles = new Map<string, string>(Object.keys(binding.groups).map(name => [name, '512']));
  const frames: (() => void)[] = [];
  const time = timing();
  const blocks = createLeafBoxBlocks(binding, name => styles.get(name) ?? '', (name, value) => styles.set(name, value), callback => frames.push(callback), time);
  blocks.publish(view(1500));
  // While the camera moves the queue requests no frame and writes nothing: the block behind waits.
  expect(frames).toHaveLength(0);
  expect(styles.get('--silhouette-step-2')).toBe('512');
  // Once the camera has stayed still, the queue wakes and the rest lands.
  time.settle();
  while (frames.length) frames.shift()!();
  expect(styles.get('--silhouette-step-2')).toBe('16');
  expect(Number(styles.get('--silhouette-step-0'))).toBeGreaterThan(512);
  const direct = new Map<string, string>();
  createLeafBoxBlocks(binding, name => direct.get(name) ?? '', (name, value) => direct.set(name, value), null).publish(view(4000));
  expect([...direct.values()]).toEqual(['512', '256', '16']);
});

test('the queue paces itself by the frames its writes cost', () => {
  // Sixty-four blocks of one leaf, all to sharpen; each frame's timestamp is the previous one plus its cost.
  const writes = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`--silhouette-step-${index}`,
    { center: [0, 0, 950] as [number, number, number], radius: 10, normal: [0, 0, 1] as [number, number, number], spread: 0.01 }]));
  const many: LeafBoxBinding = { ...binding, groups: Object.fromEntries(Object.keys(writes).map((name, index) => [name, [index + 10]])),
    placements: { body: { center: [0, 0, 0], radius: 1000 }, writes } };
  let pending: ((now?: number) => void) | null = null, now = 0;
  const perFrame: number[] = [];
  let count = 0;
  const time = timing();
  const blocks = createLeafBoxBlocks(many, () => '16', () => { count++; }, callback => { pending = callback; }, time);
  blocks.publish(view(1500));
  time.settle();
  // Slow frames (40 ms) until the budget has halved twice, then quick ones (10 ms).
  for (let frame = 0; frame < 12 && pending; frame++) {
    const run = pending as (now?: number) => void; pending = null; count = 0;
    now += frame < 4 ? 40 : 10; run(now); perFrame.push(count);
  }
  // Writes, a skipped frame after each slow one with a smaller budget, then growth once frames are quick again.
  expect(perFrame[0]).toBe(16);
  expect(perFrame[1]).toBe(0);
  expect(perFrame[2]).toBe(8);
  expect(perFrame.slice(4).some(value => value > 8)).toBe(true);
});

test('detail beyond the need stays within the budget; past it the groups needed longest ago shrink first', () => {
  // Four groups of 1,000,000 CSS px² at full box (density 1/2048: the last step, 2048, gives a factor of one).
  const sized: LeafBoxBinding = { ...binding, groups: { a: [1], b: [2], c: [3], d: [4] },
    groupSizes: { a: [1e6, 1 / 2048], b: [1e6, 1 / 2048], c: [1e6, 1 / 2048], d: [1e6, 1 / 2048] } };
  const full = 7, rest = 5, written = new Map([['a', full], ['b', full], ['c', full], ['d', full]]);
  const lastNeeded = new Map([['a', 1], ['b', 4], ['c', 2], ['d', 3]]);
  // At DPR 1 a full group holds 4 MB (bytes, 1e6); at step 512 its factor is 1/4, so the view needs 0.25 MB and 3.75 MB is
  // kept beyond it: 15 MB in all, within the 32 MiB cap. Nothing shrinks.
  const wanted = new Map(['a', 'b', 'c', 'd'].map(name => [name, { level: rest, need: 400 }]));
  expect([...leafBoxShrinkable(sized, wanted, written, lastNeeded, 1)!]).toEqual([]);
  // At DPR 2 each group keeps 15 MB beyond its need, 60 MB in all: the two needed longest ago go, leaving 30 MB.
  expect([...leafBoxShrinkable(sized, wanted, written, lastNeeded, 2)!]).toEqual(['a', 'c']);
  // Without prepared sizes there is no budget: every group may shrink.
  expect(leafBoxShrinkable(binding, wanted, written, lastNeeded, 3)).toBe(null);
});
