import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readDaf } from './daf.js';
import { spkSegments } from './spk.js';

/** Build a one-segment SPK DAF of a given type from a data word list. */
function spk(type: number, data: number[], { start = 0, stop = 100, target = -999, center = 0, frame = 1 } = {}) {
  const records = 3 + Math.ceil(data.length / 128), out = new Uint8Array(records * 1024), view = new DataView(out.buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i); };
  write(0, 'DAF/SPK '); view.setInt32(8, 2, true); view.setInt32(12, 6, true); write(16, 'test'.padEnd(60)); view.setInt32(76, 2, true); view.setInt32(80, 2, true); write(88, 'LTL-IEEE');
  const base = 1024; view.setFloat64(base, 0, true); view.setFloat64(base + 8, 0, true); view.setFloat64(base + 16, 1, true);
  const first = 3 * 128 + 1;
  view.setFloat64(base + 24, start, true); view.setFloat64(base + 32, stop, true);
  [target, center, frame, type, first, first + data.length - 1].forEach((value, i) => view.setInt32(base + 40 + i * 4, value, true));
  write(2048, 'segment'.padEnd(40));
  data.forEach((value, i) => view.setFloat64((first - 1 + i) * 8, value, true));
  return spkSegments(readDaf(out))[0];
}

test('type 2 Chebyshev records reproduce a cubic trajectory and its derivative', () => {
  // x = 3 + 2 T1 + T3 on s in [-1,1] over two 10 s records; T-basis coefficients [3,2,0,1]; y,z constants.
  const record = (mid: number) => [mid, 5, 3, 2, 0, 1, 7, 0, 0, 0, -1, 0, 0, 0];
  const segment = spk(2, [...record(5), ...record(15), 0, 10, 14, 2]);
  const at = (et: number) => { const s = ((et % 10) - 5) / 5; return { x: 3 + 2 * s + (4 * s ** 3 - 3 * s), dx: (2 + 12 * s ** 2 - 3) / 5 }; };
  for (const et of [1.25, 5, 9.9, 12.5, 17]) {
    const { position, velocity } = segment.state(et), expected = at(et);
    assert.ok(Math.abs(position[0] - expected.x) < 1e-12 && position[1] === 7 && position[2] === -1, `position at ${et}`);
    assert.ok(Math.abs(velocity[0] - expected.dx) < 1e-12 && velocity[1] === 0, `velocity at ${et}`);
  }
  assert.throws(() => spk(21, [0, 0, 0, 0]), /Unsupported SPK segment type 21/);
});

test('type 3 records carry velocity coefficients directly', () => {
  const record = [5, 5, 1, 0, 2, 0, 3, 0, 0.5, 0, 0.25, 0, 0, 0];
  const { position, velocity } = spk(3, [...record, 0, 10, 14, 1]).state(7.5);
  assert.deepEqual(position, [1, 2, 3]); assert.deepEqual(velocity, [0.5 + 0 * 0.5, 0.25, 0]);
});

test('type 9 Lagrange and type 13 Hermite windows interpolate discrete states exactly for polynomials', () => {
  const epochs = [0, 1, 2.5, 4, 5, 7, 8], f = (t: number) => ({ x: t * t, vx: 2 * t });
  const states = epochs.flatMap(t => [f(t).x, 10, 20, f(t).vx, 0, 0]);
  const nine = spk(9, [...states, ...epochs, 3, epochs.length]); // degree 3: four-point Lagrange reproduces a quadratic
  for (const et of [0.5, 3.1, 6.9]) { const state = nine.state(et); assert.ok(Math.abs(state.position[0] - et * et) < 1e-10); assert.ok(Math.abs(state.velocity[0] - 2 * et) < 1e-10); }
  const thirteen = spk(13, [...states, ...epochs, 3, epochs.length]); // degree 3: two nodes with derivatives
  for (const et of [0.5, 3.1, 6.9]) { const state = thirteen.state(et); assert.ok(Math.abs(state.position[0] - et * et) < 1e-10, `hermite ${et}`); assert.ok(Math.abs(state.velocity[0] - 2 * et) < 1e-10); assert.equal(state.position[1], 10); }
  assert.throws(() => thirteen.state(9), /outside/);
});

test('type 5 segments propagate a circular orbit exactly between and beyond stored states', () => {
  const gm = 398600.4418, radius = 7000, speed = Math.sqrt(gm / radius), period = 2 * Math.PI * radius / speed;
  const at = (t: number) => { const a = speed / radius * t; return [radius * Math.cos(a), radius * Math.sin(a), 0, -speed * Math.sin(a), speed * Math.cos(a), 0]; };
  const epochs = [0, period / 4, period / 2];
  const segment = spk(5, [...epochs.flatMap(at), ...epochs, gm, epochs.length], { start: 0, stop: period });
  for (const t of [period / 8, period / 3, period * 0.45, period / 2 + 100]) {
    const { position, velocity } = segment.state(t), expected = at(t);
    assert.ok(Math.hypot(position[0] - expected[0], position[1] - expected[1], position[2] - expected[2]) < 1e-6, `position at ${t}`);
    assert.ok(Math.hypot(velocity[0] - expected[3], velocity[1] - expected[4], velocity[2] - expected[5]) < 1e-9, `velocity at ${t}`);
  }
});

test('type 8 equally spaced states interpolate a polynomial trajectory', () => {
  const start = 100, step = 2.5, count = 9, f = (t: number) => [t * t - 3 * t, 1, 2, 2 * t - 3, 0, 0];
  const states = Array.from({ length: count }, (_, i) => f(start + i * step)).flat();
  const segment = spk(8, [...states, start, step, 3, count], { start: 100, stop: 120 });
  for (const t of [100.1, 107.3, 113.9, 119.9]) { const s = segment.state(t); assert.ok(Math.abs(s.position[0] - (t * t - 3 * t)) < 1e-9, `type 8 position at ${t}`); assert.ok(Math.abs(s.velocity[0] - (2 * t - 3)) < 1e-9); }
});
