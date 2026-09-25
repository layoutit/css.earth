import assert from 'node:assert/strict';
import test from 'node:test';
import { readOverlaySessions, writeOverlaySessions, resolveSavedPlacement, type SavedOverlay } from './overlay-store.js';
import { defaultOverlayPlacement, type OverlayPlacement } from '@cssearth/bake/volume';

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

test('corrected alignment replaces an untouched old default without erasing manual fits', () => {
  const identity = defaultOverlayPlacement();
  assert.deepEqual(resolveSavedPlacement(identity, undefined, placement), placement);
  const adjusted = { ...identity, rotationZ: 12, scale: 2.5 };
  assert.deepEqual(resolveSavedPlacement(adjusted, undefined, placement), adjusted);
  // Choosing the unadjusted sky view after the correction remains an intentional choice on reload.
  const storage = new MemoryStorage();
  writeOverlaySessions(new Map([['candidates', [{ ...saved('image', 'basis'), placement: identity, defaultPlacement: placement }]]]), storage);
  const restored = readOverlaySessions(storage).get('candidates')![0]!;
  assert.deepEqual(resolveSavedPlacement(restored.placement, restored.defaultPlacement, placement), identity);
});

test('historical catalogue locations keep saved alignment after model folders move', () => {
  const storage = new MemoryStorage();
  storage.setItem(KEY, JSON.stringify({ schema: 'cssearth-nebula-overlay-state@1', catalogues: [
    ['labs/nebula/models/lmc-candidates/overlays.json', [{ id: 'vista-infrared', enabled: true, opacity: .7,
      placement: defaultOverlayPlacement(), basis: 'saved-basis' }]],
  ] }));
  const sessions = readOverlaySessions(storage);
  assert.equal(sessions.get('labs/nebula/models/lmc/candidates/overlays.json')?.[0]?.id, 'vista-infrared');
  assert.equal(sessions.get('labs/nebula/models/lmc/candidates/overlays.json')?.[0]?.basis, 'saved-basis');
});
