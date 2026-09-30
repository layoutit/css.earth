import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createVolumeTextureReadiness } from './volume-texture-readiness.js';

function fixture() {
  const loads: string[] = [], complete: (() => void)[] = [];
  const publish = mock.fn(() => {});
  const gate = createVolumeTextureReadiness(publish, () => ({ src: '', decoding: 'async', naturalWidth: 1, naturalHeight: 1,
    decode() { loads.push(this.src); return new Promise<void>(resolve => { complete.push(resolve); }); } }));
  const finish = async () => { complete.shift()!(); for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return { gate, loads, publish, finish };
}

test('replacement stays gated until its unique images decode, serially and once', async () => {
  const { gate, loads, publish, finish } = fixture();
  assert.equal(gate.ready(['/a.webp', '/a.webp', '/b.webp']), false);
  assert.deepEqual(loads, ['/a.webp']);
  await finish();
  assert.equal(gate.ready(['/a.webp', '/b.webp']), false);
  assert.deepEqual(loads, ['/a.webp', '/b.webp']);
  await finish();
  assert.equal(gate.ready(['/a.webp', '/b.webp']), true);
  assert.equal(publish.mock.callCount(), 2);
  assert.equal(loads.length, 2);
  gate.destroy();
});

test('a cancelled decode cannot publish readiness for a changed view or a destroyed bank', async () => {
  const { gate, publish, finish, loads } = fixture();
  gate.ready(['/old.webp']);
  gate.ready(['/new.webp']);
  await finish();
  assert.equal(publish.mock.callCount(), 0);
  assert.deepEqual(loads, ['/old.webp', '/new.webp']);
  assert.equal(gate.ready(['/new.webp']), false);
  gate.destroy(); await finish();
  assert.equal(publish.mock.callCount(), 0);
  assert.equal(gate.ready(['/new.webp']), false);
});
