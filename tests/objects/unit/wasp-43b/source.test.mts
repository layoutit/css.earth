import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedPlanetStateRelativeKm } from '@cssearth/astronomy';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireBodyFixedToIcrf, requireBodyOrbit } from '../../../../src/platform/solar-geometry.mts';
import { requireArray, requireRecord } from '../../../../tools/sources/source-values.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;

test('WASP-43b pins its Zenodo deposit unchanged and reads the map from it', async () => {
  const source = await createSourceManifest({ planetId: 'wasp-43b', planetName: 'WASP-43b', sourceRoot: root });
  await source.verify();
  const deposit = source.manifest.inputs.find(input => input.path === 'science/challener-2024/wasp-43b.tar');
  assert.ok(deposit, 'the tar is a pinned input');
  assert.equal(deposit.expectedSha256, 'a2dc0004e40fad053933156237d8aeb5defaeee68ef6981f667f503b96731138');
  const plan = requireRecord(await read('preparation/acquisition.json'));
  assert.ok(requireArray(plan.operations).some(operation => requireRecord(operation).url === 'https://zenodo.org/api/records/12627524/files/wasp-43b.tar/content'));
  const surface = requireRecord(requireArray(requireRecord(await read('preparation/raster.json')).surfaces)[0]);
  const science = requireRecord(surface.science);
  assert.deepEqual([science.kind, science.format, science.member, science.units, surface.falseColor], ['terrestrial-scientific', 'npy-dictionary-map', 'wasp-43b/maps.npy', 'K', true]);
  assert.deepEqual(science.values, ['whitelight', 'tmap']);
});

test('the radius is the transit ratio times the host radius, and the rotation keeps longitude 0 on the host', async () => {
  assert.ok(Math.abs(BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm - 0.15883) < 1e-6);
  const rotation = requireRecord(await read('preparation/rotation.json'));
  assert.equal(rotation.schema, 'cssearth-synchronous-rotation@1');
  assert.equal(rotation.host, 'wasp-43');
  // At the scene epoch the prepared body frame's +X points from the planet to its host.
  const m = requireBodyFixedToIcrf('wasp-43b'), state = hostedPlanetStateRelativeKm('wasp-43b', 2461286.5), distance = Math.hypot(...state.positionKm);
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(m[axis * 3]! + state.positionKm[axis]! / distance) < 1e-9, 'body +X faces the host star');
  const orbit = requireBodyOrbit('wasp-43b');
  assert.equal(orbit.centerBodyId, 'wasp-43');
  // The orbit is circular by construction. The table's stellar mass is Kepler's law for a and P alone (0.6916 solar masses);
  // the osculating elements add the planet's GM (0.28 percent), so the circular speed reads as slightly sub-circular:
  // measured e = 0.0029 and a 0.28 percent short.
  assert.ok(orbit.eccentricity < 0.005, `near-circular osculating orbit: e = ${orbit.eccentricity}`);
  assert.ok(Math.abs(orbit.semiMajorAxisAu * 149597870.7 / (4.8767 * BODIES['wasp-43'].meanRadiusKm) - 1) < 0.005, 'a is 4.8767 stellar radii');
});
