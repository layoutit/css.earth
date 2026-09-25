import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMaterialSlots, resyncCloudSupport, unfilteredCloud } from './material-slots.ts';
import type { CloudDensityFilter } from '@cssearth/bake/volume';

test('material toggles, lens swaps and density cutoffs share one texture-slot generation', () => {
  const slots = createMaterialSlots();
  const cutoff = slots.begin('cutoff'), neutral = slots.begin('material');
  assert.equal(slots.current(cutoff), false, 'a material change supersedes an in-flight cutoff');
  assert.equal(slots.finish(cutoff), false);
  assert.throws(() => slots.begin('cutoff'), /still loading/);
  assert.equal(slots.finish(neutral, 'neutral'), true);
  assert.deepEqual([slots.mode, slots.loading], ['neutral', false]);
  assert.throws(() => slots.begin('cutoff'), /Switch to Textured/);
  const stale = slots.begin('material'), latest = slots.begin('material');
  assert.equal(slots.finish(stale, 'textured'), false);
  assert.deepEqual([slots.mode, slots.loading], ['neutral', true], 'a stale writer neither commits nor clears loading');
  assert.equal(slots.finish(latest, 'textured'), true);
  assert.equal(slots.current(slots.begin('cutoff')), true);
  const pending = slots.begin('material'); slots.reset();
  assert.deepEqual([slots.current(pending), slots.mode, slots.loading], [false, 'textured', false]);
});

test('replaced slots resynchronize star support with the displayed selection', () => {
  const calls: [CloudDensityFilter, readonly string[]][] = [];
  const filter = resyncCloudSupport({ setCloudSupport: (value, ids) => calls.push([value, ids]) }, { selection: () => ['all-light'] });
  assert.deepEqual(filter, unfilteredCloud());
  assert.deepEqual(calls, [[unfilteredCloud(), ['all-light']]]);
  assert.deepEqual(resyncCloudSupport(null, { selection: () => [] }), unfilteredCloud());
});

test('the viewer routes every texture writer through the shared slots and resyncs stars on commit', () => {
  const source = readFileSync('labs/nebula/packages/lab/src/features/legacy-viewer/controller.ts', 'utf8');
  assert.match(source, /token = slots\.begin\('cutoff'\)/);
  assert.match(source, /const token = slots\.begin\('material'\)/);
  assert.match(source, /slots\.finish\(token, mode\)\) \{[^}]*cloudFilter = resyncCloudSupport\(starLayer, cloud\)/);
  assert.match(source, /slots\.finish\(token, 'textured'\)\) return;\s*subject = next; cloud = nextCloud;[^\n]*\n\s*cloudFilter = resyncCloudSupport\(starLayer, cloud\);/);
  assert.match(source, /swapToken = materialOnly \? slots\.begin\('material'\) : \(slots\.reset\(\), 0\)/);
});
