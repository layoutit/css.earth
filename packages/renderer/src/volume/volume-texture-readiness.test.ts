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

test('images nothing drew for a while are decoded again, after the missing ones, before the bank is ready', async () => {
  const { gate, loads, publish, finish } = fixture();
  gate.ready(['/z.webp']); await finish();
  assert.equal(gate.ready(['/z.webp']), true);
  // The bank leaves layout, is kept resident there, and comes back asking for two more images.
  gate.undrawn();
  assert.equal(gate.ready(['/z.webp'], false), true, 'kept resident, it is ready on what it has decoded');
  assert.deepEqual(loads, ['/z.webp'], 'and nothing is decoded again until it is asked on screen');
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), false);
  assert.deepEqual(loads, ['/z.webp', '/x.webp'], 'the missing images first');
  await finish();
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), false);
  await finish();
  assert.deepEqual(loads, ['/z.webp', '/x.webp', '/y.webp']);
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), false, 'not ready on an image that may have lost its pixels');
  assert.deepEqual(loads, ['/z.webp', '/x.webp', '/y.webp', '/z.webp'], 'decoded again last, once');
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), false);
  assert.equal(loads.length, 4);
  const published = publish.mock.callCount();
  await finish();
  assert.equal(publish.mock.callCount(), published + 1, 'the bank is told when the pixels are back');
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), true);
  assert.equal(gate.ready(['/z.webp', '/x.webp', '/y.webp']), true);
  assert.equal(loads.length, 4, 'an image drawn since is not decoded again');
  gate.destroy();
});
