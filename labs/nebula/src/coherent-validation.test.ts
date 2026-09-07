import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoherentVolumeSampler } from './coherent-volume.js';
import { validateCoherentColumns, validateCoherentAxisSampling } from './coherent-validation.js';

const bounds = { min: [0, 0, -.5] as [number, number, number], max: [1, 1, .5] as [number, number, number] };
const rgba = new Uint8Array([128, 64, 32, 255]);
const make = (half: number) => createCoherentVolumeSampler({ target: { width: 1, height: 1, rgba },
  boundsKpc: bounds, catalog: [], baseHalfThicknessKpc: half, structureHalfThicknessKpc: half });

test('the real source-column gate rejects unresolved thin emission and admits converged integration', () => {
  const common = { sampler: make(.003), rgba, width: 1, height: 1, bounds, exposureGain: 1, maxDisplaySignal: .98 };
  assert.throws(() => validateCoherentColumns({ ...common, samples: 16 }), /undersampled|loses source/);
  const result = validateCoherentColumns({ ...common, samples: 4096 });
  assert.ok(result.maximumDisplayChannelError[0]! < .002);
});

test('axis validation detects aliasing that a converged front column would not catch', () => {
  const sampler = { ...make(.4), sample(x: number, _y: number, _z: number, out: [number, number, number]) {
    out[0] = 1 + Math.cos(Math.PI * 32 * x); out[1] = out[2] = 0;
  } };
  assert.throws(() => validateCoherentAxisSampling({ sampler, bounds,
    samples: { x: 16, y: 16, z: 16 }, exposureGain: 1 }), /x quadrature/);
});
