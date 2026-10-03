import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSolarGeometry } from './load-solar-geometry.ts';

test('generated geometry is validated before a consumer can use its constants or body values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'solar-geometry-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/platform'), { recursive: true });
  await writeFile(join(root, 'src/platform/solar-geometry.mts'), `
    export const SOLAR_GEOMETRY_EPOCH_LABEL = 'fixture';
    export const SOLAR_GEOMETRY_EPOCH_JD_TT = 123;
    export const ASTRONOMICAL_UNIT_KILOMETERS = 149597870.7;
    export const requireBodyFixedSunDirection = () => [1, 0, NaN];
    export const requireBodyFixedEclipticNorth = () => [0, 0, 1];
    export const requireBodyFixedToIcrf = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
    export const bodyFixedStarDirection = () => null;
    export const requireBodyOrbit = () => ({ heliocentricDistanceAu: Infinity });
  `);
  const geometry = await loadSolarGeometry(root);
  assert.equal(geometry.SOLAR_GEOMETRY_EPOCH_JD_TT, 123);
  assert.deepEqual(geometry.requireBodyFixedEclipticNorth('fixture'), [0, 0, 1]);
  assert.equal(geometry.bodyFixedStarDirection('fixture'), null);
  assert.throws(() => geometry.requireBodyFixedSunDirection('fixture'), /must be finite/);
  assert.throws(() => geometry.requireBodyOrbit('fixture'), /must be finite/);
});

test('a generated module missing a required operation fails at the loading boundary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'solar-geometry-missing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/platform'), { recursive: true });
  await writeFile(join(root, 'src/platform/solar-geometry.mts'), 'export const SOLAR_GEOMETRY_EPOCH_JD_TT = 123;');
  await assert.rejects(loadSolarGeometry(root), /needs requireBodyFixedSunDirection/);
});
