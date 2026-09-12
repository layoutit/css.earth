import test from 'node:test';
import assert from 'node:assert/strict';
import { compilerSlabMaterial } from './material';

test('thin displaced emission takes its own image color rather than the empty slice center', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = x > .5 ? 2 : 0; },
    (x, _y, out) => { out[0] = x > .5 ? 255 : 0; out[1] = 0; out[2] = x > .5 ? 0 : 255; return true; });
  assert.ok(sample(0, 0, 0, color, { axis: 'x', pitch: 4, samples: 4 }));
  assert.deepEqual(color, [255, 0, 0]);
});

test('constant source color stays constant through every bank and missing coverage stays explicit', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((_x, _y, _z, out) => { out[0] = out[1] = out[2] = 3; },
    (x, _y, out) => { out[0] = 60; out[1] = 120; out[2] = 240; return x < 10; });
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(sample(0, 0, 0, color, { axis, pitch: 4, samples: 4 }));
    assert.deepEqual(color, [63.75, 127.5, 255]);
  }
  assert.equal(sample(20, 0, 0, color, { axis: 'z', pitch: 4, samples: 4 }), false);
});

test('weighted full-intensity channels remain inside the RGB transport range after floating-point division', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = Math.exp(-x * x / 3); },
    (_x, _y, out) => { out[0] = 30; out[1] = 80; out[2] = 255; return true; });
  for (let i = 0; i < 200; i++) {
    assert.ok(sample(i / 37, 0, 0, color, { axis: 'x', pitch: 1.3, samples: 4 }));
    assert.ok(color.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255));
    assert.ok(color[2] > 254.999999999);
  }
});
