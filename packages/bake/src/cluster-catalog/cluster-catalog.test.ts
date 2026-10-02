import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePreparedClusterCatalog } from '@cssearth/objects';
import { comovingDistanceMpc } from './prepare.ts';

const directory = resolve('src/objects/galaxy-clusters');

test('redshift integration agrees with analytic matter-only and Lambda-only distances, not linear cz/H0', () => {
  const z = .3, hubble = 70, scale = 299792.458 / hubble;
  assert.ok(Math.abs(comovingDistanceMpc(z, hubble, 0) - scale * z) < 1e-9);
  assert.ok(Math.abs(comovingDistanceMpc(z, hubble, 1) - 2 * scale * (1 - 1 / Math.sqrt(1 + z))) < 1e-9);
  assert.ok(comovingDistanceMpc(z, hubble, .3) < scale * z * .95);
});

test('cluster validation rejects missing evidence, invalid apertures and ambiguous focus identities', async () => {
  const data = JSON.parse(await readFile(resolve(directory, 'prepared/catalogue.json'), 'utf8'));
  for (const change of [
    (d: typeof data) => { d.objects[0].aperture.properRadiusM = -1; },
    (d: typeof data) => { d.objects[0].positionM[2] = NaN; },
    (d: typeof data) => { d.objects[0].distance.sourceRef = 'unavailable'; },
    (d: typeof data) => { d.objects[1].id = d.objects[0].id; },
    (d: typeof data) => { d.cosmology.omegaMatter = 2; },
  ]) { const bad = structuredClone(data); change(bad); assert.throws(() => parsePreparedClusterCatalog(bad)); }
});
