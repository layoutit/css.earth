import test from 'node:test';
import assert from 'node:assert/strict';
import { compilerSlabMaterial, alphaLimitedSlabMaterial } from '@cssearth/volume-core/materials/slab-material';

test('thin displaced emission takes its own image color rather than the empty slice center', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = x > .5 ? 2 : 0; },
    (x, _y, _z, out) => { out[0] = x > .5 ? 255 : 0; out[1] = 0; out[2] = x > .5 ? 0 : 255; return true; });
  assert.ok(sample(0, 0, 0, color, { axis: 'x', pitch: 4, samples: 4 }));
  assert.deepEqual(color, [255, 0, 0]);
});

test('constant source color stays constant through every bank and missing coverage stays explicit', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((_x, _y, _z, out) => { out[0] = out[1] = out[2] = 3; },
    (x, _y, _z, out) => { out[0] = 63.75; out[1] = 127.5; out[2] = 255; return x < 10; });
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(sample(0, 0, 0, color, { axis, pitch: 4, samples: 4 }));
    assert.deepEqual(color, [63.75, 127.5, 255]);
  }
  assert.equal(sample(20, 0, 0, color, { axis: 'z', pitch: 4, samples: 4 }), false);
});

test('weighted full-intensity channels remain inside the RGB transport range after floating-point division', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = Math.exp(-x * x / 3); },
    (_x, _y, _z, out) => { out[0] = 30; out[1] = 80; out[2] = 255; return true; });
  for (let i = 0; i < 200; i++) {
    assert.ok(sample(i / 37, 0, 0, color, { axis: 'x', pitch: 1.3, samples: 4 }));
    assert.ok(color.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255));
    assert.ok(color[2] > 254.999999999);
  }
});

test('XYZ slab materials sample identical emitting coordinates and preserve component mixtures', () => {
  for (const axis of ['x', 'y', 'z'] as const) {
    const coordinates: [number, number, number][] = [], sampled: [number, number, number][] = [], rgb: [number, number, number] = [0, 0, 0];
    const component = (x: number, y: number, z: number) => ({ x, y, z })[axis];
    const material = compilerSlabMaterial((x, y, z, out) => {
      coordinates.push([x, y, z]); out[0] = out[1] = out[2] = component(x, y, z) > 0 ? 3 : 1;
    }, (x, y, z, out) => {
      sampled.push([x, y, z]); out[0] = component(x, y, z) > 0 ? 0 : 255; out[1] = 0; out[2] = component(x, y, z) > 0 ? 255 : 0; return true;
    });
    assert.equal(material(0, 0, 0, rgb, { axis, pitch: 4, samples: 4 }), true);
    assert.deepEqual(sampled, coordinates); assert.deepEqual(rgb, [63.75, 0, 191.25]);
  }
  const rgb: [number, number, number] = [0, 0, 0];
  const mixture = compilerSlabMaterial((_x, _y, _z, out) => { out[0] = out[1] = out[2] = 1; },
    (_x, _y, _z, out) => { out[0] = out[2] = 127.5; out[1] = 0; return true; });
  assert.ok(mixture(0, 0, 0, rgb, { axis: 'z', pitch: 1, samples: 4 }));
  assert.deepEqual(rgb, [127.5, 0, 127.5], 'Mixed components must not be normalized back to twice their emission.');
});

test('alpha-limited slab material keeps chroma in dense slabs and neutralizes thin ones', () => {
  const orange = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = 255; out[1] = 128; out[2] = 0; return true; };
  const slab = { axis: 'z' as const, pitch: 1, samples: 4 }, out: [number, number, number] = [0, 0, 0];
  const dense = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = 2; };
  const thin = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = .001; };
  assert.ok(alphaLimitedSlabMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24)(0, 0, 0, out, slab));
  assert.deepEqual(out.map(Math.round), [255, 128, 0]);
  assert.ok(alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24)(0, 0, 0, out, slab));
  assert.ok(out[2] > 240 && out[1] > 245, `thin slab stays near neutral: ${out}`);
  assert.throws(() => alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 0, 24));
});
