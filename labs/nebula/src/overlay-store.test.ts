import assert from 'node:assert/strict';
import test from 'node:test';
import { readOverlaySessions, writeOverlaySessions, type SavedOverlay } from './overlay-store.js';
import type { OverlayPlacement } from './overlay-placement.js';

const KEY = 'cssearth-nebula-overlay-state-v1';
class MemoryStorage {
  value: string | null = null;
  getItem(_key: string) { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}
const placement: OverlayPlacement = { x: -1.2, y: -1.7, z: 0,
  rotationX: 7, rotationY: -3, rotationZ: 39, scale: 3 };
const saved = (id: string, basis: string): SavedOverlay => ({ id, basis, enabled: true, opacity: .29, placement: { ...placement } });

test('saved overlay state round-trips independently for each catalogue', () => {
  const storage = new MemoryStorage(), sessions = new Map([
    ['catalogue/lmc.json', [saved('smash', 'lmc-basis')]],
    ['catalogue/smc.json', [{ ...saved('vista', 'smc-basis'), enabled: false, opacity: .61 }]],
  ]);
  assert.equal(writeOverlaySessions(sessions, storage), true);
  assert.deepEqual(readOverlaySessions(storage), sessions);
  const envelope = JSON.parse(storage.value!);
  assert.equal(envelope.schema, 'cssearth-nebula-overlay-state@1');
  assert.ok(storage.value!.includes('catalogue/lmc.json'));
});

test('bad records and missing placement properties are isolated from valid saved images', () => {
  const storage = new MemoryStorage(), valid = saved('valid', 'basis');
  const missing = (key: keyof OverlayPlacement) => {
    const row = structuredClone(valid); delete (row.placement as Partial<OverlayPlacement>)[key]; return row;
  };
  const malformed = (Object.keys(placement) as (keyof OverlayPlacement)[]).map(missing);
  storage.setItem(KEY, JSON.stringify({ schema: 'cssearth-nebula-overlay-state@1', catalogues: [
    ['catalogue.json', [malformed[0], valid, ...malformed.slice(1), { ...valid, id: 'bad-opacity', opacity: 2 }]],
    [17, [valid]],
    ['second.json', [saved('second', 'other-basis')]],
  ] }));
  const restored = readOverlaySessions(storage);
  assert.deepEqual(restored.get('catalogue.json'), [valid]);
  assert.deepEqual(restored.get('second.json'), [saved('second', 'other-basis')]);
  assert.equal(restored.has('17'), false);
});

test('denied reads and quota-failed writes degrade safely', () => {
  const denied = { getItem(): string | null { throw new Error('denied'); }, setItem(): void { throw new Error('quota'); } };
  assert.deepEqual(readOverlaySessions(denied), new Map());
  assert.equal(writeOverlaySessions(new Map([['catalogue.json', [saved('image', 'basis')]]]), denied), false);
  assert.equal(writeOverlaySessions(new Map(), undefined), false);
});
