import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { readObservation } from '../../../../tools/objects/terrestrial-layers/solid-raster.mjs';
const root = new URL('../../../../src/planets/ophelia/source/', import.meta.url);

test('Ophelia source preserves the published prolate semiaxes in metres', async () => {
  // Karkoschka2001 Table IV adopts A=27, B=19 km; the second B is an assumption.
  const config = JSON.parse(await readFile(new URL('preparation/terrestrial.json', root)));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  for (const [lon, lat, metres] of [[0,0,27000],[90,0,19000],[180,0,27000],[270,0,19000],[0,90,19000],[0,-90,19000]]) {
    assert.ok(Math.abs(shape.sample(lon, lat) - metres) < 0.001, `${lon},${lat}`);
  }
});

test('Ophelia shape model has no invented observed texels', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  const config = JSON.parse(await readFile(new URL('preparation/terrestrial.json', root)));
  const entry = manifest.inputs.find(input => input.id === 'model-surface');
  const observation = await readObservation(root.pathname, entry, config.raster.observations[0].validity, 512, 256);
  assert.equal(observation.missing.length, 512 * 256);
  assert.ok(observation.missing.every(value => value === 1));
});
