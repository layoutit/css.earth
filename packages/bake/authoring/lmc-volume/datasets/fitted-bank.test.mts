import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bankSpec,
  planeLayout,
  encodeGalaxyPlane,
  writeGalaxyModelBank,
  hybridGalaxyPlanes,
  type GalaxyBankSpec,
} from './fitted-bank.mts';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
const IDENTITY_BANK_FIT = { rgb: [1, 1, 1] as [number, number, number], gamma: 1, dust: 1 };
const spec: GalaxyBankSpec = {
  box: { min: [-1, -1, -1], max: [1, 1, 1] },
  counts: [13, 13, 7],
  size: 16,
  record: 'fixture',
  texturePrefix: 'test-slices',
};
test('opt-in galaxy banks keep the 33-layer budget and uniform physical interval anchors', () => {
  assert.equal(bankSpec(spec), spec);
  assert.ok(Math.abs(planeLayout(spec, 2, 3).center) < 1e-15);
  assert.throws(() => bankSpec({ ...spec, counts: [14, 13, 7] }));
  assert.throws(() => bankSpec({ ...spec, texturePrefix: '../outside' }));
});
test('26 physical intervals expand to exactly 33 validated hybrid optical layers', async () => {
  const directory = (await mkdtemp(join(tmpdir(), 'galaxy-hybrid-'))) + '/',
    plan: GalaxyBankSpec = { ...spec, counts: [10, 9, 7], hybrid: { densePerAxis: [2, 2, 3] } },
    frame = {
      referenceFrame: 'fixture',
      epochJdTt: 123,
      originM: [0, 0, 0],
      localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1,
    };
  try {
    const planes = ([0, 1, 2] as const).flatMap(axis =>
        Array.from({ length: plan.counts[axis] }, (_, index) => ({
          ...planeLayout(plan, axis, index),
          rgb: new Float64Array(16 * 16 * 3).fill(0.1 + index / 100),
          tau: new Float64Array(16 * 16),
        })),
      ),
      dense = new Set(['0:0', '0:1', '1:0', '1:1', '2:0', '2:1', '2:2']),
      fits = [IDENTITY_BANK_FIT, IDENTITY_BANK_FIT, IDENTITY_BANK_FIT];
    assert.equal(dense.size, 7);
    assert.equal(hybridGalaxyPlanes(planes, fits, dense).length, 33);
    const data = await writeGalaxyModelBank(directory, plan, planes, fits, dense),
      volume = compileGalaxySliceVolume(data, frame, directory, 'fixture', {
        record: plan.record,
        texturePrefix: plan.texturePrefix,
      });
    assert.equal(volume.stacks.flatMap(s => s.leaves).length, 33);
    assert.equal(volume.stacks.flatMap(s => s.leaves).filter(l => l.opticalSlab?.role === 'single').length, 7);
    assert.throws(() => bankSpec({ ...plan, hybrid: { densePerAxis: [3, 2, 3] } }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('the shared compiler admits another model only through its explicit binding and keeps three merged copies', async () => {
  const directory = (await mkdtemp(join(tmpdir(), 'galaxy-model-'))) + '/',
    tiny = { ...spec, counts: [1, 1, 1] as [number, number, number] },
    frame = {
      referenceFrame: 'sun-icrf',
      epochJdTt: 2451545,
      originM: [0, 0, 0],
      localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1,
    };
  try {
    const planes = ([0, 1, 2] as const).map(axis => ({
        ...planeLayout(tiny, axis, 0),
        rgb: new Float64Array(16 * 16 * 3).fill(0.1),
        tau: new Float64Array(16 * 16),
      })),
      data = await writeGalaxyModelBank(directory, tiny, planes, [
        IDENTITY_BANK_FIT,
        IDENTITY_BANK_FIT,
        IDENTITY_BANK_FIT,
      ]);
    assert.throws(() => compileGalaxySliceVolume(data, frame, directory, 'fixture'));
    const volume = compileGalaxySliceVolume(data, frame, directory, 'fixture', {
      record: tiny.record,
      texturePrefix: tiny.texturePrefix,
    });
    assert.equal(volume.mergedOpticalCopies, 3);
    assert.equal(volume.stacks.flatMap(s => s.leaves).length, 3);
    assert.ok(volume.resources.every(r => r.path.startsWith('test-slices/')));
    assert.equal(volume.frame.metersPerUnit, 1000);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
