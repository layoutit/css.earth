import { expect, test, vi } from 'vitest';
import { createVolumeTextureReadiness } from './volume-texture-readiness.js';

function fixture() {
  const loads: string[] = [], complete: (() => void)[] = [];
  const publish = vi.fn();
  const gate = createVolumeTextureReadiness(publish, () => ({ src: '', decoding: 'async', naturalWidth: 1, naturalHeight: 1,
    decode() { loads.push(this.src); return new Promise<void>(resolve => { complete.push(resolve); }); } }));
  const finish = async () => { complete.shift()!(); for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return { gate, loads, publish, finish };
}

test('replacement stays gated until its unique images decode, serially and once', async () => {
  const { gate, loads, publish, finish } = fixture();
  expect(gate.ready(['/a.webp', '/a.webp', '/b.webp'])).toBe(false);
  expect(loads).toEqual(['/a.webp']);
  await finish();
  expect(gate.ready(['/a.webp', '/b.webp'])).toBe(false);
  expect(loads).toEqual(['/a.webp', '/b.webp']);
  await finish();
  expect(gate.ready(['/a.webp', '/b.webp'])).toBe(true);
  expect(publish).toHaveBeenCalledTimes(2);
  expect(loads).toHaveLength(2);
  gate.destroy();
});

test('a cancelled decode cannot publish readiness for a changed view or a destroyed bank', async () => {
  const { gate, publish, finish, loads } = fixture();
  gate.ready(['/old.webp']);
  gate.ready(['/new.webp']);
  await finish();
  expect(publish).not.toHaveBeenCalled();
  expect(loads).toEqual(['/old.webp', '/new.webp']);
  expect(gate.ready(['/new.webp'])).toBe(false);
  gate.destroy(); await finish();
  expect(publish).not.toHaveBeenCalled();
  expect(gate.ready(['/new.webp'])).toBe(false);
});
