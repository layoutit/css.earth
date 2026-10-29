import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bankSpec, planeLayout, writeGalaxyModelBank, type GalaxyPlane } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { compileFiniteBank } from './compile.mts';
import { json } from '../inputs.mts';
import { KPC_M } from '../delivery/delivery-frame.mts';

test('parsec-scale prepared leaves retain their physical extent instead of expanding by the CSS edge guard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lmc-small-geometry-')) + '/';
  try {
    const spec = bankSpec({ box: { min: [-.9, -.16, .02], max: [-.893, -.152, .029] }, counts: [3, 3, 2], hybrid: { densePerAxis: [1, 1, 1] }, size: 128, record: 'fixture', texturePrefix: 'small-fixture' }), planes: GalaxyPlane[] = [];
    for (const axis of [0, 1, 2] as const) for (let index = 0; index < spec.counts[axis]; index++) { const p = planeLayout(spec, axis, index); planes.push({ ...p, rgb: new Float64Array(p.width * p.height * 3), tau: new Float64Array(p.width * p.height) }); }
    await writeGalaxyModelBank(directory, spec, planes, [0, 1, 2].map(() => ({ rgb: [1, 1, 1], gamma: 1, dust: 1 })));
    const volume = compileFiniteBank(await json(directory + 'prototype.json'), directory, { record: 'fixture', texturePrefix: 'small-fixture' });
    assert.equal(volume.frame.metersPerUnit, KPC_M);
    for (const stack of volume.stacks) for (const leaf of stack.leaves) {
      const axis = ['x', 'y', 'z'].indexOf(stack.axis), h = axis === 0 ? 1 : 0, v = axis === 2 ? 1 : 2, p = planeLayout(spec, axis === 0 ? 0 : axis === 1 ? 1 : 2, 0), extents = leaf.boundsCssPixels!.max.map((n, a) => n - leaf.boundsCssPixels!.min[a]!);
      const physicalH = (spec.box.max[h]! - spec.box.min[h]!) * (1 + 6 / p.width) * 50, physicalV = (spec.box.max[v]! - spec.box.min[v]!) * (1 + 6 / p.height) * 50;
      const expected = axis === 0 ? [physicalH, 0, physicalV] : axis === 1 ? [0, physicalH, physicalV] : [physicalV, physicalH, 0];
      for (let a = 0; a < 3; a++) assert.ok(Math.abs(extents[a]! - expected[a]!) < .005, 'The compiled image must preserve the finite object physical scale');
      const center = [leaf.centerUnits[1] * 50, leaf.centerUnits[0] * 50, leaf.centerUnits[2] * 50];
      for (let a = 0; a < 3; a++) assert.ok(Math.abs((leaf.boundsCssPixels!.min[a]! + leaf.boundsCssPixels!.max[a]!) / 2 - center[a]!) < .005, 'The compiled image must preserve the physical offset as well as the size');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
