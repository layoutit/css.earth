import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { readObservation } from '../../../../tools/objects/terrestrial-layers/solid-raster.mjs';
const root = new URL('../../../../src/planets/styx/source/', import.meta.url);

test('Styx source radii preserve the 2025 ellipsoid semi-axes in metres', async () => {
  // Porter et al. 2025 presentation slide 9: full axes 10.6 × 6.0 × 5.3 km.
  const config = JSON.parse(await readFile(new URL('preparation/terrestrial.json', root)));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  for (const [lon, lat, metres] of [[0,0,5300],[90,0,3000],[180,0,5300],[270,0,3000],[0,90,2650],[0,-90,2650]]) {
    assert.ok(Math.abs(shape.sample(lon, lat) - metres) < 0.001, `${lon},${lat}`);
  }
});

test('Styx shape-only source contains no fabricated observed texels', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  const config = JSON.parse(await readFile(new URL('preparation/terrestrial.json', root)));
  const entry = manifest.inputs.find(input => input.id === 'model-surface');
  const observation = await readObservation(root.pathname, entry, config.raster.observations[0].validity, 512, 256);
  assert.equal(observation.missing.length, 512 * 256);
  assert.ok(observation.missing.every(value => value === 1));
});
