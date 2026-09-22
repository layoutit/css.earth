import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedPlanetStateRelativeKm } from '@cssearth/astronomy';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireBodyFixedToIcrf, requireBodyOrbit } from '../../../../src/platform/solar-geometry.mts';
import { requireArray, requireRecord } from '../../../../tools/sources/source-values.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/hd-189733b/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;

test('HD 189733b pins the deposited map file unchanged and reads its temperature and times in place', async () => {
  const source = await createSourceManifest({ planetId: 'hd-189733b', planetName: 'HD 189733b', sourceRoot: root });
  await source.verify();
  const deposit = source.manifest.inputs.find(input => input.path === 'science/lally-2025/output_E.npy');
  assert.ok(deposit, 'the deposit is a declared input');
  const plan = requireRecord(await read('preparation/acquisition.json'));
  assert.ok(requireArray(plan.operations).some(operation => requireRecord(operation).url === 'https://zenodo.org/api/records/15103479/files/output_E.npy/content'));
  const surfaces = requireArray(requireRecord(await read('preparation/raster.json')).surfaces).map(value => requireRecord(value));
  assert.equal(surfaces.length, 1);
  const science = requireRecord(surfaces[0]!.science);
  assert.deepEqual([science.format, science.values, science.gridLayout, science.visibleLongitudes, science.units], ['npy-dictionary-map', ['tmap'], 'pixel-centres', { times: ['time'], planet: 'hd-189733b' }, 'K']);
});

test('radius and orbit are the deposited configuration\'s, and the rotation keeps longitude 0 on the host', async () => {
  // hd189-eureka-spitzer+MIRI-share.cfg: planet r 0.116795376, star r 0.752 solar radii, a 0.030994811518716577 au.
  assert.ok(Math.abs(BODIES['hd-189733b'].meanRadiusKm / BODIES['hd-189733'].meanRadiusKm - 0.116795376 / 0.752) < 1e-12);
  const rotation = requireRecord(await read('preparation/rotation.json'));
  assert.deepEqual([rotation.schema, rotation.host], ['cssearth-synchronous-rotation@1', 'hd-189733']);
  const m = requireBodyFixedToIcrf('hd-189733b'), state = hostedPlanetStateRelativeKm('hd-189733b', 2461286.5), distance = Math.hypot(...state.positionKm);
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(m[axis * 3]! + state.positionKm[axis]! / distance) < 1e-9, 'body +X faces the host star');
  assert.ok(Math.abs(distance / 149597870.7 - 0.030994811518716577) < 1e-12, 'the planet is 0.030995 au from its star');
  const orbit = requireBodyOrbit('hd-189733b');
  assert.equal(orbit.centerBodyId, 'hd-189733');
});
